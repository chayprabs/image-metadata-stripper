import type { ProveCleanPayload, ScrubFieldEntry } from "./types.js";

const SIGNING_KEY_ID = "exifscrub-browser-v1";

let cachedKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    false,
    ["sign", "verify"]
  );
  return cachedKey;
}

export async function buildProveCleanPayload(input: {
  filename: string;
  cleanedSha256: string;
  stripped: ScrubFieldEntry[];
  retained: ScrubFieldEntry[];
}): Promise<ProveCleanPayload> {
  return {
    version: "1",
    filename: input.filename,
    cleanedSha256: input.cleanedSha256,
    stripped: input.stripped,
    retained: input.retained,
    timestamp: new Date().toISOString(),
    signature: "",
    signatureAlgorithm: "Ed25519-browser",
  };
}

export function canonicalPayload(payload: Omit<ProveCleanPayload, "signature">): string {
  return JSON.stringify({
    version: payload.version,
    filename: payload.filename,
    cleanedSha256: payload.cleanedSha256,
    stripped: payload.stripped,
    retained: payload.retained,
    timestamp: payload.timestamp,
    signatureAlgorithm: payload.signatureAlgorithm,
  });
}

export async function signProveClean(payload: ProveCleanPayload): Promise<string> {
  const key = await getSigningKey();
  const { signature: _s, ...rest } = payload;
  const data = new TextEncoder().encode(canonicalPayload(rest));
  const sig = await crypto.subtle.sign("Ed25519", key, data);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyProveClean(payload: ProveCleanPayload): Promise<boolean> {
  if (!payload.signature) return false;
  try {
    const key = await getSigningKey();
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

export { SIGNING_KEY_ID };
