import test from 'node:test';
import assert from 'node:assert/strict';
import { walletForTrip, configureWallet, saveExpense, restoreExpense, removeWalletEntry, walletSummary, recordPayment, parseMoney, moneyDigits, convertMinor, expenseCSV } from '../dist/wallet-model.js';
import { downloadExpenseCSV } from '../dist/wallet-export.js';
import { saveTrip, readTrips } from '../dist/trip-store.js';
import { changeTripDates } from '../dist/trip-dates.js';
const trip = { id: 'test', placeId: 'lisbon', name: 'Lisbon', latitude: 38.7, longitude: -9.1, startDate: '2026-10-20', endDate: '2026-10-25', items: [] };
const people = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Sam' }, { id: 'c', name: 'Jordan' }];
const configured = () => configureWallet(trip, { currency: 'USD', budget: '1000', people });
const entry = (extra = {}) => ({ title: 'Dinner', category: 'Food', currency: 'USD', amount: '10.00', date: '2026-10-16', paidBy: 'a', splitWith: ['a', 'b', 'c'], ...extra });

test('currency parsing rejects fractional cents and handles zero- and three-decimal currencies', () => {
  assert.equal(parseMoney('12.34', 'USD'), 1234); assert.equal(parseMoney('1250', 'JPY'), 1250); assert.equal(parseMoney('1.005', 'KWD'), 1005);
  assert.equal(parseMoney('0', 'USD', { allowZero: true }), 0);
  for (const value of ['-1', '1e3', '1,000', 'NaN', 'Infinity', '0', '1.001', '<script>']) assert.throws(() => parseMoney(value, 'USD'));
  assert.throws(() => parseMoney('1.1', 'JPY')); assert.throws(() => moneyDigits('XYZ')); assert.throws(() => parseMoney('1'.repeat(10000), 'USD'));
});

test('FX conversion rounds decimal rates with integer arithmetic and respects currency scales', () => {
  assert.equal(convertMinor(100, 'USD', 'USD', 1.005), 101);
  assert.equal(convertMinor(123, 'JPY', 'USD', .0065), 80);
  assert.equal(convertMinor(1234, 'USD', 'JPY', 150.25), 1854);
  assert.equal(convertMinor(1000, 'KWD', 'USD', 3.25), 325);
  assert.equal(convertMinor(100, 'USD', 'JPY', 1e-3), 0);
  for (const rate of [0, -1, NaN, Infinity, 1e10]) assert.throws(() => convertMinor(100, 'USD', 'EUR', rate));
});

test('equal splits preserve every penny regardless of participant selection order', () => {
  const first = saveExpense(configured(), entry()), second = saveExpense(configured(), entry({ splitWith: ['c', 'b', 'a', 'a'] }));
  const summary = walletSummary(first.wallet);
  assert.deepEqual(summary.balances, { a: 666, b: -333, c: -333 });
  assert.deepEqual(walletSummary(second.wallet).balances, summary.balances);
  assert.equal(Object.values(summary.balances).reduce((sum, value) => sum + value, 0), 0);
  assert.equal(summary.spentMinor, 1000); assert.equal(summary.remainingMinor, 99000);
});

test('foreign currency expense stores its original amount and a fixed conversion snapshot', () => {
  const input = configured(), before = structuredClone(input);
  const saved = saveExpense(input, entry({ currency: 'EUR', amount: '80', rate: { value: 1.1, date: '2026-10-15', source: 'Frankfurter' } }));
  assert.equal(saved.wallet.expenses[0].amountMinor, 8000); assert.equal(saved.wallet.expenses[0].baseMinor, 8800);
  assert.deepEqual(saved.wallet.expenses[0].rate, { value: 1.1, date: '2026-10-15', source: 'Frankfurter' }); assert.deepEqual(input, before);
  assert.throws(() => saveExpense(input, entry({ currency: 'EUR' })), /Load a rate/);
  assert.throws(() => saveExpense(input, entry({ currency: 'EUR', rate: { value: 1.1, date: '2026-10-15', source: 'same currency' } })), /Load a rate/);
});

test('expense edits and deletions recalculate budget, category totals and group balances', () => {
  const saved = saveExpense(configured(), entry()), id = saved.wallet.expenses[0].id;
  const edited = saveExpense(saved, entry({ id, amount: '30', category: 'Activity', paidBy: 'b', splitWith: ['a', 'b'] }));
  assert.equal(edited.wallet.expenses.length, 1);
  assert.deepEqual(walletSummary(edited.wallet).categories, { Activity: 3000 });
  assert.deepEqual(walletSummary(edited.wallet).balances, { a: -1500, b: 1500, c: 0 });
  const removed = removeWalletEntry(edited, 'expenses', id); assert.equal(walletSummary(removed.wallet).spentMinor, 0);
  assert.throws(() => saveExpense(removed, entry({ id })), /was removed/);
});

test('partial repayments update balances without inflating spending and can be undone', () => {
  const saved = saveExpense(configured(), entry());
  const partial = recordPayment(saved, { from: 'b', to: 'a', amount: '1.00', date: '2026-10-16' });
  assert.deepEqual(walletSummary(partial.wallet).balances, { a: 566, b: -233, c: -333 });
  assert.equal(walletSummary(partial.wallet).spentMinor, 1000);
  assert.throws(() => recordPayment(partial, { from: 'b', to: 'a', amount: '2.34', date: '2026-10-16' }), /exceeds/);
  assert.throws(() => recordPayment(saved, { from: 'a', to: 'b', amount: '1', date: '2026-10-16' }), /exceeds/);
  assert.deepEqual(walletSummary(removeWalletEntry(partial, 'payments', partial.wallet.payments[0].id).wallet), walletSummary(saved.wallet));
  let settled = saved;
  for (const transfer of walletSummary(saved.wallet).transfers) settled = recordPayment(settled, { ...transfer, amount: (transfer.amountMinor / 100).toFixed(2), date: '2026-10-16' });
  assert.deepEqual(walletSummary(settled.wallet).balances, { a: 0, b: 0, c: 0 }); assert.deepEqual(walletSummary(settled.wallet).transfers, []);
});

test('settlements conserve balances over varied amounts and participant subsets', () => {
  let saved = configured();
  for (let index = 0; index < 100; index++) saved = saveExpense(saved, entry({ amount: ((index * 173 % 9900 + 1) / 100).toFixed(2), paidBy: people[index % 3].id, splitWith: index % 2 ? ['a', 'b'] : ['a', 'b', 'c'] }));
  const summary = walletSummary(saved.wallet); assert.equal(Object.values(summary.balances).reduce((sum, value) => sum + value, 0), 0);
  for (const transfer of summary.transfers) saved = recordPayment(saved, { ...transfer, amount: (transfer.amountMinor / 100).toFixed(2), date: '2026-10-16' });
  assert.deepEqual(walletSummary(saved.wallet).balances, { a: 0, b: 0, c: 0 });
});

test('settings preserve referenced travelers, prevent unit relabeling and reject ambiguous names', () => {
  const saved = saveExpense(configured(), entry());
  assert.throws(() => configureWallet(saved, { currency: 'EUR', budget: '1000', people }), /reporting currency/);
  assert.throws(() => configureWallet(saved, { currency: 'USD', budget: '1000', people: people.slice(0, 2) }), /Keep travelers/);
  assert.throws(() => configureWallet(trip, { currency: 'USD', people: [{ id: 'a', name: 'Sam' }, { id: 'b', name: 'sam' }] }), /different name/);
  assert.throws(() => saveExpense(configured(), entry({ paidBy: 'missing' })), /who paid/);
  assert.throws(() => saveExpense(configured(), entry({ splitWith: [] })), /at least one/);
  assert.throws(() => saveExpense(configured(), entry({ splitWith: 'a' })), /at least one/);
});

test('ledger persists with the trip and remains intact when itinerary dates move', () => {
  const saved = saveExpense(configured(), entry()), values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  saveTrip(saved, storage); const reopened = readTrips(storage)[0]; assert.deepEqual(reopened.wallet, saved.wallet);
  const shifted = changeTripDates(reopened, '2026-11-01', '2026-11-06'); assert.deepEqual(shifted.wallet, saved.wallet); assert.equal(shifted.wallet.expenses[0].date, '2026-10-16');
  assert.equal(walletForTrip(trip, 'JPY').currency, 'JPY'); assert.equal(walletForTrip(trip).budgetMinor, null);
});

test('CSV exports original and reporting amounts, rate history and escaped spreadsheet formulas', () => {
  const saved = saveExpense(configured(), entry({ title: '=HYPERLINK("bad")', note: 'Line 1\nLine 2', currency: 'EUR', amount: '10', rate: { value: 1.2, date: '2026-10-16', source: 'manual' } }));
  const content = expenseCSV(saved.wallet); assert.match(content, /"10.00","EUR","12.00","USD"/); assert.match(content, /"1.2","2026-10-16","manual"/);
  assert.match(content, /"'=HYPERLINK\(""bad""\)"/); assert.match(content, /"Line 1\nLine 2"/); assert.ok(content.startsWith('\ufeff'));
});


test('undo restores an expense and its rate snapshot, and refuses to relabel reporting units', () => {
  const saved = saveExpense(configured(), entry({ currency: 'EUR', amount: '12.34', rate: { value: 1.12345, date: '2026-10-15', source: 'manual' } }));
  const expense = saved.wallet.expenses[0], removed = removeWalletEntry(saved, 'expenses', expense.id);
  const restored = restoreExpense(removed, expense, 'USD');
  assert.deepEqual(walletSummary(restored.wallet), walletSummary(saved.wallet));
  assert.deepEqual(restored.wallet.expenses[0].rate, expense.rate);
  const relabeled = configureWallet(removed, { currency: 'JPY', budget: '1000', people });
  assert.throws(() => restoreExpense(relabeled, expense, 'USD'), /original reporting currency/);
});


test('CSV download creates a local file, clicks its download link and cleans up the object URL', async () => {
  const previous = { document: globalThis.document, timeout: globalThis.setTimeout, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let clicked = false, removed = false, cleanup, blob, revoked = false;
  const link = { click() { clicked = true; }, remove() { removed = true; } };
  globalThis.document = { createElement: () => link, body: { append() {} } };
  globalThis.setTimeout = callback => { cleanup = callback; };
  URL.createObjectURL = value => { blob = value; return 'blob:expense-csv'; };
  URL.revokeObjectURL = value => { assert.equal(value, 'blob:expense-csv'); revoked = true; };
  try {
    const result = downloadExpenseCSV(saveExpense(configured(), entry()).wallet);
    assert.ok(clicked && removed); assert.equal(link.download, 'trip-expenses.csv');
    assert.equal(blob.type, 'text/csv;charset=utf-8'); assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)], [239, 187, 191]); assert.equal(await blob.text(), result.content.slice(1)); cleanup(); assert.ok(revoked);
  } finally { globalThis.document = previous.document; globalThis.setTimeout = previous.timeout; URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke; }
});
