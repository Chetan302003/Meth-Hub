/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VTC_ID?: string;
  readonly VITE_VTC_NAME?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_DISCORD_WEBHOOK_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APTABASE_APP_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
