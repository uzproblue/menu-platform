"use client";

import { useI18n } from "@/app/components/i18n-provider";

export function LocationLogo({ src, name }: { src: string; name: string }) {
  const { t } = useI18n();
  return (
    <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-background/80 ring-1 ring-foreground/5">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- supports local/static and remote logo paths
        <img
          src={src}
          alt={t("restaurants.logoAlt", { name })}
          className="size-full object-cover"
          width={40}
          height={40}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-xs font-medium text-foreground/45">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}
