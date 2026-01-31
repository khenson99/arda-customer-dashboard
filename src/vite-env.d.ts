/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARDA_API_KEY: string
  readonly VITE_ARDA_AUTHOR: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
