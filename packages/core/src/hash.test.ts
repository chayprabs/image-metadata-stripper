import { describe, it, expect } from "vitest";
import { sha256Hex } from "./hash.js";

describe("sha256Hex", () => {
  it("hashes empty buffer", async () => {
    const hash = await sha256Hex(new Uint8Array(0));
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});
