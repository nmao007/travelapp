import test from "node:test";
import assert from "node:assert/strict";
import { sampleTrip, applyPreviewOperation } from "../lib/preview.ts";
function form(values) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
const run = (store, operation, values) => applyPreviewOperation(store, operation, form({ tripId: store.trip?.id, ...values }), "new-sample-id");

test("local sample CRUD updates data without mutating the previous snapshot", () => {
  const original = sampleTrip();
  let result = run(original, "savePackingItem", { name: "Umbrella", category: "Essentials" });
  assert.equal(result.store.items.length, 4);
  assert.equal(original.items.length, 3);
  result = run(result.store, "togglePackingItem", { id: "new-sample-id", packed: "true" });
  assert.equal(result.store.items.find((item) => item.id === "new-sample-id").packed, true);
  result = run(result.store, "savePackingItem", { id: "new-sample-id", name: "Small umbrella", category: "Other" });
  assert.equal(result.store.items.find((item) => item.id === "new-sample-id").packed, true);
  result = run(result.store, "deleteItem", { id: "new-sample-id", table: "packing_items" });
  assert.equal(result.store.items.length, 3);
});
test("local itinerary and expense changes follow trip date and currency rules", () => {
  const store = sampleTrip();
  assert.match(run(store, "saveActivity", { title: "Too late", category: "Activity", date: "2026-10-05" }).error, /within your trip/);
  assert.match(run(store, "saveExpense", { title: "Fraction", category: "Food", date: "2026-09-27", amount: "1.5" }).error, /positive amount/);
  const result = run(store, "saveExpense", { title: "Coffee", category: "Food", date: "2026-09-27", amount: "500" });
  assert.equal(result.store.expenses.at(-1).amount_minor, 500);
});
test("local preview rejects unknown operations and wrong trip identities", () => {
  assert.match(run(sampleTrip(), "unexpected", {}).error, /unavailable/);
  const result = applyPreviewOperation(sampleTrip(), "deleteTrip", form({ tripId: "another-trip" }), "id");
  assert.ok(result.error);
  assert.equal(result.store, undefined);
});
test("local deletion clears only the sample snapshot", () => {
  const source = sampleTrip(), result = run(source, "deleteTrip", {});
  assert.equal(result.store.trip, null);
  assert.deepEqual(result.store.items, []);
  assert.ok(source.trip);
});
