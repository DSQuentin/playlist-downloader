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
