import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import archiver from "archiver";
import { validateUrl } from "../middleware/validateUrl.js";
import { JobStore } from "../services/jobStore.js";
import {
  fetchPlaylistInfo,
  downloadTrack,
  ensureOutputDir,
} from "../services/downloader.js";

const store = new JobStore();
const router = Router();

// Maps jobId -> active yt-dlp ChildProcess (so we can kill it on cancel/skip)
const activeProcs = new Map();

const MAX_CONCURRENT_JOBS_PER_IP = 3;
const SSE_POLL_INTERVAL_MS = 500;
const CLEANUP_DELAY_MS = 60 * 60 * 1000;

// POST /api/playlist - Start a new download job
router.post("/", validateUrl, async (req, res) => {
  const { url, browser } = req.body;
  const ip = req.ip;

  if (store.countByIp(ip) >= MAX_CONCURRENT_JOBS_PER_IP) {
    return res.status(429).json({
      error: "Too many active downloads. Please wait for current downloads to finish.",
    });
  }

  const job = store.create(url, ip);
  job.browser = browser || null;
  res.json({ jobId: job.id });

  // Start processing in background (don't await)
  processJob(job).catch((err) => {
    console.error(`Job ${job.id} failed:`, err);
    store.update(job.id, { status: "error" });
  });
});

// GET /api/playlist/:jobId/progress - SSE stream
router.get("/:jobId/progress", (req, res) => {
  const job = store.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send current state immediately
  res.write(`data: ${JSON.stringify({ type: "job_state", ...job })}\n\n`);

  const interval = setInterval(() => {
    const current = store.get(req.params.jobId);
    if (!current) {
      clearInterval(interval);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ type: "job_state", ...current })}\n\n`);

    if (["complete", "error", "cancelled"].includes(current.status)) {
      clearInterval(interval);
      res.end();
    }
  }, SSE_POLL_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(interval);
  });
});

// GET /api/playlist/:jobId/download/:trackIndex - Download single MP3
router.get("/:jobId/download/:trackIndex", (req, res) => {
  const job = store.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  const trackIndex = parseInt(req.params.trackIndex, 10);
  const track = job.tracks[trackIndex];

  if (!track || !track.filePath) {
    return res.status(404).json({ error: "Track not found or not ready." });
  }

  res.download(track.filePath, path.basename(track.filePath));
});

// GET /api/playlist/:jobId/download-all - Download all as ZIP
router.get("/:jobId/download-all", (req, res) => {
  const job = store.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  if (job.status !== "complete" && job.status !== "cancelled") {
    return res.status(400).json({ error: "Download is not complete yet." });
  }

  const zipFilename = `${job.playlistTitle || "playlist"}.zip`;
  res.set("Content-Type", "application/zip");
  res.set("Content-Disposition", `attachment; filename="${zipFilename}"`);

  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.pipe(res);

  for (const track of job.tracks) {
    if (track.filePath && fs.existsSync(track.filePath)) {
      archive.file(track.filePath, { name: path.basename(track.filePath) });
    }
  }

  archive.finalize();
});

// POST /api/playlist/:jobId/cancel - Cancel entire download job
router.post("/:jobId/cancel", (req, res) => {
  const job = store.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }
  if (job.status !== "downloading") {
    return res.status(400).json({ error: "Job is not downloading." });
  }

  store.update(job.id, { status: "cancelled" });

  const proc = activeProcs.get(job.id);
  if (proc) {
    proc.kill();
  }

  res.json({ ok: true });
});

// POST /api/playlist/:jobId/skip/:trackIndex - Skip a specific track
router.post("/:jobId/skip/:trackIndex", (req, res) => {
  const job = store.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  const trackIndex = parseInt(req.params.trackIndex, 10);
  const track = job.tracks?.[trackIndex];
  if (!track) {
    return res.status(404).json({ error: "Track not found." });
  }
  if (track.status !== "downloading") {
    return res.status(400).json({ error: "Track is not downloading." });
  }

  track.status = "skipped";
  store.update(job.id, { tracks: [...job.tracks] });

  const proc = activeProcs.get(job.id);
  if (proc) {
    proc.kill();
  }

  res.json({ ok: true });
});

async function processJob(job) {
  const outputDir = await ensureOutputDir(path.join("tmp", job.id));

  store.update(job.id, { status: "fetching_info" });
  const { playlistTitle, tracks: trackInfos } = await fetchPlaylistInfo(job.url, { browser: job.browser });

  const tracks = trackInfos.map((t) => ({
    ...t,
    status: "waiting",
    progress: 0,
    filePath: null,
    error: null,
  }));

  store.update(job.id, {
    status: "downloading",
    playlistTitle,
    tracks,
  });

  for (let i = 0; i < tracks.length; i++) {
    // Check if job was cancelled before starting next track
    const currentJob = store.get(job.id);
    if (currentJob.status === "cancelled") {
      // Mark remaining waiting tracks as cancelled
      for (let j = i; j < tracks.length; j++) {
        if (tracks[j].status === "waiting") {
          tracks[j].status = "cancelled";
        }
      }
      store.update(job.id, { tracks: [...tracks] });
      break;
    }

    tracks[i].status = "downloading";
    store.update(job.id, { tracks: [...tracks] });

    try {
      const filePath = await downloadTrackWithRetry(job.url, tracks[i], outputDir, tracks, job.id);
      // If the track was skipped while downloading, don't overwrite its status
      if (tracks[i].status === "skipped") continue;
      tracks[i].status = "complete";
      tracks[i].progress = 100;
      tracks[i].filePath = filePath;
    } catch (err) {
      // If skipped or cancelled, don't treat the kill as an error
      if (tracks[i].status === "skipped") continue;
      const freshJob = store.get(job.id);
      if (freshJob.status === "cancelled") continue;
      tracks[i].status = "error";
      tracks[i].error = err.message;
    }

    store.update(job.id, { tracks: [...tracks] });
  }

  activeProcs.delete(job.id);

  // Only mark as complete if not cancelled
  const finalJob = store.get(job.id);
  if (finalJob.status !== "cancelled") {
    store.update(job.id, { status: "complete" });
  }

  setTimeout(async () => {
    try {
      const fsPromises = await import("node:fs/promises");
      await fsPromises.rm(outputDir, { recursive: true, force: true });
      store.delete(job.id);
    } catch {
      // Ignore cleanup errors
    }
  }, CLEANUP_DELAY_MS);
}

async function downloadTrackWithRetry(url, track, outputDir, tracks, jobId) {
  const makeProgressCallback = () => (progress) => {
    track.progress = progress;
    store.update(jobId, { tracks: [...tracks] });
  };

  const runDownload = () => {
    const { promise, proc } = downloadTrack(url, track.videoId, outputDir, makeProgressCallback());
    activeProcs.set(jobId, proc);
    return promise;
  };

  try {
    return await runDownload();
  } catch (err) {
    // Don't retry if the track was skipped or job was cancelled
    if (track.status === "skipped" || store.get(jobId).status === "cancelled") {
      throw err;
    }
    return await runDownload();
  }
}

export { router as playlistRouter };
