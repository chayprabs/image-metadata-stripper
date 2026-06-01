#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import {
  scrub,
  read,
  proveCleanToPdf,
  proveCleanToPdfText,
  ScrubValidationError,
  type ScrubPreset,
} from "@exifscrub/core";

const VALID_PRESETS = new Set<ScrubPreset>(["all", "gps_author", "orientation_only", "custom"]);

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "Usage: exifscrub [--preset=all|gps_author|orientation_only|custom] [--custom=EXIF:Artist,...] <file>",
  );
  process.exit(0);
}

const presetArg = args.find((a) => a.startsWith("--preset="))?.split("=")[1] ?? "all";
if (!VALID_PRESETS.has(presetArg as ScrubPreset)) {
  console.error(`Invalid preset: ${presetArg}. Use one of: ${[...VALID_PRESETS].join(", ")}`);
  process.exit(1);
}
const preset = presetArg as ScrubPreset;

const customArg = args.find((a) => a.startsWith("--custom="))?.split("=")[1];
const input = args.find((a) => !a.startsWith("--"));

if (!input) {
  console.error("Missing input file.");
  process.exit(1);
}

if (!existsSync(input)) {
  console.error(`File not found: ${input}`);
  process.exit(1);
}

const custom = customArg
  ? customArg.split(",").map((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return { namespace: "EXIF", field: pair };
      return { namespace: pair.slice(0, idx), field: pair.slice(idx + 1) };
    })
  : undefined;

let buffer: Buffer;
try {
  buffer = readFileSync(input);
} catch (e) {
  console.error(e instanceof Error ? e.message : "Failed to read input file");
  process.exit(1);
}

const file = new File([buffer], basename(input), {
  type: "application/octet-stream",
});

try {
  const report = await read(file);
  console.log("Metadata blocks:", report.blocks.length);

  const result = await scrub(file, { preset, custom });
  const outDir = dirname(input);
  const outName = `clean-${basename(input)}`;
  const out = join(outDir, outName);
  writeFileSync(out, Buffer.from(await result.cleanedBlob.arrayBuffer()));
  writeFileSync(`${out}.prove-clean.json`, JSON.stringify(result.proveCleanJson, null, 2));
  const pdf = await proveCleanToPdf(result.proveCleanJson);
  writeFileSync(`${out}.prove-clean.pdf`, Buffer.from(await pdf.arrayBuffer()));
  writeFileSync(`${out}.prove-clean.txt`, proveCleanToPdfText(result.proveCleanJson));
  console.log("Wrote", out, `${out}.prove-clean.pdf`);
} catch (e) {
  if (e instanceof ScrubValidationError) {
    console.error(e.message);
  } else {
    console.error(e instanceof Error ? e.message : "Scrub failed");
  }
  process.exit(1);
}
