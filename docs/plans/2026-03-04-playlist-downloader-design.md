# Playlist Downloader - Design Document

## Overview

Web application that downloads entire YouTube playlists as MP3 files. Users paste a playlist URL, see real-time download progress, and download files individually or as a ZIP.

Deployable for multiple users.

## Stack

- **Frontend**: React (Vite) + TailwindCSS
- **Backend**: Express.js (Node.js)
- **Tools**: yt-dlp + ffmpeg (called as subprocesses)
- **Deployment**: Docker (Dockerfile includes yt-dlp + ffmpeg)

## Architecture

```
[React Frontend]  <--SSE-->  [Express Backend]  --> [yt-dlp + ffmpeg]
                                    |
                              [Temp directory]
                              (MP3 files per job)
```

### Flow

1. User pastes a YouTube playlist URL
2. Frontend sends POST to backend with the URL
3. Backend validates URL, generates a `jobId`, starts processing in background
4. Backend spawns `yt-dlp` to download and convert each track to MP3
5. Progress is pushed to frontend via SSE (Server-Sent Events)
6. User downloads files individually or as a ZIP

## API

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/playlist` | Receives URL, starts download, returns `{ jobId }` |
| `GET` | `/api/playlist/:jobId/progress` | SSE connection for real-time progress |
| `GET` | `/api/playlist/:jobId/download/:trackIndex` | Download individual MP3 |
| `GET` | `/api/playlist/:jobId/download-all` | Download all MP3s as ZIP |

### SSE Events

- `playlist_info`: playlist name, track count, track titles
- `track_progress`: track index, download percentage
- `track_complete`: track finished
- `all_complete`: all tracks done
- `error`: error on a specific track

## Frontend

Single page with 3 states:

### State 1 - Home
- Large centered input field: "Paste your YouTube playlist link"
- "Download" button
- Clean dark design, YouTube-inspired colors (red/white)

### State 2 - Downloading
- Playlist name as title
- Global progress bar
- Track list with: title, individual progress bar, status (waiting/downloading/done/error)
- Download button appears next to each completed track

### State 3 - Complete
- All tracks marked as done
- Prominent "Download All (ZIP)" button
- Individual download buttons
- "New playlist" button to reset

### Components
- `App`: state routing
- `PlaylistInput`: input field + button
- `DownloadProgress`: global download view
- `TrackItem`: individual track row

## Error Handling

- Invalid URL or not a YouTube playlist -> clear error message
- Unavailable track (geo-blocked, deleted) -> skip, continue others, show error indicator
- yt-dlp crash -> retry once, then error

## Security & Limits

- Strict URL validation (must match YouTube playlist pattern)
- Rate limiting: max 3 concurrent jobs per IP
- Max playlist size: 200 tracks
- Auto-cleanup of temp files after 1 hour

## Project Structure

```
playlist-downloader/
  client/               # React (Vite)
    src/
      components/       # PlaylistInput, DownloadProgress, TrackItem
      App.jsx
  server/               # Express
    routes/             # playlist.js
    services/           # downloader.js (yt-dlp logic)
    middleware/          # rateLimiter.js, validateUrl.js
    index.js
  Dockerfile
  docker-compose.yml
  package.json          # workspaces
```
