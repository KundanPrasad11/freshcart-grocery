"use client";
import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { StoreProvider } from "@/context/store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <StoreProvider>{children}</StoreProvider>
    </SessionProvider>
  );
}
