#!/usr/bin/env node
/**
 * Ad-hoc verification script — prints evidence for bug report.
 * Run: node packages/core/scripts/verify-core.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const { read, scrub, diff, verifyProveClean, canonicalPayload, getProcessingMode, buildProveCleanPayload, signProveClean } = await import(
  join(root, "packages/core/dist/index.js")
);

const SAMPLES = join(root, "samples");
const findings = [];

function bug(id, severity, fileLine, description, steps, expected, actual) {
  findings.push({ id, severity, fileLine, description, steps, expected, actual });
}

function pass(label) {
  console.log(`  ✓ PASS: ${label}`);
}

function fail(label, detail) {
  console.log(`  ✗ FAIL: ${label}`);
  if (detail) console.log(`    ${detail}`);
}

const geotagged = readFileSync(join(SAMPLES, "geotagged.jpg"));
const geoFile = () => new File([geotagged], "geotagged.jpg", { type: "image/jpeg" });

console.log("\n=== 1. JPEG presets on geotagged.jpg ===\n");

for (const preset of ["all", "gps_author", "orientation_only"]) {
  const opts = { preset };
  const result = await scrub(geoFile(), opts);
  const after = await read(new File([result.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
  const fp = result.stripped.filter((s) => {
    const b = after.blocks.find((x) => x.namespace === s.namespace);
    return b?.fields[s.field] !== undefined;
  });
  console.log(`preset=${preset}: stripped=${result.stripped.length} retained=${result.retained.length} afterBlocks=${after.blocks.length}`);
  if (fp.length) {
    fail(`false positives in stripped`, JSON.stringify(fp));
    bug("BUG-001", "high", "scrub.ts:271-288", "Stripped list contains fields still present after scrub", `scrub geotagged.jpg preset=${preset}`, "stripped fields absent in after report", JSON.stringify(fp));
  } else pass(`no stripped false positives (${preset})`);
  if (!(await verifyProveClean(result.proveCleanJson))) {
    fail(`prove-clean signature invalid (${preset})`);
  } else pass(`prove-clean valid (${preset})`);
}

console.log("\n=== 2. custom preset empty throws validation error ===\n");

try {
  await scrub(geoFile(), { preset: "custom" });
  fail("JPEG custom empty should throw");
  bug("BUG-002", "medium", "scrub.ts:27-29", "JPEG custom with no fields should throw", "scrub geotagged.jpg {preset:'custom'}", "ScrubValidationError", "no throw");
} catch (e) {
  if (e?.name === "ScrubValidationError" || String(e?.message).includes("at least one field")) {
    pass("JPEG custom empty throws ScrubValidationError");
  } else {
    fail("JPEG custom empty unexpected error", String(e?.message));
  }
}

// PNG with metadata
const basePng = new Uint8Array(readFileSync(join(root, "node_modules/.pnpm/png-chunks-extract@1.0.0/node_modules/png-chunks-extract/test.png")));
const chunks = extractChunks(basePng);
const ihdrIdx = chunks.findIndex((c) => c.name === "IHDR");
const metaPng = new Uint8Array(
  encodeChunks([
    ...chunks.slice(0, ihdrIdx + 1),
    { name: "tEXt", data: new TextEncoder().encode("Author\0Test") },
    ...chunks.slice(ihdrIdx + 1),
  ]),
);
const pngFile = new File([metaPng], "meta.png", { type: "image/png" });
const pngEmpty = await scrub(pngFile, { preset: "custom" });
const pngAfterChunks = extractChunks(new Uint8Array(await pngEmpty.cleanedBlob.arrayBuffer())).map((c) => c.name);
const pngHasText = pngAfterChunks.includes("tEXt");
console.log(`PNG custom empty: stripped=${pngEmpty.stripped.length} hasTEXt=${pngHasText} chunks=${pngAfterChunks.join(",")}`);
if (pngHasText !== jpegEmptySame) {
  fail("JPEG vs PNG custom-empty behavior inconsistent");
  bug(
    "BUG-003",
    "high",
    "scrub.ts:123-125 vs scrub.ts:267-268",
    "Empty custom preset: JPEG passthrough but PNG strips all metadata",
    "scrub JPEG and PNG with {preset:'custom'} and no custom fields",
    "Consistent passthrough (or consistent strip-all)",
    `JPEG unchanged=${jpegEmptySame}, PNG tEXt stripped=${!pngHasText}`,
  );
} else pass("JPEG/PNG custom empty consistent");

console.log("\n=== 3. PNG orientation_only leaves eXIf ===\n");

const withExif = new Uint8Array(
  encodeChunks([
    ...chunks.slice(0, ihdrIdx + 1),
    { name: "eXIf", data: new Uint8Array([0, 1, 2, 3, 4]) },
    ...chunks.slice(ihdrIdx + 1),
  ]),
);
const orientResult = await scrub(new File([withExif], "exif.png", { type: "image/png" }), {
  preset: "orientation_only",
});
const orientChunks = extractChunks(new Uint8Array(await orientResult.cleanedBlob.arrayBuffer())).map((c) => c.name);
console.log(`PNG orientation_only chunks: ${orientChunks.join(",")}`);
if (orientChunks.includes("eXIf")) {
  fail("eXIf chunk retained in orientation_only preset");
  bug(
    "BUG-004",
    "medium",
    "scrub.ts:252-254",
    "PNG orientation_only does not strip eXIf chunk (EXIF metadata)",
    "scrub PNG with eXIf chunk, preset orientation_only",
    "eXIf removed (only orientation-related data kept)",
    "eXIf chunk still present",
  );
} else pass("eXIf stripped in orientation_only");

console.log("\n=== 4. prove-clean stripped accuracy (gps_author) ===\n");

const ga = await scrub(geoFile(), { preset: "gps_author" });
const gaAfter = await read(new File([ga.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
const gaFields = gaAfter.blocks.flatMap((b) => Object.keys(b.fields));
const strippedFields = ga.stripped.map((s) => s.field);
const retainedFields = ga.retained.map((r) => r.field);
console.log(`After fields: ${gaFields.join(", ") || "(none)"}`);
console.log(`Stripped: ${strippedFields.join(", ")}`);
console.log(`Retained: ${retainedFields.join(", ")}`);

// Check if stripped includes fields that are GPS-related but gps_author should strip
const stillHasGps = gaFields.some((f) => f.toLowerCase().includes("gps") || f === "latitude" || f === "longitude");
if (stillHasGps) {
  fail("GPS fields remain after gps_author");
  bug("BUG-005", "critical", "scrub.ts:109-114", "gps_author preset failed to remove all GPS fields", "scrub geotagged.jpg gps_author", "no GPS fields in after", `remaining: ${gaFields.filter((f) => f.toLowerCase().includes("gps") || f === "latitude")}`);
} else pass("all GPS removed by gps_author");

// retained should not list stripped fields
const overlap = retainedFields.filter((f) => strippedFields.includes(f));
if (overlap.length) {
  fail(`fields in both stripped and retained: ${overlap.join(",")}`);
  bug("BUG-006", "high", "scrub.ts:291-303", "Field appears in both stripped and retained lists", "scrub geotagged.jpg gps_author", "disjoint stripped/retained", `overlap: ${overlap}`);
} else pass("stripped/retained disjoint");

console.log("\n=== 5. preset=all retained list should be empty ===\n");

const allResult = await scrub(geoFile(), { preset: "all" });
console.log(`all preset retained count: ${allResult.retained.length}`);
if (allResult.retained.length > 0) {
  fail(`retained non-empty for all preset: ${JSON.stringify(allResult.retained.map((r) => r.field))}`);
  bug("BUG-007", "low", "scrub.ts:291-303", "preset=all reports retained fields despite stripping everything", "scrub geotagged.jpg all", "retained=[]", `retained=${allResult.retained.length}`);
} else pass("retained empty for all preset");

console.log("\n=== 6. HEIC/WebP/GIF Node passthrough — prove-clean misleading? ===\n");

const fakeHeic = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0]);
const heicResult = await scrub(new File([fakeHeic], "t.heic", { type: "image/heic" }), { preset: "all" });
const heicSame =
  new Uint8Array(await heicResult.cleanedBlob.arrayBuffer()).length === fakeHeic.length;
console.log(`HEIC: bytes unchanged=${heicSame} stripped=${heicResult.stripped.length} proveCleanValid=${await verifyProveClean(heicResult.proveCleanJson)}`);
if (heicSame && heicResult.proveCleanJson.stripped.length === 0) {
  // Not scrubbed but claims clean — misleading prove-clean
  bug(
    "BUG-008",
    "high",
    "scrub.ts:175-191",
    "HEIC scrub is no-op in Node (no document) but prove-clean certifies file without noting failure",
    "scrub .heic in Node with preset=all",
    "Either scrub metadata or report scrub failure / passthrough in prove-clean",
    "Original bytes returned, stripped=[], signature validates 'clean' state",
  );
  fail("HEIC no-op produces valid prove-clean with empty stripped");
} else pass("HEIC behavior documented");

const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const webpResult = await scrub(new File([webp], "t.webp", { type: "image/webp" }), { preset: "all" });
const webpSame = new Uint8Array(await webpResult.cleanedBlob.arrayBuffer()).every((v, i) => v === webp[i]);
if (webpSame) {
  bug(
    "BUG-009",
    "high",
    "scrub.ts:193-225",
    "WebP scrub is no-op without DOM/canvas but returns valid prove-clean",
    "scrub .webp in Node preset=all",
    "Metadata removed or passthrough flagged",
    "Bytes unchanged, valid prove-clean signature",
  );
  fail("WebP no-op in Node with valid prove-clean");
}

console.log("\n=== 7. getProcessingMode edge cases ===\n");

const modeCases = [
  ["image/bmp", "x.bmp"],
  ["image/bmp", "x.BMP"],
  ["", "photo.JPEG"],
  ["application/octet-stream", "file.tiff"],
];
for (const [mime, name] of modeCases) {
  const mode = getProcessingMode(mime, name);
  console.log(`  getProcessingMode("${mime}", "${name}") => ${mode}`);
}

// BMP handled in scrub but not in BROWSER_MIMES
const bmpMode = getProcessingMode("image/bmp", "photo.bmp");
if (bmpMode === "browser") pass("bmp routes to browser");
else bug("BUG-010", "low", "types.ts:71-80", "image/bmp not in BROWSER_MIMES but scrub supports it via extension", "getProcessingMode('image/bmp')", "browser", bmpMode);

console.log("\n=== 8. canonical payload key ordering ===\n");

const p = await buildProveCleanPayload({
  filename: "x.jpg",
  cleanedSha256: "a".repeat(64),
  stripped: [],
  retained: [],
});
p.signature = await signProveClean(p);
const { signature, ...rest } = p;
const canon = canonicalPayload(rest);
const parsed = JSON.parse(canon);
const keys = Object.keys(parsed);
const sorted = [...keys].sort();
if (JSON.stringify(keys) === JSON.stringify(sorted)) pass("canonical keys sorted");
else {
  bug("BUG-011", "medium", "prove-clean.ts:42-65", "canonicalPayload key order not deterministic", "canonicalPayload(payload)", "sorted keys", keys.join(","));
  fail("canonical key order");
}

console.log("\n=== 9. diff vs scrub stripped alignment ===\n");

const before = await read(geoFile());
const allRes = await scrub(geoFile(), { preset: "all" });
const afterAll = await read(new File([allRes.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
const d = diff(before, afterAll);
const removed = d.entries.filter((e) => e.status === "removed").map((e) => e.path);
const strippedPaths = allRes.stripped.map((s) => `${s.namespace}.${s.field}`);
const missingInDiff = strippedPaths.filter((p) => !removed.includes(p));
const extraInDiff = removed.filter((p) => !strippedPaths.includes(p));
console.log(`removed=${removed.length} stripped=${strippedPaths.length}`);
if (missingInDiff.length) {
  bug("BUG-012", "medium", "scrub.ts:271-323", "scrub stripped entries not reflected as removed in diff", "compare diff(before,after) vs result.stripped", "all stripped paths in diff removed", missingInDiff.join(","));
  fail(`stripped not in diff removed: ${missingInDiff.join(",")}`);
} else pass("all stripped in diff removed");
if (extraInDiff.length) {
  console.log(`  note: diff has extra removed not in stripped (shouldStripField filter): ${extraInDiff.join(",")}`);
}

console.log("\n=== 10. custom preset partial — false stripped for unrelated fields ===\n");

const customArtist = await scrub(geoFile(), {
  preset: "custom",
  custom: [{ namespace: "EXIF", field: "Artist" }],
});
const caAfter = await read(new File([customArtist.cleanedBlob], "geotagged.jpg", { type: "image/jpeg" }));
const gpsInStripped = customArtist.stripped.some((s) => s.field.toLowerCase().includes("gps") || s.field === "latitude");
const gpsStill = caAfter.blocks.some((b) => Object.keys(b.fields).some((f) => f.toLowerCase().includes("gps") || f === "latitude"));
console.log(`custom Artist only: gpsInStripped=${gpsInStripped} gpsStill=${gpsStill}`);
if (gpsInStripped) {
  bug("BUG-013", "high", "scrub.ts:313-320", "custom preset reports GPS in stripped when only Artist requested", "custom [{field:'Artist'}]", "GPS not in stripped", JSON.stringify(customArtist.stripped));
  fail("false GPS entries in stripped for Artist-only custom");
} else pass("no false GPS in stripped for Artist-only custom");

console.log("\n=== SUMMARY: " + findings.length + " bugs documented ===\n");
for (const f of findings) {
  console.log(`[${f.id}] ${f.severity.toUpperCase()} @ ${f.fileLine}`);
  console.log(`  ${f.description}`);
  console.log(`  Expected: ${f.expected}`);
  console.log(`  Actual:   ${f.actual}`);
  console.log();
}
