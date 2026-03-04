const STATUS_LABELS = {
  waiting: "Waiting",
  downloading: "Downloading",
  complete: "Done",
  error: "Error",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

const STATUS_COLORS = {
  waiting: "var(--text-muted)",
  downloading: "var(--accent)",
  complete: "#34d399",
  error: "#f87171",
  skipped: "#fb923c",
  cancelled: "var(--text-muted)",
};

export function TrackItem({ track, index, jobId, onSkip, delay }) {
  const dimmed = track.status === "waiting" || track.status === "cancelled";

  return (
    <div
      className="track-row animate-in"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Track number */}
      <span
        className="text-right flex-shrink-0"
        style={{ color: "var(--text-muted)", fontSize: "13px", width: "28px" }}
      >
        {index + 1}
      </span>

      {/* Status dot */}
      <div className={`status-dot ${track.status}`} />

      {/* Title + progress */}
      <div className="flex-1 min-w-0">
        <p
          className="truncate text-sm"
          style={{ color: dimmed ? "var(--text-secondary)" : "var(--text-primary)" }}
        >
          {track.title}
        </p>
        {track.status === "downloading" && (
          <div className="progress-track progress-track-sm mt-2">
            <div
              className="progress-fill active"
              style={{ width: `${track.progress}%` }}
            />
          </div>
        )}
        {track.error && (
          <p className="mt-1" style={{ color: "#f87171", fontSize: "12px" }}>
            {track.error}
          </p>
        )}
      </div>

      {/* Status label */}
      <span
        className="flex-shrink-0"
        style={{ fontSize: "12px", color: STATUS_COLORS[track.status] }}
      >
        {STATUS_LABELS[track.status]}
      </span>

      {/* Actions */}
      {track.status === "downloading" && (
        <button onClick={() => onSkip(index)} className="link-action skip">
          Skip
        </button>
      )}

      {track.status === "complete" && (
        <a
          href={`/api/playlist/${jobId}/download/${index}`}
          className="link-action accent"
        >
          Download
        </a>
      )}
    </div>
  );
}
