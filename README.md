# Playlist Downloader

A web app to download YouTube playlists as MP3 files with embedded cover art. Paste a playlist URL, pick your tracks, and download them as a ZIP archive.

Built with React (Vite + Tailwind) and Express, powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/).

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation)
- [ffmpeg](https://ffmpeg.org/download.html)

## Setup

```bash
# Clone the repository
git clone https://github.com/DSQuentin/playlist-downloader.git
cd playlist-downloader

# Install dependencies (installs both client and server)
npm install
```

## Usage

### Development

```bash
npm run dev
```

This starts both the Vite dev server (client) and the Express server (with hot reload) in parallel.

- Client: http://localhost:5173
- Server API: http://localhost:3001

### Production with Docker

```bash
docker compose up --build
```

The app will be available at http://localhost:3001.

## How it works

1. Paste a YouTube playlist URL into the input field.
2. Optionally select a browser to use cookies from (for private playlists).
3. The server fetches the playlist metadata and starts downloading each track as MP3 with the YouTube thumbnail embedded as cover art.
4. Track progress in real time -- you can skip or cancel individual tracks.
5. Once complete, download all tracks as a ZIP file.

## Project structure

```
playlist-downloader/
├── client/          # React frontend (Vite + Tailwind)
├── server/          # Express API
│   ├── routes/      # API endpoints
│   ├── services/    # Download logic (yt-dlp + ffmpeg)
│   └── tests/       # Server tests
├── Dockerfile
└── docker-compose.yml
```

## Tests

```bash
npm test --workspace=server
```
