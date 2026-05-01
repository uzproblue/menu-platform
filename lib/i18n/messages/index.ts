import { enMessages } from "./en";
import { ruMessages } from "./ru";
import { uzMessages } from "./uz";
import type { Locale, Messages } from "../types";

export const MESSAGES_BY_LOCALE: Record<Locale, Messages> = {
  en: enMessages,
  ru: ruMessages,
  uz: uzMessages,
};
