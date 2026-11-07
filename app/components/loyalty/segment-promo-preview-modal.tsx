"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LoyaltyGuest, LoyaltySegmentAction } from "@/lib/loyalty-api/types";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function formatBirthday(iso: string | null | undefined, locale: string): string | null {
  if (!iso?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(date);
}

type Props = {
  open: boolean;
  action: LoyaltySegmentAction | null;
  onClose: () => void;
  onContinue: (draft: {
    name: string;
    message: string;
    href: string;
  }) => void;
};

const PAGE_SIZE = 20;

export function SegmentPromoPreviewModal({
  open,
  action,
  onClose,
  onContinue,
}: Props) {
  const { t, locale } = useI18n();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [guests, setGuests] = useState<LoyaltyGuest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmentKey =
    (typeof action?.ctaPayload?.segmentKey === "string"
      ? action.ctaPayload.segmentKey
      : action?.segmentKey) ?? "";
  const showBirthdays = segmentKey === "birthday_this_week";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!open || !action) return;
    const payload = action.ctaPayload ?? {};
    setName(
      typeof payload.suggestedName === "string" && payload.suggestedName.trim()
        ? payload.suggestedName
        : action.title,
    );
    setMessage(action.body ?? "");
    setPage(1);
    setError(null);
  }, [open, action]);

  const loadMembers = useCallback(
    async (pageNum: number) => {
      if (!segmentKey) {
        setGuests([]);
        setTotal(0);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/settings/loyalty/segments/${encodeURIComponent(segmentKey)}/members?page=${pageNum}&limit=${PAGE_SIZE}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(
            await readErrorMessage(res, t("loyalty.errLoadSegmentMembers")),
          );
        }
        const data = (await res.json()) as {
          guests?: LoyaltyGuest[];
          total?: number;
          page?: number;
        };
        setGuests(data.guests ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? pageNum);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("loyalty.errLoadSegmentMembers"),
        );
      } finally {
        setLoading(false);
      }
    },
    [segmentKey, t],
  );

  useEffect(() => {
    if (!open || !segmentKey) return;
    void loadMembers(page);
  }, [open, segmentKey, page, loadMembers]);

  if (!open || !action) return null;

  const payload = action.ctaPayload ?? {};
  const type =
    typeof payload.suggestedType === "string" ? payload.suggestedType : "";
  const continueHref = (() => {
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (message.trim()) params.set("description", message.trim());
    if (type) params.set("type", type);
    if (segmentKey) params.set("segment", segmentKey);
    const qs = params.toString();
    return `/loyalty/promotions/points/new${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="segment-promo-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="segment-promo-modal-title"
              className="text-base font-semibold tracking-tight"
            >
              {t("loyalty.segmentPromoModalTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-foreground/50">
              {t("loyalty.segmentPromoModalHint", {
                count: String(total),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-foreground/55 hover:bg-foreground/5"
          >
            {t("loyalty.segmentsClose")}
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground/70">
              {t("loyalty.segmentPromoName")}
            </span>
            <input
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground/70">
              {t("loyalty.segmentPromoMessage")}
            </span>
            <textarea
              className="min-h-[88px] w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground/70">
                {t("loyalty.segmentPromoRecipients")}
              </p>
              <p className="text-[11px] tabular-nums text-foreground/45">
                {t("loyalty.membersCount", { total: String(total) })}
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            ) : null}

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-lg bg-foreground/[0.04]"
                  />
                ))}
              </div>
            ) : guests.length === 0 ? (
              <p className="py-6 text-center text-sm text-foreground/50">
                {t("loyalty.segmentsEmptyMembers")}
              </p>
            ) : (
              <ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/10">
                {guests.map((g) => {
                  const birthday = showBirthdays
                    ? formatBirthday(g.dateOfBirth, locale)
                    : null;
                  return (
                    <li
                      key={g.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{g.name}</p>
                        <p className="truncate text-xs text-foreground/50">
                          {g.phoneE164}
                        </p>
                      </div>
                      {birthday ? (
                        <p className="shrink-0 text-xs font-medium tabular-nums text-violet-700 dark:text-violet-300">
                          {birthday}
                        </p>
                      ) : (
                        <p className="shrink-0 text-xs tabular-nums text-foreground/45">
                          {g.balance}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {total > PAGE_SIZE ? (
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-foreground/12 px-2.5 py-1.5 text-xs disabled:opacity-40"
                >
                  {t("loyalty.segmentPromoPrev")}
                </button>
                <span className="text-[11px] tabular-nums text-foreground/50">
                  {t("loyalty.segmentPromoPage", {
                    page: String(page),
                    pages: String(pageCount),
                  })}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-foreground/12 px-2.5 py-1.5 text-xs disabled:opacity-40"
                >
                  {t("loyalty.segmentPromoNext")}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-foreground/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-foreground/60 hover:bg-foreground/5"
          >
            {t("loyalty.segmentsClose")}
          </button>
          <Link
            href={continueHref}
            onClick={() =>
              onContinue({
                name: name.trim(),
                message: message.trim(),
                href: continueHref,
              })
            }
            className="rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background"
          >
            {t("loyalty.segmentPromoContinue")}
          </Link>
        </div>
      </div>
    </div>
  );
}
