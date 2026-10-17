export type ComboPricingMode = "fixed" | "percent_off" | "amount_off";

/** Compute combo price from list total and pricing mode. Values are major units (same as catalog prices). */
export function computeComboPrice(
  listTotal: number,
  mode: ComboPricingMode,
  pricingValue: number,
): number {
  if (!Number.isFinite(listTotal) || listTotal < 0) return 0;
  if (!Number.isFinite(pricingValue) || pricingValue < 0) return listTotal;

  if (mode === "fixed") {
    return Math.max(0, pricingValue);
  }
  if (mode === "percent_off") {
    const pct = Math.min(100, Math.max(0, pricingValue));
    return Math.max(0, listTotal * (1 - pct / 100));
  }
  return Math.max(0, listTotal - pricingValue);
}

export function parsePriceNumber(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== "string") return 0;
  const n = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
