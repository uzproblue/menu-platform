"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BalanceReconciliationResult,
  BalanceReconciliationRun,
  LoyaltyIncident,
  LoyaltyIncidentStatus,
  LoyaltyIncidentsResponse,
} from "@/lib/loyalty-api/operations";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

const STATUSES: LoyaltyIncidentStatus[] = ["open", "resolved", "ignored"];

export function LoyaltyOperationsClient() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<LoyaltyIncidentStatus>("open");
  const [incidents, setIncidents] = useState<LoyaltyIncident[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [runs, setRuns] = useState<BalanceReconciliationRun[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [lastResult, setLastResult] = useState<BalanceReconciliationResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const formatDate = useCallback(
    (value: string | number | null) =>
      value == null
        ? "—"
        : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(value),
          ),
    [locale],
  );

  const loadIncidents = useCallback(
    async (before?: number) => {
      try {
        const qs = new URLSearchParams({ status });
        if (before) qs.set("before", String(before));
        const res = await fetch(`/api/settings/loyalty/incidents?${qs}`, { cache: "no-store" });
        setIncidentsError(null);
        if (!res.ok) {
          setIncidentsError(await readErrorMessage(res, t("loyalty.operationsLoadFailed")));
          return;
        }
        const data = (await res.json()) as LoyaltyIncidentsResponse;
        setIncidents((prev) => (before ? [...prev, ...data.incidents] : data.incidents));
        setNextBefore(data.nextBefore);
      } catch {
        setIncidentsError(t("loyalty.operationsLoadFailed"));
      } finally {
        setLoadingIncidents(false);
      }
    },
    [status, t],
  );

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/loyalty/reconciliation", { cache: "no-store" });
      if (!res.ok) {
        setRunsError(await readErrorMessage(res, t("loyalty.operationsLoadFailed")));
        return;
      }
      setRuns(((await res.json()) as { runs: BalanceReconciliationRun[] }).runs);
      setRunsError(null);
    } catch {
      setRunsError(t("loyalty.operationsLoadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    const onContextChanged = () => {
      void loadIncidents();
      void loadRuns();
    };
    window.addEventListener("restaurant-context-changed", onContextChanged);
    return () => window.removeEventListener("restaurant-context-changed", onContextChanged);
  }, [loadIncidents, loadRuns]);

  async function updateIncident(id: string, next: "resolved" | "ignored") {
    const res = await fetch(`/api/settings/loyalty/incidents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setIncidentsError(await readErrorMessage(res, t("loyalty.operationsUpdateFailed")));
      return;
    }
    setIncidents((prev) => prev.filter((incident) => incident.id !== id));
  }

  async function reconcile(repair: boolean) {
    if (repair && !window.confirm(t("loyalty.operationsRepairConfirm"))) return;
    setReconciling(true);
    setRunsError(null);
    try {
      const res = await fetch("/api/settings/loyalty/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repair }),
      });
      if (!res.ok) {
        setRunsError(await readErrorMessage(res, t("loyalty.operationsReconcileFailed")));
        return;
      }
      setLastResult((await res.json()) as BalanceReconciliationResult);
      await Promise.all([loadRuns(), loadIncidents()]);
    } catch {
      setRunsError(t("loyalty.operationsReconcileFailed"));
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("loyalty.operationsReconciliation")}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void reconcile(false)}
              disabled={reconciling}
              className="rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {reconciling ? t("loyalty.operationsReconciling") : t("loyalty.operationsCheckBalances")}
            </button>
            <button
              type="button"
              onClick={() => void reconcile(true)}
              disabled={reconciling}
              className="rounded-xl border border-foreground/12 px-3 py-2 text-sm text-foreground/75 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {t("loyalty.operationsRepair")}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-foreground/60">{t("loyalty.operationsReconciliationHint")}</p>
        {lastResult ? (
          <p className="mt-3 text-sm" role="status">
            {t("loyalty.operationsLastResult")
              .replace("{scanned}", String(lastResult.scannedCount))
              .replace("{mismatched}", String(lastResult.mismatchCount))
              .replace("{repaired}", String(lastResult.repairedCount))}
          </p>
        ) : null}
        {runsError ? (
          <p className="mt-3 text-sm text-red-600" role="alert">{runsError}</p>
        ) : null}
        {runs.length > 0 ? (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-foreground/50">
              <tr>
                <th className="py-2 font-medium">{t("loyalty.operationsStarted")}</th>
                <th className="py-2 font-medium">{t("loyalty.operationsMode")}</th>
                <th className="py-2 font-medium">{t("loyalty.operationsStatus")}</th>
                <th className="py-2 text-right font-medium">{t("loyalty.operationsScanned")}</th>
                <th className="py-2 text-right font-medium">{t("loyalty.operationsMismatched")}</th>
                <th className="py-2 text-right font-medium">{t("loyalty.operationsRepaired")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-foreground/8">
                  <td className="py-2">{formatDate(run.startedAt)}</td>
                  <td className="py-2">{run.mode}</td>
                  <td className="py-2">{run.status}</td>
                  <td className="py-2 text-right tabular-nums">{run.scannedCount}</td>
                  <td
                    className={`py-2 text-right tabular-nums ${run.mismatchCount > 0 ? "font-semibold text-red-600" : ""}`}
                  >
                    {run.mismatchCount}
                  </td>
                  <td className="py-2 text-right tabular-nums">{run.repairedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("loyalty.operationsIncidents")}</h2>
          <div className="flex gap-1 rounded-xl border border-foreground/10 p-1">
            {STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setLoadingIncidents(true);
                  setStatus(value);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  status === value ? "bg-foreground text-background" : "text-foreground/70 hover:bg-foreground/5"
                }`}
              >
                {t(`loyalty.incidentStatus.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-sm text-foreground/60">{t("loyalty.operationsIncidentsHint")}</p>
        {incidentsError ? (
          <p className="mt-3 text-sm text-red-600" role="alert">{incidentsError}</p>
        ) : null}
        {!loadingIncidents && incidents.length === 0 && !incidentsError ? (
          <p className="mt-6 text-sm text-foreground/50">{t("loyalty.operationsNoIncidents")}</p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-xl border border-foreground/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{incident.category}</p>
                  <p className="mt-0.5 break-words text-sm text-foreground/70">{incident.message}</p>
                  <p className="mt-1 text-xs text-foreground/50">
                    {formatDate(incident.occurredAt)}
                    {incident.eventId ? ` · ${incident.eventId}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === incident.id ? null : incident.id)}
                    className="rounded-xl px-3 py-1.5 text-sm text-foreground/60 transition hover:bg-foreground/5"
                  >
                    {t("loyalty.operationsDetails")}
                  </button>
                  {incident.status === "open" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void updateIncident(incident.id, "resolved")}
                        className="rounded-xl border border-foreground/12 px-3 py-1.5 text-sm transition hover:bg-foreground/5"
                      >
                        {t("loyalty.operationsResolve")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateIncident(incident.id, "ignored")}
                        className="rounded-xl px-3 py-1.5 text-sm text-foreground/50 transition hover:bg-foreground/5"
                      >
                        {t("loyalty.operationsIgnore")}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              {expanded === incident.id ? (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-foreground/5 p-3 text-xs">
                  {JSON.stringify(incident.details, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
        {nextBefore ? (
          <button
            type="button"
            onClick={() => {
              setLoadingIncidents(true);
              void loadIncidents(nextBefore);
            }}
            disabled={loadingIncidents}
            className="mt-4 rounded-xl border border-foreground/12 px-3 py-2 text-sm text-foreground/75 transition hover:bg-foreground/5 disabled:opacity-50"
          >
            {t("loyalty.operationsLoadMore")}
          </button>
        ) : null}
      </section>
    </div>
  );
}
