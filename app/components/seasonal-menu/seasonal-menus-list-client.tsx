"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { SeasonalMenuDesignApi } from "@/lib/auth-api";
import { useI18n } from "@/app/components/i18n-provider";

type SeasonalMenusListClientProps = {
  initialDesigns: SeasonalMenuDesignApi[];
  loadError: string | null;
};

export function SeasonalMenusListClient({
  initialDesigns,
  loadError,
}: SeasonalMenusListClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [designs, setDesigns] = useState(initialDesigns);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(loadError);

  const handleNew = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/seasonal-menu-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t("seasonalMenu.newDesign"),
        }),
      });
      if (!res.ok) {
        setError(t("seasonalMenu.createFailed"));
        return;
      }
      const data = (await res.json()) as { design: SeasonalMenuDesignApi };
      router.push(`/seasonal-menus/${data.design.id}`);
    } catch {
      setError(t("seasonalMenu.createFailed"));
    } finally {
      setCreating(false);
    }
  }, [router, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t("seasonalMenu.deleteConfirm"))) return;
      const res = await fetch(`/api/settings/seasonal-menu-designs/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDesigns((prev) => prev.filter((d) => d.id !== id));
      }
    },
    [t],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void handleNew()}
          disabled={creating}
          className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
        >
          {creating ? t("seasonalMenu.saving") : t("seasonalMenu.newDesign")}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}

      {designs.length === 0 ? (
        <p className="mt-8 text-sm text-foreground/60">{t("seasonalMenu.emptyList")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-foreground/10 rounded-xl border border-foreground/10">
          {designs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{d.title}</p>
                <p className="text-xs text-foreground/55">
                  {t("seasonalMenu.updatedAt")}:{" "}
                  {new Date(d.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/seasonal-menus/${d.id}`}
                  className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
                >
                  {t("seasonalMenu.open")}
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete(d.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
