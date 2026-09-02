/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin. Optional — defaults to the same-origin `/api` proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
