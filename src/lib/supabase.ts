import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  /* Phase 0 runs without a Supabase project; fail loudly once the app starts
     reading data rather than silently returning empty result sets. */
  console.warn(
    "Supabase env vars are not set. Copy .env.example to .env.local and fill in the project URL and anon key.",
  );
}

export const supabase = createClient(url ?? "http://localhost:54321", anonKey ?? "anon-key-not-set");
