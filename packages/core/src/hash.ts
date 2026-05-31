export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256HexFromBlob(blob: Blob): Promise<string> {
  return sha256Hex(await blob.arrayBuffer());
}
