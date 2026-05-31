import { useCallback, useState } from "react";
import {
  read,
  scrub,
  diff,
  getProcessingMode,
  proveCleanToPdfText,
  type MetadataReport,
  type ScrubPreset,
  type ScrubResult,
  type Diff,
} from "@exifscrub/core";
import { Shield, Upload, Download, FileJson } from "lucide-react";
import { workerScrub, workerRead } from "../api/worker";

interface FileJob {
  id: string;
  file: File;
  mode: "browser" | "worker";
  report?: MetadataReport;
  scrubResult?: ScrubResult;
  diffResult?: Diff;
  error?: string;
  loading?: boolean;
  showMetadata?: boolean;
}

const PRESETS: { id: ScrubPreset; label: string }[] = [
  { id: "all", label: "Strip all" },
  { id: "gps_author", label: "Strip GPS + author" },
  { id: "orientation_only", label: "Keep orientation only" },
];

export default function HomePage() {
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [preset, setPreset] = useState<ScrubPreset>("all");
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const newJobs: FileJob[] = list.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      mode: getProcessingMode(file.type, file.name),
    }));
    setJobs((prev) => [...prev, ...newJobs]);
    for (const job of newJobs) {
      if (job.mode === "browser") void loadMetadata(job);
    }
  }, []);

  async function loadMetadata(job: FileJob) {
    updateJob(job.id, { loading: true, error: undefined });
    try {
      const report =
        job.mode === "browser" ? await read(job.file) : await workerRead(job.file);
      updateJob(job.id, { report, loading: false });
    } catch (e) {
      updateJob(job.id, {
        loading: false,
        error: e instanceof Error ? e.message : "Read failed",
      });
    }
  }

  function updateJob(id: string, patch: Partial<FileJob>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  async function handleScrub(job: FileJob) {
    updateJob(job.id, { loading: true, error: undefined });
    try {
      const before =
        job.report ??
        (job.mode === "browser" ? await read(job.file) : await workerRead(job.file));

      const result =
        job.mode === "browser"
          ? await scrub(job.file, { preset })
          : await workerScrub(job.file, preset);

      const cleanedFile = new File([result.cleanedBlob], job.file.name, {
        type: job.file.type || before.file.mime,
      });
      const after =
        job.mode === "browser" ? await read(cleanedFile) : await workerRead(cleanedFile);
      const diffResult = diff(before, after);

      updateJob(job.id, {
        scrubResult: result,
        report: before,
        diffResult,
        loading: false,
      });
    } catch (e) {
      updateJob(job.id, {
        loading: false,
        error: e instanceof Error ? e.message : "Scrub failed",
      });
    }
  }

  function downloadCleaned(job: FileJob) {
    if (!job.scrubResult) return;
    const url = URL.createObjectURL(job.scrubResult.cleanedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clean-${job.file.name}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadProveCleanJson(job: FileJob) {
    if (!job.scrubResult) return;
    const blob = new Blob([JSON.stringify(job.scrubResult.proveCleanJson, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `prove-clean-${job.file.name}.json`);
  }

  function downloadProveCleanReport(job: FileJob) {
    if (!job.scrubResult) return;
    const text = proveCleanToPdfText(job.scrubResult.proveCleanJson);
    const blob = new Blob([text], { type: "text/plain" });
    triggerDownload(blob, `prove-clean-${job.file.name}.txt`);
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tool-card">
      <div
        className={`drop-zone ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => document.getElementById("file-input")?.click()}
        onKeyDown={(e) => e.key === "Enter" && document.getElementById("file-input")?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop files or click to upload"
      >
        <Upload size={32} strokeWidth={1.5} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
        <p style={{ margin: 0, fontWeight: 600 }}>Drop images or media here</p>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
          JPEG, PNG, HEIC, WebP, PDF, MP3, MP4 and more
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*,.pdf,.mp3,.mp4,.mov,.flac,.wav,.heic,.heif"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      <div className="preset-row" role="group" aria-label="Privacy preset">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset-btn ${preset === p.id ? "active" : ""}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {jobs.map((job) => (
        <div key={job.id} className="file-row">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.5rem",
            }}
          >
            <div>
              <strong>{job.file.name}</strong>
              <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                {(job.file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <span className={job.mode === "browser" ? "badge badge-browser" : "badge badge-worker"}>
              {job.mode === "browser" ? "In browser" : "Server"}
            </span>
          </div>

          {job.loading && <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Processing…</p>}
          {job.error && <p className="error-msg">{job.error}</p>}

          <div className="actions-row">
            <button
              type="button"
              className="btn-primary"
              disabled={job.loading}
              onClick={() => handleScrub(job)}
            >
              <Shield size={16} />
              Scrub metadata
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={job.loading}
              onClick={() => {
                const showMetadata = !job.showMetadata;
                updateJob(job.id, { showMetadata });
                if (showMetadata && !job.report) void loadMetadata(job);
              }}
            >
              View metadata
            </button>
          </div>

          {job.showMetadata && job.report && (
            <pre className="metadata-panel">{JSON.stringify(job.report.blocks, null, 2)}</pre>
          )}

          {job.scrubResult && (
            <div className="actions-row" style={{ marginTop: "0.5rem" }}>
              <button type="button" className="btn-secondary" onClick={() => downloadCleaned(job)}>
                <Download size={14} /> Cleaned file
              </button>
              <button type="button" className="btn-secondary" onClick={() => downloadProveCleanJson(job)}>
                <FileJson size={14} /> Prove-clean JSON
              </button>
              <button type="button" className="btn-secondary" onClick={() => downloadProveCleanReport(job)}>
                <Download size={14} /> Prove-clean report (TXT)
              </button>
            </div>
          )}

          {job.diffResult && (
            <details style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
              <summary>
                Metadata diff (
                {job.diffResult.entries.filter((entry) => entry.status === "removed").length} removed)
              </summary>
              <pre className="metadata-panel">
                {JSON.stringify(
                  job.diffResult.entries.filter((entry) => entry.status !== "unchanged"),
                  null,
                  2
                )}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
