import { createClient } from "@supabase/supabase-js";
import type { Database } from "./domain/database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when no project is configured, so the app can fall back to seed data. */
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.warn(
    "Supabase is not configured. Copy .env.example to .env.local and fill in the project URL and key. " +
      "The app will run on in-memory seed data until then.",
  );
}

export const supabase = createClient<Database>(
  url ?? "http://localhost:54321",
  anonKey ?? "anon-key-not-set",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
