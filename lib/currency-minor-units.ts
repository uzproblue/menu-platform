const DEFAULT_CURRENCY = "KZT";

export function currencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || DEFAULT_CURRENCY,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyFractionDigits(currency);
}

export function majorToMinor(amountMajor: number, currency: string): number {
  return Math.round(amountMajor * 10 ** currencyFractionDigits(currency));
}

export function formatMinorCurrency(
  amountMinor: number,
  currency: string,
  locale: string,
): string {
  const resolvedCurrency = currency || DEFAULT_CURRENCY;
  const amountMajor = minorToMajor(amountMinor, resolvedCurrency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: resolvedCurrency,
    }).format(amountMajor);
  } catch {
    return `${amountMajor} ${resolvedCurrency}`;
  }
}
