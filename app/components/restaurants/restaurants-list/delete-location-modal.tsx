"use client";

import { useEffect } from "react";
import { useI18n } from "@/app/components/i18n-provider";

export type DeleteLocationTarget = { id: string; name: string };

type DeleteLocationModalProps = {
  target: DeleteLocationTarget | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteLocationModal({
  target,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteLocationModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, onClose]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 z-0 cursor-pointer bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={() => {
          if (pending) return;
          onClose();
        }}
      />
      <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-location-title"
          className="flex w-full max-w-md flex-col rounded-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md"
        >
        <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
          <h2
            id="delete-location-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            {t("restaurants.deleteLocationQuestion")}
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            {t("restaurants.deleteLocationHelp", { name: target.name })}
          </p>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="min-h-11 flex-1 cursor-pointer rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void onConfirm()}
              className="min-h-11 flex-1 cursor-pointer rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700"
            >
              {pending ? t("restaurants.deletingLocation") : t("common.delete")}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
