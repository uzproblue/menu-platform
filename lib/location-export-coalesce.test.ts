import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLocationExportCoalescer,
  mergeLocationExportModes,
  type LocationExportMode,
  type LocationExportRunArgs,
} from "./location-export-coalesce.ts";

describe("mergeLocationExportModes", () => {
  it("upgrades any full over availability_patch", () => {
    const patch: LocationExportMode = {
      kind: "availability_patch",
      changes: [{ menuItemId: "a", enabled: false }],
    };
    assert.deepEqual(mergeLocationExportModes(patch, { kind: "full" }), {
      kind: "full",
    });
    assert.deepEqual(mergeLocationExportModes({ kind: "full" }, patch), {
      kind: "full",
    });
  });

  it("merges availability patches with later enabled winning per item", () => {
    const a: LocationExportMode = {
      kind: "availability_patch",
      changes: [
        { menuItemId: "x", enabled: false },
        { menuItemId: "y", enabled: true },
      ],
    };
    const b: LocationExportMode = {
      kind: "availability_patch",
      changes: [
        { menuItemId: "x", enabled: true },
        { menuItemId: "z", enabled: false },
      ],
    };
    const merged = mergeLocationExportModes(a, b);
    assert.equal(merged.kind, "availability_patch");
    if (merged.kind !== "availability_patch") return;
    const byId = Object.fromEntries(
      merged.changes.map((c) => [c.menuItemId, c.enabled]),
    );
    assert.deepEqual(byId, { x: true, y: true, z: false });
  });
});

describe("createLocationExportCoalescer", () => {
  it("runs dirty retry with enable intent after overlapping disable", async () => {
    const runs: LocationExportMode[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let call = 0;

    const coalesce = createLocationExportCoalescer(
      async (args: LocationExportRunArgs) => {
        runs.push(args.mode);
        call += 1;
        if (call === 1) {
          await firstGate;
        }
        return { ok: true as const, mode: args.mode };
      },
    );

    const disableMode: LocationExportMode = {
      kind: "availability_patch",
      changes: [{ menuItemId: "item-1", enabled: false }],
    };
    const enableMode: LocationExportMode = {
      kind: "availability_patch",
      changes: [{ menuItemId: "item-1", enabled: true }],
    };

    const first = coalesce({
      accessToken: "t1",
      locationId: "loc-1",
      mode: disableMode,
    });
    // Let the first run start and park on the gate.
    await Promise.resolve();
    await Promise.resolve();

    const second = coalesce({
      accessToken: "t2",
      locationId: "loc-1",
      mode: enableMode,
    });

    releaseFirst();
    const [r1, r2] = await Promise.all([first, second]);

    assert.equal(runs.length, 2);
    assert.deepEqual(runs[0], disableMode);
    assert.deepEqual(runs[1], enableMode);
    assert.deepEqual(r1, r2);
    assert.deepEqual(r1, { ok: true, mode: enableMode });
  });

  it("upgrades overlapping full + patch pending to a full dirty retry", async () => {
    const runs: LocationExportMode[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let call = 0;

    const coalesce = createLocationExportCoalescer(
      async (args: LocationExportRunArgs) => {
        runs.push(args.mode);
        call += 1;
        if (call === 1) await firstGate;
        return args.mode.kind;
      },
    );

    const first = coalesce({
      accessToken: "t",
      locationId: "loc-2",
      mode: {
        kind: "availability_patch",
        changes: [{ menuItemId: "a", enabled: false }],
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    const second = coalesce({
      accessToken: "t",
      locationId: "loc-2",
      mode: { kind: "full" },
    });

    releaseFirst();
    await Promise.all([first, second]);

    assert.equal(runs.length, 2);
    assert.equal(runs[0]?.kind, "availability_patch");
    assert.deepEqual(runs[1], { kind: "full" });
  });
});
