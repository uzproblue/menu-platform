"use client";

import { useI18n } from "../i18n-provider";

export type MenuPreviewSection = {
  categoryName: string;
  items: { name: string; price: string }[];
};

type LocationWizardMenuPreviewProps = {
  locationName: string;
  address: string;
  currency: string;
  logoSrc: string | null | undefined;
  sections: MenuPreviewSection[];
  placeholderLocationName: string;
  caption: string;
};

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 border-b border-stone-200/90 py-3 last:border-b-0"
        >
          <div className="h-3 max-w-[65%] flex-1 rounded bg-stone-200/80" />
          <div className="h-3 w-12 shrink-0 rounded bg-stone-200/70" />
        </div>
      ))}
    </div>
  );
}

export function LocationWizardMenuPreview({
  locationName,
  address,
  currency,
  logoSrc,
  sections,
  placeholderLocationName,
  caption,
}: LocationWizardMenuPreviewProps) {
  const { t } = useI18n();
  const title = locationName.trim() || placeholderLocationName;
  const addressLine = address.trim();
  const hasSections = sections.length > 0;

  return (
    <figure className="flex flex-col items-center gap-3">
      <figcaption className="sr-only">{caption}</figcaption>
      <div
        className="relative w-[min(100%,280px)] shrink-0"
        aria-hidden
      >
        <div className="rounded-[2.35rem] border-[10px] border-zinc-800 bg-zinc-800 p-1 shadow-2xl shadow-black/35 ring-1 ring-white/10">
          <div className="overflow-hidden rounded-[1.9rem] bg-stone-100 ring-1 ring-black/5">
            <div className="flex h-7 items-end justify-center bg-stone-200/90 pb-1">
              <div className="h-1 w-10 rounded-full bg-stone-400/50" aria-hidden />
            </div>
            <div className="max-h-[min(520px,58vh)] overflow-y-auto overscroll-contain bg-[#fafaf9] px-3 pb-4 pt-2">
              <header className="border-b border-stone-200/90 pb-3">
                <div className="flex items-start gap-2.5">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob URLs and arbitrary paths
                      <img src={logoSrc} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-stone-100 text-sm font-semibold text-stone-400">
                        {title.slice(0, 1).toUpperCase() || "·"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-stone-900">
                      {title}
                    </h2>
                    {addressLine ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-stone-500">
                        {addressLine}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      {currency}
                    </p>
                  </div>
                </div>
              </header>

              <div className="mt-3 space-y-5">
                {!hasSections ? (
                  <section>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      {t("restaurants.newWizard.previewMenuHeading")}
                    </h3>
                    <SkeletonRows count={4} />
                  </section>
                ) : (
                  sections.map((sec) => (
                    <section key={sec.categoryName}>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                        {sec.categoryName}
                      </h3>
                      {sec.items.length === 0 ? (
                        <SkeletonRows count={2} />
                      ) : (
                        <ul className="divide-y divide-stone-200/90">
                          {sec.items.map((item, idx) => (
                            <li
                              key={`${sec.categoryName}-${idx}-${item.name}`}
                              className="flex items-baseline justify-between gap-2 py-2.5 text-[13px]"
                            >
                              <span className="min-w-0 flex-1 font-medium leading-snug text-stone-800">
                                {item.name}
                              </span>
                              <span className="shrink-0 tabular-nums text-stone-600">{item.price}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="max-w-[280px] text-center text-xs text-foreground/50">{caption}</p>
    </figure>
  );
}
