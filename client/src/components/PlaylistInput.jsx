import { useState } from "react";

const BROWSER_OPTIONS = [
  { value: "", label: "No cookies (public only)" },
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass w-full max-w-md p-8 animate-in">
        <h1 className="text-2xl font-bold mb-1">
          Playlist Downloader
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Paste a YouTube playlist URL to download as MP3
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/playlist?list=..."
            className="input-glass"
            disabled={isLoading}
            required
          />

          <div className="flex gap-3">
            <select
              value={browser}
              onChange={(e) => setBrowser(e.target.value)}
              disabled={isLoading}
              className="select-glass flex-1"
            >
              {BROWSER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="btn btn-accent flex-1"
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Starting...
                </>
              ) : (
                "Download"
              )}
            </button>
          </div>
        </form>

        {error && <p className="error-box mt-4">{error}</p>}
      </div>
    </div>
  );
}
