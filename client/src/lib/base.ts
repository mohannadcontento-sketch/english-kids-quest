// App base-path helper: empty at root deploys ("/"), or "/english-kids-quest" on GitHub Pages project deploys.
export const appBase = import.meta.env.BASE_URL.replace(/\/+$/, "");

export const withBase = (path: string) => `${appBase}${path}`;
