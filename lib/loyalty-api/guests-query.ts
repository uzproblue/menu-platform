import type { GuestsListParams } from "./types";

export function buildGuestsListQuery(params: GuestsListParams = {}): string {
  const searchParams = new URLSearchParams();
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.status) searchParams.set("status", params.status);
  if (params.lastVisitedFrom?.trim()) {
    searchParams.set("lastVisitedFrom", params.lastVisitedFrom.trim());
  }
  if (params.lastVisitedTo?.trim()) {
    searchParams.set("lastVisitedTo", params.lastVisitedTo.trim());
  }
  if (typeof params.minSpend === "number" && Number.isFinite(params.minSpend)) {
    searchParams.set("minSpend", String(Math.floor(params.minSpend)));
  }
  if (typeof params.maxSpend === "number" && Number.isFinite(params.maxSpend)) {
    searchParams.set("maxSpend", String(Math.floor(params.maxSpend)));
  }
  if (typeof params.page === "number" && Number.isFinite(params.page)) {
    searchParams.set("page", String(Math.max(1, Math.floor(params.page))));
  }
  if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
    searchParams.set("limit", String(Math.floor(params.limit)));
  }
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.order) searchParams.set("order", params.order);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}
