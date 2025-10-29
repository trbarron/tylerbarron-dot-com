/// <reference types="@react-router/dev/env" />
/// <reference types="@react-router/node" />

declare module "@react-router/node" {
    interface ProcessEnv {
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
    }
  }

