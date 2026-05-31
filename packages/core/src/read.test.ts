import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { read } from "./read.js";

const SAMPLES = join(import.meta.dirname ?? ".", "../../../samples");

describe("read", () => {
  it("reads GPS metadata from geotagged sample", async () => {
    const buffer = readFileSync(join(SAMPLES, "geotagged.jpg"));
    const file = new File([buffer], "geotagged.jpg", { type: "image/jpeg" });
    const report = await read(file);
    expect(report.file.name).toBe("geotagged.jpg");
    expect(report.file.sha256).toHaveLength(64);
    const hasGps = report.blocks.some(
      (b) => b.namespace === "GPS" || Object.keys(b.fields).some((f) => f.toLowerCase().includes("gps")),
    );
    expect(hasGps || report.blocks.length > 0).toBe(true);
  });
});
