import { describe, it, expect } from "vitest";
import { proveCleanToPdf } from "./prove-clean.js";
import { buildProveCleanPayload } from "./prove-clean.js";

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
    const header = new Uint8Array(await pdf.slice(0, 5).arrayBuffer());
    expect(String.fromCharCode(...header)).toBe("%PDF-");
  });
});
