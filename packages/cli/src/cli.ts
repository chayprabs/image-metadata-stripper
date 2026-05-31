#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { scrub, read, proveCleanToPdf, proveCleanToPdfText, type ScrubPreset } from "@exifscrub/core";

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

const custom = customArg
  ? customArg.split(",").map((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return { namespace: "EXIF", field: pair };
      return { namespace: pair.slice(0, idx), field: pair.slice(idx + 1) };
    })
  : undefined;

const buffer = readFileSync(input);
const file = new File([buffer], input.split("/").pop() ?? "input.jpg", {
  type: "application/octet-stream",
});

const report = await read(file);
console.log("Metadata blocks:", report.blocks.length);

const result = await scrub(file, { preset, custom });
const out = `clean-${input.split("/").pop()}`;
writeFileSync(out, Buffer.from(await result.cleanedBlob.arrayBuffer()));
writeFileSync(`${out}.prove-clean.json`, JSON.stringify(result.proveCleanJson, null, 2));
const pdf = await proveCleanToPdf(result.proveCleanJson);
writeFileSync(`${out}.prove-clean.pdf`, Buffer.from(await pdf.arrayBuffer()));
writeFileSync(`${out}.prove-clean.txt`, proveCleanToPdfText(result.proveCleanJson));
console.log("Wrote", out, `${out}.prove-clean.pdf`);
