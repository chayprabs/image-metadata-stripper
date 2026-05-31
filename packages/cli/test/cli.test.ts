import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sample = join(root, "samples", "geotagged.jpg");
const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

test("scrubs geotagged jpeg and writes prove-clean outputs", () => {
  if (!existsSync(sample)) throw new Error("sample missing");
  execFileSync("node", [cli, "--preset=all", sample], { stdio: "pipe" });

  const out = join(process.cwd(), "clean-geotagged.jpg");
  const proveJson = `${out}.prove-clean.json`;
  const provePdf = `${out}.prove-clean.pdf`;

  try {
    if (!existsSync(out)) throw new Error("clean output missing");
    const json = JSON.parse(readFileSync(proveJson, "utf8"));
    if (!json.signature) throw new Error("prove-clean signature missing");
    if (!existsSync(provePdf)) throw new Error("prove-clean pdf missing");
  } finally {
    for (const f of [out, proveJson, provePdf, `${out}.prove-clean.txt`]) {
      if (existsSync(f)) unlinkSync(f);
    }
  }
});
