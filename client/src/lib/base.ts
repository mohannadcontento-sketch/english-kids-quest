// App base-path helper: empty at root deploys ("/"), or "/english-kids-quest" on GitHub Pages project deploys.
export const appBase = import.meta.env.BASE_URL.replace(/\/+$/, "");

export const withBase = (path: string) => `${appBase}${path}`;

/**
 * Cache-busting version for static assets (audio/images).
 * Bump this whenever an asset's CONTENT changes on the same filename,
 * so browsers that cached the old file (immutable or long max-age) fetch the new one.
 */
export const ASSET_V = "20260830-human-audio";

export const withAssetV = (path: string) => `${path}?v=${ASSET_V}`;
