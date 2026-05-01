"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, Suspense, type FormEvent } from "react";
import { useI18n } from "../components/i18n-provider";

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
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

function LoginFormFields() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (res?.error) {
      setError(t("login.invalidCredentials"));
      return;
    }
    if (res?.ok) {
      router.push(res.url ?? callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <p
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={passwordId}
            className="text-sm font-medium text-foreground"
          >
            {t("login.password")}
          </label>
          <Link
            href="/forgot-pass"
            className="text-xs font-medium text-foreground/60 underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("login.forgotPassword")}
          </Link>
        </div>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-foreground/15 bg-background/80 py-2.5 pl-3.5 pr-24 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[box-shadow,background-color] placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
            placeholder="********"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-pressed={showPassword}
            aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
          >
            {showPassword ? t("login.hidePassword") : t("login.showPassword")}
          </button>
        </div>
      </div>
      <SubmitButton pending={pending} label={t("login.signIn")} pendingLabel={t("login.signingIn")} />
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-xl bg-foreground/5" />
      }
    >
      <LoginFormFields />
    </Suspense>
  );
}
