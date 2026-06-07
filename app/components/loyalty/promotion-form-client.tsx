"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LoyaltyPromotion } from "@/lib/loyalty-api/types";
import { useI18n } from "../i18n-provider";

const PROMOTION_TYPES = ["earn_multiplier", "bonus_points", "redeem_offer"] as const;

type Props = {
  promotionId?: string;
};

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function PromotionFormClient({ promotionId }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const isEdit = Boolean(promotionId);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<(typeof PROMOTION_TYPES)[number]>("bonus_points");
  const [rulesJson, setRulesJson] = useState("{}");
  const [pointsCost, setPointsCost] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!promotionId) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/settings/loyalty/promotions/${encodeURIComponent(promotionId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(await readErrorMessage(res, t("loyalty.errLoadPromotion")));
        }
        const data = (await res.json()) as { promotion: LoyaltyPromotion };
        const p = data.promotion;
        setName(p.name);
        setDescription(p.description ?? "");
        setType(p.type as (typeof PROMOTION_TYPES)[number]);
        setRulesJson(JSON.stringify(p.rules ?? {}, null, 2));
        setPointsCost(p.pointsCost != null ? String(p.pointsCost) : "");
        setActive(p.active);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loyalty.errLoadPromotion"));
      } finally {
        setLoading(false);
      }
    })();
  }, [promotionId, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let rules: unknown = {};
    try {
      rules = JSON.parse(rulesJson || "{}");
    } catch {
      setError(t("loyalty.invalidRulesJson"));
      setSaving(false);
      return;
    }

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      rules,
      pointsCost: pointsCost.trim() ? Number(pointsCost) : null,
      active,
    };

    const url = isEdit
      ? `/api/settings/loyalty/promotions/${encodeURIComponent(promotionId!)}`
      : "/api/settings/loyalty/promotions";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.errSavePromotion")));
      }
      router.push("/loyalty/promotions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loyalty.errSavePromotion"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-xl space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <label className="block text-sm">
        {t("common.name")}
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-foreground/15 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        {t("loyalty.description")}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-foreground/15 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        {t("loyalty.promotionType")}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as (typeof PROMOTION_TYPES)[number])}
          className="mt-1 w-full rounded-xl border border-foreground/15 px-3 py-2"
        >
          {PROMOTION_TYPES.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        {t("loyalty.rulesJson")}
        <textarea
          value={rulesJson}
          onChange={(e) => setRulesJson(e.target.value)}
          rows={6}
          className="mt-1 w-full font-mono text-xs rounded-xl border border-foreground/15 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        {t("loyalty.pointsCostOptional")}
        <input
          type="number"
          value={pointsCost}
          onChange={(e) => setPointsCost(e.target.value)}
          className="mt-1 w-full rounded-xl border border-foreground/15 px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {t("loyalty.active")}
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? t("loyalty.saving") : t("common.save")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/loyalty/promotions")}
          className="rounded-xl border border-foreground/15 px-4 py-2 text-sm"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
