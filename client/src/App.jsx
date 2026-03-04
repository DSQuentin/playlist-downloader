import { useState, useEffect, useRef } from "react";
import { PlaylistInput } from "./components/PlaylistInput";
import { DownloadProgress } from "./components/DownloadProgress";

// 12 particles with deterministic spread across the viewport
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  x: ((i * 37 + 17) * 73) % 97,
  y: ((i * 53 + 31) * 41) % 97,
  size: 2 + (i % 3),
  duration: 20 + (i * 5) % 16,
  delay: -((i * 2.5) % 25),
  variant: (i % 2) + 1,
  isAccent: i % 4 === 0,
}));

function App() {
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef(null);

  const handleSubmit = async (url, browser) => {
    setIsLoading(true);

    const res = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, browser: browser || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      setIsLoading(false);
      throw new Error(data.error || "Something went wrong.");
    }

    setJobId(data.jobId);
  };

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/playlist/${jobId}/progress`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setJob(data);
      setIsLoading(false);

      if (["complete", "error", "cancelled"].includes(data.status)) {
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
      setIsLoading(false);
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  const handleCancel = async () => {
    if (!jobId) return;
    await fetch(`/api/playlist/${jobId}/cancel`, { method: "POST" });
  };

  const handleSkip = async (trackIndex) => {
    if (!jobId) return;
    await fetch(`/api/playlist/${jobId}/skip/${trackIndex}`, { method: "POST" });
  };

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setJobId(null);
    setJob(null);
    setIsLoading(false);
  };

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="light-sweep" />

        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className={`particle${p.isAccent ? " accent" : ""}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `particle-drift-${p.variant} ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
        {job ? (
          <DownloadProgress job={job} onReset={handleReset} onCancel={handleCancel} onSkip={handleSkip} />
        ) : (
          <PlaylistInput onSubmit={handleSubmit} isLoading={isLoading} />
        )}
      </div>
    </>
  );
}

export default App;
