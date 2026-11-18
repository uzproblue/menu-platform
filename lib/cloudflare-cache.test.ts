import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCloudflareAuthFailure,
  zoneIdOwningHostname,
} from "./cloudflare-cache.ts";

describe("zoneIdOwningHostname", () => {
  const zones = [
    { id: "apex", name: "loyaltering.online" },
    { id: "other", name: "example.com" },
  ];

  it("matches the apex zone for a CDN hostname", () => {
    assert.equal(zoneIdOwningHostname("cdn.loyaltering.online", zones), "apex");
  });

  it("prefers the longest matching zone name", () => {
    assert.equal(
      zoneIdOwningHostname("cdn.loyaltering.online", [
        ...zones,
        { id: "cdn", name: "cdn.loyaltering.online" },
      ]),
      "cdn",
    );
  });

  it("returns undefined when no zone owns the hostname", () => {
    assert.equal(zoneIdOwningHostname("other.example.net", zones), undefined);
  });
});

describe("isCloudflareAuthFailure", () => {
  it("treats Authentication error and 401/403 as auth failures", () => {
    assert.equal(isCloudflareAuthFailure(200, "Authentication error"), true);
    assert.equal(isCloudflareAuthFailure(401, null), true);
    assert.equal(isCloudflareAuthFailure(403, "forbidden"), true);
  });

  it("ignores ordinary purge failures", () => {
    assert.equal(isCloudflareAuthFailure(400, "Invalid request"), false);
    assert.equal(isCloudflareAuthFailure(500, "Internal error"), false);
  });
});
