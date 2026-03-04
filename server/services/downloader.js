import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

const MAX_TRACKS = 200;

const ALLOWED_BROWSERS = ["chrome", "firefox", "edge", "safari", "opera", "brave"];

// Convert watch?v=...&list=... URLs to playlist?list=... format
// so yt-dlp always treats them as playlists
function toPlaylistUrl(url) {
  const parsed = new URL(url);
  const listId = parsed.searchParams.get("list");
  if (listId) {
    return `https://www.youtube.com/playlist?list=${listId}`;
  }
  return url;
}

function getCookiesArgs(browser) {
  if (!browser || !ALLOWED_BROWSERS.includes(browser)) return [];
  return ["--cookies-from-browser", browser];
}

export async function fetchPlaylistInfo(url, { browser } = {}) {
  const playlistUrl = toPlaylistUrl(url);

  return new Promise((resolve, reject) => {
    const args = [
      "--flat-playlist",
      "--dump-json",
      "--yes-playlist",
      "--playlist-end", String(MAX_TRACKS),
      ...getCookiesArgs(browser),
      playlistUrl,
    ];

    const proc = spawn("yt-dlp", args);
    let output = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => { output += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp failed: ${stderr}`));
      }

      const lines = output.trim().split("\n").filter(Boolean);
      const entries = lines.map((line) => JSON.parse(line));

      const tracks = entries.map((data) => ({
        title: data.title,
        videoId: data.id,
        duration: data.duration,
      }));

      const playlistTitle = entries[0].playlist_title || "Playlist";

      resolve({ playlistTitle, tracks });
    });
  });
}

// Cookies are only used for fetchPlaylistInfo (to access private playlists).
// downloadTrack fetches each video by its public ID, so cookies are not needed
// and actually cause failures (authenticated requests change available formats
// and break the JS challenge solver).
export function downloadTrack(url, videoId, outputDir, onProgress) {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(outputDir, "%(title)s.%(ext)s");

    const args = [
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--embed-thumbnail",
      "--newline",
      "--no-playlist",
      "-o", outputTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const proc = spawn("yt-dlp", args);
    let stderr = "";
    let filename = null;

    proc.stdout.on("data", (chunk) => {
      const text = chunk.toString();

      const progressMatch = text.match(/\[download\]\s+([\d.]+)%/);
      if (progressMatch) {
        onProgress(parseFloat(progressMatch[1]));
      }

      const destMatch = text.match(/\[ExtractAudio\] Destination: (.+\.mp3)/);
      if (destMatch) {
        filename = destMatch[1].trim();
      }
    });

    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp download failed: ${stderr}`));
      }
      onProgress(100);
      resolve(filename);
    });
  });
}

export async function ensureOutputDir(jobId) {
  const dir = path.join(process.cwd(), "tmp", jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
