import path from "node:path";
import express from "express";
import cors from "cors";
import { playlistRouter } from "./routes/playlist.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/playlist", playlistRouter);

// In production, serve the React build
if (process.env.NODE_ENV === "production") {
  const clientDistPath = new URL("../client/dist", import.meta.url).pathname;
  app.use(express.static(clientDistPath));
  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
