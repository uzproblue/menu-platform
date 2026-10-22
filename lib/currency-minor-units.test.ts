import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currencyFractionDigits,
  formatMinorCurrency,
  majorToMinor,
  minorToMajor,
} from "./currency-minor-units.ts";

describe("currency minor-unit conversion", () => {
  it("converts two-decimal currencies in both directions", () => {
    assert.equal(currencyFractionDigits("KZT"), 2);
    assert.equal(majorToMinor(123.45, "KZT"), 12_345);
    assert.equal(minorToMajor(12_345, "KZT"), 123.45);
  });

  it("respects zero-decimal currencies", () => {
    assert.equal(currencyFractionDigits("JPY"), 0);
    assert.equal(majorToMinor(123, "JPY"), 123);
    assert.equal(minorToMajor(123, "JPY"), 123);
  });

  it("formats a minor-unit amount as its major-unit value", () => {
    const formatted = formatMinorCurrency(12_345, "USD", "en-US");
    assert.equal(formatted, "$123.45");
  });
});
