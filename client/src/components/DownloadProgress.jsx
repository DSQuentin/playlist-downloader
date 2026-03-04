import { TrackItem } from "./TrackItem";

export function DownloadProgress({ job, onReset, onCancel, onSkip }) {
  const tracks = job.tracks || [];
  const completedCount = tracks.filter((t) => t.status === "complete").length;
  const totalCount = tracks.length;
  const globalProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = job.status === "complete";
  const isCancelled = job.status === "cancelled";
  const isDownloading = job.status === "downloading";
  const isDone = isComplete || isCancelled;

  if (job.status === "fetching_info") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="animate-in text-center">
          <div className="spinner spinner-lg mx-auto mb-4" />
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Fetching playlist info...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      {/* Header */}
      <div className="animate-in mb-8">
        <h1 className="text-2xl font-bold mb-1">
          {job.playlistTitle || "Loading playlist..."}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {completedCount} of {totalCount} tracks
          {isCancelled && " — Cancelled"}
        </p>
      </div>

      {/* Global progress */}
      <div className="animate-in mb-6" style={{ animationDelay: "0.05s" }}>
        <div className="progress-track">
          <div
            className={`progress-fill ${isDownloading ? "active" : ""}`}
            style={{ width: `${globalProgress}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-8 animate-in" style={{ animationDelay: "0.1s" }}>
        {isDone && tracks.some((t) => t.status === "complete") && (
          <a href={`/api/playlist/${job.id}/download-all`} className="btn btn-accent">
            Download ZIP
          </a>
        )}
        {isDownloading && (
          <button onClick={onCancel} className="btn btn-danger">
            Cancel All
          </button>
        )}
        <button onClick={onReset} className="btn btn-ghost">
          New Playlist
        </button>
      </div>

      {/* Track list */}
      <div className="flex flex-col gap-1">
        {tracks.map((track, i) => (
          <TrackItem
            key={i}
            track={track}
            index={i}
            jobId={job.id}
            onSkip={onSkip}
            delay={0.15 + i * 0.03}
          />
        ))}
      </div>
    </div>
  );
}
