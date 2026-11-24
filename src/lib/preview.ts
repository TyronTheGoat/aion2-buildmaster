declare const __BM_PREVIEW__: boolean | undefined;
/** Features that only the offline file shows until Tyron approves them (the live site is built with BM_PREVIEW=0). */
export const PREVIEW = typeof __BM_PREVIEW__ === "undefined" || !!__BM_PREVIEW__;
