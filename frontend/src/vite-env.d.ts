/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOMTOM_MAP_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
