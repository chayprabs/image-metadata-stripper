import piexif from "piexifjs";
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";
import type {
  CustomField,
  MetadataReport,
  ScrubFieldEntry,
  ScrubPreset,
  ScrubResult,
} from "./types.js";
import { read, AUTHOR_KEYS, GPS_KEYS } from "./read.js";
import { sha256HexFromBlob } from "./hash.js";
import { buildProveCleanPayload, signProveClean } from "./prove-clean.js";

const PNG_TEXT_CHUNKS = new Set(["tEXt", "iTXt", "zTXt"]);
const PNG_EXIF_CHUNK = "eXIf";
const PNG_STRIP_ALL = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME", "pHYs", "gAMA", "cHRM"]);

export interface ScrubOptions {
  preset: ScrubPreset;
  custom?: CustomField[];
}

export async function scrub(file: File, opts: ScrubOptions): Promise<ScrubResult> {
  const before = await read(file);
  const mime = before.file.mime;
  let cleanedBlob: Blob;

  if (mime === "image/jpeg" || file.name.match(/\.jpe?g$/i)) {
    cleanedBlob = await scrubJpeg(file, opts);
  } else if (mime === "image/png" || file.name.match(/\.png$/i)) {
    cleanedBlob = await scrubPng(file, opts);
  } else if (
    mime === "image/webp" ||
    mime === "image/gif" ||
    mime === "image/bmp" ||
    file.name.match(/\.(webp|gif|bmp|tiff?|avif)$/i)
  ) {
    cleanedBlob = await scrubViaCanvas(file, opts, mime);
  } else if (mime === "image/heic" || mime === "image/heif" || file.name.match(/\.heic$|\.heif$/i)) {
    cleanedBlob = await scrubHeic(file, opts);
  } else {
    cleanedBlob = new Blob([await file.arrayBuffer()], { type: mime });
  }

  const after = await read(new File([cleanedBlob], file.name, { type: mime }));
  const stripped = diffStripped(before, after, opts);
  const retained = diffRetained(after, opts);

  const proveCleanJson = await buildProveCleanPayload({
    filename: file.name,
    cleanedSha256: await sha256HexFromBlob(cleanedBlob),
    stripped,
    retained,
  });
  proveCleanJson.signature = await signProveClean(proveCleanJson);

  return {
    cleanedBlob,
    cleaned: {
      sha256: proveCleanJson.cleanedSha256,
      mime,
      size: cleanedBlob.size,
    },
    stripped,
    retained,
    proveCleanJson,
  };
}

async function scrubJpeg(file: File, opts: ScrubOptions): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const binary = arrayBufferToBinaryString(buffer);
  let dataUrl: string;
  try {
    dataUrl = "data:image/jpeg;base64," + btoa(binary);
  } catch {
    const bytes = new Uint8Array(buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    dataUrl = "data:image/jpeg;base64," + btoa(bin);
  }

  let exifObj: piexif.IExif = { "0th": {}, Exif: {}, GPS: {}, "1st": {}, thumbnail: null };
  try {
    exifObj = piexif.load(dataUrl);
  } catch {
    /* keep empty exif */
  }

  if (opts.preset === "all") {
    const stripped = piexif.remove(dataUrl);
    return dataUrlToBlob(stripped, "image/jpeg");
  }

  if (opts.preset === "orientation_only") {
    const orientation = exifObj["0th"]?.[piexif.ImageIFD.Orientation];
    const fresh = piexif.remove(dataUrl);
    if (orientation !== undefined) {
      const newExif = piexif.load(fresh);
      newExif["0th"] = newExif["0th"] || {};
      newExif["0th"][piexif.ImageIFD.Orientation] = orientation;
      const inserted = piexif.insert(piexif.dump(newExif), fresh);
      return dataUrlToBlob(inserted, "image/jpeg");
    }
    return dataUrlToBlob(fresh, "image/jpeg");
  }

  if (opts.preset === "gps_author") {
    stripGpsAuthorFromExif(exifObj);
    const dumped = piexif.dump(exifObj);
    const inserted = piexif.insert(dumped, piexif.remove(dataUrl));
    return dataUrlToBlob(inserted, "image/jpeg");
  }

  if (opts.preset === "custom" && opts.custom?.length) {
    applyCustomExifRemoval(exifObj, opts.custom);
    const dumped = piexif.dump(exifObj);
    const inserted = piexif.insert(dumped, piexif.remove(dataUrl));
    return dataUrlToBlob(inserted, "image/jpeg");
  }

  if (opts.preset === "custom") {
    return dataUrlToBlob(dataUrl, "image/jpeg");
  }

  return dataUrlToBlob(piexif.remove(dataUrl), "image/jpeg");
}

function stripGpsAuthorFromExif(exifObj: piexif.IExif): void {
  exifObj.GPS = {};
  const removeFrom0th = [
    piexif.ImageIFD.Artist,
    piexif.ImageIFD.Copyright,
    piexif.ImageIFD.ImageDescription,
    piexif.ImageIFD.Software,
  ];
  for (const tag of removeFrom0th) {
    if (exifObj["0th"]?.[tag] !== undefined) delete exifObj["0th"][tag];
  }
  const exifTags = [
    piexif.ExifIFD.UserComment,
    piexif.ExifIFD.BodySerialNumber,
    piexif.ExifIFD.LensSerialNumber,
  ];
  for (const tag of exifTags) {
    if (exifObj.Exif?.[tag] !== undefined) delete exifObj.Exif[tag];
  }
}

function applyCustomExifRemoval(exifObj: piexif.IExif, custom: CustomField[]): void {
  for (const { namespace, field } of custom) {
    if (namespace === "GPS") {
      exifObj.GPS = {};
      continue;
    }
    deleteExifField(exifObj, field);
  }
}

function deleteExifField(exifObj: piexif.IExif, field: string): void {
  const ifdMaps: [Record<string, unknown>, keyof piexif.IExif][] = [
    [piexif.ImageIFD as Record<string, unknown>, "0th"],
    [piexif.ExifIFD as Record<string, unknown>, "Exif"],
    [piexif.GPSIFD as Record<string, unknown>, "GPS"],
  ];
  for (const [ifd, key] of ifdMaps) {
    const tag = ifd[field];
    if (typeof tag !== "number") continue;
    const section = exifObj[key] as Record<number, unknown> | undefined;
    if (section?.[tag] !== undefined) delete section[tag];
  }
}

async function scrubHeic(file: File, opts: ScrubOptions): Promise<Blob> {
  if (typeof document === "undefined") {
    return new Blob([await file.arrayBuffer()], { type: file.type || "image/heic" });
  }
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const jpegBlob = Array.isArray(converted) ? converted[0]! : converted;
    const jpegFile = new File([jpegBlob], file.name.replace(/\.heic$/i, ".jpg"), {
      type: "image/jpeg",
    });
    const scrubbed = await scrubJpeg(jpegFile, opts);
    return scrubbed;
  } catch {
    return new Blob([await file.arrayBuffer()], { type: file.type || "image/heic" });
  }
}

async function scrubViaCanvas(file: File, opts: ScrubOptions, mime: string): Promise<Blob> {
  if (typeof document === "undefined") {
    return new Blob([await file.arrayBuffer()], { type: mime });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const outputType = mime.startsWith("image/") ? mime : "image/png";
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
        outputType,
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

async function scrubPng(file: File, opts: ScrubOptions): Promise<Blob> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const chunks = extractChunks(buffer);

  if (opts.preset === "all") {
    const kept = chunks.filter((c) => !PNG_STRIP_ALL.has(c.name));
    return new Blob([new Uint8Array(encodeChunks(kept))], { type: "image/png" });
  }

  if (opts.preset === "gps_author") {
    const kept = chunks.filter((c) => {
      if (c.name === PNG_EXIF_CHUNK) return false;
      if (!PNG_TEXT_CHUNKS.has(c.name)) return true;
      const text = new TextDecoder().decode(c.data).toLowerCase();
      return !(
        text.includes("gps") ||
        text.includes("author") ||
        text.includes("creator") ||
        text.includes("copyright") ||
        text.includes("owner")
      );
    });
    return new Blob([new Uint8Array(encodeChunks(kept))], { type: "image/png" });
  }

  if (opts.preset === "orientation_only") {
    const kept = chunks.filter((c) => !PNG_TEXT_CHUNKS.has(c.name) && c.name !== "tIME");
    return new Blob([new Uint8Array(encodeChunks(kept))], { type: "image/png" });
  }

  if (opts.preset === "custom" && opts.custom?.length) {
    const stripFields = new Set(opts.custom.map((c) => c.field.toLowerCase()));
    const kept = chunks.filter((c) => {
      if (!PNG_TEXT_CHUNKS.has(c.name) && c.name !== PNG_EXIF_CHUNK) return true;
      const text = new TextDecoder().decode(c.data).toLowerCase();
      return ![...stripFields].some((f) => text.includes(f));
    });
    return new Blob([new Uint8Array(encodeChunks(kept))], { type: "image/png" });
  }

  const kept = chunks.filter((c) => !PNG_STRIP_ALL.has(c.name));
  return new Blob([new Uint8Array(encodeChunks(kept))], { type: "image/png" });
}

function diffStripped(
  before: MetadataReport,
  after: MetadataReport,
  opts: ScrubOptions
): ScrubFieldEntry[] {
  const stripped: ScrubFieldEntry[] = [];
  for (const block of before.blocks) {
    for (const [field, value] of Object.entries(block.fields)) {
      const afterBlock = after.blocks.find((b) => b.namespace === block.namespace);
      const stillThere = afterBlock?.fields[field];
      if (stillThere === undefined) {
        if (shouldStripField(field, opts)) {
          stripped.push({ namespace: block.namespace, field, value });
        }
      }
    }
  }
  return stripped;
}

function diffRetained(after: MetadataReport, opts: ScrubOptions): ScrubFieldEntry[] {
  const retained: ScrubFieldEntry[] = [];
  for (const block of after.blocks) {
    for (const [field, value] of Object.entries(block.fields)) {
      if (opts.preset === "orientation_only" && field.toLowerCase().includes("orientation")) {
        retained.push({ namespace: block.namespace, field, value });
      } else if (opts.preset !== "all") {
        retained.push({ namespace: block.namespace, field, value });
      }
    }
  }
  return retained;
}

function shouldStripField(field: string, opts: ScrubOptions): boolean {
  if (opts.preset === "all") return true;
  if (opts.preset === "gps_author") {
    return GPS_KEYS.has(field) || AUTHOR_KEYS.has(field) || field.toLowerCase().includes("gps");
  }
  if (opts.preset === "orientation_only") {
    return !field.toLowerCase().includes("orientation");
  }
  if (opts.preset === "custom") {
    return (
      opts.custom?.some(
        (c) =>
          c.field === field ||
          (c.namespace === "GPS" && (field.toLowerCase().includes("gps") || GPS_KEYS.has(field)))
      ) ?? false
    );
  }
  return false;
}

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}

function dataUrlToBlob(dataUrl: string, mime: string): Blob {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
