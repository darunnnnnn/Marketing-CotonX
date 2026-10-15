import { useContext } from "react";
import { AuthContext } from "./context";
import type { AuthState } from "./context";

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
