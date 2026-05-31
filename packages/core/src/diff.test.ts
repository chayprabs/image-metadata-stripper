import { describe, it, expect } from "vitest";
import { diff } from "./diff.js";
import type { MetadataReport } from "./types.js";

describe("diff", () => {
  it("detects removed fields", () => {
    const before: MetadataReport = {
      file: { name: "a.jpg", sha256: "x", mime: "image/jpeg", size: 1 },
      blocks: [{ namespace: "EXIF", fields: { Make: "Canon", Model: "EOS" } }],
      thumbnails: [],
    };
    const after: MetadataReport = {
      file: { name: "a.jpg", sha256: "y", mime: "image/jpeg", size: 1 },
      blocks: [{ namespace: "EXIF", fields: { Make: "Canon" } }],
      thumbnails: [],
    };
    const result = diff(before, after);
    expect(result.entries.some((e) => e.status === "removed" || e.status === "changed")).toBe(true);
  });
});
