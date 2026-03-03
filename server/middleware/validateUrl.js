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
    return res.status(400).json({
      error: "Invalid YouTube playlist URL. The URL must contain a playlist (list= parameter).",
    });
  }

  next();
}
