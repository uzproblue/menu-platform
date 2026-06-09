import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeCatalogPipelineOptions,
  postCatalogOptionsForCategory,
  postCatalogOptionsForMenuItem,
} from "./catalog-pipeline-options.ts";

describe("mergeCatalogPipelineOptions", () => {
  it("accumulates three distinct category IDs from rapid saves", () => {
    let merged = postCatalogOptionsForCategory("cat-a", { translations: [] }, {
      textFieldsChanged: true,
    });
    merged = mergeCatalogPipelineOptions(
      merged,
      postCatalogOptionsForCategory("cat-b", { translations: [] }, {
        textFieldsChanged: true,
      }),
    );
    merged = mergeCatalogPipelineOptions(
      merged,
      postCatalogOptionsForCategory("cat-c", { translations: [] }, {
        textFieldsChanged: true,
      }),
    );
    assert.deepEqual(merged.categoryIdsToSync.sort(), ["cat-a", "cat-b", "cat-c"]);
    assert.deepEqual(merged.itemIdsToSync, []);
  });

  it("retains both item and category IDs when saves are mixed", () => {
    const merged = mergeCatalogPipelineOptions(
      postCatalogOptionsForMenuItem("item-1", { translations: [] }, {
        textFieldsChanged: true,
      }),
      postCatalogOptionsForCategory("cat-1", { translations: [] }, {
        textFieldsChanged: true,
      }),
    );
    assert.deepEqual(merged.itemIdsToSync, ["item-1"]);
    assert.deepEqual(merged.categoryIdsToSync, ["cat-1"]);
  });

  it("dedupes the same category saved twice", () => {
    const first = postCatalogOptionsForCategory("cat-a", { translations: [] }, {
      textFieldsChanged: true,
    });
    const second = postCatalogOptionsForCategory("cat-a", { translations: [] }, {
      textFieldsChanged: true,
    });
    const merged = mergeCatalogPipelineOptions(first, second);
    assert.deepEqual(merged.categoryIdsToSync, ["cat-a"]);
  });
});

describe("postCatalogOptionsForCategory", () => {
  it("skips sync for sortOrder-only updates with existing translations", () => {
    const options = postCatalogOptionsForCategory(
      "cat-a",
      { translations: [{ lang: "EN", name: "Starters" }] },
      { textFieldsChanged: false },
    );
    assert.deepEqual(options.categoryIdsToSync, []);
    assert.deepEqual(options.itemIdsToSync, []);
  });

  it("syncs when translations are missing", () => {
    const options = postCatalogOptionsForCategory(
      "cat-a",
      { translations: [] },
      { textFieldsChanged: false },
    );
    assert.deepEqual(options.categoryIdsToSync, ["cat-a"]);
  });
});

describe("postCatalogOptionsForMenuItem", () => {
  it("syncs when text fields changed", () => {
    const options = postCatalogOptionsForMenuItem(
      "item-a",
      { translations: [{ lang: "EN", name: "Soup" }] },
      { textFieldsChanged: true },
    );
    assert.deepEqual(options.itemIdsToSync, ["item-a"]);
    assert.deepEqual(options.categoryIdsToSync, []);
  });
});
