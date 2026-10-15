import type { ReactNode } from "react";
import { useAuth } from "../lib/auth/useAuth";
import { Login } from "./auth/Login";

/**
 * Nothing renders until the session is known.
 *
 * This is convenience, not security: row level security is what actually
 * protects the data. Without a session, every query returns empty anyway.
 */
export function Guard({ children }: { children: ReactNode }) {
  const { loading, session, configured } = useAuth();

  /* With no project configured the app runs on seed data and needs no login. */
  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", color: "var(--c-text-muted)" }}>
        Loading…
      </div>
    );
  }

  if (!session) return <Login />;

  return <>{children}</>;
}
