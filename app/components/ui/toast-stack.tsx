"use client";

import { useEffect } from "react";
import { Spinner } from "@/app/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ToastVariant = "loading" | "success" | "error";

export type ToastEntry = {
  id: string;
  variant: ToastVariant;
  message: string;
  /** Auto-dismiss after ms (loading toasts are not auto-dismissed). */
  durationMs?: number;
};

type ToastStackProps = {
  toasts: ToastEntry[];
  onDismiss: (id: string) => void;
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "loading") {
    return <Spinner className="size-5 shrink-0 text-foreground/80" />;
  }
  if (variant === "success") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
        <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-700 dark:text-red-300">
      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.variant === "loading" || !toast.durationMs) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.durationMs, toast.id, toast.variant, onDismiss]);

  return (
    <div
      role={toast.variant === "loading" ? "status" : "alert"}
      aria-live={toast.variant === "loading" ? "polite" : "assertive"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-xl shadow-foreground/10 ring-1 backdrop-blur-md transition-[transform,opacity]",
        toast.variant === "loading" &&
          "border-foreground/15 bg-background/95 ring-foreground/10",
        toast.variant === "success" &&
          "border-emerald-500/35 bg-emerald-500/10 ring-emerald-500/25",
        toast.variant === "error" &&
          "border-red-500/40 bg-red-500/10 ring-red-500/25",
      )}
    >
      <ToastIcon variant={toast.variant} />
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
        {toast.message}
      </p>
      {toast.variant !== "loading" ? (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-lg p-1 text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
          aria-label="Dismiss"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
