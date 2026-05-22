"use client";

import { useEffect, useState } from "react";
import {
  TEMPLATE_BODY_FONT_FAMILY,
  TEMPLATE_TITLE_FONT_FAMILY,
} from "@/lib/seasonal-menu/template-fonts";

export function useTemplateFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (typeof document !== "undefined" && document.fonts?.load) {
          await Promise.all([
            document.fonts.load(`600 16px "${TEMPLATE_TITLE_FONT_FAMILY}"`),
            document.fonts.load(`700 42px "${TEMPLATE_TITLE_FONT_FAMILY}"`),
            document.fonts.load(`400 16px "${TEMPLATE_BODY_FONT_FAMILY}"`),
            document.fonts.load(`600 20px "${TEMPLATE_BODY_FONT_FAMILY}"`),
          ]);
          await document.fonts.ready;
        }
      } catch {
        /* fall through — Konva will use fallbacks */
      }
      if (!cancelled) setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
