"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MealConstructor } from "@/lib/auth-api";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function MealConstructorsClient() {
  const { t } = useI18n();
  const [constructors, setConstructors] = useState<MealConstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/settings/meal-constructors", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, t("constructors.errLoad")));
    }
    const data = (await res.json()) as { constructors: MealConstructor[] };
    setConstructors(data.constructors);
  }, [t]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("constructors.errLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [load, t]);

  useEffect(() => {
    const onContextChanged = () => {
      setLoading(true);
      void load()
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : t("constructors.errLoad"));
        })
        .finally(() => setLoading(false));
    };
    window.addEventListener("restaurant-context-changed", onContextChanged);
    return () => window.removeEventListener("restaurant-context-changed", onContextChanged);
  }, [load, t]);

  async function handleDelete(id: string) {
    if (!window.confirm(t("constructors.deleteConfirm"))) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/settings/meal-constructors/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(await readErrorMessage(res, t("constructors.errDelete")));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("constructors.errDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/60">{t("constructors.listHint")}</p>
        <Link
          href="/global-menu/constructors/new"
          className="inline-flex items-center rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          {t("constructors.new")}
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-foreground/60">{t("constructors.loading")}</p>
      ) : constructors.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("constructors.empty")}</p>
      ) : (
        <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
          {constructors.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-foreground/55">
                  {t("constructors.meta", {
                    slots: String(row.slots.length),
                    hosts: String(row.hosts.length),
                    active: row.active
                      ? t("constructors.active")
                      : t("constructors.inactive"),
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/global-menu/constructors/${encodeURIComponent(row.id)}`}
                  className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm"
                >
                  {t("constructors.edit")}
                </Link>
                <button
                  type="button"
                  disabled={deletingId === row.id}
                  onClick={() => void handleDelete(row.id)}
                  className="rounded-md border border-red-500/30 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:text-red-300"
                >
                  {t("constructors.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
