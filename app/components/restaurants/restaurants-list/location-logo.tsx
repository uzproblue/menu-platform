"use client";

import Image from "next/image";
import { useI18n } from "@/app/components/i18n-provider";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";

export function LocationLogo({
  src,
  name,
  priority = false,
}: {
  src: string;
  name: string;
  priority?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-background/80 ring-1 ring-foreground/5">
      {src ? (
        <Image
          src={src}
          alt={t("restaurants.logoAlt", { name })}
          width={40}
          height={40}
          className="size-full object-cover"
          sizes="40px"
          priority={priority}
          {...(!priority ? { loading: "lazy" as const } : {})}
          unoptimized={imageSrcIsNonOptimizable(src)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-xs font-medium text-foreground/45">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}
