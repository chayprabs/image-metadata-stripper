/** Resolve static asset paths for GitHub Pages subpath deploys. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const clean = path.replace(/^\//, "");
  return `${base}${clean}`;
}

/** True when URL should be fetched from this app origin (not external). */
export function isAppRelativeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("/")) return true;
  if (trimmed.startsWith(window.location.origin)) return true;
  try {
    return new URL(trimmed, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function resolveFetchUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return assetUrl(trimmed);
  }
  return trimmed;
}
