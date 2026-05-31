export type MetadataNamespace =
  | "EXIF"
  | "GPS"
  | "XMP"
  | "IPTC"
  | "MakerNotes"
  | "ICC"
  | "PNGText"
  | "PDFInfo"
  | "ID3"
  | "MP4Atoms";

export interface MetadataBlock {
  namespace: MetadataNamespace;
  fields: Record<string, unknown>;
}

export interface MetadataReport {
  file: { name: string; sha256: string; mime: string; size: number };
  blocks: MetadataBlock[];
  thumbnails: { source: string; dataUrl: string }[];
}

export type ScrubPreset = "all" | "gps_author" | "orientation_only" | "custom";

export interface CustomField {
  namespace: string;
  field: string;
}

export interface ScrubFieldEntry {
  namespace: string;
  field: string;
  value: unknown;
}

export interface ScrubResult {
  cleanedBlob: Blob;
  cleaned: { sha256: string; mime: string; size: number };
  stripped: ScrubFieldEntry[];
  retained: ScrubFieldEntry[];
  proveCleanJson: ProveCleanPayload;
}

export interface ProveCleanPayload {
  version: "1";
  filename: string;
  cleanedSha256: string;
  stripped: ScrubFieldEntry[];
  retained: ScrubFieldEntry[];
  timestamp: string;
  signature: string;
  signatureAlgorithm: "HMAC-SHA256" | "Ed25519-browser";
}

export interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
  status: "removed" | "added" | "changed" | "unchanged";
}

export interface Diff {
  entries: DiffEntry[];
}

export type ProcessingMode = "browser" | "worker";

export const BROWSER_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/tiff",
  "image/gif",
  "image/avif",
]);

export const WORKER_MIMES = new Set([
  "application/pdf",
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "video/mp4",
  "video/quicktime",
  "audio/wav",
  "audio/x-wav",
]);

export function getProcessingMode(mime: string, filename: string): ProcessingMode {
  if (BROWSER_MIMES.has(mime)) return "browser";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const browserExts = ["jpg", "jpeg", "png", "heic", "heif", "webp", "tiff", "tif", "gif", "avif"];
  if (browserExts.includes(ext)) return "browser";
  const workerExts = ["pdf", "mp3", "flac", "mp4", "mov", "wav"];
  if (workerExts.includes(ext)) return "worker";
  if (WORKER_MIMES.has(mime)) return "worker";
  return "browser";
}
