"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../components/i18n-provider";

function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full cursor-pointer rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const newId = useId();
  const confirmId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const newPassword = (form.elements.namedItem("newPassword") as HTMLInputElement)
      .value;
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement)
      .value;
    if (newPassword !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      if (res.status === 204) {
        setDone(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (data.error === "invalid_or_expired_token") {
        setError(t("reset.error"));
      } else {
        setError(data.message ?? t("reset.error"));
      }
    } catch {
      setError(t("forgot.error"));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <p
          className="rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2.5 text-sm text-foreground/80"
          role="status"
        >
          {t("reset.success")}
        </p>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-xl border border-foreground/15 bg-background/80 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {t("forgot.backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <p
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-foreground"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={newId} className="text-sm font-medium text-foreground">
            {t("reset.newPassword")}
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-xs font-medium text-foreground/60 underline-offset-2 hover:text-foreground hover:underline"
          >
            {showPassword ? t("login.hidePassword") : t("login.showPassword")}
          </button>
        </div>
        <input
          id={newId}
          name="newPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[box-shadow,background-color] placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor={confirmId}
          className="text-sm font-medium text-foreground"
        >
          {t("reset.confirmPassword")}
        </label>
        <input
          id={confirmId}
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[box-shadow,background-color] placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
        />
      </div>
      <SubmitButton
        pending={pending}
        label={t("reset.submit")}
        pendingLabel={t("reset.submitting")}
      />
      <p className="text-center text-sm text-foreground/60">
        <button
          type="button"
          onClick={() => router.push("/forgot-pass")}
          className="font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("forgot.sendResetLink")}
        </button>
      </p>
    </form>
  );
}
