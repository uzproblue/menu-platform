"use client";

import { useId, useState, type FormEvent } from "react";
import type { ProvisionRestaurantResponse } from "@/lib/auth-api";

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const inputClassName =
  "w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[box-shadow,background-color] placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20";

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="font-mono text-xs text-foreground/80 break-all">{value}</dd>
    </div>
  );
}

function SuccessPanel({
  data,
  onRegisterAnother,
}: {
  data: ProvisionRestaurantResponse;
  onRegisterAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(data.admin.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">Restaurant created</h2>
      <div
        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
        role="status"
      >
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Restaurant created successfully
        </p>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-foreground/50">Restaurant</dt>
          <dd className="font-medium text-foreground">
            {data.restaurant.name}{" "}
            <span className="font-mono text-foreground/70">
              ({data.restaurant.slug})
            </span>
          </dd>
        </div>
        <DetailRow label="Restaurant ID" value={data.restaurant.id} />
        <DetailRow
          label="Default location"
          value={`${data.defaultLocation.name} · ${data.defaultLocation.currency}`}
        />
        <DetailRow label="Location ID" value={data.defaultLocation.id} />
        <div>
          <dt className="text-foreground/50">Admin email</dt>
          <dd className="font-medium text-foreground">{data.admin.email}</dd>
        </div>
        <div>
          <dt className="text-foreground/50">Temporary password</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-foreground/15 bg-background/80 px-3 py-2 font-mono text-sm text-foreground">
              {data.admin.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={copyPassword}
              className="shrink-0 rounded-lg border border-foreground/15 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </dd>
        </div>
      </dl>
      <p className="text-xs text-foreground/50">
        {data.welcomeEmailSent
          ? `Login details were also emailed to ${data.admin.email}.`
          : "Save this password now. Welcome email was not sent — check menu-server Resend configuration."}
      </p>
      <button
        type="button"
        onClick={onRegisterAnother}
        className="w-full rounded-xl border border-foreground/15 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
      >
        Register another
      </button>
    </div>
  );
}

export function RestRegisterForm() {
  const apiKeyId = useId();
  const nameId = useId();
  const slugId = useId();
  const emailId = useId();
  const adminNameId = useId();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ProvisionRestaurantResponse | null>(
    null,
  );
  const [formKey, setFormKey] = useState(0);

  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const slugInput = document.getElementById(slugId) as HTMLInputElement | null;
    if (!slugInput || slugInput.value.trim().length > 0) return;
    const normalized = normalizeSlug(e.target.value);
    if (normalized.length) slugInput.value = normalized;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = e.currentTarget;
    const adminApiKey = (
      form.elements.namedItem("adminApiKey") as HTMLInputElement
    ).value.trim();
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const slug = (form.elements.namedItem("slug") as HTMLInputElement).value.trim();
    const adminEmail = (
      form.elements.namedItem("adminEmail") as HTMLInputElement
    ).value
      .trim()
      .toLowerCase();
    const adminNameRaw = (
      form.elements.namedItem("adminName") as HTMLInputElement
    ).value.trim();

    try {
      const res = await fetch("/api/rest-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminApiKey,
          name,
          slug,
          adminEmail,
          adminName: adminNameRaw.length ? adminNameRaw : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as
        | ProvisionRestaurantResponse
        | { message?: string; error?: string };

      if (res.ok) {
        setSuccess(data as ProvisionRestaurantResponse);
        return;
      }

      const err = data as { message?: string; error?: string };
      setError(
        err.message ??
          (err.error === "unauthorized"
            ? "Invalid provision API key"
            : "Could not create restaurant"),
      );
    } catch {
      setError("Could not reach server. Try again.");
    } finally {
      setPending(false);
    }
  }

  function handleRegisterAnother() {
    setSuccess(null);
    setError(null);
    setFormKey((k) => k + 1);
  }

  if (success) {
    return (
      <SuccessPanel data={success} onRegisterAnother={handleRegisterAnother} />
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <p
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={apiKeyId} className="text-sm font-medium text-foreground">
          Provision API key
        </label>
        <input
          id={apiKeyId}
          name="adminApiKey"
          type="password"
          autoComplete="off"
          required
          className={inputClassName}
          placeholder="X-Admin-Api-Key"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={nameId} className="text-sm font-medium text-foreground">
          Restaurant name
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          required
          onBlur={handleNameBlur}
          className={inputClassName}
          placeholder="My Restaurant"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={slugId} className="text-sm font-medium text-foreground">
          Slug
        </label>
        <input
          id={slugId}
          name="slug"
          type="text"
          required
          className={inputClassName}
          placeholder="my-restaurant"
        />
        <p className="text-xs text-foreground/50">
          Lowercase letters, numbers, and hyphens. Normalized on the server.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor={emailId} className="text-sm font-medium text-foreground">
          Admin email
        </label>
        <input
          id={emailId}
          name="adminEmail"
          type="email"
          autoComplete="email"
          required
          className={inputClassName}
          placeholder="admin@example.com"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor={adminNameId}
          className="text-sm font-medium text-foreground"
        >
          Admin name <span className="text-foreground/40">(optional)</span>
        </label>
        <input
          id={adminNameId}
          name="adminName"
          type="text"
          className={inputClassName}
          placeholder="Jane Doe"
        />
      </div>

      <SubmitButton
        pending={pending}
        label="Create restaurant"
        pendingLabel="Creating…"
      />
    </form>
  );
}
