import type { CustomField, MetadataReport, ScrubPreset, ScrubResult } from "@exifscrub/core";

const API_BASE = import.meta.env.VITE_WORKER_URL ?? "/api";

async function workerFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error(
      "Server processing is unavailable. Start the worker (docker compose up) or try again later.",
    );
  }
}

export async function workerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function workerRead(file: File): Promise<MetadataReport> {
  const form = new FormData();
  form.append("file", file);
  const res = await workerFetch("/v1/read", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Worker read failed (${res.status})`);
  }
  return res.json() as Promise<MetadataReport>;
}

export async function workerScrub(
  file: File,
  preset: ScrubPreset,
  custom?: CustomField[],
): Promise<ScrubResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("preset", preset);
  if (custom?.length) form.append("custom", JSON.stringify(custom));
  const res = await workerFetch("/v1/scrub", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Worker scrub failed (${res.status})`);
  }
  const data = (await res.json()) as {
    cleanedBase64: string;
    mime: string;
    proveCleanJson: ScrubResult["proveCleanJson"];
    stripped: ScrubResult["stripped"];
    retained: ScrubResult["retained"];
    cleaned: ScrubResult["cleaned"];
  };
  const bytes = Uint8Array.from(atob(data.cleanedBase64), (c) => c.charCodeAt(0));
  const cleanedBlob = new Blob([bytes], { type: data.mime });
  return {
    cleanedBlob,
    cleaned: data.cleaned,
    stripped: data.stripped,
    retained: data.retained,
    proveCleanJson: data.proveCleanJson,
  };
}

export async function workerFetchUrl(url: string): Promise<File> {
  const form = new FormData();
  form.append("url", url);
  const res = await workerFetch("/v1/fetch", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Fetch URL failed (${res.status})`);
  }
  const data = (await res.json()) as { filename: string; mime: string; base64: string };
  const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
  return new File([bytes], data.filename, { type: data.mime });
}

export async function workerBatch(file: File, preset: ScrubPreset): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("preset", preset);
  const res = await workerFetch("/v1/batch", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Batch failed (${res.status})`);
  }
  const data = (await res.json()) as { zipBase64: string };
  const bytes = Uint8Array.from(atob(data.zipBase64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "application/zip" });
}
