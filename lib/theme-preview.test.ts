import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildThemePreviewShareUrl,
  isThemePreviewSigningConfigured,
  signThemePreview,
} from "./theme-preview.ts";

const originalSecret = process.env.MENU_THEME_PREVIEW_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.MENU_THEME_PREVIEW_SECRET;
  } else {
    process.env.MENU_THEME_PREVIEW_SECRET = originalSecret;
  }
});

describe("platform theme preview signing", () => {
  it("signs tokens when secret is configured", async () => {
    process.env.MENU_THEME_PREVIEW_SECRET = "unit-test-preview-secret";
    assert.equal(isThemePreviewSigningConfigured(), true);
    const signed = await signThemePreview({
      locationId: "loc-1",
      themeId: "maxcreme",
    });
    assert.ok(signed?.token.includes("."));
    assert.match(
      buildThemePreviewShareUrl({
        menuBaseUrl: "https://menu.example.com",
        locationId: "loc-1",
        token: signed!.token,
      }),
      /themePreview=/,
    );
  });

  it("returns null without a secret", async () => {
    delete process.env.MENU_THEME_PREVIEW_SECRET;
    assert.equal(isThemePreviewSigningConfigured(), false);
    assert.equal(
      await signThemePreview({ locationId: "loc-1", themeId: "maxcreme" }),
      null,
    );
  });
});
