#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { scrub, read, proveCleanToPdf, proveCleanToPdfText } from "@exifscrub/core";

const args = process.argv.slice(2);
const preset = (args.find((a) => a.startsWith("--preset="))?.split("=")[1] ??
  "all") as "all" | "gps_author" | "orientation_only" | "custom";
const customArg = args.find((a) => a.startsWith("--custom="))?.split("=")[1];
const input = args.find((a) => !a.startsWith("--"));

if (!input || args.includes("--help")) {
  console.log(`Usage: exifscrub [--preset=all|gps_author|orientation_only|custom] [--custom=EXIF:Artist,...] <file>`);
  process.exit(input ? 0 : 1);
}

const custom = customArg
  ? customArg.split(",").map((pair) => {
      const [namespace, field] = pair.split(":");
      return { namespace: namespace ?? "EXIF", field: field ?? pair };
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
