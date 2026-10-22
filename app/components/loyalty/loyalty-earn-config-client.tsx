"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatMinorCurrency, majorToMinor, minorToMajor } from "@/lib/currency-minor-units";
import type { EarnConfigResponse } from "@/lib/loyalty-api/operations";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function LoyaltyEarnConfigClient() {
  const { t, locale } = useI18n();
  const [config, setConfig] = useState<EarnConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState("");
  const [spendDraft, setSpendDraft] = useState("");

  const formatDate = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      ),
    [locale],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/loyalty/config", { cache: "no-store" });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.earnLoadFailed")));
        return;
      }
      const data = (await res.json()) as EarnConfigResponse;
      setConfig(data);
      setError(null);
      if (data.current) {
        setCurrencyDraft(data.current.currency);
        setSpendDraft(String(minorToMajor(data.current.spendMinorPerPoint, data.current.currency)));
      }
    } catch {
      setError(t("loyalty.earnLoadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onContextChanged = () => void load();
    window.addEventListener("restaurant-context-changed", onContextChanged);
    return () => window.removeEventListener("restaurant-context-changed", onContextChanged);
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const currency = currencyDraft.trim().toUpperCase();
    const spendMajor = Number(spendDraft);
    if (!/^[A-Z]{3}$/.test(currency)) {
      setError(t("loyalty.earnInvalidCurrency"));
      return;
    }
    const spendMinorPerPoint = majorToMinor(spendMajor, currency);
    if (!Number.isFinite(spendMajor) || spendMinorPerPoint < 1) {
      setError(t("loyalty.earnInvalidSpend"));
      return;
    }
    if (!window.confirm(t("loyalty.earnSaveConfirm"))) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/loyalty/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, spendMinorPerPoint }),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.earnSaveFailed")));
        return;
      }
      setSaved(true);
      await load();
    } catch {
      setError(t("loyalty.earnSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">{t("loyalty.earnTitle")}</h2>
      <p className="mt-1 text-sm text-foreground/60">{t("loyalty.earnHint")}</p>
      {config && !config.configured ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {t("loyalty.earnNotConfigured")}
        </p>
      ) : null}
      {config?.current ? (
        <p className="mt-3 text-sm">
          {t("loyalty.earnCurrentRule")
            .replace(
              "{amount}",
              formatMinorCurrency(config.current.spendMinorPerPoint, config.current.currency, locale),
            )
            .replace("{since}", formatDate(config.current.effectiveAt))}
        </p>
      ) : null}
      <form onSubmit={(e) => void save(e)} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-foreground/60">{t("loyalty.earnCurrency")}</span>
          <input
            value={currencyDraft}
            onChange={(e) => setCurrencyDraft(e.target.value)}
            maxLength={3}
            placeholder="KZT"
            className="mt-1 w-24 rounded-xl border border-foreground/12 bg-transparent px-3 py-2 uppercase"
          />
        </label>
        <label className="text-sm">
          <span className="block text-foreground/60">{t("loyalty.earnSpendPerPoint")}</span>
          <input
            value={spendDraft}
            onChange={(e) => setSpendDraft(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-36 rounded-xl border border-foreground/12 bg-transparent px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("loyalty.earnSaving") : t("loyalty.earnSave")}
        </button>
      </form>
      {saved ? (
        <p className="mt-3 text-sm" role="status">{t("loyalty.earnSaved")}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>
      ) : null}
      {config && config.history.length > 0 ? (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-foreground/50">
            <tr>
              <th className="py-2 font-medium">{t("loyalty.earnEffectiveAt")}</th>
              <th className="py-2 font-medium">{t("loyalty.earnCurrency")}</th>
              <th className="py-2 text-right font-medium">{t("loyalty.earnSpendPerPoint")}</th>
              <th className="py-2 font-medium">{t("loyalty.earnVersion")}</th>
            </tr>
          </thead>
          <tbody>
            {config.history.map((row) => (
              <tr key={row.version} className="border-t border-foreground/8">
                <td className="py-2">{formatDate(row.effectiveAt)}</td>
                <td className="py-2">{row.currency}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMinorCurrency(row.spendMinorPerPoint, row.currency, locale)}
                </td>
                <td className="py-2 font-mono text-xs text-foreground/60">{row.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
