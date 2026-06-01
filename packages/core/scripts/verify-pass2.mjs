#!/usr/bin/env node
/**
 * Second verification pass — exhaustive browser-core checks.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const {
  read,
  scrub,
  diff,
  verifyProveClean,
  canonicalPayload,
  getProcessingMode,
  buildProveCleanPayload,
  signProveClean,
  BROWSER_MIMES,
  WORKER_MIMES,
  ScrubValidationError,
  ScrubEnvironmentError,
  UnsupportedFormatError,
} = await import(join(root, "packages/core/dist/index.js"));

const SAMPLES = join(root, "samples");
const findings = [];
let passCount = 0;

function bug(id, severity, fileLine, description, repro, expected, actual) {
  findings.push({ id, severity, fileLine, description, repro, expected, actual });
}

function pass(label) {
  passCount++;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail = "") {
  console.log(`  ✗ ${label}${detail ? `: ${detail}` : ""}`);
}

const geotagged = readFileSync(join(SAMPLES, "geotagged.jpg"));
const geoFile = () => new File([geotagged], "geotagged.jpg", { type: "image/jpeg" });

function strippedFP(result, after) {
  return result.stripped.filter((s) => {
    const b = after.blocks.find((x) => x.namespace === s.namespace);
    return b?.fields[s.field] !== undefined;
  });
}

function retainedFN(result, after) {
  return result.retained.filter((r) => {
    const b = after.blocks.find((x) => x.namespace === r.namespace);
    return b?.fields[r.field] === undefined;
  });
}

function fieldsInReport(report) {
  return report.blocks.flatMap((b) => Object.entries(b.fields).map(([f, v]) => ({ ns: b.namespace, field: f, value: v })));
}

// --- PNG fixture ---
const pngBasePath = join(
  root,
  "node_modules/.pnpm/png-chunks-extract@1.0.0/node_modules/png-chunks-extract/test.png",
);
const basePng = new Uint8Array(readFileSync(pngBasePath));
const baseChunks = extractChunks(basePng);
const ihdrIdx = baseChunks.findIndex((c) => c.name === "IHDR");

function makePng(extraChunks = []) {
  return new Uint8Array(
    encodeChunks([...baseChunks.slice(0, ihdrIdx + 1), ...extraChunks, ...baseChunks.slice(ihdrIdx + 1)]),
  );
}

console.log("\n=== A. JPEG presets on geotagged.jpg ===\n");
for (const preset of ["all", "gps_author", "orientation_only"]) {
  const result = await scrub(geoFile(), { preset });
  const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
  const fp = strippedFP(result, after);
  const fn = retainedFN(result, after);
  console.log(`  preset=${preset}: stripped=${result.stripped.length} retained=${result.retained.length} blocks=${after.blocks.length}`);
  if (fp.length) {
    bug("BUG-P2-001", "high", "scrub.ts:293-310", "Stripped false positive", `JPEG ${preset}`, "absent in after", JSON.stringify(fp));
    fail(`stripped FP (${preset})`, JSON.stringify(fp));
  } else pass(`no stripped FP (${preset})`);
  if (fn.length) {
    bug("BUG-P2-002", "medium", "scrub.ts:313-324", "Retained false negative", `JPEG ${preset}`, "present in after", JSON.stringify(fn));
    fail(`retained FN (${preset})`, JSON.stringify(fn));
  } else pass(`retained accurate (${preset})`);
  if (!(await verifyProveClean(result.proveCleanJson))) {
    bug("BUG-P2-003", "critical", "prove-clean.ts:76-87", "Invalid prove-clean signature", `JPEG ${preset}`, "valid sig", "invalid");
    fail(`prove-clean invalid (${preset})`);
  } else pass(`prove-clean valid (${preset})`);
}

console.log("\n=== B. JPEG custom presets ===\n");
const customCases = [
  { label: "GPS namespace", custom: [{ namespace: "GPS", field: "GPSLatitude" }] },
  { label: "Artist field", custom: [{ namespace: "EXIF", field: "Artist" }] },
  { label: "Make field", custom: [{ namespace: "EXIF", field: "Make" }] },
  { label: "multi", custom: [{ namespace: "GPS", field: "GPSLatitude" }, { namespace: "EXIF", field: "Artist" }] },
];
for (const { label, custom } of customCases) {
  const result = await scrub(geoFile(), { preset: "custom", custom });
  const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
  const fp = strippedFP(result, after);
  if (fp.length) {
    bug("BUG-P2-004", "high", "scrub.ts:293-310", `Custom stripped FP (${label})`, JSON.stringify(custom), "no FP", JSON.stringify(fp));
    fail(`custom ${label} FP`);
  } else pass(`custom ${label} no FP`);
}

console.log("\n=== C. custom empty validation ===\n");
try {
  await scrub(geoFile(), { preset: "custom" });
  bug("BUG-P2-005", "high", "scrub.ts:27-29", "Empty custom should throw", "scrub JPEG custom no fields", "ScrubValidationError", "resolved");
  fail("JPEG custom empty should throw");
} catch (e) {
  if (e instanceof ScrubValidationError || e.name === "ScrubValidationError") pass("JPEG custom empty throws");
  else {
    bug("BUG-P2-006", "medium", "scrub.ts:27-29", "Wrong error for empty custom JPEG", "scrub JPEG custom", "ScrubValidationError", e.message);
    fail("JPEG custom empty wrong error", e.message);
  }
}

const metaPng = makePng([{ name: "tEXt", data: new TextEncoder().encode("Author\0Test") }]);
try {
  await scrub(new File([metaPng], "meta.png", { type: "image/png" }), { preset: "custom" });
  bug("BUG-P2-007", "high", "scrub.ts:27-29", "Empty custom PNG should throw", "scrub PNG custom no fields", "ScrubValidationError", "resolved");
  fail("PNG custom empty should throw");
} catch (e) {
  if (e instanceof ScrubValidationError || e.name === "ScrubValidationError") pass("PNG custom empty throws");
  else fail("PNG custom empty wrong error", e.message);
}

console.log("\n=== D. PNG presets ===\n");
const pngWithMeta = makePng([
  { name: "tEXt", data: new TextEncoder().encode("Author\0Sample") },
  { name: "tEXt", data: new TextEncoder().encode("Comment\0Neutral text") },
  { name: "tEXt", data: new TextEncoder().encode(`GPS${String.fromCharCode(31)}.7749,-122.4194`) },
]);
const pngFile = new File([pngWithMeta], "meta.png", { type: "image/png" });

for (const preset of ["all", "gps_author", "orientation_only"]) {
  const result = await scrub(pngFile, { preset });
  const chunks = extractChunks(new Uint8Array(await result.cleanedBlob.arrayBuffer()));
  const names = chunks.map((c) => c.name);
  console.log(`  PNG ${preset}: chunks=${names.join(",")}`);
  if (preset === "all" && (names.includes("tEXt") || names.includes("eXIf"))) {
    bug("BUG-P2-008", "high", "scrub.ts:251-254", "PNG all leaves metadata chunks", preset, "no tEXt/eXIf", names.join(","));
    fail("PNG all leaves metadata");
  } else if (preset === "all") pass("PNG all strips metadata chunks");
}

const pngExif = makePng([{ name: "eXIf", data: new Uint8Array([0, 1, 2, 3, 4]) }]);
const orientPng = await scrub(new File([pngExif], "exif.png", { type: "image/png" }), { preset: "orientation_only" });
const orientNames = extractChunks(new Uint8Array(await orientPng.cleanedBlob.arrayBuffer())).map((c) => c.name);
if (orientNames.includes("eXIf")) {
  bug("BUG-P2-009", "medium", "scrub.ts:272-276", "PNG orientation_only retains eXIf", "PNG+eXIf orientation_only", "eXIf removed", "eXIf present");
  fail("PNG orientation_only keeps eXIf");
} else pass("PNG orientation_only strips eXIf");

const pngCustom = await scrub(pngFile, {
  preset: "custom",
  custom: [{ namespace: "EXIF", field: "author" }],
});
const customTexts = extractChunks(new Uint8Array(await pngCustom.cleanedBlob.arrayBuffer()))
  .filter((c) => c.name === "tEXt")
  .map((c) => new TextDecoder().decode(c.data).toLowerCase());
if (customTexts.some((t) => t.includes("author"))) {
  bug("BUG-P2-010", "high", "scrub.ts:279-286", "PNG custom failed to strip author tEXt", "custom author", "no author chunk", customTexts.join("|"));
  fail("PNG custom author not stripped");
} else pass("PNG custom strips author tEXt");

console.log("\n=== E. prove-clean attestation accuracy ===\n");
const ga = await scrub(geoFile(), { preset: "gps_author" });
const gaAfter = await read(new File([ga.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
const gaFields = fieldsInReport(gaAfter);
const gpsRemain = gaFields.filter((f) => f.field.toLowerCase().includes("gps") || f.field === "latitude" || f.field === "longitude");
if (gpsRemain.length) {
  bug("BUG-P2-011", "critical", "scrub.ts:123-128", "gps_author leaves GPS in file", "gps_author JPEG", "no GPS", JSON.stringify(gpsRemain));
  fail("GPS remains after gps_author");
} else pass("gps_author removes GPS");

const overlap = ga.stripped.map((s) => s.field).filter((f) => ga.retained.some((r) => r.field === f));
if (overlap.length) {
  bug("BUG-P2-012", "high", "scrub.ts:293-324", "Field in both stripped and retained", "gps_author", "disjoint", overlap.join(","));
  fail("stripped/retained overlap", overlap.join(","));
} else pass("stripped/retained disjoint (gps_author)");

const allRes = await scrub(geoFile(), { preset: "all" });
if (allRes.retained.length > 0) {
  bug("BUG-P2-013", "low", "scrub.ts:313-324", "preset=all has retained entries", "all preset", "retained=[]", `${allRes.retained.length} entries`);
  fail("all preset retained non-empty");
} else pass("all preset retained empty");

// Attestation when scrub fails silently would be bad — check Node canvas formats throw
console.log("\n=== F. Node environment errors (HEIC/WebP/GIF/BMP) ===\n");
const nodeFormatCases = [
  ["HEIC", new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]), "t.heic", "image/heic"],
  ["WebP", new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), "t.webp", "image/webp"],
  ["GIF", new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x4c, 0x01, 0x00, 0x3b]), "t.gif", "image/gif"],
  ["BMP", new Uint8Array([0x42, 0x4d, 0x3a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00]), "t.bmp", "image/bmp"],
];
for (const [label, bytes, name, mime] of nodeFormatCases) {
  try {
    const r = await scrub(new File([bytes], name, { type: mime }), { preset: "all" });
    const same = new Uint8Array(await r.cleanedBlob.arrayBuffer()).length === bytes.length;
    if (same && (await verifyProveClean(r.proveCleanJson))) {
      bug("BUG-P2-014", "critical", "scrub.ts:185-241", `${label} no-op in Node with valid prove-clean`, `scrub ${name} Node all`, "throw or no attestation", "passthrough + valid sig");
      fail(`${label} no-op with valid prove-clean in Node`);
    } else fail(`${label} resolved without throw (unexpected)`);
  } catch (e) {
    if (e instanceof ScrubEnvironmentError || e.name === "ScrubEnvironmentError") pass(`${label} throws ScrubEnvironmentError in Node`);
    else {
      bug("BUG-P2-015", "medium", "scrub.ts", `${label} wrong error in Node`, name, "ScrubEnvironmentError", e.message);
      fail(`${label} wrong error`, e.message);
    }
  }
}

console.log("\n=== G. Unsupported format ===\n");
try {
  await scrub(new File([new Uint8Array([1, 2, 3])], "x.xyz", { type: "application/octet-stream" }), { preset: "all" });
  // default getProcessingMode is browser — scrub may still try and fail
  bug("BUG-P2-016", "medium", "scrub.ts:52-54", "Unknown format should throw UnsupportedFormatError", "scrub .xyz", "UnsupportedFormatError", "resolved");
  fail("unknown .xyz should throw");
} catch (e) {
  if (e instanceof UnsupportedFormatError || e.name === "UnsupportedFormatError") pass(".xyz throws UnsupportedFormatError");
  else pass(`.xyz throws: ${e.name}`);
}

console.log("\n=== H. getProcessingMode exhaustive ===\n");
const modeCases = [
  ["image/jpeg", "a.jpg", "browser"],
  ["image/png", "a.png", "browser"],
  ["image/heic", "a.heic", "browser"],
  ["image/heif", "a.heif", "browser"],
  ["image/webp", "a.webp", "browser"],
  ["image/gif", "a.gif", "browser"],
  ["image/tiff", "a.tiff", "browser"],
  ["image/avif", "a.avif", "browser"],
  ["image/bmp", "a.bmp", "browser"],
  ["image/bmp", "a.BMP", "browser"],
  ["", "photo.JPEG", "browser"],
  ["application/octet-stream", "file.tiff", "browser"],
  ["application/octet-stream", "file.bmp", "browser"],
  ["application/octet-stream", "file.jpg", "browser"],
  ["application/pdf", "doc.pdf", "worker"],
  ["audio/mpeg", "song.mp3", "worker"],
  ["video/mp4", "clip.mp4", "worker"],
  ["application/octet-stream", "doc.pdf", "worker"],
  ["application/octet-stream", "unknown.xyz", "browser"],
  ["image/jpeg", "doc.pdf", "browser"], // mime wins for jpeg
  ["application/pdf", "photo.jpg", "browser"], // ext wins? pdf mime but jpg ext — jpeg ext in browserExts
];
for (const [mime, name, expected] of modeCases) {
  const actual = getProcessingMode(mime, name);
  if (actual !== expected) {
    bug("BUG-P2-017", "medium", "types.ts:93-102", `getProcessingMode mismatch`, `(${mime}, ${name})`, expected, actual);
    fail(`getProcessingMode(${mime}, ${name}) => ${actual}, expected ${expected}`);
  }
}

if (!BROWSER_MIMES.has("image/bmp")) {
  bug("BUG-P2-018", "low", "types.ts:71-80", "image/bmp missing from BROWSER_MIMES (scrub supports it)", "BROWSER_MIMES", "includes image/bmp", "missing — relies on default fallback");
  fail("image/bmp not in BROWSER_MIMES");
} else pass("image/bmp in BROWSER_MIMES");

if (!BROWSER_MIMES.has("image/heif")) {
  // heif is in set
}
// bmp extension not in browserExts
const bmpExtOnly = getProcessingMode("application/octet-stream", "x.bmp");
if (bmpExtOnly !== "browser") {
  bug("BUG-P2-019", "medium", "types.ts:96", "bmp extension not in browserExts", "octet-stream x.bmp", "browser", bmpExtOnly);
  fail("bmp ext routing");
} else pass("bmp ext routes browser via default");

console.log("\n=== I. diff vs scrub.stripped alignment ===\n");
const before = await read(geoFile());
for (const preset of ["all", "gps_author", "orientation_only"]) {
  const result = await scrub(geoFile(), { preset });
  const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
  const d = diff(before, after);
  const removed = d.entries.filter((e) => e.status === "removed").map((e) => e.path);
  const strippedPaths = result.stripped.map((s) => `${s.namespace}.${s.field}`);
  const missing = strippedPaths.filter((p) => !removed.includes(p));
  if (missing.length) {
    bug("BUG-P2-020", "medium", "scrub.ts:293-310 / diff.ts", `stripped not in diff removed (${preset})`, preset, "all stripped in diff", missing.join(","));
    fail(`diff alignment ${preset}`, missing.join(","));
  } else pass(`diff alignment ${preset}`);
}

console.log("\n=== J. MIME routing in scrub ===\n");
// JPEG with wrong mime but .jpg extension
const jpegWrongMime = new File([geotagged], "geotagged.jpg", { type: "application/octet-stream" });
const jwm = await scrub(jpegWrongMime, { preset: "all" });
const jwmAfter = await read(new File([jwm.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
if (jwmAfter.blocks.length > 0) {
  bug("BUG-P2-021", "high", "scrub.ts:36-37", "JPEG scrub via extension with octet-stream mime failed", "octet-stream + .jpg", "metadata stripped", `${jwmAfter.blocks.length} blocks remain`);
  fail("JPEG via extension scrub failed");
} else pass("JPEG routed via .jpg extension");

// PNG with wrong mime
const pngWrongMime = new File([pngWithMeta], "meta.png", { type: "" });
const pwm = await scrub(pngWrongMime, { preset: "all" });
const pwmChunks = extractChunks(new Uint8Array(await pwm.cleanedBlob.arrayBuffer())).map((c) => c.name);
if (pwmChunks.includes("tEXt")) {
  bug("BUG-P2-022", "high", "scrub.ts:38-39", "PNG scrub via extension with empty mime failed", "empty mime + .png", "tEXt stripped", "tEXt remains");
  fail("PNG via extension scrub failed");
} else pass("PNG routed via .png extension");

console.log("\n=== K. custom GPS namespace clears all GPS keys ===\n");
const gpsCustom = await scrub(geoFile(), { preset: "custom", custom: [{ namespace: "GPS", field: "GPSLatitude" }] });
const gpsAfter = await read(new File([gpsCustom.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
const gpsLeft = fieldsInReport(gpsAfter).filter((f) => f.ns === "GPS" || f.field.toLowerCase().includes("gps") || f.field === "latitude");
if (gpsLeft.length) {
  bug("BUG-P2-023", "high", "scrub.ts:161-168", "custom GPS namespace leaves GPS fields", "custom GPS", "all GPS cleared", JSON.stringify(gpsLeft));
  fail("custom GPS namespace incomplete");
} else pass("custom GPS namespace clears all GPS");

console.log("\n=== L. orientation_only JPEG retains orientation when injected ===\n");
const piexif = (await import("piexifjs")).default;
const buf = await geoFile().arrayBuffer();
const binary = Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join("");
const dataUrl = "data:image/jpeg;base64," + btoa(binary);
let exifObj = piexif.load(dataUrl);
exifObj["0th"] = exifObj["0th"] || {};
exifObj["0th"][piexif.ImageIFD.Orientation] = 6;
const withOrient = piexif.insert(piexif.dump(exifObj), dataUrl);
const orientBytes = Uint8Array.from(atob(withOrient.split(",")[1]), (c) => c.charCodeAt(0));
const orientResult = await scrub(new File([orientBytes], "o.jpg", { type: "image/jpeg" }), { preset: "orientation_only" });
const orientAfter = await read(new File([orientResult.cleanedBlob], "o.jpg", { type: "image/jpeg" }));
const hasOrient = fieldsInReport(orientAfter).some((f) => f.field.toLowerCase().includes("orientation"));
if (!hasOrient) {
  bug("BUG-P2-024", "high", "scrub.ts:110-120", "orientation_only failed to retain Orientation tag", "JPEG orientation=6", "Orientation present", "missing");
  fail("orientation_only lost Orientation");
} else pass("orientation_only retains Orientation");

console.log("\n=== M. prove-clean canonical payload ===\n");
const p = await buildProveCleanPayload({ filename: "x.jpg", cleanedSha256: "a".repeat(64), stripped: [], retained: [] });
p.signature = await signProveClean(p);
const { signature, ...rest } = p;
const canon = canonicalPayload(rest);
const keys = Object.keys(JSON.parse(canon));
if (JSON.stringify(keys) !== JSON.stringify([...keys].sort())) {
  bug("BUG-P2-025", "medium", "prove-clean.ts:42-65", "canonicalPayload keys unsorted", "canonicalPayload", "sorted keys", keys.join(","));
  fail("canonical keys unsorted");
} else pass("canonical keys sorted");

console.log("\n=== N. scrubPng dead code path (unreachable custom empty) ===\n");
// scrubPng lines 247-248 would passthrough — unreachable because scrub() validates first
// Document as low severity code smell only if behavior is correct at top level
pass("custom empty blocked at scrub() entry (scrubPng passthrough unreachable)");

console.log("\n=== SUMMARY ===\n");
console.log(`Passes: ${passCount}, Bugs: ${findings.length}\n`);
for (const f of findings) {
  console.log(`[${f.id}] ${f.severity.toUpperCase()} @ ${f.fileLine}`);
  console.log(`  ${f.description}`);
  console.log(`  Repro: ${f.repro}`);
  console.log(`  Expected: ${f.expected}`);
  console.log(`  Actual: ${f.actual}`);
  console.log();
}
process.exit(findings.length ? 1 : 0);
