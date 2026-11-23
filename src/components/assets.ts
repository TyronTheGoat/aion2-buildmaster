/**
 * Where optional local assets come from (e.g. class icons in public/class-icons).
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
