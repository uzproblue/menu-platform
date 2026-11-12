"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  GlobalMenuResponse,
  MealConstructor,
  MealConstructorMutationBody,
} from "@/lib/auth-api";
import { useI18n } from "../i18n-provider";

type OptionDraft = {
  key: string;
  id?: string;
  menuItemId: string;
  posModifierId: string;
};

type SlotDraft = {
  key: string;
  id?: string;
  label: string;
  minPicks: number;
  maxPicks: number;
  options: OptionDraft[];
};

type HostDraft = {
  key: string;
  id?: string;
  hostMenuItemId: string;
  groupIds: string[];
};

type FlatItem = { id: string; name: string };

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptySlot(): SlotDraft {
  return {
    key: newKey(),
    label: "",
    minPicks: 1,
    maxPicks: 1,
    options: [{ key: newKey(), menuItemId: "", posModifierId: "" }],
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

type Props = {
  constructorId?: string;
};

export function MealConstructorFormClient({ constructorId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);
  const [hosts, setHosts] = useState<HostDraft[]>([]);
  const [menu, setMenu] = useState<GlobalMenuResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(constructorId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatItems = useMemo(() => {
    if (!menu) return [] as FlatItem[];
    const out: FlatItem[] = [];
    for (const cat of menu.categories) {
      for (const item of cat.items) {
        out.push({ id: item.id, name: item.name });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [menu]);

  useEffect(() => {
    void (async () => {
      try {
        const menuRes = await fetch("/api/settings/global-menu", { cache: "no-store" });
        if (menuRes.ok) {
          setMenu((await menuRes.json()) as GlobalMenuResponse);
        }
        if (!constructorId) return;
        const res = await fetch(
          `/api/settings/meal-constructors/${encodeURIComponent(constructorId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(await readErrorMessage(res, t("constructors.errLoad")));
        }
        const data = (await res.json()) as { constructor: MealConstructor };
        const c = data.constructor;
        setName(c.name);
        setActive(c.active);
        const nextSlots: SlotDraft[] = c.slots.map((slot) => ({
          key: slot.id,
          id: slot.id,
          label: slot.label,
          minPicks: slot.minPicks,
          maxPicks: slot.maxPicks,
          options: slot.options.map((opt) => ({
            key: opt.id,
            id: opt.id,
            menuItemId: opt.menuItemId,
            posModifierId: opt.posModifierId,
          })),
        }));
        setSlots(nextSlots.length ? nextSlots : [emptySlot()]);
        setHosts(
          c.hosts.map((host) => {
            const groupIds = nextSlots.map((slot) => {
              const match = host.slotGroups.find((g) => g.slotId === slot.id);
              return match?.posModifierGroupId ?? "";
            });
            return {
              key: host.id,
              id: host.id,
              hostMenuItemId: host.hostMenuItemId,
              groupIds,
            };
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : t("constructors.errLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [constructorId, t]);

  function syncHostGroupLengths(nextSlots: SlotDraft[]) {
    setHosts((prev) =>
      prev.map((host) => {
        const groupIds = nextSlots.map((_, i) => host.groupIds[i] ?? "");
        return { ...host, groupIds };
      }),
    );
  }

  function buildBody(): MealConstructorMutationBody {
    return {
      name: name.trim(),
      active,
      slots: slots.map((slot, i) => ({
        id: slot.id,
        label: slot.label.trim(),
        minPicks: slot.minPicks,
        maxPicks: slot.maxPicks,
        sortOrder: i,
        options: slot.options.map((opt, j) => ({
          id: opt.id,
          menuItemId: opt.menuItemId,
          posModifierId: opt.posModifierId.trim(),
          sortOrder: j,
        })),
      })),
      hosts: hosts.map((host) => ({
        id: host.id,
        hostMenuItemId: host.hostMenuItemId,
        slotGroups: host.groupIds.map((posModifierGroupId, slotIndex) => ({
          slotIndex,
          posModifierGroupId: posModifierGroupId.trim(),
        })),
      })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = buildBody();
      const url = constructorId
        ? `/api/settings/meal-constructors/${encodeURIComponent(constructorId)}`
        : "/api/settings/meal-constructors";
      const res = await fetch(url, {
        method: constructorId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("constructors.errSave")));
      }
      router.push("/global-menu/constructors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("constructors.errSave"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-foreground/60">{t("constructors.loading")}</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("constructors.fieldName")}</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>{t("constructors.fieldActive")}</span>
        </label>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("constructors.slotsTitle")}</h2>
          <button
            type="button"
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm"
            onClick={() => {
              const next = [...slots, emptySlot()];
              setSlots(next);
              syncHostGroupLengths(next);
            }}
          >
            {t("constructors.addSlot")}
          </button>
        </div>

        {slots.map((slot, slotIndex) => (
          <div
            key={slot.key}
            className="space-y-3 rounded-xl border border-foreground/10 p-4"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[12rem] flex-1 space-y-1 text-sm">
                <span className="font-medium">{t("constructors.slotLabel")}</span>
                <input
                  required
                  value={slot.label}
                  onChange={(e) => {
                    const next = [...slots];
                    next[slotIndex] = { ...slot, label: e.target.value };
                    setSlots(next);
                  }}
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("constructors.minPicks")}</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={slot.minPicks}
                  onChange={(e) => {
                    const next = [...slots];
                    next[slotIndex] = {
                      ...slot,
                      minPicks: Number(e.target.value) || 1,
                    };
                    setSlots(next);
                  }}
                  className="w-20 rounded-lg border border-foreground/15 bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("constructors.maxPicks")}</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={slot.maxPicks}
                  onChange={(e) => {
                    const next = [...slots];
                    next[slotIndex] = {
                      ...slot,
                      maxPicks: Number(e.target.value) || 1,
                    };
                    setSlots(next);
                  }}
                  className="w-20 rounded-lg border border-foreground/15 bg-background px-3 py-2"
                />
              </label>
              {slots.length > 1 ? (
                <button
                  type="button"
                  className="rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300"
                  onClick={() => {
                    const next = slots.filter((_, i) => i !== slotIndex);
                    setSlots(next);
                    syncHostGroupLengths(next);
                  }}
                >
                  {t("constructors.removeSlot")}
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{t("constructors.optionsTitle")}</h3>
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => {
                    const next = [...slots];
                    next[slotIndex] = {
                      ...slot,
                      options: [
                        ...slot.options,
                        { key: newKey(), menuItemId: "", posModifierId: "" },
                      ],
                    };
                    setSlots(next);
                  }}
                >
                  {t("constructors.addOption")}
                </button>
              </div>
              {slot.options.map((opt, optIndex) => (
                <div key={opt.key} className="flex flex-wrap gap-2">
                  <select
                    required
                    value={opt.menuItemId}
                    onChange={(e) => {
                      const next = [...slots];
                      const options = [...slot.options];
                      options[optIndex] = { ...opt, menuItemId: e.target.value };
                      next[slotIndex] = { ...slot, options };
                      setSlots(next);
                    }}
                    className="min-w-[14rem] flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{t("constructors.pickItem")}</option>
                    {flatItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    placeholder={t("constructors.posModifierId")}
                    value={opt.posModifierId}
                    onChange={(e) => {
                      const next = [...slots];
                      const options = [...slot.options];
                      options[optIndex] = { ...opt, posModifierId: e.target.value };
                      next[slotIndex] = { ...slot, options };
                      setSlots(next);
                    }}
                    className="min-w-[12rem] flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                  />
                  {slot.options.length > 1 ? (
                    <button
                      type="button"
                      className="rounded-md border border-foreground/15 px-2 text-sm"
                      onClick={() => {
                        const next = [...slots];
                        next[slotIndex] = {
                          ...slot,
                          options: slot.options.filter((_, i) => i !== optIndex),
                        };
                        setSlots(next);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("constructors.hostsTitle")}</h2>
          <button
            type="button"
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm"
            onClick={() =>
              setHosts((prev) => [
                ...prev,
                {
                  key: newKey(),
                  hostMenuItemId: "",
                  groupIds: slots.map(() => ""),
                },
              ])
            }
          >
            {t("constructors.addHost")}
          </button>
        </div>
        <p className="text-sm text-foreground/60">{t("constructors.hostsHint")}</p>

        {hosts.length === 0 ? (
          <p className="text-sm text-foreground/55">{t("constructors.noHosts")}</p>
        ) : (
          hosts.map((host, hostIndex) => (
            <div
              key={host.key}
              className="space-y-3 rounded-xl border border-foreground/10 p-4"
            >
              <div className="flex flex-wrap gap-2">
                <select
                  required
                  value={host.hostMenuItemId}
                  onChange={(e) => {
                    const next = [...hosts];
                    next[hostIndex] = { ...host, hostMenuItemId: e.target.value };
                    setHosts(next);
                  }}
                  className="min-w-[14rem] flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t("constructors.pickHost")}</option>
                  {flatItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300"
                  onClick={() => setHosts(hosts.filter((_, i) => i !== hostIndex))}
                >
                  {t("constructors.removeHost")}
                </button>
              </div>
              {slots.map((slot, slotIndex) => (
                <label key={slot.key} className="block space-y-1 text-sm">
                  <span className="font-medium">
                    {t("constructors.groupIdForSlot", {
                      slot: slot.label || `#${slotIndex + 1}`,
                    })}
                  </span>
                  <input
                    required
                    value={host.groupIds[slotIndex] ?? ""}
                    onChange={(e) => {
                      const next = [...hosts];
                      const groupIds = [...host.groupIds];
                      groupIds[slotIndex] = e.target.value;
                      next[hostIndex] = { ...host, groupIds };
                      setHosts(next);
                    }}
                    className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
                    placeholder={t("constructors.posModifierGroupId")}
                  />
                </label>
              ))}
            </div>
          ))
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? t("constructors.saving") : t("constructors.save")}
        </button>
        <button
          type="button"
          className="rounded-lg border border-foreground/15 px-4 py-2 text-sm"
          onClick={() => router.push("/global-menu/constructors")}
        >
          {t("constructors.cancel")}
        </button>
      </div>
    </form>
  );
}
