import type { GuestsListParams } from "./types";

export function buildGuestsListQuery(params: GuestsListParams = {}): string {
  const searchParams = new URLSearchParams();
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.status) searchParams.set("status", params.status);
  if (typeof params.isLegacy === "boolean") {
    searchParams.set("isLegacy", params.isLegacy ? "true" : "false");
  }
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
  if (typeof params.minVisits === "number" && Number.isFinite(params.minVisits)) {
    searchParams.set("minVisits", String(Math.floor(params.minVisits)));
  }
  if (typeof params.maxVisits === "number" && Number.isFinite(params.maxVisits)) {
    searchParams.set("maxVisits", String(Math.floor(params.maxVisits)));
  }
  if (typeof params.minBalance === "number" && Number.isFinite(params.minBalance)) {
    searchParams.set("minBalance", String(Math.floor(params.minBalance)));
  }
  if (typeof params.maxBalance === "number" && Number.isFinite(params.maxBalance)) {
    searchParams.set("maxBalance", String(Math.floor(params.maxBalance)));
  }
  if (params.verified) searchParams.set("verified", params.verified);
  if (typeof params.hasWallet === "boolean") {
    searchParams.set("hasWallet", params.hasWallet ? "true" : "false");
  }
  if (params.walletPlatform) {
    searchParams.set("walletPlatform", params.walletPlatform);
  }
  if (typeof params.iikoMatched === "boolean") {
    searchParams.set("iikoMatched", params.iikoMatched ? "true" : "false");
  }
  if (typeof params.marketingConsent === "boolean") {
    searchParams.set(
      "marketingConsent",
      params.marketingConsent ? "true" : "false",
    );
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
