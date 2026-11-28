import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SELECTED,
  addSelected,
  allSelected,
  countSelected,
  removeSelected,
  toggleSelected,
} from "../ui/shared/utils/selection.js";
import { EXPORT_MAX_RECORDS } from "../server/constants.js";

test("the view's selection limit is the export tool's limit", () => {
  assert.equal(MAX_SELECTED, EXPORT_MAX_RECORDS);
});

test("toggling ticks a work, then unticks it, without changing the set given", () => {
  const empty = new Set<string>();
  const one = toggleSelected(empty, "W1");
  assert.deepEqual([...one], ["W1"]);
  assert.equal(empty.size, 0);
  assert.deepEqual([...toggleSelected(one, "W1")], []);
});

test("a full selection takes no more, but a ticked work can still be unticked", () => {
  const full = new Set(["W1", "W2"]);
  assert.deepEqual([...toggleSelected(full, "W3", 2)], ["W1", "W2"]);
  assert.deepEqual([...toggleSelected(full, "W1", 2)], ["W2"]);
});

test("selecting a page adds to what is ticked on other pages and stops at the limit", () => {
  const earlier = new Set(["W1"]);
  assert.deepEqual([...addSelected(earlier, ["W2", "W3"])], ["W1", "W2", "W3"]);
  assert.deepEqual([...addSelected(earlier, ["W2", "W3", "W4"], 3)], ["W1", "W2", "W3"]);
  assert.deepEqual([...addSelected(earlier, ["W1", "W2"])], ["W1", "W2"]);
});

test("unselecting a page keeps works ticked on other pages", () => {
  assert.deepEqual([...removeSelected(new Set(["W1", "W2", "W3"]), ["W2", "W3", "W9"])], ["W1"]);
});

test("a page counts as selected only when every work on it is ticked", () => {
  const selected = new Set(["W1", "W2"]);
  assert.equal(allSelected(selected, ["W1", "W2"]), true);
  assert.equal(allSelected(selected, ["W1", "W3"]), false);
  assert.equal(allSelected(selected, []), false);
  assert.equal(countSelected(selected, ["W1", "W3"]), 1);
});
