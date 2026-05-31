import type { ProveCleanPayload, ScrubFieldEntry } from "./types.js";

const SIGNING_KEY_ID = "exifscrub-browser-v1";

let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ]);
  cachedPrivateKey = pair.privateKey;
  cachedPublicKey = pair.publicKey;
  return cachedPrivateKey;
}

export async function buildProveCleanPayload(input: {
  filename: string;
  cleanedSha256: string;
  stripped: ScrubFieldEntry[];
  retained: ScrubFieldEntry[];
}): Promise<ProveCleanPayload> {
  await getSigningKey();
  const exported = await crypto.subtle.exportKey("raw", cachedPublicKey!);
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return {
    version: "1",
    filename: input.filename,
    cleanedSha256: input.cleanedSha256,
    stripped: input.stripped,
    retained: input.retained,
    timestamp: new Date().toISOString(),
    signature: "",
    signatureAlgorithm: "Ed25519-browser",
    signingKeyId: SIGNING_KEY_ID,
    publicKey,
  };
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
}

export function canonicalPayload(
  payload: Omit<ProveCleanPayload, "signature">,
): string {
  const base: Record<string, unknown> = {
    version: payload.version,
    filename: payload.filename,
    cleanedSha256: payload.cleanedSha256,
    stripped: payload.stripped,
    retained: payload.retained,
    timestamp: payload.timestamp,
    signatureAlgorithm: payload.signatureAlgorithm,
  };
  if (payload.signingKeyId) base.signingKeyId = payload.signingKeyId;
  if (payload.publicKey) base.publicKey = payload.publicKey;
  return JSON.stringify(sortKeys(base));
}

export async function signProveClean(payload: ProveCleanPayload): Promise<string> {
  const key = await getSigningKey();
  const { signature: _s, ...rest } = payload;
  const data = new TextEncoder().encode(canonicalPayload(rest));
  const sig = await crypto.subtle.sign("Ed25519", key, data);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyProveClean(payload: ProveCleanPayload): Promise<boolean> {
  if (!payload.signature || !payload.publicKey) return false;
  try {
    const raw = Uint8Array.from(atob(payload.publicKey), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", raw, "Ed25519", false, ["verify"]);
    const { signature, ...rest } = payload;
    const data = new TextEncoder().encode(canonicalPayload(rest));
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    return crypto.subtle.verify("Ed25519", key, sigBytes, data);
  } catch {
    return false;
  }
}

export function proveCleanToPdfText(payload: ProveCleanPayload): string {
  const lines = [
    "ExifScrub Prove-Clean Report",
    "============================",
    `File: ${payload.filename}`,
    `SHA-256 (cleaned): ${payload.cleanedSha256}`,
    `Timestamp: ${payload.timestamp}`,
    `Algorithm: ${payload.signatureAlgorithm}`,
    "",
    "Stripped fields:",
    ...payload.stripped.map((s) => `  - ${s.namespace}.${s.field}`),
    "",
    "Retained fields:",
    ...payload.retained.map((r) => `  - ${r.namespace}.${r.field}`),
    "",
    `Signature: ${payload.signature.slice(0, 64)}...`,
  ];
  return lines.join("\n");
}

export async function proveCleanToPdf(payload: ProveCleanPayload): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  let y = 750;

  const draw = (text: string, size = 11, bold = false) => {
    page.drawText(text, { x: 50, y, size, font: bold ? boldFont : font, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 6;
  };

  draw("ExifScrub Prove-Clean Report", 16, true);
  y -= 8;
  draw(`File: ${payload.filename}`);
  draw(`SHA-256: ${payload.cleanedSha256}`, 9);
  draw(`Timestamp: ${payload.timestamp}`);
  draw(`Algorithm: ${payload.signatureAlgorithm}`);
  y -= 8;
  draw(`Stripped (${payload.stripped.length}):`, 12, true);
  for (const s of payload.stripped.slice(0, 25)) {
    if (y < 60) break;
    draw(`  [${s.namespace}] ${s.field}`, 9);
  }
  y -= 8;
  draw(`Retained (${payload.retained.length}):`, 12, true);
  for (const r of payload.retained.slice(0, 15)) {
    if (y < 60) break;
    draw(`  [${r.namespace}] ${r.field}`, 9);
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

export { SIGNING_KEY_ID };
