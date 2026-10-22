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
