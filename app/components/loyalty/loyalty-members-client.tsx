"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type {
  GuestDetailResponse,
  GuestsListResponse,
  GuestsListSort,
  LoyaltyGuest,
  LoyaltyGuestOrder,
  LoyaltyLedgerEntry,
} from "@/lib/loyalty-api/types";
import { buildGuestsListQuery } from "@/lib/loyalty-api/guests-query";
import type { GuestBlastChannel, GuestBlastPreviewResponse } from "@/lib/loyalty-api/guests";
import { formatMinorCurrency, majorToMinor } from "@/lib/currency-minor-units";
import { useI18n } from "../i18n-provider";
import {
  LoyaltyMemberBlastModals,
  type BlastSendPayload,
} from "./loyalty-member-blast-modals";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

type StatusFilter = "" | "active" | "blocked";
type MemberTab = "all" | "legacy";
type VerifiedFilter = "" | "whatsapp" | "telegram" | "any" | "none";
type TriFilter = "" | "true" | "false";
type WalletPlatformFilter = "" | "apple" | "google";
type SortOrder = "asc" | "desc";

type AppliedFilters = {
  search: string;
  status: StatusFilter;
  lastVisitedFrom: string;
  lastVisitedTo: string;
  minSpend: string;
  maxSpend: string;
  minVisits: string;
  maxVisits: string;
  minBalance: string;
  maxBalance: string;
  verified: VerifiedFilter;
  hasWallet: TriFilter;
  walletPlatform: WalletPlatformFilter;
  iikoMatched: TriFilter;
  marketingConsent: TriFilter;
};

const DEFAULT_FILTERS: AppliedFilters = {
  search: "",
  status: "",
  lastVisitedFrom: "",
  lastVisitedTo: "",
  minSpend: "",
  maxSpend: "",
  minVisits: "",
  maxVisits: "",
  minBalance: "",
  maxBalance: "",
  verified: "",
  hasWallet: "",
  walletPlatform: "",
  iikoMatched: "",
  marketingConsent: "",
};

const PAGE_SIZE_OPTIONS = [25, 50] as const;
const BLAST_MAX = 500;

function parseSpendInput(value: string, currency: string | null): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return majorToMinor(n, currency);
}

function parseNonNegIntInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function parseTriBool(value: TriFilter): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function formatVisitDate(value: string | null | undefined, neverLabel: string, locale: string): string {
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

function SortHeader({
  label,
  field,
  sort,
  order,
  onSort,
  className = "",
}: {
  label: string;
  field: GuestsListSort;
  sort: GuestsListSort;
  order: SortOrder;
  onSort: (field: GuestsListSort) => void;
  className?: string;
}) {
  const active = sort === field;
  return (
    <th className={`px-3 py-3 ${className}`} scope="col">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground"
      >
        {label}
        <span className="text-[10px] opacity-70" aria-hidden>
          {active ? (order === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function LoyaltyMembersClient() {
  const { t, locale } = useI18n();
  const [guests, setGuests] = useState<LoyaltyGuest[]>([]);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState<string | null>(null);
  const [earnConfigured, setEarnConfigured] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [tab, setTab] = useState<MemberTab>("all");
  const [sort, setSort] = useState<GuestsListSort>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");

  const [query, setQuery] = useState("");
  const [statusDraft, setStatusDraft] = useState<StatusFilter>("");
  const [lastVisitedFromDraft, setLastVisitedFromDraft] = useState("");
  const [lastVisitedToDraft, setLastVisitedToDraft] = useState("");
  const [minSpendDraft, setMinSpendDraft] = useState("");
  const [maxSpendDraft, setMaxSpendDraft] = useState("");
  const [minVisitsDraft, setMinVisitsDraft] = useState("");
  const [maxVisitsDraft, setMaxVisitsDraft] = useState("");
  const [minBalanceDraft, setMinBalanceDraft] = useState("");
  const [maxBalanceDraft, setMaxBalanceDraft] = useState("");
  const [verifiedDraft, setVerifiedDraft] = useState<VerifiedFilter>("");
  const [hasWalletDraft, setHasWalletDraft] = useState<TriFilter>("");
  const [walletPlatformDraft, setWalletPlatformDraft] =
    useState<WalletPlatformFilter>("");
  const [iikoMatchedDraft, setIikoMatchedDraft] = useState<TriFilter>("");
  const [marketingDraft, setMarketingDraft] = useState<TriFilter>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applied, setApplied] = useState<AppliedFilters>(DEFAULT_FILTERS);

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LoyaltyGuest | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyLedgerEntry[]>([]);
  const [orders, setOrders] = useState<LoyaltyGuestOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pointsInput, setPointsInput] = useState("10");
  const [noteInput, setNoteInput] = useState("");
  const [mutating, setMutating] = useState(false);
  const mutationAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [selectAllCap, setSelectAllCap] = useState(100);
  const [selectingAll, setSelectingAll] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [composeChannel, setComposeChannel] = useState<GuestBlastChannel | null>(null);
  const [blastPreview, setBlastPreview] = useState<GuestBlastPreviewResponse | null>(null);
  const [blastPreviewLoading, setBlastPreviewLoading] = useState(false);
  const [blastPreviewError, setBlastPreviewError] = useState<string | null>(null);
  const [blastSending, setBlastSending] = useState(false);
  const [blastError, setBlastError] = useState<string | null>(null);
  const [blastResult, setBlastResult] = useState<{
    targeted: number;
    succeeded: number;
    failed: number;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const hasActiveFilters = useMemo(() => {
    return Object.entries(applied).some(([key, value]) => {
      if (key === "status" || key === "search") return String(value).trim() !== "";
      return String(value).trim() !== "";
    });
  }, [applied]);

  const listParams = useCallback(
    (overrides?: { page?: number; limit?: number }) =>
      buildGuestsListQuery({
        q: applied.search || undefined,
        status: applied.status || undefined,
        isLegacy: tab === "legacy" ? true : undefined,
        lastVisitedFrom: applied.lastVisitedFrom || undefined,
        lastVisitedTo: applied.lastVisitedTo || undefined,
        minSpend: parseSpendInput(applied.minSpend, currency),
        maxSpend: parseSpendInput(applied.maxSpend, currency),
        minVisits: parseNonNegIntInput(applied.minVisits),
        maxVisits: parseNonNegIntInput(applied.maxVisits),
        minBalance: parseNonNegIntInput(applied.minBalance),
        maxBalance: parseNonNegIntInput(applied.maxBalance),
        verified: applied.verified || undefined,
        hasWallet: parseTriBool(applied.hasWallet),
        walletPlatform: applied.walletPlatform || undefined,
        iikoMatched: parseTriBool(applied.iikoMatched),
        marketingConsent: parseTriBool(applied.marketingConsent),
        page: overrides?.page ?? page,
        limit: overrides?.limit ?? limit,
        sort,
        order,
      }),
    [applied, currency, limit, order, page, sort, tab],
  );

  const loadGuests = useCallback(async () => {
    setListError(null);
    const params = listParams();
    const res = await fetch(`/api/settings/loyalty/guests${params}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, t("loyalty.errLoadMembers")));
    }
    const data = (await res.json()) as GuestsListResponse;
    setGuests(data.guests ?? []);
    setTotal(typeof data.total === "number" ? data.total : 0);
    setCurrency(data.currency?.trim() || null);
    setEarnConfigured(data.earnConfigured !== false);
  }, [listParams, t]);

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
      setOrders([]);
      setDetailError(null);
      setMutationError(null);
      mutationAttempt.current = null;
      setApplied(DEFAULT_FILTERS);
      setQuery("");
      setStatusDraft("");
      setLastVisitedFromDraft("");
      setLastVisitedToDraft("");
      setMinSpendDraft("");
      setMaxSpendDraft("");
      setMinVisitsDraft("");
      setMaxVisitsDraft("");
      setMinBalanceDraft("");
      setMaxBalanceDraft("");
      setVerifiedDraft("");
      setHasWalletDraft("");
      setWalletPlatformDraft("");
      setIikoMatchedDraft("");
      setMarketingDraft("");
      setCheckedIds(new Set());
      setPickerOpen(false);
      setComposeChannel(null);
      setBlastPreview(null);
      setBlastResult(null);
      setBlastError(null);
      setPage(1);
    };
    window.addEventListener("restaurant-context-changed", onContextChanged);
    return () => window.removeEventListener("restaurant-context-changed", onContextChanged);
  }, []);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setCheckedIds(new Set());
    setBlastResult(null);
  }, [tab, applied, page, limit, sort, order]);

  const closeMember = useCallback(() => {
    setSelected(null);
    setTransactions([]);
    setOrders([]);
    setExpandedOrderId(null);
    setDetailError(null);
    setMutationError(null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMember();
    }
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selected, closeMember]);

  function applyFilters(next: AppliedFilters) {
    setApplied(next);
    setPage(1);
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    applyFilters({
      search: query,
      status: statusDraft,
      lastVisitedFrom: lastVisitedFromDraft,
      lastVisitedTo: lastVisitedToDraft,
      minSpend: minSpendDraft,
      maxSpend: maxSpendDraft,
      minVisits: minVisitsDraft,
      maxVisits: maxVisitsDraft,
      minBalance: minBalanceDraft,
      maxBalance: maxBalanceDraft,
      verified: verifiedDraft,
      hasWallet: hasWalletDraft,
      walletPlatform: walletPlatformDraft,
      iikoMatched: iikoMatchedDraft,
      marketingConsent: marketingDraft,
    });
  }

  function resetFilters() {
    setQuery("");
    setStatusDraft("");
    setLastVisitedFromDraft("");
    setLastVisitedToDraft("");
    setMinSpendDraft("");
    setMaxSpendDraft("");
    setMinVisitsDraft("");
    setMaxVisitsDraft("");
    setMinBalanceDraft("");
    setMaxBalanceDraft("");
    setVerifiedDraft("");
    setHasWalletDraft("");
    setWalletPlatformDraft("");
    setIikoMatchedDraft("");
    setMarketingDraft("");
    applyFilters(DEFAULT_FILTERS);
  }

  function switchTab(next: MemberTab) {
    setTab(next);
    setPage(1);
    setSelected(null);
  }

  function onSort(field: GuestsListSort) {
    if (sort === field) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "name" || field === "phoneE164" ? "asc" : "desc");
    }
    setPage(1);
  }

  function toggleChecked(guestId: string, checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(guestId);
      else next.delete(guestId);
      return next;
    });
  }

  function togglePageChecked(checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const g of guests) {
        if (checked) next.add(g.id);
        else next.delete(g.id);
      }
      return next;
    });
  }

  async function selectAllMatching() {
    const cap = Math.min(BLAST_MAX, Math.max(1, Math.floor(selectAllCap) || 1));
    setSelectingAll(true);
    setListError(null);
    try {
      const params = listParams({ page: 1, limit: cap });
      const res = await fetch(`/api/settings/loyalty/guests${params}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.errLoadMembers")));
      }
      const data = (await res.json()) as GuestsListResponse;
      setCheckedIds(new Set((data.guests ?? []).map((g) => g.id)));
    } catch (e) {
      setListError(e instanceof Error ? e.message : t("loyalty.errLoadMembers"));
    } finally {
      setSelectingAll(false);
    }
  }

  async function openGuest(guest: LoyaltyGuest) {
    setSelected(guest);
    setDetailError(null);
    setMutationError(null);
    mutationAttempt.current = null;
    setDetailLoading(true);
    setTransactions([]);
    setOrders([]);
    setExpandedOrderId(null);
    try {
      const res = await fetch(`/api/settings/loyalty/guests/${encodeURIComponent(guest.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.errLoadMember")));
      }
      const data = (await res.json()) as GuestDetailResponse;
      setSelected(data.guest);
      setTransactions(data.recentTransactions ?? []);
      setOrders(data.orders ?? []);
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

  async function loadBlastPreview(guestIds: string[]) {
    setBlastPreviewLoading(true);
    setBlastPreviewError(null);
    try {
      const res = await fetch("/api/settings/loyalty/guests/blasts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestIds }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.blastPreviewFailed")));
      }
      const data = (await res.json()) as GuestBlastPreviewResponse;
      setBlastPreview(data);
    } catch (e) {
      setBlastPreview(null);
      setBlastPreviewError(
        e instanceof Error ? e.message : t("loyalty.blastPreviewFailed"),
      );
    } finally {
      setBlastPreviewLoading(false);
    }
  }

  async function sendGuestBlast(payload: BlastSendPayload) {
    const guestIds = [...checkedIds];
    if (guestIds.length === 0) return;
    if (payload.channel === "webpush") {
      if (!payload.title?.trim() || !payload.message?.trim()) {
        setBlastError(t("loyalty.webpushFieldsRequired"));
        return;
      }
    } else if (!payload.message?.trim()) {
      setBlastError(t("loyalty.whatsappMessageRequired"));
      return;
    }
    setBlastSending(true);
    setBlastError(null);
    setBlastResult(null);
    try {
      const res = await fetch("/api/settings/loyalty/guests/blasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: payload.channel,
          guestIds,
          message: payload.message,
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.url ? { url: payload.url } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("loyalty.blastSendFailed")));
      }
      const data = (await res.json()) as {
        targeted: number;
        succeeded: number;
        failed: number;
      };
      setBlastResult({
        targeted: data.targeted,
        succeeded: data.succeeded,
        failed: data.failed,
      });
    } catch (e) {
      setBlastError(e instanceof Error ? e.message : t("loyalty.blastSendFailed"));
    } finally {
      setBlastSending(false);
    }
  }

  function statusLabel(status: string): string {
    if (status === "active") return t("loyalty.statusActive");
    if (status === "blocked") return t("loyalty.statusBlocked");
    return status;
  }

  function walletLabel(guest: LoyaltyGuest): string {
    if (!guest.walletInstalledAt) return t("loyalty.walletNone");
    if (guest.walletPlatform === "apple") return t("loyalty.membersWalletApple");
    if (guest.walletPlatform === "google") return t("loyalty.membersWalletGoogle");
    return t("loyalty.walletUnknown");
  }

  function verifyBadges(guest: LoyaltyGuest) {
    const badges: string[] = [];
    if (guest.whatsappVerifiedAt) badges.push(t("loyalty.verifyWhatsapp"));
    if (guest.telegramVerifiedAt) badges.push(t("loyalty.verifyTelegram"));
    return badges.length > 0 ? badges.join(" · ") : t("loyalty.verifyNone");
  }

  const pageAllChecked =
    guests.length > 0 && guests.every((g) => checkedIds.has(g.id));
  const pageSomeChecked = guests.some((g) => checkedIds.has(g.id));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-foreground/10">
        <button
          type="button"
          onClick={() => switchTab("all")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "all"
              ? "border-b-2 border-foreground text-foreground"
              : "text-foreground/55 hover:text-foreground"
          }`}
        >
          {t("loyalty.tabAll")}
        </button>
        <button
          type="button"
          onClick={() => switchTab("legacy")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "legacy"
              ? "border-b-2 border-foreground text-foreground"
              : "text-foreground/55 hover:text-foreground"
          }`}
        >
          {t("loyalty.tabLegacy")}
        </button>
      </div>

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
                value={maxSpendDraft}
                onChange={(e) => setMaxSpendDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.minVisits")}
              <input
                type="number"
                min={0}
                value={minVisitsDraft}
                onChange={(e) => setMinVisitsDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.maxVisits")}
              <input
                type="number"
                min={0}
                value={maxVisitsDraft}
                onChange={(e) => setMaxVisitsDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.minBalance")}
              <input
                type="number"
                min={0}
                value={minBalanceDraft}
                onChange={(e) => setMinBalanceDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.maxBalance")}
              <input
                type="number"
                min={0}
                value={maxBalanceDraft}
                onChange={(e) => setMaxBalanceDraft(e.target.value)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.verifiedFilter")}
              <select
                value={verifiedDraft}
                onChange={(e) => setVerifiedDraft(e.target.value as VerifiedFilter)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{t("loyalty.filterAny")}</option>
                <option value="whatsapp">{t("loyalty.verifyWhatsapp")}</option>
                <option value="telegram">{t("loyalty.verifyTelegram")}</option>
                <option value="any">{t("loyalty.verifyAny")}</option>
                <option value="none">{t("loyalty.verifyNone")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.hasWalletFilter")}
              <select
                value={hasWalletDraft}
                onChange={(e) => setHasWalletDraft(e.target.value as TriFilter)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{t("loyalty.filterAny")}</option>
                <option value="true">{t("loyalty.filterYes")}</option>
                <option value="false">{t("loyalty.filterNo")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.walletPlatformFilter")}
              <select
                value={walletPlatformDraft}
                onChange={(e) =>
                  setWalletPlatformDraft(e.target.value as WalletPlatformFilter)
                }
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{t("loyalty.filterAny")}</option>
                <option value="apple">{t("loyalty.membersWalletApple")}</option>
                <option value="google">{t("loyalty.membersWalletGoogle")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.iikoMatchedFilter")}
              <select
                value={iikoMatchedDraft}
                onChange={(e) => setIikoMatchedDraft(e.target.value as TriFilter)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{t("loyalty.filterAny")}</option>
                <option value="true">{t("loyalty.filterYes")}</option>
                <option value="false">{t("loyalty.filterNo")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t("loyalty.marketingFilter")}
              <select
                value={marketingDraft}
                onChange={(e) => setMarketingDraft(e.target.value as TriFilter)}
                className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{t("loyalty.filterAny")}</option>
                <option value="true">{t("loyalty.filterYes")}</option>
                <option value="false">{t("loyalty.filterNo")}</option>
              </select>
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

      {!earnConfigured ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {t("loyalty.earnNotConfiguredBanner")}{" "}
          <a href="/loyalty/operations" className="font-medium underline">
            {t("loyalty.earnConfigureLink")}
          </a>
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

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 text-sm">
        <span className="text-foreground/70">
          {t("loyalty.selectedCount", { count: String(checkedIds.size) })}
        </span>
        <label className="flex items-center gap-1.5 text-foreground/70">
          <span>{t("loyalty.selectAllCap")}</span>
          <input
            type="number"
            min={1}
            max={BLAST_MAX}
            value={selectAllCap}
            onChange={(e) => setSelectAllCap(Number(e.target.value) || 1)}
            className="w-16 rounded-lg border border-foreground/15 bg-background px-2 py-1 text-sm text-foreground"
          />
        </label>
        <button
          type="button"
          disabled={selectingAll || total === 0}
          onClick={() => void selectAllMatching()}
          className="rounded-lg border border-foreground/15 px-3 py-1.5 font-medium hover:bg-foreground/5 disabled:opacity-40"
        >
          {selectingAll ? t("loyalty.selectingAll") : t("loyalty.selectAllMatching")}
        </button>
        <button
          type="button"
          disabled={checkedIds.size === 0}
          onClick={() => {
            setPickerOpen(true);
            setComposeChannel(null);
            setBlastError(null);
            setBlastResult(null);
            void loadBlastPreview([...checkedIds]);
          }}
          className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background disabled:opacity-40"
        >
          {t("loyalty.messageSelected")}
        </button>
        {checkedIds.size > 0 ? (
          <button
            type="button"
            onClick={() => setCheckedIds(new Set())}
            className="rounded-lg border border-foreground/15 px-3 py-1.5 hover:bg-foreground/5"
          >
            {t("loyalty.clearSelection")}
          </button>
        ) : null}
      </div>

      <LoyaltyMemberBlastModals
        selectedCount={checkedIds.size}
        pickerOpen={pickerOpen}
        composeChannel={composeChannel}
        preview={blastPreview}
        previewLoading={blastPreviewLoading}
        previewError={blastPreviewError}
        sending={blastSending}
        sendError={blastError}
        sendResult={blastResult}
        onClosePicker={() => setPickerOpen(false)}
        onPickChannel={(channel) => {
          setComposeChannel(channel);
          setPickerOpen(false);
          setBlastError(null);
          setBlastResult(null);
        }}
        onCloseCompose={() => setComposeChannel(null)}
        onSend={(payload) => void sendGuestBlast(payload)}
      />

      {loading ? (
        <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : guests.length === 0 ? (
        <p className="text-sm text-foreground/60">
          {hasActiveFilters || tab === "legacy"
            ? t("loyalty.noMembersMatch")
            : t("loyalty.noMembers")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-background/40 ring-1 ring-foreground/5">
          <table className="w-full min-w-[96rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-xs font-medium uppercase tracking-wider text-foreground/50">
                <th className="px-3 py-3 pl-4" scope="col">
                  <input
                    type="checkbox"
                    checked={pageAllChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = pageSomeChecked && !pageAllChecked;
                    }}
                    onChange={(e) => togglePageChecked(e.target.checked)}
                    aria-label={t("loyalty.selectPage")}
                  />
                </th>
                <SortHeader
                  label={t("common.name")}
                  field="name"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <SortHeader
                  label={t("loyalty.phone")}
                  field="phoneE164"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <th className="px-3 py-3" scope="col">
                  {t("loyalty.verified")}
                </th>
                <SortHeader
                  label={t("loyalty.walletCol")}
                  field="walletPlatform"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <SortHeader
                  label={t("loyalty.balance")}
                  field="balance"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                  className="text-right tabular-nums"
                />
                <SortHeader
                  label={t("loyalty.visits")}
                  field="visitCount"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                  className="text-right tabular-nums"
                />
                <SortHeader
                  label={t("loyalty.visits90d")}
                  field="visits90d"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                  className="text-right tabular-nums"
                />
                <SortHeader
                  label={t("loyalty.ordersValue")}
                  field="lifetimeSpendMinor"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                  className="text-right tabular-nums"
                />
                <SortHeader
                  label={t("loyalty.spend90d")}
                  field="spend90d"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                  className="text-right tabular-nums"
                />
                <SortHeader
                  label={t("loyalty.lastVisited")}
                  field="lastVisitedAt"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <SortHeader
                  label={t("loyalty.firstOrder")}
                  field="iikoFirstOrderAt"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <th className="px-3 py-3" scope="col">
                  {t("loyalty.email")}
                </th>
                <SortHeader
                  label={t("loyalty.iikoSynced")}
                  field="iikoPulledAt"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
                <th className="px-3 py-3" scope="col">
                  {t("common.status")}
                </th>
                <SortHeader
                  label={t("loyalty.created")}
                  field="createdAt"
                  sort={sort}
                  order={order}
                  onSort={onSort}
                />
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr
                  key={g.id}
                  className="cursor-pointer border-b border-foreground/5 last:border-0 transition-colors hover:bg-foreground/3"
                  onClick={() => void openGuest(g)}
                >
                  <td className="px-3 py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(g.id)}
                      onChange={(e) => toggleChecked(g.id, e.target.checked)}
                      aria-label={t("loyalty.selectMember", { name: g.name })}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {g.name}
                      {g.isLegacy ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                          {t("loyalty.legacyBadge")}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-foreground/70">
                    {g.phoneE164}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground/70">{verifyBadges(g)}</td>
                  <td className="px-3 py-3 text-xs text-foreground/70">{walletLabel(g)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{g.balance}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{g.visitCount ?? 0}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{g.visits90d ?? 0}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground/80">
                    {formatMinorCurrency(g.lifetimeSpendMinor ?? 0, currency, locale)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground/80">
                    {formatMinorCurrency(g.spend90d ?? 0, currency, locale)}
                  </td>
                  <td className="px-3 py-3 text-foreground/70">
                    {formatVisitDate(g.lastVisitedAt, t("loyalty.neverVisited"), locale)}
                  </td>
                  <td className="px-3 py-3 text-foreground/70">
                    {formatVisitDate(g.iikoFirstOrderAt, t("loyalty.neverVisited"), locale)}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground/70">{g.email || "—"}</td>
                  <td className="px-3 py-3 text-foreground/70">
                    {formatVisitDate(g.iikoPulledAt, "—", locale)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(g.status)}`}
                    >
                      {statusLabel(g.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-foreground/70">
                    {formatVisitDate(g.createdAt, "—", locale)}
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

      {selected
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="loyalty-member-modal-title"
              onClick={closeMember}
            >
              <div
                className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2
                  id="loyalty-member-modal-title"
                  className="inline-flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight"
                >
                  {selected.name}
                  {selected.isLegacy ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                      {t("loyalty.legacyBadge")}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-0.5 text-sm text-foreground/60">{selected.phoneE164}</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-foreground/55 hover:bg-foreground/5"
                onClick={closeMember}
              >
                {t("common.close")}
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
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
                  {t("loyalty.verified")}: <strong>{verifyBadges(selected)}</strong>
                </p>
                <p>
                  {t("loyalty.walletCol")}: <strong>{walletLabel(selected)}</strong>
                </p>
                <p>
                  {t("loyalty.email")}: <strong>{selected.email || "—"}</strong>
                </p>
                <p>
                  {t("loyalty.lastVisited")}:{" "}
                  <strong>
                    {formatVisitDate(selected.lastVisitedAt, t("loyalty.neverVisited"), locale)}
                  </strong>
                </p>
                <p>
                  {t("loyalty.firstOrder")}:{" "}
                  <strong>
                    {formatVisitDate(
                      selected.iikoFirstOrderAt,
                      t("loyalty.neverVisited"),
                      locale,
                    )}
                  </strong>
                </p>
                <p>
                  {t("loyalty.registered")}:{" "}
                  <strong>
                    {formatVisitDate(selected.iikoWhenRegisteredAt, "—", locale)}
                  </strong>
                </p>
                <p>
                  {t("loyalty.ordersValue")}:{" "}
                  <strong>
                    {formatMinorCurrency(selected.lifetimeSpendMinor ?? 0, currency, locale)}
                  </strong>
                </p>
                <p>
                  {t("loyalty.visits")}: <strong>{selected.visitCount ?? 0}</strong>
                </p>
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
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
                >
                  {t("loyalty.earn")}
                </button>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => void mutatePoints("redeem")}
                  className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {t("loyalty.redeem")}
                </button>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => void mutatePoints("adjust")}
                  className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {t("loyalty.adjust")}
                </button>
              </div>
              {mutationError ? (
                <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {mutationError}
                </p>
              ) : null}

              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold">{t("loyalty.ordersTitle")}</h3>
                {detailLoading ? (
                  <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
                ) : orders.length === 0 ? (
                  <p className="text-sm text-foreground/60">{t("loyalty.noOrders")}</p>
                ) : (
                  <ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/10">
                    {orders.map((order) => {
                      const open = expandedOrderId === order.id;
                      return (
                        <li key={order.id} className="bg-background/40">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-foreground/5"
                            onClick={() =>
                              setExpandedOrderId((id) =>
                                id === order.id ? null : order.id,
                              )
                            }
                          >
                            <span>
                              {formatVisitDate(order.occurredAt, "—", locale)} ·{" "}
                              {formatMinorCurrency(
                                order.amountMinor,
                                order.currency || currency,
                                locale,
                              )}{" "}
                              · {order.pointsEarned} pts
                            </span>
                            <span className="text-xs text-foreground/50">
                              {open ? "−" : "+"} {order.items.length} {t("loyalty.items")}
                            </span>
                          </button>
                          {open ? (
                            <ul className="space-y-1 border-t border-foreground/8 bg-foreground/[0.02] px-3 py-2 text-xs text-foreground/75">
                              {order.items.length === 0 ? (
                                <li>{t("loyalty.noOrderItems")}</li>
                              ) : (
                                order.items.map((item) => (
                                  <li key={item.id} className="flex justify-between gap-2">
                                    <span>
                                      {item.productName || item.productId} × {item.quantity}
                                      <span className="ml-2 text-foreground/45">
                                        {item.attribution === "attributed"
                                          ? t("loyalty.itemAttributed")
                                          : t("loyalty.itemShared")}
                                      </span>
                                    </span>
                                    <span className="tabular-nums">
                                      {formatMinorCurrency(
                                        item.lineTotalMinor,
                                        order.currency || currency,
                                        locale,
                                      )}
                                    </span>
                                  </li>
                                ))
                              )}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold">{t("loyalty.recentTransactions")}</h3>
                {detailLoading ? (
                  <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-foreground/60">{t("loyalty.noTransactions")}</p>
                ) : (
                  <ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/10">
                    {transactions.map((tx) => (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span>
                          {tx.kind} · {tx.note || "—"}
                        </span>
                        <span className="tabular-nums font-medium">
                          {tx.points > 0 ? `+${tx.points}` : tx.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
