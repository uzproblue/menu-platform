import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOCATION_TRANSLATION_OPTIONS,
  validateTranslationLangsInput,
} from "./menu-translation-langs.ts";

describe("menu translation langs", () => {
  it("includes CN in the location allowlist", () => {
    assert.ok(LOCATION_TRANSLATION_OPTIONS.includes("CN"));
    assert.equal(LOCATION_TRANSLATION_OPTIONS.length, 6);
  });

  it("accepts CN in translationLangs validation", () => {
    const result = validateTranslationLangsInput(["EN", "RU", "CN"]);
    assert.deepEqual(result, { ok: true, value: ["EN", "RU", "CN"] });
  });
});
