"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { UserSettingsProvider } from "@/hooks/use-user-settings";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <UserSettingsProvider>{children}</UserSettingsProvider>
      </SessionProvider>
    </MotionConfig>
  );
}
