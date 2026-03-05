import readline from "node:readline/promises";
import path from "node:path";
import chalk from "chalk";
import cliProgress from "cli-progress";
import {
  fetchPlaylistInfo,
  downloadTrack,
  ensureOutputDir,
  ALLOWED_BROWSERS,
} from "./services/downloader.js";

// --- Interactive prompts ---

const OUTPUT_DEFAULT = "./downloads";

const BROWSER_CHOICES = [
  { key: "0", label: "None (public playlist)", value: null },
  ...ALLOWED_BROWSERS.map((b, i) => ({ key: String(i + 1), label: b, value: b })),
];

async function prompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log(chalk.bold.cyan("  playlist-downloader"));
  console.log("");

  const url = await askRequired(rl, `  ${chalk.yellow("Playlist URL:")} `);

  console.log("");
  console.log(`  ${chalk.yellow("Browser cookies")} ${chalk.dim("(for private playlists)")}`);
  for (const { key, label } of BROWSER_CHOICES) {
    console.log(chalk.dim(`    ${key}) `) + label);
  }
  const browserChoice = await askChoice(rl, `  ${chalk.yellow("Choice")} ${chalk.dim(`[0]`)}: `, BROWSER_CHOICES);

  console.log("");
  const outputRaw = await rl.question(`  ${chalk.yellow("Output directory")} ${chalk.dim(`[${OUTPUT_DEFAULT}]`)}: `);
  const outputBase = outputRaw.trim() || OUTPUT_DEFAULT;

  rl.close();

  return { url, browser: browserChoice, outputBase };
}

async function askRequired(rl, message) {
  let value = "";
  while (!value) {
    value = (await rl.question(message)).trim();
    if (!value) {
      console.log(chalk.red("    This field is required."));
    }
  }
  return value;
}

async function askChoice(rl, message, choices) {
  const validKeys = choices.map((c) => c.key);
  while (true) {
    const input = (await rl.question(message)).trim();
    if (!input) return choices[0].value;
    const match = choices.find((c) => c.key === input || c.label.toLowerCase() === input.toLowerCase());
    if (match) return match.value;
    console.log(chalk.red(`    Please enter one of: ${validKeys.join(", ")}`));
  }
}

const { url, browser, outputBase } = await prompt();

// --- Helpers ---

function formatDuration(seconds) {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// --- Main ---

let currentProc = null;

process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\n  Interrupted. Cleaning up..."));
  if (currentProc) {
    currentProc.kill();
  }
  process.exit(130);
});

async function main() {
  console.log("");
  console.log(chalk.cyan.bold("  Fetching playlist info..."));

  let playlistTitle, tracks;
  try {
    ({ playlistTitle, tracks } = await fetchPlaylistInfo(url, { browser }));
  } catch (err) {
    console.error(chalk.red(`\n  Failed to fetch playlist: ${err.message}`));
    process.exit(1);
  }

  const totalTracks = tracks.length;

  console.log("");
  console.log(chalk.white.bold(`  ${playlistTitle}`));
  console.log(chalk.dim(`  ${totalTracks} tracks`));
  console.log("");

  const outputDir = await ensureOutputDir(path.join(outputBase, playlistTitle));

  const BAR_COMPLETE_CHAR = "\u2588";
  const BAR_INCOMPLETE_CHAR = "\u2591";

  const multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      linewrap: false,
      barsize: 30,
      barCompleteChar: BAR_COMPLETE_CHAR,
      barIncompleteChar: BAR_INCOMPLETE_CHAR,
    },
    cliProgress.Presets.shades_grey,
  );

  const trackBar = multibar.create(100, 0, { label: "", pct: "" });
  trackBar.formatter = (options, params, payload) => {
    const filled = Math.round(params.progress * options.barsize);
    const empty = options.barsize - filled;
    const bar = chalk.magenta(BAR_COMPLETE_CHAR.repeat(filled)) + chalk.dim(BAR_INCOMPLETE_CHAR.repeat(empty));
    const pct = payload.pct ? chalk.magenta.bold(payload.pct) : "";
    return `  ${bar} ${pct}  ${chalk.white(payload.label)}`;
  };

  const overallBar = multibar.create(totalTracks, 0, { label: "" });
  overallBar.formatter = (options, params, payload) => {
    const filled = Math.round(params.progress * options.barsize);
    const empty = options.barsize - filled;
    const bar = chalk.cyan(BAR_COMPLETE_CHAR.repeat(filled)) + chalk.dim(BAR_INCOMPLETE_CHAR.repeat(empty));
    return `  ${bar}  ${chalk.cyan.bold(payload.label)}`;
  };

  let completed = 0;
  const errors = [];

  for (const track of tracks) {
    const index = completed + 1;
    const duration = formatDuration(track.duration);
    const durationLabel = duration ? chalk.dim(` (${duration})`) : "";
    const trackLabel = `[${index}/${totalTracks}] ${track.title}${durationLabel}`;

    trackBar.update(0, { label: trackLabel, pct: "0%" });

    try {
      const { promise, proc } = downloadTrack(url, track.videoId, outputDir, (percent) => {
        const rounded = Math.round(percent);
        trackBar.update(rounded, { pct: `${rounded}%` });
      });

      currentProc = proc;
      await promise;
      currentProc = null;
    } catch (err) {
      errors.push({ title: track.title, error: err.message });
    }

    completed++;
    overallBar.update(completed, { label: `${completed}/${totalTracks} tracks` });
  }

  multibar.stop();
  console.log("");

  if (errors.length > 0) {
    console.log(chalk.yellow.bold(`  ${errors.length} track(s) failed:`));
    for (const { title, error } of errors) {
      console.log(chalk.yellow(`    x ${title}`));
      console.log(chalk.dim(`      ${error}`));
    }
    console.log("");
  }

  const successCount = totalTracks - errors.length;
  if (successCount === totalTracks) {
    console.log(chalk.green.bold(`  Done! All ${totalTracks} tracks downloaded.`));
  } else {
    console.log(chalk.green(`  Done! ${successCount}/${totalTracks} tracks downloaded.`));
  }
  console.log(chalk.dim(`  Saved to ${outputDir}`));
  console.log("");
}

main();
