"use client";

import { luxuryDarkTheme } from "@/lib/seasonal-menu/templates/luxury-dark";
import { luxuryLightTheme } from "@/lib/seasonal-menu/templates/luxury-light";
import type { SeasonalMenuTemplateId } from "@/lib/seasonal-menu/templates/types";
import { SEASONAL_MENU_TEMPLATES } from "@/lib/seasonal-menu/templates";
import { useI18n } from "@/app/components/i18n-provider";

type TemplatePickerCardsProps = {
  selectedId: SeasonalMenuTemplateId | null;
  onSelect: (id: SeasonalMenuTemplateId) => void;
};

function previewTheme(id: SeasonalMenuTemplateId) {
  return id === "luxury-dark" ? luxuryDarkTheme : luxuryLightTheme;
}

export function TemplatePickerCards({ selectedId, onSelect }: TemplatePickerCardsProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SEASONAL_MENU_TEMPLATES.map((meta) => {
        const theme = previewTheme(meta.id);
        const active = selectedId === meta.id;
        return (
          <button
            key={meta.id}
            type="button"
            onClick={() => onSelect(meta.id)}
            className={`overflow-hidden rounded-2xl border-2 text-left transition ${
              active
                ? "border-foreground ring-2 ring-foreground/20"
                : "border-foreground/15 hover:border-foreground/30"
            }`}
          >
            <div
              className="relative h-44 p-5"
              style={{
                background: `linear-gradient(180deg, ${theme.backgroundGradientStart} 0%, ${theme.backgroundGradientEnd} 100%)`,
              }}
            >
              <div
                className="absolute inset-4 rounded-lg border"
                style={{ borderColor: theme.accentColor, opacity: 0.7 }}
              />
              <p
                className="relative text-center text-lg font-semibold tracking-[0.2em]"
                style={{
                  fontFamily: theme.titleFontFamily,
                  color: theme.titleColor,
                }}
              >
                MENU
              </p>
              <div
                className="relative mx-auto mt-4 h-0.5 w-24"
                style={{ backgroundColor: theme.accentColor }}
              />
              <div
                className="relative mx-auto mt-4 max-w-[85%] rounded-md border px-3 py-2"
                style={{
                  backgroundColor: theme.cardFill,
                  borderColor: theme.cardStroke,
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ fontFamily: theme.bodyFontFamily, color: theme.nameColor }}
                >
                  Truffle Risotto
                </p>
                <p
                  className="text-xs"
                  style={{ fontFamily: theme.bodyFontFamily, color: theme.priceColor }}
                >
                  24.00 USD
                </p>
              </div>
            </div>
            <div className="border-t border-foreground/10 bg-background px-4 py-3">
              <p className="font-medium text-foreground">
                {t(meta.labelKey as Parameters<typeof t>[0])}
              </p>
              <p className="mt-0.5 text-sm text-foreground/60">
                {t(meta.descriptionKey as Parameters<typeof t>[0])}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
