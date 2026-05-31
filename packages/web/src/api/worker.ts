import type { MetadataReport, ScrubPreset, ScrubResult } from "@exifscrub/core";

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

export async function workerScrub(file: File, preset: ScrubPreset): Promise<ScrubResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("preset", preset);
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
