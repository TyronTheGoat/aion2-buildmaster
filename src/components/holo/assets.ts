/**
 * Where the hologram's optional assets come from (character models, hero backgrounds, texture references, weapons).
 * Web app: served from /public. Offline file: embedded as data URIs by offline/build.mjs.
 * Returns undefined when the asset is not installed, so callers can fall back.
 */
declare global {
  var __BM_ASSETS__: Record<string, string> | undefined;
}

export function assetUrl(path: string): string | undefined {
  const inline = globalThis.__BM_ASSETS__;
  return inline ? inline[path] : `/${path}`;
}

/** Fetches an asset as bytes; null when it is missing. */
export async function fetchAsset(path: string): Promise<ArrayBuffer | null> {
  const url = assetUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Loads an image asset (for textures and backgrounds); null when it is missing. */
export function loadImage(path: string): Promise<HTMLImageElement | null> {
  const url = assetUrl(path);
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
