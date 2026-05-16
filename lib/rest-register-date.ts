const REST_REGISTER_DATE_RE = /^\d{2}-\d{2}-\d{4}$/;

/** Format a date as DD-MM-YYYY (UTC). */
export function formatRestRegisterDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/** Today's rest-register path segment (UTC). */
export function getTodayRestRegisterDate(): string {
  return formatRestRegisterDate(new Date());
}

/** True when param matches DD-MM-YYYY and equals today (UTC). */
export function isValidRestRegisterDateParam(param: string): boolean {
  if (!REST_REGISTER_DATE_RE.test(param)) return false;
  return param === getTodayRestRegisterDate();
}
