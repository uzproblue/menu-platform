"use client";

import type { WalletPassField } from "@/lib/loyalty-api";
import { useI18n } from "../i18n-provider";

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { PlusIcon, TrashIcon };

export function FieldListEditor({
  title,
  hint,
  fields,
  onChange,
  max = 10,
}: {
  title: string;
  hint: string;
  fields: WalletPassField[];
  onChange: (next: WalletPassField[]) => void;
  max?: number;
}) {
  const { t } = useI18n();
  return (
    <section className="space-y-2 border-t border-foreground/10 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-foreground/50">{hint}</p>
        </div>
        <button
          type="button"
          disabled={fields.length >= max}
          onClick={() => onChange([...fields, { label: "", value: "" }])}
          className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/5 disabled:opacity-30"
          aria-label={t("loyalty.walletAddField")}
        >
          <PlusIcon size={16} />
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/15 px-3 py-4 text-center text-xs text-foreground/40">
          {t("loyalty.walletNoFields")}
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, index) => (
            <li key={index} className="flex items-start gap-2">
              <input
                className="w-[38%] rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                placeholder={t("loyalty.walletFieldLabel")}
                value={field.label ?? ""}
                onChange={(e) => {
                  const next = [...fields];
                  next[index] = { ...field, label: e.target.value };
                  onChange(next);
                }}
              />
              <input
                className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                placeholder={t("loyalty.walletFieldValue")}
                value={field.value}
                onChange={(e) => {
                  const next = [...fields];
                  next[index] = { ...field, value: e.target.value };
                  onChange(next);
                }}
              />
              <button
                type="button"
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
                className="rounded-md p-2 text-foreground/45 hover:bg-foreground/5 hover:text-red-600"
                aria-label={t("loyalty.walletRemoveField")}
              >
                <TrashIcon size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
