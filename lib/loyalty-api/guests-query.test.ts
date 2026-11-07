import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGuestsListQuery } from "./guests-query.ts";

describe("buildGuestsListQuery", () => {
  it("encodes advanced member filters and sort", () => {
    const qs = buildGuestsListQuery({
      q: "ada",
      verified: "whatsapp",
      hasWallet: true,
      walletPlatform: "apple",
      iikoMatched: false,
      marketingConsent: true,
      minVisits: 2,
      maxBalance: 100,
      sort: "visitCount",
      order: "asc",
      page: 2,
      limit: 50,
    });

    const params = new URLSearchParams(qs.replace(/^\?/, ""));
    assert.equal(params.get("q"), "ada");
    assert.equal(params.get("verified"), "whatsapp");
    assert.equal(params.get("hasWallet"), "true");
    assert.equal(params.get("walletPlatform"), "apple");
    assert.equal(params.get("iikoMatched"), "false");
    assert.equal(params.get("marketingConsent"), "true");
    assert.equal(params.get("minVisits"), "2");
    assert.equal(params.get("maxBalance"), "100");
    assert.equal(params.get("sort"), "visitCount");
    assert.equal(params.get("order"), "asc");
    assert.equal(params.get("page"), "2");
    assert.equal(params.get("limit"), "50");
  });
});
