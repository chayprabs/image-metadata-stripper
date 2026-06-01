import { useCallback, useEffect, useState } from "react";
import {
  read,
  scrub,
  diff,
  getProcessingMode,
  proveCleanToPdf,
  type MetadataReport,
  type ScrubPreset,
  type ScrubResult,
  type Diff,
  type CustomField,
} from "@exifscrub/core";
import {
  Shield,
  Upload,
  Download,
  FileJson,
  FlaskConical,
  Link as LinkIcon,
  Trash2,
  X,
  Archive,
} from "lucide-react";
import { workerScrub, workerRead, workerFetchUrl, workerBatch } from "../api/worker";
import WorkerBanner from "../components/WorkerBanner";
import DiffView from "../components/DiffView";
import { assetUrl, isAppRelativeUrl, resolveFetchUrl } from "../utils/assetUrl";

interface FileJob {
  id: string;
  file: File;
  mode: "browser" | "worker";
  report?: MetadataReport;
  reportBefore?: MetadataReport;
  reportAfter?: MetadataReport;
  scrubResult?: ScrubResult;
  diffResult?: Diff;
  error?: string;
  loading?: boolean;
  showMetadata?: boolean;
  showDiff?: boolean;
}

const PRESETS: { id: ScrubPreset; label: string }[] = [
  { id: "all", label: "Strip all" },
  { id: "gps_author", label: "Strip GPS + author" },
  { id: "orientation_only", label: "Keep orientation only" },
  { id: "custom", label: "Custom" },
];

const SAMPLES = [
  { name: "geotagged.jpg", label: "Geotagged JPEG", path: "samples/geotagged.jpg" },
  { name: "pdf-with-author.pdf", label: "PDF with Author", path: "samples/pdf-with-author.pdf" },
  { name: "mp3-with-id3.mp3", label: "MP3 with ID3", path: "samples/mp3-with-id3.mp3" },
  { name: "video-with-meta.mp4", label: "MP4 with metadata", path: "samples/video-with-meta.mp4" },
];

export function parseCustomFields(text: string): CustomField[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const idx = l.indexOf(":");
      if (idx === -1) return { namespace: "EXIF", field: l };
      const namespace = l.slice(0, idx);
      const field = l.slice(idx + 1);
      return { namespace: namespace || "EXIF", field };
    })
    .filter((c) => c.field.trim().length > 0);
}

export default function HomePage() {
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [preset, setPreset] = useState<ScrubPreset>("all");
  const [dragOver, setDragOver] = useState(false);
  const [customFields, setCustomFields] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const customList = preset === "custom" ? parseCustomFields(customFields) : undefined;
  const scrubOpts = { preset, custom: customList };

  useEffect(() => {
    setJobs((prev) =>
      prev.map((j) => ({
        ...j,
        scrubResult: undefined,
        diffResult: undefined,
        showDiff: undefined,
        reportAfter: undefined,
      })),
    );
  }, [preset, customFields]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const newJobs: FileJob[] = list.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      mode: getProcessingMode(file.type, file.name),
    }));
    setJobs((prev) => [...prev, ...newJobs]);
    for (const job of newJobs) void loadMetadata(job);
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
    if (preset === "custom" && !customList?.length) {
      updateJob(job.id, {
        error: "Add at least one field in the custom list (one per line, e.g. EXIF:Artist)",
      });
      return;
    }

    updateJob(job.id, { loading: true, error: undefined });
    try {
      const before =
        job.report ??
        (job.mode === "browser" ? await read(job.file) : await workerRead(job.file));

      const result =
        job.mode === "browser"
          ? await scrub(job.file, scrubOpts)
          : await workerScrub(job.file, preset, scrubOpts.custom);

      const cleanedFile = new File([result.cleanedBlob], job.file.name, {
        type: result.cleaned.mime || job.file.type || before.file.mime,
      });
      const after =
        job.mode === "browser" ? await read(cleanedFile) : await workerRead(cleanedFile);

      updateJob(job.id, {
        scrubResult: result,
        reportBefore: before,
        reportAfter: after,
        report: after,
        diffResult: diff(before, after),
        showDiff: true,
        loading: false,
      });
    } catch (e) {
      updateJob(job.id, {
        loading: false,
        error: e instanceof Error ? e.message : "Scrub failed",
      });
    }
  }

  async function handleScrubAll() {
    for (const job of jobs.filter((j) => !j.scrubResult && !j.loading)) {
      await handleScrub(job);
    }
  }

  async function handleBatchZip(zipFile: File) {
    if (preset === "custom" && !customList?.length) {
      setBatchError("Add at least one custom field before running batch ZIP");
      return;
    }
    setBatchLoading(true);
    setBatchError(null);
    try {
      const blob = await workerBatch(zipFile, preset, customList);
      triggerDownload(blob, "exif-scrub-batch.zip");
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchLoading(false);
    }
  }

  function downloadCleaned(job: FileJob) {
    if (!job.scrubResult) return;
    triggerDownload(job.scrubResult.cleanedBlob, `clean-${job.file.name}`);
  }

  function downloadProveCleanJson(job: FileJob) {
    if (!job.scrubResult) return;
    triggerDownload(
      new Blob([JSON.stringify(job.scrubResult.proveCleanJson, null, 2)], {
        type: "application/json",
      }),
      `prove-clean-${job.file.name}.json`,
    );
  }

  async function downloadProveCleanReport(job: FileJob) {
    if (!job.scrubResult) return;
    try {
      const pdf = await proveCleanToPdf(job.scrubResult.proveCleanJson);
      triggerDownload(pdf, `prove-clean-${job.file.name}.pdf`);
    } catch (e) {
      updateJob(job.id, {
        error: e instanceof Error ? e.message : "Prove-clean PDF generation failed",
      });
    }
  }

  async function loadSample(sample: (typeof SAMPLES)[0]) {
    setSampleError(null);
    try {
      const res = await fetch(assetUrl(sample.path));
      if (!res.ok) throw new Error(`Sample not found (${res.status})`);
      const blob = await res.blob();
      addFiles([new File([blob], sample.name, { type: blob.type || "application/octet-stream" })]);
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : "Sample unavailable");
    }
  }

  async function loadFromUrl() {
    if (!urlInput.trim()) return;
    setUrlError(null);
    const url = urlInput.trim();
    try {
      if (isAppRelativeUrl(url)) {
        const res = await fetch(resolveFetchUrl(url));
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const blob = await res.blob();
        const name = url.split("/").pop()?.split("?")[0] || "download";
        addFiles([new File([blob], name, { type: blob.type || "application/octet-stream" })]);
      } else {
        const file = await workerFetchUrl(url);
        addFiles([file]);
      }
      setUrlInput("");
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : "Could not load URL");
    }
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
      <WorkerBanner />

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
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && document.getElementById("file-input")?.click()}
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
          accept="image/*,.pdf,.mp3,.mp4,.mov,.flac,.wav,.heic,.heif,.zip"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="sample-row">
        <FlaskConical size={14} />
        <span>Samples:</span>
        {SAMPLES.map((s) => (
          <button key={s.name} type="button" className="preset-btn" onClick={() => loadSample(s)}>
            {s.label}
          </button>
        ))}
      </div>
      {sampleError && <p className="error-msg">{sampleError}</p>}

      <div className="url-row">
        <LinkIcon size={14} />
        <input
          type="url"
          placeholder="Paste file URL (uses server for external links)"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadFromUrl()}
        />
          <button type="button" className="btn-secondary" aria-label="Load URL" onClick={loadFromUrl}>
            Load URL
          </button>
      </div>
      {urlError && <p className="error-msg">{urlError}</p>}

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

      {preset === "custom" && (
        <textarea
          className="custom-fields"
          placeholder="Fields to strip, one per line: EXIF:Artist&#10;GPS:latitude"
          value={customFields}
          onChange={(e) => setCustomFields(e.target.value)}
          rows={3}
        />
      )}

      <div className="actions-row" style={{ marginBottom: jobs.length > 0 ? "0.75rem" : 0 }}>
        {jobs.length > 0 && (
          <>
            <button type="button" className="btn-primary" onClick={handleScrubAll}>
              <Shield size={14} /> Scrub all ({jobs.length})
            </button>
            <button type="button" className="btn-secondary" onClick={() => {
            setJobs([]);
            setSampleError(null);
            setUrlError(null);
            setBatchError(null);
          }}>
              <Trash2 size={14} /> Clear all
            </button>
          </>
        )}
        <label className="btn-secondary" style={{ cursor: "pointer" }}>
          <Archive size={14} /> Batch ZIP
          <input
            type="file"
            accept=".zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleBatchZip(f);
              e.target.value = "";
            }}
          />
        </label>
        {batchLoading && <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Batch processing…</span>}
      </div>
      {batchError && <p className="error-msg">{batchError}</p>}

      {jobs.map((job) => (
        <div key={job.id} className="file-row">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              {job.report?.thumbnails?.[0] && (
                <img
                  src={job.report.thumbnails[0].dataUrl}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
                />
              )}
              <div>
                <strong>{job.file.name}</strong>
                <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                  {(job.file.size / 1024).toFixed(1)} KB
                  {job.report && ` · ${job.report.blocks.length} blocks`}
                </span>
                {job.report && (
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
                    sha256: {(job.reportAfter ?? job.report).file.sha256.slice(0, 16)}…
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
              <span className={job.mode === "browser" ? "badge badge-browser" : "badge badge-worker"}>
                {job.mode === "browser" ? "In browser" : "Server"}
              </span>
              <button type="button" className="preset-btn" aria-label="Remove file" onClick={() => setJobs((p) => p.filter((j) => j.id !== job.id))}>
                <X size={14} />
              </button>
            </div>
          </div>

          {job.loading && <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Processing…</p>}
          {job.error && <p className="error-msg">{job.error}</p>}

          <div className="actions-row">
            <button type="button" className="btn-primary" disabled={job.loading} onClick={() => handleScrub(job)}>
              <Shield size={16} /> Scrub metadata
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={job.loading}
              onClick={() => {
                const show = !job.showMetadata;
                updateJob(job.id, { showMetadata: show });
                if (show && !job.report) void loadMetadata(job);
              }}
            >
              View metadata
            </button>
          </div>

          {job.showMetadata && (job.reportAfter ?? job.report) && (
            <pre className="metadata-panel">{JSON.stringify((job.reportAfter ?? job.report)!.blocks, null, 2)}</pre>
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
                <Download size={14} /> Prove-clean PDF
              </button>
            </div>
          )}

          {job.diffResult && (
            <details
              open={job.showDiff ?? true}
              style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}
              onToggle={(e) =>
                updateJob(job.id, { showDiff: (e.currentTarget as HTMLDetailsElement).open })
              }
            >
              <summary>
                Metadata diff ({job.diffResult.entries.filter((e) => e.status === "removed").length} removed)
              </summary>
              <DiffView diff={job.diffResult} />
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
