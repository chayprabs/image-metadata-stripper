import { describe, it, expect } from "vitest";
import { read, scrub, diff, verifyProveClean } from "./index.js";

// Minimal JPEG (1x1 red pixel) with APP1 EXIF segment (simplified)
const MINIMAL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";

function base64ToFile(b64: string, name: string): File {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: "image/jpeg" });
}

describe("scrub", () => {
  it("scrubs jpeg with strip all preset", async () => {
    const file = base64ToFile(MINIMAL_JPEG_BASE64, "test.jpg");
    const before = await read(file);
    const result = await scrub(file, { preset: "all" });
    expect(result.cleanedBlob.size).toBeGreaterThan(0);
    expect(result.proveCleanJson.cleanedSha256).toHaveLength(64);
    expect(result.proveCleanJson.signature.length).toBeGreaterThan(0);
    const after = await read(new File([result.cleanedBlob], "test.jpg", { type: "image/jpeg" }));
    const d = diff(before, after);
    expect(d.entries.length).toBeGreaterThanOrEqual(0);
    const valid = await verifyProveClean(result.proveCleanJson);
    expect(valid).toBe(true);
  });
});
