"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { GuestsListResponse, LoyaltyGuest, LoyaltyLedgerEntry } from "@/lib/loyalty-api/types";
import { buildGuestsListQuery } from "@/lib/loyalty-api/guests-query";
import { formatMinorCurrency, majorToMinor } from "@/lib/currency-minor-units";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

type StatusFilter = "" | "active" | "blocked";

type AppliedFilters = {
  search: string;
  status: StatusFilter;
  lastVisitedFrom: string;
  lastVisitedTo: string;
  minSpend: string;
  maxSpend: string;
};

const DEFAULT_FILTERS: AppliedFilters = {
  search: "",
  status: "",
  lastVisitedFrom: "",
  lastVisitedTo: "",
  minSpend: "",
  maxSpend: "",
};

const PAGE_SIZE_OPTIONS = [25, 50] as const;

function parseSpendInput(value: string, currency: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return majorToMinor(n, currency);
}

function formatVisitDate(value: string | null, neverLabel: string, locale: string): string {
  if (!value) return neverLabel;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return neverLabel;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
}

function statusBadgeClass(status: string): string {
  if (status === "active") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "blocked") {
    return "bg-red-500/15 text-red-700 dark:text-red-300";
  }
  return "bg-foreground/10 text-foreground/70";
}

export function LoyaltyMembersClient() {
  const { t, locale } = useI18n();
  const [guests, setGuests] = useState<LoyaltyGuest[]>([]);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState("KZT");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);

  const [query, setQuery] = useState("");
  const [statusDraft, setStatusDraft] = useState<StatusFilter>("");
  const [lastVisitedFromDraft, setLastVisitedFromDraft] = useState("");
  const [lastVisitedToDraft, setLastVisitedToDraft] = useState("");
  const [minSpendDraft, setMinSpendDraft] = useState("");
  const [maxSpendDraft, setMaxSpendDraft] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applied, setApplied] = useState<AppliedFilters>(DEFAULT_FILTERS);

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LoyaltyGuest | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyLedgerEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pointsInput, setPointsInput] = useState("10");
  const [noteInput, setNoteInput] = useState("");
  const [mutating, setMutating] = useState(false);
  const mutationAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const hasActiveFilters = useMemo(() => {
    return (
      applied.search.trim() !== "" ||
      applied.status !== "" ||
      applied.lastVisitedFrom !== "" ||
      applied.lastVisitedTo !== "" ||
      applied.minSpend.trim() !== "" ||
      applied.maxSpend.trim() !== ""
    );
  }, [applied]);

  const loadGuests = useCallback(async () => {
    setListError(null);
    const params = buildGuestsListQuery({
      q: applied.search || undefined,
      status: applied.status || undefined,
      lastVisitedFrom: applied.lastVisitedFrom || undefined,
      lastVisitedTo: applied.lastVisitedTo || undefined,
      minSpend: parseSpendInput(applied.minSpend, currency),
      maxSpend: parseSpendInput(applied.maxSpend, currency),
      page,
      limit,
      sort: "createdAt",
      order: "desc",
    });
    const res = await fetch(`/api/settings/loyalty/guests${params}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, t("loyalty.errLoadMembers")));
    }
    const data = (await res.json()) as GuestsListResponse;
    setGuests(data.guests ?? []);
    setTotal(typeof data.total === "number" ? data.total : 0);
    setCurrency(data.currency?.trim() || "KZT");
  }, [applied, currency, limit, page, t]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadGuests();
      } catch (e) {
        setListError(e instanceof Error ? e.message : t("loyalty.errLoadMembers"));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadGuests, t]);

  useEffect(() => {
    const onContextChanged = () => {
      setSelected(null);
      setTransactions([]);
      setDetailError(null);
      setMutationError(null);
      mutationAttempt.current = null;
      setMinSpendDraft("");
      setMaxSpendDraft("");
      setApplied((current) => ({ ...current, minSpend: "", maxSpend: "" }));
      setPage(1);
    };
    window.addEventListener("restaurant-context-changed", onContextChanged);
    return () => window.removeEventListener("restaurant-context-changed", onContextChanged);
  }, []);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function applyFilters(next: AppliedFilters) {
    setApplied(next);
    setPage(1);
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    applyFilters({
      ...applied,
      search: query,
      status: statusDraft,
      lastVisitedFrom: lastVisitedFromDraft,
      lastVisitedTo: lastVisitedToDraft,
      minSpend: minSpendDraft,
      maxSpend: maxSpendDraft,
    });
  }

  function resetFilters() {
    setQuery("");
    setStatusDraft("");
    setLastVisitedFromDraft("");
    setLastVisitedToDraft("");
    setMinSpendDraft("");
    setMaxSpendDraft("");
    applyFilters(DEFAULT_FILTERS);
  }

  async function openGuest(guest: LoyaltyGuest) {
    setSelected(guest);
    setDetailError(null);
    setMutationError(null);
    mutationAttempt.current = null;
    setDetailLoading(true);
    setTransactions([]);
    try {
      const res = await fetch(`/api/settings/loyalty/guests/${encodeURIComponent(guest.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.errLoadMember")));
      }
      const data = (await res.json()) as {
        guest: LoyaltyGuest;
        recentTransactions: LoyaltyLedgerEntry[];
      };
      setSelected(data.guest);
      setTransactions(data.recentTransactions);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : t("loyalty.errLoadMember"));
    } finally {
      setDetailLoading(false);
    }
  }

  async function mutatePoints(kind: "earn" | "redeem" | "adjust") {
    if (!selected) return;
    const points = Number(pointsInput);
    if (!Number.isFinite(points) || points === 0) return;
    const note = noteInput.trim();
    const fingerprint = JSON.stringify([selected.id, kind, points, note]);
    if (mutationAttempt.current?.fingerprint !== fingerprint) {
      mutationAttempt.current = {
        fingerprint,
        key: globalThis.crypto.randomUUID(),
      };
    }
    setMutating(true);
    setMutationError(null);
    try {
      const res = await fetch(
        `/api/settings/loyalty/guests/${encodeURIComponent(selected.id)}/points`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            points,
            note: note || undefined,
            idempotencyKey: mutationAttempt.current.key,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.errAdjustPoints")));
      }
      const data = (await res.json()) as { balance: number };
      mutationAttempt.current = null;
      setSelected({ ...selected, balance: data.balance });
      await loadGuests().catch((e: unknown) => {
        setListError(e instanceof Error ? e.message : t("loyalty.errLoadMembers"));
      });
      await openGuest({ ...selected, balance: data.balance });
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : t("loyalty.errAdjustPoints"));
    } finally {
      setMutating(false);
    }
  }

  function statusLabel(status: string): string {
    if (status === "active") return t("loyalty.statusActive");
    if (status === "blocked") return t("loyalty.statusBlocked");
    return status;
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={submitSearch}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("loyalty.searchPlaceholder")}
            className="flex-1 rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
          <select
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value as StatusFilter)}
            className="rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm sm:w-44"
            aria-label={t("common.status")}
          >
            <option value="">{t("loyalty.statusAll")}</option>
            <option value="active">{t("loyalty.statusActive")}</option>
            <option value="blocked">{t("loyalty.statusBlocked")}</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            {t("loyalty.search")}
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="rounded-xl border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            {t("loyalty.filters")}
          </button>
        </div>

        {filtersOpen ? (
          <div className="grid gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.lastVisitedFrom")}
              <input
                type="date"
                value={lastVisitedFromDraft}
                onChange={(e) => setLastVisitedFromDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.lastVisitedTo")}
              <input
                type="date"
                value={lastVisitedToDraft}
                onChange={(e) => setLastVisitedToDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.minSpend")}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={minSpendDraft}
                onChange={(e) => setMinSpendDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.maxSpend")}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={maxSpendDraft}
                onChange={(e) => setMaxSpendDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                {t("loyalty.applyFilters")}
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/5"
              >
                {t("loyalty.resetFilters")}
              </button>
            </div>
          </div>
        ) : null}
      </form>

      {listError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {listError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground/60">
        <p>{t("loyalty.membersCount", { total: String(total) })}</p>
        <label className="flex items-center gap-2">
          <span>{t("loyalty.pageSize")}</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              setPage(1);
            }}
            className="rounded-lg border border-foreground/15 bg-background px-2 py-1 text-sm text-foreground"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : guests.length === 0 ? (
        <p className="text-sm text-foreground/60">
          {hasActiveFilters ? t("loyalty.noMembersMatch") : t("loyalty.noMembers")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-background/40 ring-1 ring-foreground/5">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-xs font-medium uppercase tracking-wider text-foreground/50">
                <th className="px-4 py-3 pl-5" scope="col">
                  {t("common.name")}
                </th>
                <th className="px-4 py-3" scope="col">
                  {t("loyalty.phone")}
                </th>
                <th className="px-4 py-3 text-right tabular-nums" scope="col">
                  {t("loyalty.balance")}
                </th>
                <th className="px-4 py-3" scope="col">
                  {t("loyalty.lastVisited")}
                </th>
                <th className="px-4 py-3 text-right tabular-nums" scope="col">
                  {t("loyalty.ordersValue")}
                </th>
                <th className="px-4 py-3 pr-5" scope="col">
                  {t("common.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr
                  key={g.id}
                  className="cursor-pointer border-b border-foreground/5 last:border-0 transition-colors hover:bg-foreground/3"
                  onClick={() => void openGuest(g)}
                >
                  <td className="px-4 py-3 pl-5 font-medium">{g.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground/70">{g.phoneE164}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{g.balance}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {formatVisitDate(g.lastVisitedAt, t("loyalty.neverVisited"), locale)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                    {formatMinorCurrency(g.lifetimeSpendMinor ?? 0, currency, locale)}
                  </td>
                  <td className="px-4 py-3 pr-5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(g.status)}`}
                    >
                      {statusLabel(g.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-foreground/60">
            {t("loyalty.pageOf", { page: String(page), totalPages: String(totalPages) })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {t("loyalty.prevPage")}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {t("loyalty.nextPage")}
            </button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 ring-1 ring-foreground/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <p className="text-sm text-foreground/60">{selected.phoneE164}</p>
              <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <p>
                  {t("loyalty.balance")}: <strong>{selected.balance}</strong>
                </p>
                <p>
                  {t("common.status")}:{" "}
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(selected.status)}`}
                  >
                    {statusLabel(selected.status)}
                  </span>
                </p>
                <p>
                  {t("loyalty.lastVisited")}:{" "}
                  <strong>
                    {formatVisitDate(selected.lastVisitedAt, t("loyalty.neverVisited"), locale)}
                  </strong>
                </p>
                <p>
                  {t("loyalty.ordersValue")}:{" "}
                  <strong>
                    {formatMinorCurrency(selected.lifetimeSpendMinor ?? 0, currency, locale)}
                  </strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-sm text-foreground/60 hover:text-foreground"
              onClick={() => setSelected(null)}
            >
              {t("common.close")}
            </button>
          </div>

          {detailError ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {detailError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              {t("loyalty.points")}
              <input
                type="number"
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                className="w-24 rounded-lg border border-foreground/15 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs">
              {t("loyalty.noteOptional")}
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="rounded-lg border border-foreground/15 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={mutating}
              onClick={() => void mutatePoints("earn")}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("loyalty.earn")}
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => void mutatePoints("redeem")}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("loyalty.redeem")}
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() => void mutatePoints("adjust")}
              className="rounded-lg bg-foreground/80 px-3 py-2 text-sm text-background disabled:opacity-50"
            >
              {t("loyalty.adjust")}
            </button>
          </div>

          {mutationError ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {mutationError}
            </p>
          ) : null}

          <div className="mt-4">
            <h3 className="text-sm font-medium">{t("loyalty.recentTransactions")}</h3>
            {detailLoading ? (
              <p className="mt-2 text-sm text-foreground/60">{t("loyalty.loading")}</p>
            ) : transactions.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/60">{t("loyalty.noTransactions")}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex justify-between gap-4 border-b border-foreground/5 py-1"
                  >
                    <span>
                      {tx.kind} {tx.points > 0 ? `+${tx.points}` : tx.points}
                      {tx.note ? ` — ${tx.note}` : ""}
                    </span>
                    <span className="shrink-0 text-foreground/50">{tx.createdAt ?? ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
