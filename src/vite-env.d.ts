/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional API base URL override. Defaults to /api (same-origin). */
  readonly VITE_API_URL?: string;
  /** Pusher app key for realtime updates. Omit to fall back to polling only. */
  readonly VITE_PUSHER_KEY?: string;
  /** Pusher cluster (e.g. "ap2", "us2"), required alongside VITE_PUSHER_KEY. */
  readonly VITE_PUSHER_CLUSTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
