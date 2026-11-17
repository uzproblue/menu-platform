/**
 * Single-flight + dirty-retry for per-location public exports.
 * Concurrent callers mark pending work instead of dropping their mode;
 * after the in-flight export finishes, pending intent runs once more.
 */

export type LocationExportMode =
  | { kind: "full" }
  | {
      kind: "availability_patch";
      changes: Array<{ menuItemId: string; enabled: boolean }>;
    };

export type LocationExportRunArgs = {
  accessToken: string;
  locationId: string;
  mode: LocationExportMode;
  explicitRestaurantId?: string;
};

export function mergeLocationExportModes(
  a: LocationExportMode,
  b: LocationExportMode,
): LocationExportMode {
  if (a.kind === "full" || b.kind === "full") {
    return { kind: "full" };
  }
  const latest = new Map<string, boolean>();
  for (const c of a.changes) {
    latest.set(c.menuItemId, c.enabled);
  }
  for (const c of b.changes) {
    latest.set(c.menuItemId, c.enabled);
  }
  return {
    kind: "availability_patch",
    changes: Array.from(latest, ([menuItemId, enabled]) => ({
      menuItemId,
      enabled,
    })),
  };
}

type PendingExport = {
  accessToken: string;
  mode: LocationExportMode;
  explicitRestaurantId?: string;
};

type InFlightEntry<T> = {
  pending: PendingExport | null;
  promise: Promise<T>;
};

export type LocationExportCoalescer<T> = (
  args: LocationExportRunArgs,
) => Promise<T>;

/**
 * Creates a per-locationId coalescer. `run` performs one export+purge.
 * While a run is in flight, further calls merge into `pending` and share the
 * same promise, which only resolves after pending work has been drained.
 *
 * If pending arrives in the tiny window after the drain loop exits but before
 * the map entry is cleared, a follow-up coalesce is started so work is not lost
 * (that follow-up is not part of the first promise; callers should schedule
 * `waitUntil` on each schedule call's returned work as today).
 */
export function createLocationExportCoalescer<T>(
  run: (args: LocationExportRunArgs) => Promise<T>,
): LocationExportCoalescer<T> {
  const inFlight = new Map<string, InFlightEntry<T>>();

  const coalesce: LocationExportCoalescer<T> = (
    args: LocationExportRunArgs,
  ): Promise<T> => {
    const key = args.locationId.trim();
    const existing = inFlight.get(key);
    if (existing) {
      if (existing.pending) {
        existing.pending = {
          accessToken: args.accessToken,
          mode: mergeLocationExportModes(existing.pending.mode, args.mode),
          explicitRestaurantId:
            args.explicitRestaurantId ?? existing.pending.explicitRestaurantId,
        };
      } else {
        existing.pending = {
          accessToken: args.accessToken,
          mode: args.mode,
          explicitRestaurantId: args.explicitRestaurantId,
        };
      }
      return existing.promise;
    }

    const entry: InFlightEntry<T> = {
      pending: null,
      promise: null as unknown as Promise<T>,
    };

    entry.promise = (async () => {
      let token = args.accessToken;
      let mode = args.mode;
      let restaurantId = args.explicitRestaurantId;
      let result!: T;
      for (;;) {
        result = await run({
          accessToken: token,
          locationId: key,
          mode,
          explicitRestaurantId: restaurantId,
        });
        const pending = entry.pending;
        if (!pending) {
          break;
        }
        entry.pending = null;
        token = pending.accessToken;
        mode = pending.mode;
        restaurantId = pending.explicitRestaurantId;
      }
      return result;
    })().finally(() => {
      const leftover = entry.pending;
      inFlight.delete(key);
      if (leftover) {
        void coalesce({
          accessToken: leftover.accessToken,
          locationId: key,
          mode: leftover.mode,
          explicitRestaurantId: leftover.explicitRestaurantId,
        });
      }
    });

    inFlight.set(key, entry);
    return entry.promise;
  };

  return coalesce;
}
