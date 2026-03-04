import { useState } from "react";

const BROWSER_OPTIONS = [
  { value: "", label: "None (public playlists only)" },
  { value: "chrome", label: "Chrome" },
  { value: "firefox", label: "Firefox" },
  { value: "edge", label: "Edge" },
  { value: "safari", label: "Safari" },
  { value: "opera", label: "Opera" },
  { value: "brave", label: "Brave" },
];

export function PlaylistInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState("");
  const [browser, setBrowser] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await onSubmit(url, browser);
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
        <div>
          <label className="block text-gray-400 text-sm mb-1">
            Use cookies from browser (for private playlists)
          </label>
          <select
            value={browser}
            onChange={(e) => setBrowser(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:outline-none"
          >
            {BROWSER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
