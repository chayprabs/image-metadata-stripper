/**
 * Comprehensive verification suite for @exifscrub/core browser processing.
 * Documents pass/fail behavior and edge cases — not part of the minimal unit test suite.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";
import {
  read,
  scrub,
  diff,
  verifyProveClean,
  canonicalPayload,
  signProveClean,
  buildProveCleanPayload,
  getProcessingMode,
  type ScrubResult,
  type MetadataReport,
} from "./index.js";

const SAMPLES = join(import.meta.dirname ?? ".", "../../../samples");
const geotaggedBuffer = readFileSync(join(SAMPLES, "geotagged.jpg"));

function bufferToFile(buffer: Buffer, name: string, type: string): File {
  return new File([Uint8Array.from(buffer)], name, { type });
}

function geotaggedFile(): File {
  return bufferToFile(geotaggedBuffer, "geotagged.jpg", "image/jpeg");
}

/** Build a PNG with tEXt metadata chunks from png-chunks-extract test fixture */
function createPngWithMetadata(): Uint8Array {
  const basePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../node_modules/.pnpm/png-chunks-extract@1.0.0/node_modules/png-chunks-extract/test.png",
  );
  const base = new Uint8Array(readFileSync(basePath));
  const chunks = extractChunks(base);
  const ihdrIdx = chunks.findIndex((c) => c.name === "IHDR");
  const textAuthor = {
    name: "tEXt" as const,
    data: new TextEncoder().encode("Author\0Sample Photographer"),
  };
  const textGps = {
    name: "tEXt" as const,
    data: new TextEncoder().encode(`GPS${String.fromCharCode(31)}.7749,-122.4194`),
  };
  const injected = [
    ...chunks.slice(0, ihdrIdx + 1),
    textAuthor,
    textGps,
    ...chunks.slice(ihdrIdx + 1),
  ];
  return new Uint8Array(encodeChunks(injected));
}

function fieldStillPresent(report: MetadataReport, field: string): boolean {
  return report.blocks.some((b) => Object.keys(b.fields).some((f) => f === field || f.toLowerCase().includes(field.toLowerCase())));
}

function strippedFalsePositives(result: ScrubResult, afterReport: MetadataReport): string[] {
  const fps: string[] = [];
  for (const s of result.stripped) {
    const block = afterReport.blocks.find((b) => b.namespace === s.namespace);
    if (block?.fields[s.field] !== undefined) {
      fps.push(`${s.namespace}.${s.field}`);
    }
  }
  return fps;
}

function retainedFalseNegatives(result: ScrubResult, afterReport: MetadataReport): string[] {
  const missing: string[] = [];
  for (const r of result.retained) {
    const block = afterReport.blocks.find((b) => b.namespace === r.namespace);
    if (block?.fields[r.field] === undefined) {
      missing.push(`${r.namespace}.${r.field}`);
    }
  }
  return missing;
}

describe("comprehensive: JPEG geotagged.jpg presets", () => {
  let before: MetadataReport;

  beforeAll(async () => {
    before = await read(geotaggedFile());
  });

  it("before sample has GPS and Artist", () => {
    expect(fieldStillPresent(before, "GPSLatitude") || fieldStillPresent(before, "latitude")).toBe(true);
    expect(fieldStillPresent(before, "Artist")).toBe(true);
    expect(fieldStillPresent(before, "Make")).toBe(true);
  });

  it("preset=all removes all metadata blocks", async () => {
    const result = await scrub(geotaggedFile(), { preset: "all" });
    const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
    expect(after.blocks.length).toBe(0);
    expect(await verifyProveClean(result.proveCleanJson)).toBe(true);
    expect(strippedFalsePositives(result, after)).toEqual([]);
    expect(result.proveCleanJson.stripped.length).toBeGreaterThan(0);
  });

  it("preset=gps_author strips GPS+Artist but retains Make/Model", async () => {
    const result = await scrub(geotaggedFile(), { preset: "gps_author" });
    const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
    expect(fieldStillPresent(after, "GPSLatitude")).toBe(false);
    expect(fieldStillPresent(after, "latitude")).toBe(false);
    expect(fieldStillPresent(after, "Artist")).toBe(false);
    expect(fieldStillPresent(after, "Make")).toBe(true);
    expect(fieldStillPresent(after, "Model")).toBe(true);
    expect(strippedFalsePositives(result, after)).toEqual([]);
  });

  it("preset=orientation_only retains only orientation-related fields", async () => {
    const result = await scrub(geotaggedFile(), { preset: "orientation_only" });
    const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
    expect(fieldStillPresent(after, "GPSLatitude")).toBe(false);
    expect(fieldStillPresent(after, "Artist")).toBe(false);
    expect(fieldStillPresent(after, "Make")).toBe(false);
    // geotagged sample may lack Orientation tag — retained list should only have orientation if present
    const nonOrientationRetained = result.retained.filter(
      (r) => !r.field.toLowerCase().includes("orientation"),
    );
    expect(nonOrientationRetained).toEqual([]);
    expect(strippedFalsePositives(result, after)).toEqual([]);
  });

  it("preset=custom with GPS namespace strips GPS only", async () => {
    const result = await scrub(geotaggedFile(), {
      preset: "custom",
      custom: [{ namespace: "GPS", field: "GPSLatitude" }],
    });
    const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
    expect(fieldStillPresent(after, "GPSLatitude")).toBe(false);
    expect(fieldStillPresent(after, "Artist")).toBe(true);
    expect(fieldStillPresent(after, "Make")).toBe(true);
    expect(strippedFalsePositives(result, after)).toEqual([]);
  });

  it("preset=custom with Artist field strips Artist only", async () => {
    const result = await scrub(geotaggedFile(), {
      preset: "custom",
      custom: [{ namespace: "EXIF", field: "Artist" }],
    });
    const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
    expect(fieldStillPresent(after, "Artist")).toBe(false);
    expect(fieldStillPresent(after, "Make")).toBe(true);
    expect(strippedFalsePositives(result, after)).toEqual([]);
  });
});

describe("comprehensive: edge cases", () => {
  it("custom preset with empty custom array throws validation error (JPEG)", async () => {
    const file = geotaggedFile();
    await expect(scrub(file, { preset: "custom" })).rejects.toThrow(/at least one field/i);
  });

  it("custom preset with empty custom array throws validation error (PNG)", async () => {
    const png = createPngWithMetadata();
    const file = bufferToFile(Buffer.from(png), "meta.png", "image/png");
    await expect(scrub(file, { preset: "custom" })).rejects.toThrow(/at least one field/i);
  });

  it("gps_author keeps Orientation when present in JPEG", async () => {
    // Inject orientation=6 into minimal JPEG via piexif if available
    const piexif = (await import("piexifjs")).default;
    const file = geotaggedFile();
    const buf = await file.arrayBuffer();
    const binary = Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join("");
    const dataUrl = "data:image/jpeg;base64," + btoa(binary);
    let exifObj = piexif.load(dataUrl);
    exifObj["0th"] = exifObj["0th"] || {};
    exifObj["0th"][piexif.ImageIFD.Orientation] = 6;
    const withOrient = piexif.insert(piexif.dump(exifObj), dataUrl);
    const base64 = withOrient.split(",")[1]!;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const orientedFile = new File([bytes], "oriented.jpg", { type: "image/jpeg" });

    const result = await scrub(orientedFile, { preset: "gps_author" });
    const after = await read(new File([result.cleanedBlob], "oriented.jpg", { type: "image/jpeg" }));
    expect(fieldStillPresent(after, "Orientation")).toBe(true);
    expect(fieldStillPresent(after, "Artist")).toBe(false);
    expect(fieldStillPresent(after, "GPSLatitude")).toBe(false);
  });
});

describe("comprehensive: PNG scrub presets", () => {
  let pngBytes: Uint8Array;
  let pngFile: File;

  beforeAll(() => {
    pngBytes = createPngWithMetadata();
    pngFile = bufferToFile(Buffer.from(pngBytes), "meta.png", "image/png");
  });

  it("PNG preset=all strips text chunks", async () => {
    const result = await scrub(pngFile, { preset: "all" });
    const chunks = extractChunks(new Uint8Array(await result.cleanedBlob.arrayBuffer())).map((c) => c.name);
    expect(chunks).not.toContain("tEXt");
    expect(chunks).toContain("IHDR");
    expect(chunks).toContain("IDAT");
  });

  it("PNG preset=gps_author strips author/gps text chunks", async () => {
    const result = await scrub(pngFile, { preset: "gps_author" });
    const chunks = extractChunks(new Uint8Array(await result.cleanedBlob.arrayBuffer()));
    const texts = chunks.filter((c) => c.name === "tEXt").map((c) => new TextDecoder().decode(c.data));
    for (const t of texts) {
      expect(t.toLowerCase()).not.toMatch(/author|gps/);
    }
  });

  it("PNG preset=all strips iCCP chunk", async () => {
    const result = await scrub(pngFile, { preset: "all" });
    const chunks = extractChunks(new Uint8Array(await result.cleanedBlob.arrayBuffer())).map((c) => c.name);
    expect(chunks).not.toContain("iCCP");
    const after = await read(new File([result.cleanedBlob], "meta.png", { type: "image/png" }));
    const iccFields = after.blocks.flatMap((b) => Object.keys(b.fields)).filter((f) => f.startsWith("Profile"));
    expect(iccFields).toEqual([]);
  });

  it("PNG preset=orientation_only strips eXIf chunk", async () => {
    const chunks = extractChunks(pngBytes);
    const exifChunk = { name: "eXIf" as const, data: new Uint8Array([0, 1, 2, 3]) };
    const withExif = new Uint8Array(encodeChunks([...chunks.slice(0, 2), exifChunk, ...chunks.slice(2)]));
    const file = bufferToFile(Buffer.from(withExif), "exif.png", "image/png");
    const result = await scrub(file, { preset: "orientation_only" });
    const afterChunks = extractChunks(new Uint8Array(await result.cleanedBlob.arrayBuffer())).map((c) => c.name);
    expect(afterChunks.includes("eXIf")).toBe(false);
  });
});

describe("comprehensive: prove-clean JSON", () => {
  it("has required structure and valid signature", async () => {
    const result = await scrub(geotaggedFile(), { preset: "all" });
    const p = result.proveCleanJson;
    expect(p.version).toBe("1");
    expect(p.filename).toBe("geotagged.jpg");
    expect(p.cleanedSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(p.signatureAlgorithm).toBe("Ed25519-browser");
    expect(p.signingKeyId).toBe("exifscrub-browser-v1");
    expect(p.publicKey).toBeTruthy();
    expect(p.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(p.stripped.every((s) => s.namespace && s.field)).toBe(true);
    expect(await verifyProveClean(p)).toBe(true);
  });

  it("canonical JSON signing is consistent across sign/verify", async () => {
    const payload = await buildProveCleanPayload({
      filename: "test.jpg",
      cleanedSha256: "a".repeat(64),
      stripped: [{ namespace: "GPS", field: "latitude", value: 1 }],
      retained: [{ namespace: "EXIF", field: "Make", value: "Canon" }],
    });
    payload.signature = await signProveClean(payload);
    const { signature, ...rest } = payload;
    const canonical1 = canonicalPayload(rest);
    const canonical2 = canonicalPayload(rest);
    expect(canonical1).toBe(canonical2);
    expect(await verifyProveClean(payload)).toBe(true);
    // Tamper should fail
    payload.stripped = [...payload.stripped, { namespace: "X", field: "Y", value: 1 }];
    expect(await verifyProveClean(payload)).toBe(false);
  });

  it("stripped/retained entries match post-scrub read report", async () => {
    const result = await scrub(geotaggedFile(), { preset: "gps_author" });
    const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
    expect(strippedFalsePositives(result, after)).toEqual([]);
    expect(retainedFalseNegatives(result, after)).toEqual([]);
  });
});

describe("comprehensive: getProcessingMode", () => {
  const cases: [string, string, "browser" | "worker"][] = [
    ["image/jpeg", "photo.jpg", "browser"],
    ["image/png", "photo.png", "browser"],
    ["image/heic", "photo.heic", "browser"],
    ["image/webp", "photo.webp", "browser"],
    ["image/gif", "photo.gif", "browser"],
    ["image/tiff", "photo.tiff", "browser"],
    ["image/avif", "photo.avif", "browser"],
    ["image/bmp", "photo.bmp", "browser"],
    ["application/pdf", "doc.pdf", "worker"],
    ["application/pdf", "photo.jpg", "worker"],
    ["audio/mpeg", "song.mp3", "worker"],
    ["video/mp4", "clip.mp4", "worker"],
    ["application/octet-stream", "photo.jpg", "browser"],
    ["application/octet-stream", "doc.pdf", "worker"],
    ["application/octet-stream", "unknown.xyz", "browser"],
  ];

  for (const [mime, name, expected] of cases) {
    it(`${name} (${mime}) => ${expected}`, () => {
      expect(getProcessingMode(mime, name)).toBe(expected);
    });
  }
});

describe("comprehensive: HEIC path (Node — no document)", () => {
  it("HEIC scrub throws in Node without browser APIs", async () => {
    const fakeHeic = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]);
    const file = new File([fakeHeic], "test.heic", { type: "image/heic" });
    expect(typeof document).toBe("undefined");
    await expect(scrub(file, { preset: "all" })).rejects.toThrow(/browser environment/i);
  });
});

describe("comprehensive: WebP/GIF canvas path (Node — no document)", () => {
  it("WebP scrub throws in Node without browser APIs", async () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const file = new File([webp], "test.webp", { type: "image/webp" });
    await expect(scrub(file, { preset: "all" })).rejects.toThrow(/browser environment/i);
  });

  it("GIF scrub throws in Node without browser APIs", async () => {
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
      0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x4c, 0x01, 0x00, 0x3b,
    ]);
    const file = new File([gif], "test.gif", { type: "image/gif" });
    await expect(scrub(file, { preset: "all" })).rejects.toThrow(/browser environment/i);
  });
});

describe("comprehensive: diff accuracy vs scrub stripped", () => {
  it("diff removed fields align with scrub stripped for preset=all", async () => {
    const file = geotaggedFile();
    const before = await read(file);
    const result = await scrub(file, { preset: "all" });
    const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
    const d = diff(before, after);
    const removed = d.entries.filter((e) => e.status === "removed").map((e) => e.path);
    const strippedPaths = result.stripped.map((s) => `${s.namespace}.${s.field}`);
    // Every stripped entry should correspond to a removed diff entry
    for (const sp of strippedPaths) {
      expect(removed).toContain(sp);
    }
  });
});
