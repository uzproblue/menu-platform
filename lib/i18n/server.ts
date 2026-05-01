import { detectRequestLocale } from "./detect-locale";
import { getMessagesForLocale } from "./get-messages";

type TranslateValues = Record<string, string | number>;

function applyTemplate(input: string, values?: TranslateValues): string {
  if (!values) return input;
  return input.replace(/\{(\w+)\}/g, (_, token) => {
    const next = values[token];
    return next == null ? `{${token}}` : String(next);
  });
}

export async function getServerT() {
  const locale = await detectRequestLocale();
  const messages = getMessagesForLocale(locale);
  const t = (key: string, values?: TranslateValues) => {
    const template = messages[key] ?? key;
    return applyTemplate(template, values);
  };
  return { locale, t };
}
