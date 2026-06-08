"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./i18n-provider";

type RestaurantOption = {
  id: string;
  name: string;
  role: string;
};

type RestaurantsPayload = {
  isOwner?: boolean;
  restaurants?: RestaurantOption[];
  selectedRestaurantId?: string | null;
  currentRestaurantId?: string | null;
};

export function RestaurantSwitcher() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/restaurant-context", {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as RestaurantsPayload | null;
      if (!res.ok || !payload?.restaurants) {
        setRestaurants([]);
        setSelectedId(null);
        return;
      }
      setRestaurants(payload.restaurants);
      const resolvedId =
        payload.selectedRestaurantId ??
        payload.currentRestaurantId ??
        payload.restaurants[0]?.id ??
        null;
      setSelectedId(resolvedId);

      if (
        !payload.selectedRestaurantId &&
        resolvedId &&
        payload.restaurants.length > 0
      ) {
        await fetch("/api/settings/restaurant-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: resolvedId }),
        });
        window.dispatchEvent(
          new CustomEvent("restaurant-context-changed", {
            detail: { restaurantId: resolvedId },
          }),
        );
        router.refresh();
      }
    } catch {
      setRestaurants([]);
      setSelectedId(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!loaded || restaurants.length <= 1) {
    return null;
  }

  const selected =
    restaurants.find((r) => r.id === selectedId) ?? restaurants[0];

  async function selectRestaurant(restaurantId: string) {
    if (restaurantId === selectedId || pending) return;
    setPending(true);
    setOpen(false);
    try {
      const res = await fetch("/api/settings/restaurant-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) return;
      setSelectedId(restaurantId);
      window.dispatchEvent(
        new CustomEvent("restaurant-context-changed", { detail: { restaurantId } }),
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={rootRef} className="relative hidden min-w-0 sm:block">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((prev) => !prev)}
        className="flex max-w-[11rem] min-w-0 cursor-pointer items-center gap-1.5 rounded-xl border border-foreground/15 bg-background/80 px-2.5 py-1.5 text-left text-sm text-foreground shadow-sm ring-1 ring-foreground/5 transition-colors hover:bg-foreground/5 disabled:opacity-60 md:max-w-[14rem]"
        aria-label={t("restaurant.switcherLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
        <svg
          className="size-4 shrink-0 text-foreground/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t("restaurant.switcherLabel")}
          className="absolute right-0 top-full z-30 mt-2 max-h-72 min-w-[12rem] overflow-y-auto rounded-xl border border-foreground/10 bg-background/95 p-1.5 shadow-xl ring-1 ring-foreground/10 backdrop-blur-md"
        >
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-widest text-foreground/50">
            {t("restaurant.selectPrompt")}
          </p>
          {restaurants.map((r) => {
            const active = r.id === selected.id;
            return (
              <button
                key={r.id}
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={() => void selectRestaurant(r.id)}
                className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-foreground/10 font-medium text-foreground"
                    : "text-foreground/80 hover:bg-foreground/5"
                }`}
              >
                <span className="min-w-0 truncate">{r.name}</span>
                {active ? (
                  <svg
                    className="size-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
