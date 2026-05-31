import { describe, it, expect } from "vitest";
import { proveCleanToPdf, buildProveCleanPayload, verifyProveClean } from "./prove-clean.js";

describe("proveCleanToPdf", () => {
  it("generates a PDF blob", async () => {
    const payload = await buildProveCleanPayload({
      filename: "test.jpg",
      cleanedSha256: "abc123",
      stripped: [{ namespace: "GPS", field: "latitude", value: 40.7 }],
      retained: [],
    });
    const pdf = await proveCleanToPdf(payload);
    expect(pdf.type).toBe("application/pdf");
    expect(pdf.size).toBeGreaterThan(100);
  });

  it("verifyProveClean validates with embedded public key", async () => {
    const payload = await buildProveCleanPayload({
      filename: "test.jpg",
      cleanedSha256: "abc123",
      stripped: [],
      retained: [],
    });
    const { signProveClean } = await import("./prove-clean.js");
    payload.signature = await signProveClean(payload);
    expect(await verifyProveClean(payload)).toBe(true);
  });
});
