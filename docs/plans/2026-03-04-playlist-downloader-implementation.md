# Playlist Downloader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app where users paste a YouTube playlist URL and download all tracks as MP3 files, with real-time progress.

**Architecture:** Express backend spawns `yt-dlp` subprocesses to download/convert tracks. Progress is pushed to a React frontend via SSE (Server-Sent Events). Files are served individually or as a ZIP.

**Tech Stack:** React (Vite) + TailwindCSS, Express.js, yt-dlp, ffmpeg, archiver (ZIP), Docker

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (root workspace)
- Create: `server/package.json`
- Create: `client/` (via Vite scaffold)

**Step 1: Initialize root package.json with workspaces**

```bash
cd /Users/quentin/Dev/CC/playlist-downloader
cat > package.json << 'EOF'
{
  "name": "playlist-downloader",
  "private": true,
  "workspaces": ["server", "client"]
}
EOF
```

**Step 2: Scaffold the server package**

```bash
mkdir -p server/routes server/services server/middleware
cat > server/package.json << 'EOF'
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch index.js",
    "test": "node --test tests/**/*.test.js"
  }
}
EOF
```

**Step 3: Install server dependencies**

```bash
cd /Users/quentin/Dev/CC/playlist-downloader
npm install --workspace=server express cors uuid archiver express-rate-limit
npm install --workspace=server --save-dev supertest
```

Note: `archiver` is a library for creating ZIP files. `uuid` generates unique job IDs. `express-rate-limit` handles rate limiting per IP.

**Step 4: Scaffold the React client with Vite**

```bash
cd /Users/quentin/Dev/CC/playlist-downloader
npm create vite@latest client -- --template react
```

**Step 5: Install client dependencies**

```bash
npm install --workspace=client
npm install --workspace=client tailwindcss @tailwindcss/vite
```

**Step 6: Configure TailwindCSS with Vite plugin**

Replace `client/vite.config.js`:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
```

Replace `client/src/index.css` with:

```css
@import "tailwindcss";
```

**Step 7: Create .gitignore**

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.DS_Store
tmp/
EOF
```

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with server and client workspaces"
```

---

### Task 2: URL Validation Middleware

**Files:**
- Create: `server/middleware/validateUrl.js`
- Create: `server/tests/validateUrl.test.js`

**Step 1: Write the failing test**

```js
// server/tests/validateUrl.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidPlaylistUrl } from "../middleware/validateUrl.js";

describe("isValidPlaylistUrl", () => {
  it("accepts a standard YouTube playlist URL", () => {
    assert.equal(
      isValidPlaylistUrl("https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
      true
    );
  });

  it("accepts a youtube.com/watch URL with a list parameter", () => {
    assert.equal(
      isValidPlaylistUrl("https://www.youtube.com/watch?v=abc123&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
      true
    );
  });

  it("accepts youtu.be short URL with list parameter", () => {
    assert.equal(
      isValidPlaylistUrl("https://youtu.be/abc123?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
      true
    );
  });

  it("rejects a single video URL without list parameter", () => {
    assert.equal(
      isValidPlaylistUrl("https://www.youtube.com/watch?v=abc123"),
      false
    );
  });

  it("rejects a non-YouTube URL", () => {
    assert.equal(isValidPlaylistUrl("https://www.google.com"), false);
  });

  it("rejects empty string", () => {
    assert.equal(isValidPlaylistUrl(""), false);
  });

  it("rejects non-URL strings", () => {
    assert.equal(isValidPlaylistUrl("not a url at all"), false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/quentin/Dev/CC/playlist-downloader
npm test --workspace=server
```

Expected: FAIL - module not found.

**Step 3: Write minimal implementation**

```js
// server/middleware/validateUrl.js

const YOUTUBE_HOSTS = ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"];

export function isValidPlaylistUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!YOUTUBE_HOSTS.includes(url.hostname)) return false;
    return url.searchParams.has("list");
  } catch {
    return false;
  }
}

export function validateUrl(req, res, next) {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required." });
  }

  if (!isValidPlaylistUrl(url)) {
    return res.status(400).json({ error: "Invalid YouTube playlist URL. The URL must contain a playlist (list= parameter)." });
  }

  next();
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add server/middleware/validateUrl.js server/tests/validateUrl.test.js
git commit -m "feat(server): add YouTube playlist URL validation middleware"
```

---

### Task 3: Job Store

The job store keeps track of all download jobs in memory. Each job has an ID, status, track list, and progress.

**Files:**
- Create: `server/services/jobStore.js`
- Create: `server/tests/jobStore.test.js`

**Step 1: Write the failing test**

```js
// server/tests/jobStore.test.js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JobStore } from "../services/jobStore.js";

describe("JobStore", () => {
  let store;

  beforeEach(() => {
    store = new JobStore();
  });

  it("creates a job and returns its id", () => {
    const job = store.create("https://youtube.com/playlist?list=PLtest");
    assert.ok(job.id);
    assert.equal(job.url, "https://youtube.com/playlist?list=PLtest");
    assert.equal(job.status, "pending");
  });

  it("retrieves a job by id", () => {
    const { id } = store.create("https://youtube.com/playlist?list=PLtest");
    const job = store.get(id);
    assert.equal(job.id, id);
  });

  it("returns undefined for unknown id", () => {
    assert.equal(store.get("nonexistent"), undefined);
  });

  it("updates job fields", () => {
    const { id } = store.create("https://youtube.com/playlist?list=PLtest");
    store.update(id, { status: "downloading", playlistTitle: "My Playlist" });
    const job = store.get(id);
    assert.equal(job.status, "downloading");
    assert.equal(job.playlistTitle, "My Playlist");
  });

  it("deletes a job", () => {
    const { id } = store.create("https://youtube.com/playlist?list=PLtest");
    store.delete(id);
    assert.equal(store.get(id), undefined);
  });

  it("counts active jobs for a given IP", () => {
    store.create("https://youtube.com/playlist?list=PL1", "1.2.3.4");
    store.create("https://youtube.com/playlist?list=PL2", "1.2.3.4");
    store.create("https://youtube.com/playlist?list=PL3", "5.6.7.8");
    assert.equal(store.countByIp("1.2.3.4"), 2);
    assert.equal(store.countByIp("5.6.7.8"), 1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test --workspace=server
```

Expected: FAIL - module not found.

**Step 3: Write minimal implementation**

```js
// server/services/jobStore.js
import { randomUUID } from "node:crypto";

export class JobStore {
  constructor() {
    this.jobs = new Map();
  }

  create(url, ip = null) {
    const id = randomUUID();
    const job = {
      id,
      url,
      ip,
      status: "pending",
      playlistTitle: null,
      tracks: [],
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id) {
    return this.jobs.get(id);
  }

  update(id, fields) {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, fields);
  }

  delete(id) {
    this.jobs.delete(id);
  }

  countByIp(ip) {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.ip === ip && job.status !== "complete" && job.status !== "error") {
        count++;
      }
    }
    return count;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test --workspace=server
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add server/services/jobStore.js server/tests/jobStore.test.js
git commit -m "feat(server): add in-memory job store for download tracking"
```

---

### Task 4: Downloader Service

This is the core service that calls `yt-dlp` to fetch playlist info and download tracks as MP3.

**Files:**
- Create: `server/services/downloader.js`

**Prerequisites check:** Before coding, verify yt-dlp and ffmpeg are available:

```bash
yt-dlp --version
ffmpeg -version
```

If not installed: `brew install yt-dlp ffmpeg`

**Step 1: Write the downloader service**

```js
// server/services/downloader.js
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

const MAX_TRACKS = 200;

export async function fetchPlaylistInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      "--flat-playlist",       // don't download, just list
      "--dump-json",           // output JSON per track
      "--playlist-end", String(MAX_TRACKS),
      url,
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

      // yt-dlp outputs one JSON object per line (one per track)
      const tracks = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const data = JSON.parse(line);
          return {
            title: data.title,
            videoId: data.id,
            duration: data.duration,
          };
        });

      // Get playlist title from first entry
      const firstEntry = JSON.parse(output.trim().split("\n")[0]);
      const playlistTitle = firstEntry.playlist_title || "Playlist";

      resolve({ playlistTitle, tracks });
    });
  });
}

export function downloadTrack(url, videoId, outputDir, onProgress) {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(outputDir, "%(title)s.%(ext)s");

    const args = [
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "0",        // best quality
      "--newline",                    // progress on new lines (parseable)
      "--no-playlist",               // download single video
      "-o", outputTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const proc = spawn("yt-dlp", args);
    let stderr = "";
    let filename = null;

    proc.stdout.on("data", (chunk) => {
      const text = chunk.toString();

      // Parse progress lines like: [download]  45.2% of 5.23MiB at 1.2MiB/s
      const progressMatch = text.match(/\[download\]\s+([\d.]+)%/);
      if (progressMatch) {
        onProgress(parseFloat(progressMatch[1]));
      }

      // Parse destination line: [ExtractAudio] Destination: /path/to/file.mp3
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
```

**Step 2: Write a quick manual test to verify yt-dlp integration**

Create a small script to test with a real (short) playlist:

```bash
cd /Users/quentin/Dev/CC/playlist-downloader
node -e "
import { fetchPlaylistInfo } from './server/services/downloader.js';
const info = await fetchPlaylistInfo('https://www.youtube.com/playlist?list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH');
console.log('Title:', info.playlistTitle);
console.log('Tracks:', info.tracks.length);
console.log('First track:', info.tracks[0]?.title);
"
```

Expected: prints playlist title and track list (this is a public Coding Train playlist).

**Step 3: Commit**

```bash
git add server/services/downloader.js
git commit -m "feat(server): add yt-dlp downloader service for playlist info and track download"
```

---

### Task 5: Express Server + API Routes

**Files:**
- Create: `server/index.js`
- Create: `server/routes/playlist.js`

**Step 1: Create the main Express server**

```js
// server/index.js
import express from "express";
import cors from "cors";
import { playlistRouter } from "./routes/playlist.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/playlist", playlistRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
```

**Step 2: Create the playlist routes**

```js
// server/routes/playlist.js
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

const MAX_CONCURRENT_JOBS_PER_IP = 3;

// POST /api/playlist - Start a new download job
router.post("/", validateUrl, async (req, res) => {
  const { url } = req.body;
  const ip = req.ip;

  if (store.countByIp(ip) >= MAX_CONCURRENT_JOBS_PER_IP) {
    return res.status(429).json({ error: "Too many active downloads. Please wait for current downloads to finish." });
  }

  const job = store.create(url, ip);
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

  // SSE setup
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send current state immediately
  res.write(`data: ${JSON.stringify({ type: "job_state", ...job })}\n\n`);

  // Poll for updates every 500ms
  const interval = setInterval(() => {
    const current = store.get(req.params.jobId);
    if (!current) {
      clearInterval(interval);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ type: "job_state", ...current })}\n\n`);

    if (current.status === "complete" || current.status === "error") {
      clearInterval(interval);
      res.end();
    }
  }, 500);

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

  if (job.status !== "complete") {
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

// Background processing function
async function processJob(job) {
  const outputDir = await ensureOutputDir(job.id);

  // Step 1: Fetch playlist info
  store.update(job.id, { status: "fetching_info" });
  const { playlistTitle, tracks: trackInfos } = await fetchPlaylistInfo(job.url);

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

  // Step 2: Download each track sequentially
  let completedCount = 0;

  for (let i = 0; i < tracks.length; i++) {
    tracks[i].status = "downloading";
    store.update(job.id, { tracks: [...tracks] });

    try {
      const filePath = await downloadTrack(
        job.url,
        tracks[i].videoId,
        outputDir,
        (progress) => {
          tracks[i].progress = progress;
          store.update(job.id, { tracks: [...tracks] });
        }
      );

      tracks[i].status = "complete";
      tracks[i].progress = 100;
      tracks[i].filePath = filePath;
      completedCount++;
    } catch (err) {
      // Retry once
      try {
        const filePath = await downloadTrack(
          job.url,
          tracks[i].videoId,
          outputDir,
          (progress) => {
            tracks[i].progress = progress;
            store.update(job.id, { tracks: [...tracks] });
          }
        );
        tracks[i].status = "complete";
        tracks[i].progress = 100;
        tracks[i].filePath = filePath;
        completedCount++;
      } catch (retryErr) {
        tracks[i].status = "error";
        tracks[i].error = retryErr.message;
      }
    }

    store.update(job.id, { tracks: [...tracks] });
  }

  store.update(job.id, { status: "complete" });

  // Schedule cleanup after 1 hour
  setTimeout(async () => {
    try {
      const fs = await import("node:fs/promises");
      await fs.rm(outputDir, { recursive: true, force: true });
      store.delete(job.id);
    } catch {
      // Ignore cleanup errors
    }
  }, 60 * 60 * 1000);
}

export { router as playlistRouter };
```

**Step 3: Test the server manually**

```bash
cd /Users/quentin/Dev/CC/playlist-downloader
npm run dev --workspace=server
```

In another terminal:
```bash
curl -X POST http://localhost:3001/api/playlist \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/playlist?list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH"}'
```

Expected: `{"jobId":"<some-uuid>"}`

Then test SSE:
```bash
curl -N http://localhost:3001/api/playlist/<jobId>/progress
```

Expected: stream of JSON events with progress.

**Step 4: Commit**

```bash
git add server/index.js server/routes/playlist.js
git commit -m "feat(server): add Express server with playlist API routes and SSE progress"
```

---

### Task 6: Frontend - PlaylistInput Component

**Files:**
- Create: `client/src/components/PlaylistInput.jsx`

**Step 1: Write the component**

```jsx
// client/src/components/PlaylistInput.jsx
import { useState } from "react";

export function PlaylistInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await onSubmit(url);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-4xl font-bold text-white mb-2">Playlist Downloader</h1>
      <p className="text-gray-400 mb-8">Download YouTube playlists as MP3</p>

      <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col gap-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste your YouTube playlist link"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:outline-none text-lg"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-lg"
        >
          {isLoading ? "Starting..." : "Download"}
        </button>
      </form>

      {error && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/components/PlaylistInput.jsx
git commit -m "feat(client): add PlaylistInput component"
```

---

### Task 7: Frontend - TrackItem Component

**Files:**
- Create: `client/src/components/TrackItem.jsx`

**Step 1: Write the component**

```jsx
// client/src/components/TrackItem.jsx

const STATUS_LABELS = {
  waiting: "Waiting",
  downloading: "Downloading",
  complete: "Done",
  error: "Error",
};

const STATUS_COLORS = {
  waiting: "text-gray-500",
  downloading: "text-yellow-400",
  complete: "text-green-400",
  error: "text-red-400",
};

export function TrackItem({ track, index, jobId }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 bg-gray-800 rounded-lg">
      <span className="text-gray-500 text-sm w-8 text-right">{index + 1}</span>

      <div className="flex-1 min-w-0">
        <p className="text-white truncate">{track.title}</p>
        {track.status === "downloading" && (
          <div className="mt-1 w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${track.progress}%` }}
            />
          </div>
        )}
        {track.error && (
          <p className="text-red-400 text-xs mt-1">{track.error}</p>
        )}
      </div>

      <span className={`text-sm ${STATUS_COLORS[track.status]}`}>
        {STATUS_LABELS[track.status]}
      </span>

      {track.status === "complete" && (
        <a
          href={`/api/playlist/${jobId}/download/${index}`}
          className="text-sm text-red-400 hover:text-red-300 underline"
        >
          Download
        </a>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/components/TrackItem.jsx
git commit -m "feat(client): add TrackItem component with progress bar and download link"
```

---

### Task 8: Frontend - DownloadProgress Component

**Files:**
- Create: `client/src/components/DownloadProgress.jsx`

**Step 1: Write the component**

```jsx
// client/src/components/DownloadProgress.jsx
import { TrackItem } from "./TrackItem";

export function DownloadProgress({ job, onReset }) {
  const tracks = job.tracks || [];
  const completedCount = tracks.filter((t) => t.status === "complete").length;
  const totalCount = tracks.length;
  const globalProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = job.status === "complete";

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">
        {job.playlistTitle || "Loading playlist..."}
      </h1>
      <p className="text-gray-400 text-sm mb-6">
        {completedCount} / {totalCount} tracks
      </p>

      {/* Global progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
        <div
          className="bg-red-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${globalProgress}%` }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        {isComplete && (
          <a
            href={`/api/playlist/${job.id}/download-all`}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Download All (ZIP)
          </a>
        )}
        <button
          onClick={onReset}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          New Playlist
        </button>
      </div>

      {/* Track list */}
      <div className="flex flex-col gap-2">
        {tracks.map((track, i) => (
          <TrackItem key={i} track={track} index={i} jobId={job.id} />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/components/DownloadProgress.jsx
git commit -m "feat(client): add DownloadProgress component with global progress and ZIP download"
```

---

### Task 9: Frontend - App (State Management + SSE)

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Wire everything together**

```jsx
// client/src/App.jsx
import { useState, useEffect, useRef } from "react";
import { PlaylistInput } from "./components/PlaylistInput";
import { DownloadProgress } from "./components/DownloadProgress";

function App() {
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef(null);

  const handleSubmit = async (url) => {
    setIsLoading(true);

    const res = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      setIsLoading(false);
      throw new Error(data.error || "Something went wrong.");
    }

    setJobId(data.jobId);
  };

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/playlist/${jobId}/progress`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setJob(data);
      setIsLoading(false);

      if (data.status === "complete" || data.status === "error") {
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
      setIsLoading(false);
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setJobId(null);
    setJob(null);
    setIsLoading(false);
  };

  if (job) {
    return <DownloadProgress job={job} onReset={handleReset} />;
  }

  return <PlaylistInput onSubmit={handleSubmit} isLoading={isLoading} />;
}

export default App;
```

**Step 2: Clean up default Vite files**

Delete `client/src/App.css` (not needed, TailwindCSS handles styles).

Update `client/src/index.css` if not already done:
```css
@import "tailwindcss";

body {
  background-color: #111;
}
```

**Step 3: Test the full stack locally**

Terminal 1:
```bash
npm run dev --workspace=server
```

Terminal 2:
```bash
npm run dev --workspace=client
```

Open http://localhost:5173 in browser. Paste a YouTube playlist URL and verify:
- Input works
- Progress appears
- Downloads work

**Step 4: Commit**

```bash
git add client/src/App.jsx client/src/index.css
git rm client/src/App.css 2>/dev/null; true
git commit -m "feat(client): wire App with SSE progress and state management"
```

---

### Task 10: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Create the Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-slim

# Install yt-dlp and ffmpeg
RUN apt-get update && \
    apt-get install -y python3 ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm install

# Copy source code
COPY server/ server/
COPY client/ client/

# Build the React frontend
RUN npm run build --workspace=client

# Serve the built frontend from Express in production
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
```

Note: In production, Express should also serve the built React files. Add this to `server/index.js` (only in production):

Add to the bottom of `server/index.js`, before `app.listen`:
```js
// In production, serve the React build
if (process.env.NODE_ENV === "production") {
  const clientDistPath = new URL("../client/dist", import.meta.url).pathname;
  app.use(express.static(clientDistPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}
```

Add `import path from "node:path";` at the top of `server/index.js`.

**Step 2: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    volumes:
      - tmp-data:/app/tmp

volumes:
  tmp-data:
```

**Step 3: Test Docker build**

```bash
docker compose build
docker compose up
```

Open http://localhost:3001 and verify it works.

**Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml server/index.js
git commit -m "feat: add Docker setup for production deployment"
```

---

### Task 11: Final Polish and Smoke Test

**Step 1: Run the full app locally and test end-to-end**

- Paste a real YouTube playlist URL (use a short one for testing, ~3 tracks)
- Verify progress bars update in real time
- Download an individual track
- Download all as ZIP
- Try invalid URLs and verify error messages
- Try pasting a single video URL (no playlist) and verify rejection

**Step 2: Fix any issues found during testing**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final polish and cleanup"
```
