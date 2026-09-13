"use client";

import Image from "next/image";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
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
  coverSrc?: string | null | undefined;
  locationType?: "dine_in" | "delivery";
  sections?: MenuPreviewSection[];
  placeholderLocationName: string;
  caption: string;
};

function MapPinIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SparklesIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function SearchIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ShoppingBagIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function BellIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ReceiptIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

export function LocationWizardMenuPreview({
  locationName,
  address,
  currency,
  logoSrc,
  coverSrc,
  locationType = "dine_in",
  sections = [],
  placeholderLocationName,
  caption,
}: LocationWizardMenuPreviewProps) {
  const { t } = useI18n();
  const title = locationName.trim() || placeholderLocationName;
  const addressLine = address.trim();
  const hasSections = sections.length > 0;
  const curr = currency.trim().toUpperCase() || "UZS";
  const isDelivery = locationType === "delivery";

  return (
    <figure className="flex flex-col items-center gap-3">
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="relative w-[min(100%,288px)] shrink-0" aria-hidden>
        {/* Realistic iPhone shell */}
        <div className="rounded-[2.4rem] border-[9px] border-zinc-900 bg-zinc-900 p-1 shadow-2xl shadow-black/45 ring-1 ring-white/15">
          <div className="relative overflow-hidden rounded-[1.95rem] bg-stone-100 ring-1 ring-black/10">
            {/* Status bar with Dynamic Island */}
            <div className="relative z-30 flex h-6 w-full items-center justify-between px-4 pt-1">
              <span className="text-[10px] font-semibold tracking-tight text-white drop-shadow-sm">
                9:41
              </span>
              <div className="h-3 w-16 rounded-full bg-black shadow-xs" />
              <div className="flex items-center gap-1 text-[9px] font-bold text-white drop-shadow-sm">
                <span className="text-[8px]">5G</span>
                <div className="h-2 w-3.5 rounded-[3px] border border-white/80 p-0.5">
                  <div className="h-full w-2 bg-white rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* Scrollable Phone Viewport */}
            <div className="-mt-6 max-h-[min(520px,58vh)] overflow-y-auto overscroll-contain pb-3">
              {isDelivery ? (
                /* ========================================================= */
                /* DELIVERY STOREFRONT PREVIEW (matches menu-delivery)      */
                /* ========================================================= */
                <div className="bg-zinc-50/50 min-h-[480px]">
                  {/* Hero Cover Banner */}
                  <div className="relative h-28 w-full overflow-hidden bg-zinc-900">
                    {coverSrc ? (
                      <Image
                        src={coverSrc}
                        alt=""
                        fill
                        className="object-cover opacity-90"
                        sizes="288px"
                        unoptimized={imageSrcIsNonOptimizable(coverSrc)}
                      />
                    ) : (
                      <div className="size-full bg-gradient-to-tr from-amber-950 via-zinc-900 to-stone-900 flex items-center justify-center">
                        <div className="text-amber-500/20 text-4xl select-none">🍔</div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

                    {/* Top Floating Language Selector */}
                    <div className="absolute top-7 right-3 z-20">
                      <span className="rounded-full bg-black/40 px-2 py-0.5 text-[8px] font-semibold text-white backdrop-blur-md border border-white/20 shadow-xs flex items-center gap-0.5">
                        EN <span className="text-[6px]">▾</span>
                      </span>
                    </div>
                  </div>

                  {/* White Info Card Overlapping Banner */}
                  <div className="relative z-10 -mt-4 rounded-t-2xl bg-white px-3 pt-0 pb-3 shadow-xs">
                    {/* Floating Avatar Logo */}
                    <div className="-mt-6 mb-1.5 size-12 rounded-xl overflow-hidden border-2 border-white bg-white shadow-md flex items-center justify-center shrink-0 z-10">
                      {logoSrc ? (
                        <Image
                          src={logoSrc}
                          alt=""
                          width={48}
                          height={48}
                          className="size-full object-cover"
                          sizes="48px"
                          priority
                          unoptimized={imageSrcIsNonOptimizable(logoSrc)}
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-zinc-900 text-xs font-bold text-white">
                          {title.slice(0, 1).toUpperCase() || "·"}
                        </div>
                      )}
                    </div>

                    {/* Restaurant Title & Address */}
                    <h2 className="text-[14px] font-bold leading-tight tracking-tight text-zinc-900 line-clamp-1">
                      {title}
                    </h2>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                      <MapPinIcon className="size-3 text-zinc-400 shrink-0" />
                      <span className="truncate">{addressLine || "Select address on map"}</span>
                    </div>

                    {/* Delivery Status Badges */}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700 border border-emerald-200 shadow-2xs">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Open
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[8px] font-medium text-zinc-700 border border-zinc-200">
                        <ClockIcon className="size-2.5 text-zinc-500" />
                        25–35m
                      </span>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-medium text-amber-800 border border-amber-200">
                        <SparklesIcon className="size-2.5 text-amber-600" />
                        Free
                      </span>
                    </div>

                    {/* Verified Delivery Address & Distance Bar */}
                    <div className="mt-2.5 flex items-center justify-between rounded-xl border border-amber-300/70 bg-amber-500/10 p-2 shadow-2xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="flex size-5 items-center justify-center rounded-lg bg-amber-500 text-zinc-950 shrink-0">
                          <MapPinIcon className="size-2.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[7px] font-bold uppercase tracking-wider text-amber-900/80 leading-none">
                            DELIVER TO
                          </span>
                          <span className="block text-[9px] font-semibold text-zinc-900 truncate">
                            {addressLine || "Choose address on map"}
                          </span>
                        </div>
                      </div>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[8px] font-bold text-amber-900 border border-amber-200 shrink-0 shadow-2xs">
                        1.8 km
                      </span>
                    </div>

                    {/* Search Bar */}
                    <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] text-zinc-400">
                      <SearchIcon className="size-3 text-zinc-400 shrink-0" />
                      <span>Search dishes…</span>
                    </div>
                  </div>

                  {/* Horizontal Category Nav Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto border-y border-zinc-200/80 bg-white px-3 py-2">
                    <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[9px] font-semibold text-white shrink-0">
                      All
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[9px] font-medium text-zinc-600 shrink-0">
                      Burgers
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[9px] font-medium text-zinc-600 shrink-0">
                      Pizza
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[9px] font-medium text-zinc-600 shrink-0">
                      Drinks
                    </span>
                  </div>

                  {/* Delivery Item Cards */}
                  <div className="space-y-2 p-2.5">
                    {hasSections ? (
                      sections.map((sec) => (
                        <div key={sec.categoryName} className="space-y-1.5">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                            {sec.categoryName}
                          </h3>
                          {sec.items.map((it) => (
                            <div
                              key={it.name}
                              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-white p-2 shadow-2xs"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-zinc-900 truncate">
                                  {it.name}
                                </p>
                                <p className="text-[10px] font-bold text-zinc-700 mt-0.5">
                                  {it.price}
                                </p>
                              </div>
                              <span className="rounded-lg bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-zinc-950 shadow-2xs">
                                + Add
                              </span>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-white p-2 shadow-2xs">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100/70 text-lg shrink-0">
                            🍔
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-zinc-900 truncate">
                              Cheeseburger Deluxe
                            </p>
                            <p className="text-[9px] text-zinc-400 line-clamp-1">
                              Angus beef, cheddar, brioche
                            </p>
                            <p className="text-[10px] font-bold text-zinc-800 mt-0.5">
                              48 000 {curr}
                            </p>
                          </div>
                          <span className="rounded-lg bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-zinc-950 shadow-2xs">
                            + Add
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-white p-2 shadow-2xs">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100/70 text-lg shrink-0">
                            🍟
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-zinc-900 truncate">
                              Crispy Fries
                            </p>
                            <p className="text-[9px] text-zinc-400 line-clamp-1">
                              Sea salt, rosemary herbs
                            </p>
                            <p className="text-[10px] font-bold text-zinc-800 mt-0.5">
                              22 000 {curr}
                            </p>
                          </div>
                          <span className="rounded-lg bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-zinc-950 shadow-2xs">
                            + Add
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Floating Bottom Cart Bar */}
                  <div className="sticky bottom-1 mx-2 mt-2 flex items-center justify-between rounded-xl bg-amber-500 px-3 py-2 text-[10px] font-bold text-zinc-950 shadow-lg shadow-amber-500/25">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBagIcon className="size-3.5" />
                      <span>View order (2)</span>
                    </div>
                    <span>70 000 {curr} →</span>
                  </div>
                </div>
              ) : (
                /* ========================================================= */
                /* DINE-IN MENU PREVIEW (matches menu-customer)              */
                /* ========================================================= */
                <div className="bg-[#fafaf9] min-h-[480px]">
                  {/* Hero Header */}
                  <div className="relative h-24 w-full overflow-hidden bg-stone-900">
                    {coverSrc ? (
                      <Image
                        src={coverSrc}
                        alt=""
                        fill
                        className="object-cover opacity-80"
                        sizes="288px"
                        unoptimized={imageSrcIsNonOptimizable(coverSrc)}
                      />
                    ) : (
                      <div className="size-full bg-gradient-to-b from-stone-850 to-stone-950 flex items-center justify-center">
                        <div className="text-stone-700 text-3xl select-none">🍽️</div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent pointer-events-none" />

                    {/* Table Status Badge */}
                    <div className="absolute top-7 left-3 z-20">
                      <span className="rounded-full bg-black/60 px-2 py-0.5 text-[8px] font-semibold text-white backdrop-blur-md border border-white/20 shadow-xs flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Table 12
                      </span>
                    </div>

                    {/* Top Language Switcher */}
                    <div className="absolute top-7 right-3 z-20">
                      <span className="rounded-full bg-black/40 px-2 py-0.5 text-[8px] font-semibold text-white backdrop-blur-md border border-white/20 shadow-xs flex items-center gap-0.5">
                        EN <span className="text-[6px]">▾</span>
                      </span>
                    </div>
                  </div>

                  {/* Dine-In Header & Identity */}
                  <div className="px-3 pt-2.5 pb-2 border-b border-stone-200/80 bg-white">
                    <div className="flex items-start gap-2.5">
                      <div className="size-11 rounded-xl overflow-hidden border border-stone-200 bg-white shadow-xs flex items-center justify-center shrink-0">
                        {logoSrc ? (
                          <Image
                            src={logoSrc}
                            alt=""
                            width={44}
                            height={44}
                            className="size-full object-cover"
                            sizes="44px"
                            priority
                            unoptimized={imageSrcIsNonOptimizable(logoSrc)}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center bg-stone-100 text-xs font-semibold text-stone-400">
                            {title.slice(0, 1).toUpperCase() || "·"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <h2 className="text-[14px] font-bold leading-tight tracking-tight text-stone-900 line-clamp-1">
                          {title}
                        </h2>
                        {addressLine ? (
                          <p className="mt-0.5 text-[10px] text-stone-500 line-clamp-1">
                            {addressLine}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-stone-400">
                          {curr}
                        </p>
                      </div>
                    </div>

                    {/* Dine-In Action Buttons */}
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      <div className="flex items-center justify-center gap-1 rounded-lg border border-stone-200 bg-stone-50 py-1 text-[9px] font-medium text-stone-700 shadow-2xs">
                        <BellIcon className="size-2.5 text-stone-500" />
                        <span>Call waiter</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 rounded-lg border border-stone-200 bg-stone-50 py-1 text-[9px] font-medium text-stone-700 shadow-2xs">
                        <ReceiptIcon className="size-2.5 text-stone-500" />
                        <span>Table bill</span>
                      </div>
                    </div>
                  </div>

                  {/* Category Tabs */}
                  <div className="flex items-center border-b border-stone-200 bg-white px-3 text-[10px]">
                    <span className="border-b-2 border-stone-900 px-2.5 py-1.5 font-bold text-stone-900">
                      Dishes
                    </span>
                    <span className="px-2.5 py-1.5 font-medium text-stone-500">
                      Beverages
                    </span>
                    <span className="px-2.5 py-1.5 font-medium text-stone-500">
                      Desserts
                    </span>
                  </div>

                  {/* Dine-In Menu Rows */}
                  <div className="p-3 space-y-3">
                    {hasSections ? (
                      sections.map((sec) => (
                        <div key={sec.categoryName} className="space-y-2">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                            {sec.categoryName}
                          </h3>
                          <ul className="divide-y divide-stone-200/90">
                            {sec.items.map((it) => (
                              <li
                                key={it.name}
                                className="flex items-baseline justify-between gap-2 py-1.5 text-[12px]"
                              >
                                <span className="font-medium text-stone-800 truncate">
                                  {it.name}
                                </span>
                                <span className="tabular-nums font-semibold text-stone-600 shrink-0 text-[11px]">
                                  {it.price}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          Main Dishes
                        </h3>
                        <div className="divide-y divide-stone-200/90">
                          <div className="py-1.5">
                            <div className="flex items-baseline justify-between gap-2 text-[12px]">
                              <span className="font-medium text-stone-900">
                                Ribeye Steak 300g
                              </span>
                              <span className="font-bold text-stone-700 shrink-0 text-[11px]">
                                145 000 {curr}
                              </span>
                            </div>
                            <p className="text-[9px] text-stone-400 mt-0.5">
                              Charcoal grilled, herb butter
                            </p>
                          </div>

                          <div className="py-1.5">
                            <div className="flex items-baseline justify-between gap-2 text-[12px]">
                              <span className="font-medium text-stone-900">
                                Truffle Tagliatelle
                              </span>
                              <span className="font-bold text-stone-700 shrink-0 text-[11px]">
                                85 000 {curr}
                              </span>
                            </div>
                            <p className="text-[9px] text-stone-400 mt-0.5">
                              Black truffle cream, parmesan
                            </p>
                          </div>

                          <div className="py-1.5">
                            <div className="flex items-baseline justify-between gap-2 text-[12px]">
                              <span className="font-medium text-stone-900">
                                Caesar Salad
                              </span>
                              <span className="font-bold text-stone-700 shrink-0 text-[11px]">
                                52 000 {curr}
                              </span>
                            </div>
                            <p className="text-[9px] text-stone-400 mt-0.5">
                              Crispy romaine, garlic croutons
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-stone-200 text-center">
                      <p className="text-[9px] font-medium text-stone-400">
                        Dine-in menu · Enjoy your meal
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="max-w-[288px] text-center text-xs text-foreground/50">{caption}</p>
    </figure>
  );
}
