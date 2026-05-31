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

const METADATA_PNG_TYPES = new Set([
  "tEXt",
  "iTXt",
  "zTXt",
  "eXIf",
  "tIME",
  "pHYs",
  "sRGB",
  "gAMA",
  "cHRM",
  "iCCP",
]);

export interface ScrubOptions {
  preset: ScrubPreset;
  custom?: CustomField[];
}

export async function scrub(file: File, opts: ScrubOptions): Promise<ScrubResult> {
  const before = await read(file);
  const mime = before.file.mime;
  let cleanedBlob: Blob;

  if (mime === "image/jpeg" || file.name.match(/\.jpe?g$/i)) {
    cleanedBlob = await scrubJpeg(file, opts, before);
  } else if (mime === "image/png" || file.name.match(/\.png$/i)) {
    cleanedBlob = await scrubPng(file);
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

async function scrubJpeg(
  file: File,
  opts: ScrubOptions,
  before: MetadataReport
): Promise<Blob> {
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

  let exifObj: piexif.IExif = {};
  try {
    exifObj = piexif.load(dataUrl);
  } catch {
    exifObj = { "0th": {}, Exif: {}, GPS: {}, "1st": {}, thumbnail: null };
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
    applyCustomExifRemoval(exifObj, opts.custom, before);
    const dumped = piexif.dump(exifObj);
    const inserted = piexif.insert(dumped, piexif.remove(dataUrl));
    return dataUrlToBlob(inserted, "image/jpeg");
  }

  return dataUrlToBlob(piexif.remove(dataUrl), "image/jpeg");
}

function stripGpsAuthorFromExif(exifObj: piexif.IExif): void {
  exifObj.GPS = {};
  const removeFrom0th = [
    piexif.ImageIFD.Artist,
    piexif.ImageIFD.Copyright,
    piexif.ImageIFD.ImageDescription,
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

function applyCustomExifRemoval(
  _exifObj: piexif.IExif,
  custom: CustomField[],
  _before: MetadataReport
): void {
  for (const { field } of custom) {
    for (const block of _before.blocks) {
      if (block.fields[field] !== undefined) {
        delete block.fields[field];
      }
    }
  }
}

async function scrubPng(file: File): Promise<Blob> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const chunks = extractChunks(buffer);
  const kept = chunks.filter((c) => !METADATA_PNG_TYPES.has(c.name));
  const encoded = encodeChunks(kept);
  return new Blob([encoded], { type: "image/png" });
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
  if (stripped.length === 0 && before.blocks.length > 0) {
    for (const block of before.blocks) {
      for (const [field, value] of Object.entries(block.fields)) {
        stripped.push({ namespace: block.namespace, field, value });
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
  return true;
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
