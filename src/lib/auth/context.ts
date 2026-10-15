import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Row } from "../supabase";

export type Profile = Row<"profiles">;
export type AppRole = Profile["role"];

export type AuthState = {
  /** True while the initial session check is in flight. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** When no project is configured the app runs on seed data, signed out. */
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  canWrite: boolean;
};

export const AuthContext = createContext<AuthState | null>(null);
