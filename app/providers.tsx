"use client";

import { useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import { useEffect, useRef, type ReactNode } from "react";
import { safeSignOut } from "@/lib/safe-sign-out";
import { I18nProvider } from "./components/i18n-provider";
import type { Locale, Messages } from "@/lib/i18n/types";

function AutoSignOutOnExpiry() {
  const { data: session, status } = useSession();
  const signOutTriggeredRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      signOutTriggeredRef.current = false;
      return;
    }

    if (session?.authError === "AccessTokenExpired" && !signOutTriggeredRef.current) {
      signOutTriggeredRef.current = true;
      void safeSignOut("/login");
    }
  }, [session?.authError, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof session?.accessTokenExpiresAt !== "number") return;

    const msUntilExpiry = session.accessTokenExpiresAt - Date.now();
    if (msUntilExpiry <= 0 && !signOutTriggeredRef.current) {
      signOutTriggeredRef.current = true;
      void safeSignOut("/login");
      return;
    }

    const timer = window.setTimeout(() => {
      if (signOutTriggeredRef.current) return;
      signOutTriggeredRef.current = true;
      void safeSignOut("/login");
    }, msUntilExpiry);

    return () => window.clearTimeout(timer);
  }, [session?.accessTokenExpiresAt, status]);

  return null;
}

export function Providers({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <I18nProvider initialLocale={locale} initialMessages={messages}>
        <AutoSignOutOnExpiry />
        {children}
      </I18nProvider>
    </SessionProvider>
  );
}
