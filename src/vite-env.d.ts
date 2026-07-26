/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL of the deployed Cloudflare Pages Function that proxies AI zone generation (cf.
   * functions/generate-zone.ts, src/systems/ZoneGenerator.ts). Unset ⇒ always use the
   * procedural fallback, no network call attempted. */
  readonly VITE_ZONE_AI_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
