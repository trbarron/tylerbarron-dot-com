/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />

declare module "@remix-run/node" {
    interface ProcessEnv {
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
    }
  }