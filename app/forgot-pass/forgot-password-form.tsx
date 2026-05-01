"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../components/i18n-provider";

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="w-full cursor-pointer rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const emailId = useId();
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <p
          className="rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2.5 text-sm text-foreground/80"
          role="status"
        >
          {t("forgot.notWired")}
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
      <div className="space-y-2">
        <label
          htmlFor={emailId}
          className="text-sm font-medium text-foreground"
        >
          {t("common.email")}
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[box-shadow,background-color] placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
          placeholder={t("login.emailPlaceholder")}
        />
      </div>
      <SubmitButton label={t("forgot.sendResetLink")} />
      <p className="text-center text-sm text-foreground/60">
        <Link
          href="/login"
          className="font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("forgot.backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
