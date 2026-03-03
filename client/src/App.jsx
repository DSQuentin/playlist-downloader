import { useState, useEffect, useRef } from "react";
import { PlaylistInput } from "./components/PlaylistInput";
import { DownloadProgress } from "./components/DownloadProgress";

function App() {
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef(null);

  const handleSubmit = async (url) => {
    setIsLoading(true);

    const res = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
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

      if (data.status === "complete" || data.status === "error") {
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

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setJobId(null);
    setJob(null);
    setIsLoading(false);
  };

  if (job) {
    return <DownloadProgress job={job} onReset={handleReset} />;
  }

  return <PlaylistInput onSubmit={handleSubmit} isLoading={isLoading} />;
}

export default App;
