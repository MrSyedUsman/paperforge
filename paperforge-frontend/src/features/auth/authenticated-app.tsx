"use client";
import { PaperForgeApp } from "@/features/application/paperforge-app";
import { AuthGate } from "./auth-gate";
import { AuthProvider } from "./auth-provider";

export function AuthenticatedApp() {
  return (
    <AuthProvider>
      <AuthGate>{(user) => <PaperForgeApp authUser={user} />}</AuthGate>
    </AuthProvider>
  );
}
