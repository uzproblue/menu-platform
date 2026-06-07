"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LoyaltyPromotion } from "@/lib/loyalty-api/types";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function LoyaltyPromotionsClient() {
  const { t } = useI18n();
  const [promotions, setPromotions] = useState<LoyaltyPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/settings/loyalty/promotions", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, t("loyalty.errLoadPromotions")));
    }
    const data = (await res.json()) as { promotions: LoyaltyPromotion[] };
    setPromotions(data.promotions);
  }, [t]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loyalty.errLoadPromotions"));
      } finally {
        setLoading(false);
      }
    })();
  }, [load, t]);

  async function handleDelete(id: string) {
    if (!window.confirm(t("loyalty.deletePromotionConfirm"))) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/settings/loyalty/promotions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(await readErrorMessage(res, t("loyalty.errDeletePromotion")));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loyalty.errDeletePromotion"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/loyalty/promotions/new"
          className="inline-flex rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {t("loyalty.newPromotion")}
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : promotions.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("loyalty.noPromotions")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-foreground/5 text-foreground/70">
              <tr>
                <th className="px-3 py-2">{t("common.name")}</th>
                <th className="px-3 py-2">{t("loyalty.promotionType")}</th>
                <th className="px-3 py-2">{t("common.status")}</th>
                <th className="px-3 py-2">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} className="border-t border-foreground/10">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">{p.type}</td>
                  <td className="px-3 py-2">{p.active ? t("loyalty.active") : t("loyalty.inactive")}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link
                        href={`/loyalty/promotions/${encodeURIComponent(p.id)}`}
                        className="text-sm underline"
                      >
                        {t("common.edit")}
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => void handleDelete(p.id)}
                        className="text-sm text-red-600 disabled:opacity-50"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
