"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PlatformEvent, trackClientEvent } from "@/lib/analytics";

/** Fires `platform.page_viewed` on authenticated platform route changes. */
export function PlatformPageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackClientEvent(PlatformEvent.PLATFORM_PAGE_VIEWED, { pathname });
  }, [pathname]);

  return null;
}
