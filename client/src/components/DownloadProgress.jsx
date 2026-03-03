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
