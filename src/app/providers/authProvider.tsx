"use client";
import { IUser } from "@/types/user.types";
import { createContext, useContext } from "react";

const AuthContext = createContext<IUser | null>(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ user, children }: { user: IUser | null; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
