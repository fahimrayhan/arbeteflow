/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEVELOPMENT_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
