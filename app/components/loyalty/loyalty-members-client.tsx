"use client";

import { useCallback, useEffect, useState } from "react";
import type { LoyaltyGuest, LoyaltyLedgerEntry } from "@/lib/loyalty-api/types";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function LoyaltyMembersClient() {
  const { t } = useI18n();
  const [guests, setGuests] = useState<LoyaltyGuest[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LoyaltyGuest | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyLedgerEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pointsInput, setPointsInput] = useState("10");
  const [noteInput, setNoteInput] = useState("");
  const [mutating, setMutating] = useState(false);

  const loadGuests = useCallback(async () => {
    setError(null);
    const params = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    const res = await fetch(`/api/settings/loyalty/guests${params}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, t("loyalty.errLoadMembers")));
    }
    const data = (await res.json()) as { guests: LoyaltyGuest[] };
    setGuests(data.guests);
  }, [search, t]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadGuests();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loyalty.errLoadMembers"));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadGuests, t]);

  async function openGuest(guest: LoyaltyGuest) {
    setSelected(guest);
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
      setError(e instanceof Error ? e.message : t("loyalty.errLoadMember"));
    } finally {
      setDetailLoading(false);
    }
  }

  async function mutatePoints(kind: "earn" | "redeem" | "adjust") {
    if (!selected) return;
    const points = Number(pointsInput);
    if (!Number.isFinite(points) || points === 0) return;
    setMutating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/settings/loyalty/guests/${encodeURIComponent(selected.id)}/points`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, points, note: noteInput.trim() || undefined }),
        },
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.errAdjustPoints")));
      }
      const data = (await res.json()) as { balance: number };
      setSelected({ ...selected, balance: data.balance });
      await loadGuests();
      await openGuest({ ...selected, balance: data.balance });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loyalty.errAdjustPoints"));
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("loyalty.searchPlaceholder")}
          className="flex-1 rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {t("loyalty.search")}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : guests.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("loyalty.noMembers")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-foreground/5 text-foreground/70">
              <tr>
                <th className="px-3 py-2">{t("common.name")}</th>
                <th className="px-3 py-2">{t("loyalty.phone")}</th>
                <th className="px-3 py-2">{t("loyalty.balance")}</th>
                <th className="px-3 py-2">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr
                  key={g.id}
                  className="cursor-pointer border-t border-foreground/10 hover:bg-foreground/5"
                  onClick={() => void openGuest(g)}
                >
                  <td className="px-3 py-2 font-medium">{g.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{g.phoneE164}</td>
                  <td className="px-3 py-2">{g.balance}</td>
                  <td className="px-3 py-2">{g.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <p className="text-sm text-foreground/60">{selected.phoneE164}</p>
              <p className="mt-2 text-sm">
                {t("loyalty.balance")}: <strong>{selected.balance}</strong>
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-foreground/60 hover:text-foreground"
              onClick={() => setSelected(null)}
            >
              {t("common.close")}
            </button>
          </div>

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

          <div className="mt-4">
            <h3 className="text-sm font-medium">{t("loyalty.recentTransactions")}</h3>
            {detailLoading ? (
              <p className="mt-2 text-sm text-foreground/60">{t("loyalty.loading")}</p>
            ) : transactions.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/60">{t("loyalty.noTransactions")}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {transactions.map((tx) => (
                  <li key={tx.id} className="flex justify-between gap-4 border-b border-foreground/5 py-1">
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
