/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional API base URL override. Defaults to /api (same-origin). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
