import { useEffect, useState } from "react";
import { workerHealth } from "../api/worker";

export default function WorkerBanner() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    workerHealth().then(setAvailable);
  }, []);

  if (available === null || available) return null;

  return (
    <div
      className="worker-banner"
      role="status"
      style={{
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        background: "#fef3c7",
        border: "1px solid #fcd34d",
        borderRadius: "8px",
        fontSize: "0.875rem",
        color: "#92400e",
      }}
    >
      Server worker offline — PDF, MP3, and MP4 files need{" "}
      <code>docker compose up</code> for processing. Image formats still work in-browser.
    </div>
  );
}
