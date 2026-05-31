import exifr from "exifr";
import type { MetadataBlock, MetadataNamespace, MetadataReport } from "./types.js";
import { sha256HexFromBlob } from "./hash.js";

const GPS_KEYS = new Set([
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSAltitude",
  "GPSDateStamp",
  "GPSTimeStamp",
]);

const AUTHOR_KEYS = new Set([
  "Artist",
  "Author",
  "Creator",
  "OwnerName",
  "Copyright",
  "UserComment",
  "ImageDescription",
  "CameraOwnerName",
  "BodySerialNumber",
  "LensSerialNumber",
]);

function classifyKey(key: string): MetadataNamespace {
  const k = key.toLowerCase();
  if (k.includes("gps") || GPS_KEYS.has(key)) return "GPS";
  if (k.includes("xmp") || key.startsWith("xmp")) return "XMP";
  if (k.includes("iptc")) return "IPTC";
  if (k.includes("makernote")) return "MakerNotes";
  if (k.includes("icc")) return "ICC";
  return "EXIF";
}

function flattenToBlocks(data: Record<string, unknown>): MetadataBlock[] {
  const byNs = new Map<MetadataNamespace, Record<string, unknown>>();

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const ns = classifyKey(key);
    if (!byNs.has(ns)) byNs.set(ns, {});
    byNs.get(ns)![key] = value;
  }

  return Array.from(byNs.entries()).map(([namespace, fields]) => ({
    namespace,
    fields,
  }));
}

export async function read(file: File): Promise<MetadataReport> {
  const buffer = await file.arrayBuffer();
  const sha256 = await sha256HexFromBlob(new Blob([buffer]));

  let parsed: Record<string, unknown> = {};
  try {
    const result = await exifr.parse(buffer, {
      tiff: true,
      xmp: true,
      iptc: true,
      icc: true,
      mergeOutput: true,
    });
    if (result && typeof result === "object") {
      parsed = result as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }

  const blocks = flattenToBlocks(parsed);
  const thumbnails: MetadataReport["thumbnails"] = [];

  try {
    const thumb = await exifr.thumbnail(buffer);
    if (thumb) {
      const thumbBytes = thumb instanceof Uint8Array ? thumb : new Uint8Array(thumb as ArrayBuffer);
      const copy = new Uint8Array(thumbBytes);
      const blob = new Blob([copy], { type: "image/jpeg" });
      const dataUrl = await blobToDataUrl(blob);
      thumbnails.push({ source: "embedded", dataUrl });
    }
  } catch {
    /* no thumbnail */
  }

  return {
    file: {
      name: file.name,
      sha256,
      mime: file.type || guessMime(file.name),
      size: file.size,
    },
    blocks,
    thumbnails,
  };
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    webp: "image/webp",
    tiff: "image/tiff",
    gif: "image/gif",
    avif: "image/avif",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export { AUTHOR_KEYS, GPS_KEYS };
