export function currencyFractionDigits(currency: string | null | undefined): number {
  if (!currency) return 2;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function minorToMajor(amountMinor: number, currency: string | null | undefined): number {
  return amountMinor / 10 ** currencyFractionDigits(currency);
}

export function majorToMinor(amountMajor: number, currency: string | null | undefined): number {
  return Math.round(amountMajor * 10 ** currencyFractionDigits(currency));
}

/**
 * Convert an earn percentage to spendMinorPerPoint.
 * Product rule: 1 point = 1 major currency unit, so 5% of spend → spendMinorPerPoint
 * = (100 * 10^digits) / percent (e.g. KZT 5% → 2000).
 */
export function earnPercentToSpendMinorPerPoint(
  percent: number,
  currency: string | null | undefined,
): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const scale = 100 * 10 ** currencyFractionDigits(currency);
  return Math.max(1, Math.round(scale / percent));
}

/** Inverse of earnPercentToSpendMinorPerPoint for display. */
export function spendMinorPerPointToEarnPercent(
  spendMinorPerPoint: number,
  currency: string | null | undefined,
): number {
  if (!Number.isFinite(spendMinorPerPoint) || spendMinorPerPoint <= 0) return 0;
  const scale = 100 * 10 ** currencyFractionDigits(currency);
  return scale / spendMinorPerPoint;
}

/** Without a currency the amount is shown as a plain number rather than guessing a symbol. */
export function formatMinorCurrency(
  amountMinor: number,
  currency: string | null | undefined,
  locale: string,
): string {
  const amountMajor = minorToMajor(amountMinor, currency);
  if (!currency) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amountMajor);
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amountMajor);
  } catch {
    return `${amountMajor} ${currency}`;
  }
}
