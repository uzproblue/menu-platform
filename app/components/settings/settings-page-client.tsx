"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "../i18n-provider";

type SettingsPageClientProps = {
  initialName: string;
  initialEmail: string | null;
};

type RoleType = "ADMIN" | "USER" | "CHEF" | "HOSTESS";

type Teammate = {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  lastLoginAt: string | null;
  telegramPhone?: string | null;
  chefInviteStatus?: string | null;
  telegramLinked?: boolean;
  hostessInviteStatus?: string | null;
  locationName?: string | null;
};

function isPinStaffRole(role: RoleType): boolean {
  return role === "CHEF" || role === "HOSTESS";
}

type LocationOption = {
  id: string;
  name: string;
};

type InviteRestaurantOption = {
  id: string;
  name: string;
};

function formatLastLogin(value: string | null, neverLabel: string): string {
  if (!value) return neverLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return neverLabel;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SettingsPageClient({
  initialName,
  initialEmail,
}: SettingsPageClientProps) {
  const { t } = useI18n();
  const { data: session, update } = useSession();
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState<string | null>(null);
  const [namePending, setNamePending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState<string | null>(null);

  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<RoleType>("USER");
  const [isOwner, setIsOwner] = useState(false);
  const [inviteRestaurantOptions, setInviteRestaurantOptions] = useState<
    InviteRestaurantOption[]
  >([]);
  const [selectedInviteRestaurantIds, setSelectedInviteRestaurantIds] = useState<
    string[]
  >([]);
  const [inviteRestaurantsPending, setInviteRestaurantsPending] = useState(false);
  const [teammatesPending, setTeammatesPending] = useState(true);
  const [teammatesError, setTeammatesError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [teammatePending, setTeammatePending] = useState(false);
  const [teammateEmail, setTeammateEmail] = useState("");
  const [teammateName, setTeammateName] = useState("");
  const [teammateRole, setTeammateRole] = useState<RoleType>("USER");
  const [teammateTelegramPhone, setTeammateTelegramPhone] = useState("");
  const [teammateUsername, setTeammateUsername] = useState("");
  const [teammateLocationId, setTeammateLocationId] = useState("");
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [locationsPending, setLocationsPending] = useState(false);
  const [teammateError, setTeammateError] = useState<string | null>(null);
  const [teammateSaved, setTeammateSaved] = useState<string | null>(null);
  const [revealTarget, setRevealTarget] = useState<Teammate | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealPending, setRevealPending] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Teammate | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!addOpen || !isPinStaffRole(teammateRole)) return;
    let cancelled = false;
    async function loadLocations() {
      setLocationsPending(true);
      try {
        const res = await fetch("/api/settings/locations", { cache: "no-store" });
        const payload = (await res.json().catch(() => null)) as {
          locations?: LocationOption[];
        } | null;
        if (!cancelled && res.ok) {
          setLocationOptions(payload?.locations ?? []);
        }
      } catch {
        if (!cancelled) setLocationOptions([]);
      } finally {
        if (!cancelled) setLocationsPending(false);
      }
    }
    void loadLocations();
    return () => {
      cancelled = true;
    };
  }, [addOpen, teammateRole]);

  useEffect(() => {
    if (!addOpen || !isOwner || isPinStaffRole(teammateRole)) return;
    let cancelled = false;
    async function loadInviteRestaurants() {
      setInviteRestaurantsPending(true);
      try {
        const res = await fetch("/api/settings/restaurant-context", {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as {
          restaurants?: InviteRestaurantOption[];
        } | null;
        if (!cancelled && res.ok) {
          const list = payload?.restaurants ?? [];
          setInviteRestaurantOptions(list);
          setSelectedInviteRestaurantIds((prev) =>
            prev.length > 0 ? prev : list.map((r) => r.id),
          );
        }
      } catch {
        if (!cancelled) {
          setInviteRestaurantOptions([]);
          setSelectedInviteRestaurantIds([]);
        }
      } finally {
        if (!cancelled) setInviteRestaurantsPending(false);
      }
    }
    void loadInviteRestaurants();
    return () => {
      cancelled = true;
    };
  }, [addOpen, isOwner, teammateRole]);

  useEffect(() => {
    let cancelled = false;
    async function loadTeammates() {
      setTeammatesPending(true);
      setTeammatesError(null);
      try {
        const res = await fetch("/api/settings/teammates", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as {
          currentUserRole?: RoleType;
          isOwner?: boolean;
          teammates?: Teammate[];
          message?: string;
        } | null;

        if (!res.ok) {
          if (!cancelled) {
            setTeammatesError(
              payload?.message ?? t("settings.errLoadTeammates"),
            );
          }
          return;
        }

        if (!cancelled) {
          const allTeammates = payload?.teammates ?? [];
          setCurrentUserRole(payload?.currentUserRole ?? "USER");
          setIsOwner(Boolean(payload?.isOwner));
          const selfId = session?.user?.id;
          const selfEmail = session?.user?.email?.toLowerCase();
          const filtered = allTeammates.filter((teammate) => {
            if (selfId && teammate.id === selfId) return false;
            if (selfEmail && teammate.email.toLowerCase() === selfEmail)
              return false;
            return true;
          });
          setTeammates(filtered);
        }
      } catch {
        if (!cancelled) {
          setTeammatesError(t("settings.errLoadTeammatesNetwork"));
        }
      } finally {
        if (!cancelled) setTeammatesPending(false);
      }
    }

    void loadTeammates();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, session?.user?.id]);

  async function handleNameSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameError(null);
    setNameSaved(null);
    const trimmed = name.trim();
    if (!trimmed.length) {
      setNameError(t("settings.errNameRequired"));
      return;
    }

    setNamePending(true);
    try {
      const res = await fetch("/api/settings/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const payload = (await res.json().catch(() => null)) as {
        id?: string;
        email?: string;
        name?: string;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setNameError(payload?.message ?? t("settings.errNameUpdate"));
        return;
      }

      const nextName = payload?.name ?? trimmed;
      setName(nextName);
      await update({ name: nextName });
      setNameSaved(t("settings.nameUpdated"));
    } catch {
      setNameError(t("settings.errNameNetwork"));
    } finally {
      setNamePending(false);
    }
  }

  const [passwordPending, setPasswordPending] = useState(false);

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(null);

    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordError(t("settings.errPasswordRequired"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("settings.errPasswordLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.errPasswordMismatch"));
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError(t("settings.errPasswordSame"));
      return;
    }

    setPasswordPending(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setPasswordError(
          payload?.message ?? t("settings.errPasswordUpdate"),
        );
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(t("settings.passwordUpdated"));
    } catch {
      setPasswordError(t("settings.errPasswordNetwork"));
    } finally {
      setPasswordPending(false);
    }
  }

  async function handleAddTeammateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTeammateError(null);
    setTeammateSaved(null);

    const name = teammateName.trim();
    if (!name.length) {
      setTeammateError(t("settings.errNameRequired"));
      return;
    }

    let body: Record<string, string | string[]>;
    if (teammateRole === "CHEF") {
      const telegramPhone = teammateTelegramPhone.trim();
      const locationId = teammateLocationId.trim();
      if (!telegramPhone.length) {
        setTeammateError(t("settings.errPhoneRequired"));
        return;
      }
      if (!locationId.length) {
        setTeammateError(t("settings.errLocationRequired"));
        return;
      }
      body = { name, role: "CHEF", telegramPhone, locationId };
    } else if (teammateRole === "HOSTESS") {
      const locationId = teammateLocationId.trim();
      const username = teammateUsername.trim().toLowerCase();
      if (!username.length) {
        setTeammateError(t("settings.errUsernameRequired"));
        return;
      }
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        setTeammateError(t("settings.errUsernameInvalid"));
        return;
      }
      if (!locationId.length) {
        setTeammateError(t("settings.errLocationRequired"));
        return;
      }
      body = { name, role: "HOSTESS", locationId, username };
    } else {
      const email = teammateEmail.trim().toLowerCase();
      if (!email.length || !email.includes("@")) {
        setTeammateError(t("settings.errEmailValid"));
        return;
      }
      if (isOwner) {
        if (selectedInviteRestaurantIds.length === 0) {
          setTeammateError(t("settings.errRestaurantsRequired"));
          return;
        }
        body = {
          email,
          name,
          role: teammateRole,
          restaurantIds: selectedInviteRestaurantIds,
        };
      } else {
        body = { email, name, role: teammateRole };
      }
    }

    setTeammatePending(true);
    try {
      const res = await fetch("/api/settings/teammates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as {
        teammate?: Teammate;
        temporaryPassword?: string | null;
        inviteEmailSent?: boolean;
        chefInvite?: { pinCode: string };
        hostessInvite?: { pinCode: string; username?: string };
        message?: string;
      } | null;
      if (!res.ok) {
        setTeammateError(payload?.message ?? t("settings.errAddTeammate"));
        return;
      }

      setTeammateEmail("");
      setTeammateName("");
      setTeammateRole("USER");
      setTeammateTelegramPhone("");
      setTeammateUsername("");
      setTeammateLocationId("");
      setSelectedInviteRestaurantIds(
        inviteRestaurantOptions.map((r) => r.id),
      );
      if (payload?.chefInvite?.pinCode) {
        setTeammateSaved(
          t("settings.chefAddedCode", { code: payload.chefInvite.pinCode }),
        );
      } else if (payload?.hostessInvite?.pinCode) {
        setTeammateSaved(
          t("settings.hostessAddedCode", {
            code: payload.hostessInvite.pinCode,
            username: payload.hostessInvite.username ?? "",
          }),
        );
      } else if (payload?.temporaryPassword) {
        const invitedEmail = payload.teammate?.email?.trim();
        if (payload.inviteEmailSent && invitedEmail) {
          setTeammateSaved(
            t("settings.teammateAddedEmailed", { email: invitedEmail }),
          );
        } else {
          setTeammateSaved(
            t("settings.teammateAddedTempPassword", {
              password: payload.temporaryPassword,
            }),
          );
        }
      } else {
        setTeammateSaved(t("settings.teammateAdded"));
      }
      setAddOpen(false);

      const refresh = await fetch("/api/settings/teammates", {
        method: "GET",
        cache: "no-store",
      });
      const refreshed = (await refresh.json().catch(() => null)) as {
        teammates?: Teammate[];
      } | null;
      if (refresh.ok) {
        const allTeammates = refreshed?.teammates ?? [];
        const selfId = session?.user?.id;
        const selfEmail = session?.user?.email?.toLowerCase();
        const filtered = allTeammates.filter((teammate) => {
          if (selfId && teammate.id === selfId) return false;
          if (selfEmail && teammate.email.toLowerCase() === selfEmail)
            return false;
          return true;
        });
        setTeammates(filtered);
      }
    } catch {
      setTeammateError(t("settings.errAddTeammateNetwork"));
    } finally {
      setTeammatePending(false);
    }
  }

  async function handleRevealTemporaryPassword(teammate: Teammate) {
    setRevealTarget(teammate);
    setRevealPending(true);
    setRevealError(null);
    setRevealedPassword(null);
    setCopied(false);
    try {
      const res = await fetch(
        `/api/settings/teammates/${encodeURIComponent(teammate.id)}/temporary-password`,
        { method: "POST" },
      );
      const payload = (await res.json().catch(() => null)) as {
        temporaryPassword?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setRevealError(
          payload?.message ?? t("settings.errRevealTemp"),
        );
        return;
      }
      setRevealedPassword(payload?.temporaryPassword ?? null);
    } catch {
      setRevealError(t("settings.errRevealTempNetwork"));
    } finally {
      setRevealPending(false);
    }
  }

  async function handleCopyPassword() {
    if (!revealedPassword) return;
    try {
      await navigator.clipboard.writeText(revealedPassword);
      setCopied(true);
    } catch {
      setRevealError(t("settings.errCopy"));
    }
  }

  async function handleDeleteTeammate() {
    if (!deleteTarget) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/settings/teammates/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!res.ok) {
        setDeleteError(payload?.message ?? t("settings.errDeleteTeammate"));
        return;
      }

      setTeammates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError(t("settings.errDeleteTeammateNetwork"));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("settings.title")}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          {t("settings.subtitle")}
        </p>
      </div>

      <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t("settings.profile")}
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          {t("settings.profileHelp")}
        </p>
        <form onSubmit={handleNameSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="name"
            >
              {t("common.name")}
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
                if (nameSaved) setNameSaved(null);
              }}
              required
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
              placeholder={t("settings.namePlaceholder")}
            />
          </div>
          {initialEmail ? (
            <p className="text-xs text-foreground/50">
              {t("settings.signedInAs")} {initialEmail}
            </p>
          ) : null}
          {nameError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {nameError}
            </p>
          ) : null}
          {nameSaved ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {nameSaved}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={namePending}
            className="min-h-11 cursor-pointer rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {namePending ? t("settings.saving") : t("settings.saveName")}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t("settings.password")}
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          {t("settings.passwordHelp")}
        </p>
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="current-password"
            >
              {t("settings.currentPassword")}
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordError(null);
                setPasswordSaved(null);
              }}
              required
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="new-password"
              >
                {t("settings.newPassword")}
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(null);
                  setPasswordSaved(null);
                }}
                required
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="confirm-password"
              >
                {t("settings.confirmPassword")}
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError(null);
                  setPasswordSaved(null);
                }}
                required
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          </div>
          {passwordError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {passwordError}
            </p>
          ) : null}
          {passwordSaved ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {passwordSaved}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={passwordPending}
            className="min-h-11 cursor-pointer rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passwordPending ? t("settings.updating") : t("settings.updatePassword")}
          </button>
        </form>
      </section>

      {currentUserRole === "ADMIN" || isOwner ? (
        <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {t("settings.teammates")}
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              {t("settings.teammatesHelp")}
            </p>
          </div>
          {currentUserRole === "ADMIN" || isOwner ? (
            <button
              type="button"
              onClick={() => {
                setTeammateError(null);
                setTeammateSaved(null);
                setAddOpen(true);
              }}
              className="inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <svg
                className="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("settings.addTeammate")}
            </button>
          ) : null}
        </div>
        {teammateSaved ? (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {teammateSaved}
          </p>
        ) : null}
        <div className="dark-thin-scrollbar mt-4 overflow-x-auto rounded-2xl border border-foreground/10 bg-background/40 ring-1 ring-foreground/5">
          {teammatesPending ? (
            <div className="flex items-center justify-center px-6 py-12 text-sm text-foreground/60">
              {t("settings.loadingTeammates")}
            </div>
          ) : teammatesError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("settings.couldNotLoadTeammates")}
              </p>
              <p className="max-w-md text-sm text-foreground/60">
                {teammatesError}
              </p>
            </div>
          ) : teammates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("settings.noTeammates")}
              </p>
              <p className="max-w-md text-sm text-foreground/60">
                {t("settings.noTeammatesHelp")}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-160 border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-xs font-medium uppercase tracking-wider text-foreground/50">
                  <th className="px-4 py-3" scope="col">
                    {t("common.name")}
                  </th>
                  <th className="px-4 py-3" scope="col">
                    {t("common.email")}
                  </th>
                  <th className="px-4 py-3" scope="col">
                    {t("common.role")}
                  </th>
                  <th className="px-4 py-3" scope="col">
                    {t("settings.lastLogin")}
                  </th>
                  <th className="px-4 py-3 text-right" scope="col">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {teammates.map((teammate) => (
                  <tr
                    key={teammate.id}
                    className="border-b border-foreground/5 last:border-0 hover:bg-foreground/3"
                  >
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      {teammate.name}
                    </td>
                    <td className="px-4 py-3.5 text-foreground/70">
                      {teammate.role === "CHEF" ? (
                        <span className="block">
                          <span>
                            {teammate.telegramPhone ??
                              t("settings.chefPhonePending")}
                          </span>
                          {teammate.telegramLinked ? (
                            <span className="mt-0.5 block text-xs text-emerald-600 dark:text-emerald-400">
                              {t("settings.chefTelegramLinked")}
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">
                              {t("settings.chefTelegramNotLinked")}
                            </span>
                          )}
                          {teammate.locationName ? (
                            <span className="mt-0.5 block text-xs text-foreground/50">
                              {teammate.locationName}
                            </span>
                          ) : null}
                        </span>
                      ) : teammate.role === "HOSTESS" ? (
                        <span className="block">
                          <span>{t("settings.hostessPinLogin")}</span>
                          {teammate.locationName ? (
                            <span className="mt-0.5 block text-xs text-foreground/50">
                              {teammate.locationName}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        teammate.email
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-foreground/80">
                      {teammate.role === "ADMIN"
                        ? t("settings.admin")
                        : teammate.role === "CHEF"
                          ? t("settings.chef")
                          : teammate.role === "HOSTESS"
                            ? t("settings.hostess")
                            : t("settings.user")}
                    </td>
                    <td className="px-4 py-3.5 text-foreground/70">
                      {formatLastLogin(teammate.lastLoginAt, t("settings.neverLoggedIn"))}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        {teammate.lastLoginAt || isPinStaffRole(teammate.role) ? null : (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRevealTemporaryPassword(teammate)
                            }
                            className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-foreground/15 bg-background/80 p-2 text-foreground/80 transition-colors hover:bg-foreground/5"
                            title={t("settings.revealTempPassword")}
                            aria-label={t("settings.revealTempPassword")}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
                              <circle
                                cx="16.5"
                                cy="7.5"
                                r=".5"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={teammate.role === "ADMIN"}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(teammate);
                          }}
                          className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-foreground/15 bg-background/80 p-2 text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                          title={
                            teammate.role === "ADMIN"
                              ? t("settings.adminCannotDelete")
                              : t("settings.deleteTeammate")
                          }
                          aria-label={
                            teammate.role === "ADMIN"
                              ? t("settings.adminCannotDelete")
                              : t("settings.deleteTeammate")
                          }
                        >
                          <svg
                            className="size-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </section>
      ) : null}

      {(currentUserRole === "ADMIN" || isOwner) && addOpen ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/45 backdrop-blur-[2px]"
            aria-label="Close dialog"
            onClick={() => setAddOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-teammate-title"
            className="relative z-10 flex max-h-[min(92vh,560px)] w-full max-w-md flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
          >
            <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
              <h2
                id="add-teammate-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                {t("settings.addTeammateTitle")}
              </h2>
              <p className="mt-1 text-xs text-foreground/55">
                {t("settings.addTeammateHelp")}
              </p>
            </div>
            <form
              onSubmit={handleAddTeammateSubmit}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5"
            >
              {!isPinStaffRole(teammateRole) ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="teammate-email"
                  >
                    {t("common.email")}
                  </label>
                  <input
                    id="teammate-email"
                    type="email"
                    value={teammateEmail}
                    onChange={(e) => {
                      setTeammateEmail(e.target.value);
                      if (teammateError) setTeammateError(null);
                      if (teammateSaved) setTeammateSaved(null);
                    }}
                    required
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                    placeholder={t("login.emailPlaceholder")}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="teammate-name"
                >
                  {t("common.name")}
                </label>
                <input
                  id="teammate-name"
                  value={teammateName}
                  onChange={(e) => {
                    setTeammateName(e.target.value);
                    if (teammateError) setTeammateError(null);
                    if (teammateSaved) setTeammateSaved(null);
                  }}
                  required
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                  placeholder={t("settings.fullNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="teammate-role"
                >
                  {t("common.role")}
                </label>
                <select
                  id="teammate-role"
                  value={teammateRole}
                  onChange={(e) => setTeammateRole(e.target.value as RoleType)}
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                >
                  <option value="USER">{t("settings.user")}</option>
                  <option value="ADMIN">{t("settings.admin")}</option>
                  <option value="CHEF">{t("settings.chef")}</option>
                  <option value="HOSTESS">{t("settings.hostess")}</option>
                </select>
              </div>
              {isOwner && !isPinStaffRole(teammateRole) ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {t("settings.inviteRestaurants")}
                  </p>
                  {inviteRestaurantsPending ? (
                    <p className="text-xs text-foreground/55">
                      {t("settings.loadingLocations")}
                    </p>
                  ) : (
                    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-foreground/15 bg-background/50 p-2">
                      {inviteRestaurantOptions.map((r) => {
                        const checked = selectedInviteRestaurantIds.includes(r.id);
                        return (
                          <li key={r.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-foreground/5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedInviteRestaurantIds((prev) =>
                                    checked
                                      ? prev.filter((id) => id !== r.id)
                                      : [...prev, r.id],
                                  );
                                  if (teammateError) setTeammateError(null);
                                }}
                                className="size-4 rounded border-foreground/30"
                              />
                              <span className="min-w-0 truncate">{r.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
              {teammateRole === "CHEF" ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="teammate-telegram-phone"
                  >
                    {t("settings.telegramPhone")}
                  </label>
                  <input
                    id="teammate-telegram-phone"
                    type="tel"
                    value={teammateTelegramPhone}
                    onChange={(e) => {
                      setTeammateTelegramPhone(e.target.value);
                      if (teammateError) setTeammateError(null);
                      if (teammateSaved) setTeammateSaved(null);
                    }}
                    required
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                    placeholder={t("settings.telegramPhonePlaceholder")}
                  />
                </div>
              ) : null}
              {teammateRole === "HOSTESS" ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="teammate-username"
                  >
                    {t("settings.hostessUsername")}
                  </label>
                  <input
                    id="teammate-username"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={teammateUsername}
                    onChange={(e) => {
                      setTeammateUsername(
                        e.target.value.toLowerCase().replace(/\s+/g, ""),
                      );
                      if (teammateError) setTeammateError(null);
                      if (teammateSaved) setTeammateSaved(null);
                    }}
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-z0-9._\-]{3,32}"
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                    placeholder={t("settings.hostessUsernamePlaceholder")}
                  />
                </div>
              ) : null}
              {isPinStaffRole(teammateRole) ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="teammate-location"
                  >
                    {t("settings.branchLocation")}
                  </label>
                  <select
                    id="teammate-location"
                    value={teammateLocationId}
                    onChange={(e) => {
                      setTeammateLocationId(e.target.value);
                      if (teammateError) setTeammateError(null);
                      if (teammateSaved) setTeammateSaved(null);
                    }}
                    required
                    disabled={locationsPending}
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
                  >
                    <option value="">
                      {locationsPending
                        ? t("settings.loadingLocations")
                        : t("settings.selectLocation")}
                    </option>
                    {locationOptions.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {teammateError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {teammateError}
                </p>
              ) : null}
              <div className="mt-2 flex gap-2 border-t border-foreground/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setTeammateError(null);
                  }}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={teammatePending}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {teammatePending ? t("settings.adding") : t("settings.addTeammate")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {(currentUserRole === "ADMIN" || isOwner) && deleteTarget ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/45 backdrop-blur-[2px]"
            aria-label="Close dialog"
            onClick={() => {
              if (deletePending) return;
              setDeleteTarget(null);
              setDeleteError(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-teammate-title"
            className="relative z-10 flex w-full max-w-md flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
          >
            <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
              <h2
                id="delete-teammate-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                {t("settings.deleteTeammateQuestion")}
              </h2>
              <p className="mt-1 text-sm text-foreground/60">
                {t("settings.deleteTeammateHelpPrefix")}{" "}
                <span className="font-medium">{deleteTarget.name}</span> ({deleteTarget.email}){" "}
                {t("settings.deleteTeammateHelpSuffix")}
              </p>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {deleteError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {deleteError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deletePending}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={deletePending}
                  onClick={() => void handleDeleteTeammate()}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700"
                >
                  {deletePending ? t("settings.deleting") : t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {(currentUserRole === "ADMIN" || isOwner) && revealTarget ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/45 backdrop-blur-[2px]"
            aria-label="Close dialog"
            onClick={() => {
              setRevealTarget(null);
              setRevealError(null);
              setRevealedPassword(null);
              setCopied(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reveal-password-title"
            className="relative z-10 flex w-full max-w-md flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
          >
            <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
              <h2
                id="reveal-password-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                {t("settings.tempPassword")}
              </h2>
              <p className="mt-1 text-xs text-foreground/55">
                {revealTarget.name} ({revealTarget.email})
              </p>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {revealPending ? (
                <p className="text-sm text-foreground/60">
                  {t("settings.generatingPassword")}
                </p>
              ) : revealError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {revealError}
                </p>
              ) : revealedPassword ? (
                <div className=" flex items-center justify-between gap-3">
                  <div className="rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 font-mono text-sm text-foreground w-full">
                    {revealedPassword}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyPassword()}
                    className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border border-foreground/15 bg-background/80 p-2.5 text-foreground transition-colors hover:bg-foreground/5"
                    aria-label={copied ? t("settings.copied") : t("settings.copyPassword")}
                    title={copied ? t("settings.copied") : t("settings.copyPassword")}
                  >
                    {copied ? (
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-foreground/60">
                  {t("settings.noTempPassword")}
                </p>
              )}
            </div>
            <div className="border-t border-foreground/10 px-4 py-4 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  setRevealTarget(null);
                  setRevealError(null);
                  setRevealedPassword(null);
                  setCopied(false);
                }}
                className="min-h-11 w-full cursor-pointer rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
