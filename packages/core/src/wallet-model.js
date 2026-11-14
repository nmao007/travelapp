import { isDate } from './domain.js';

export const expenseCategories = Object.freeze({ Flight: ['Flights', 'plane'], Stay: ['Stays', 'stay'], Food: ['Food', 'food'], Transport: ['Transport', 'car'], Activity: ['Activities', 'landmark'], Shopping: ['Shopping', 'guide'], Other: ['Other', 'wallet'] });
const currencyCodes = new Set(Intl.supportedValuesOf('currency')), digitCache = new Map();
const maxMinor = 1_000_000_000_000;
export function moneyDigits(currency) {
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) || !currencyCodes.has(currency)) throw new Error('Choose a supported currency.');
  if (!digitCache.has(currency)) digitCache.set(currency, new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits);
  return digitCache.get(currency);
}
export function parseMoney(value, currency, { allowZero = false } = {}) {
  const digits = moneyDigits(currency), text = String(value ?? '').trim();
  if (text.length > 25 || !/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Enter an amount using numbers and a decimal point.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > digits) throw new Error(`${currency} allows ${digits} decimal places.`);
  const amount = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
  if (amount > BigInt(maxMinor) || (!allowZero && amount === 0n)) throw new Error('Enter a positive amount within the supported range.');
  return Number(amount);
}
export function moneyInput(minor, currency) { return (minor / 10 ** moneyDigits(currency)).toFixed(moneyDigits(currency)); }
export function formatMoney(minor, currency) { return new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(minor / 10 ** moneyDigits(currency)); }
export function convertMinor(amountMinor, from, to, rate) {
  const fromDigits = moneyDigits(from), toDigits = moneyDigits(to);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > maxMinor || !Number.isFinite(rate) || rate <= 0 || rate > 1e9) throw new Error('Enter a valid exchange rate.');
  const [mantissa, exponent = '0'] = String(rate).split('e'), [whole, fraction = ''] = mantissa.split('.');
  let numerator = BigInt(whole + fraction), denominator = 10n ** BigInt(fraction.length);
  if (Number(exponent) >= 0) numerator *= 10n ** BigInt(exponent); else denominator *= 10n ** BigInt(-Number(exponent));
  numerator *= BigInt(amountMinor) * 10n ** BigInt(toDigits); denominator *= 10n ** BigInt(fromDigits);
  const result = (2n * numerator + denominator) / (2n * denominator);
  if (result > BigInt(maxMinor)) throw new Error('The converted amount is too large.');
  return Number(result);
}
export function walletForTrip(trip, currency = 'USD') {
  return trip.wallet || { currency, budgetMinor: null, people: [{ id: 'me', name: 'You' }], expenses: [], payments: [] };
}
function checkPeople(people) {
  if (!Array.isArray(people) || !people.length || people.length > 20 || new Set(people.map(person => person.id)).size !== people.length) throw new Error('Add between 1 and 20 different travelers.');
  if (people.some(person => typeof person.id !== 'string' || !person.id || !person.name?.trim() || person.name.trim().length > 50)) throw new Error('Give each traveler a name, up to 50 characters.');
  if (new Set(people.map(person => person.name.trim().toLocaleLowerCase())).size !== people.length) throw new Error('Use a different name for each traveler.');
}
export function configureWallet(trip, { currency, budget, people }, defaultCurrency = 'USD') {
  moneyDigits(currency); checkPeople(people);
  const wallet = walletForTrip(trip, defaultCurrency);
  if (currency !== wallet.currency && (wallet.expenses.length || wallet.payments.length)) throw new Error('Keep the reporting currency while expenses or payments are recorded.');
  const ids = new Set(people.map(person => person.id));
  if (wallet.expenses.some(expense => !ids.has(expense.paidBy) || expense.splitWith.some(id => !ids.has(id))) || wallet.payments.some(payment => !ids.has(payment.from) || !ids.has(payment.to))) throw new Error('Keep travelers who appear in saved expenses or payments.');
  const budgetMinor = String(budget ?? '').trim() ? parseMoney(budget, currency, { allowZero: true }) : null;
  return { ...trip, wallet: { ...wallet, currency, budgetMinor, people: people.map(person => ({ id: person.id, name: person.name.trim() })) } };
}
export function saveExpense(trip, input, defaultCurrency = 'USD') {
  const wallet = walletForTrip(trip, defaultCurrency); checkPeople(wallet.people);
  if (!input.title?.trim() || input.title.trim().length > 120) throw new Error('Add an expense name, up to 120 characters.');
  if (!isDate(input.date)) throw new Error('Choose a valid payment date.');
  if (!Object.hasOwn(expenseCategories, input.category)) throw new Error('Choose an expense category.');
  if (!Array.isArray(input.splitWith)) throw new Error('Choose at least one person to split with.');
  const ids = new Set(wallet.people.map(person => person.id)), splitWith = [...new Set(input.splitWith || [])].sort();
  if (!ids.has(input.paidBy) || !splitWith.length || splitWith.some(id => !ids.has(id))) throw new Error('Choose who paid and at least one person to split with.');
  if ((input.note || '').length > 1000) throw new Error('Keep expense notes under 1,000 characters.');
  const amountMinor = parseMoney(input.amount, input.currency), same = input.currency === wallet.currency;
  const rate = same ? { value: 1, date: input.date, source: 'same currency' } : input.rate;
  if (!rate || !isDate(rate.date) || !['Frankfurter', 'manual', 'same currency'].includes(rate.source) || (!same && rate.source === 'same currency')) throw new Error('Load a rate or enter one manually.');
  const baseMinor = convertMinor(amountMinor, input.currency, wallet.currency, rate.value);
  if (!baseMinor) throw new Error('The converted amount is smaller than one reporting-currency unit.');
  if (input.id && !wallet.expenses.some(expense => expense.id === input.id)) throw new Error('This expense was removed. Reopen the expense list.');
  if (!input.id && wallet.expenses.length >= 2000) throw new Error('This trip has reached 2,000 expense entries.');
  const expense = { id: input.id || crypto.randomUUID(), title: input.title.trim(), date: input.date, category: input.category, currency: input.currency, amountMinor, baseMinor, rate: { value: rate.value, date: rate.date, source: rate.source }, paidBy: input.paidBy, splitWith, note: input.note?.trim() || '' };
  return { ...trip, wallet: { ...wallet, expenses: input.id ? wallet.expenses.map(record => record.id === input.id ? expense : record) : [...wallet.expenses, expense] } };
}
export function removeWalletEntry(trip, collection, id) {
  if (!['expenses', 'payments'].includes(collection)) throw new Error('Unknown spending entry.');
  const wallet = walletForTrip(trip);
  return { ...trip, wallet: { ...wallet, [collection]: wallet[collection].filter(record => record.id !== id) } };
}
export function walletSummary(wallet) {
  const balances = Object.fromEntries(wallet.people.map(person => [person.id, 0])), categories = {};
  let spentMinor = 0;
  for (const expense of wallet.expenses) {
    spentMinor += expense.baseMinor; categories[expense.category] = (categories[expense.category] || 0) + expense.baseMinor;
    balances[expense.paidBy] += expense.baseMinor;
    const share = Math.floor(expense.baseMinor / expense.splitWith.length), remainder = expense.baseMinor % expense.splitWith.length;
    [...expense.splitWith].sort().forEach((id, index) => { balances[id] -= share + (index < remainder ? 1 : 0); });
  }
  for (const payment of wallet.payments) { balances[payment.from] += payment.amountMinor; balances[payment.to] -= payment.amountMinor; }
  const debtors = Object.entries(balances).filter(([, value]) => value < 0).map(([id, value]) => ({ id, amount: -value })).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const creditors = Object.entries(balances).filter(([, value]) => value > 0).map(([id, value]) => ({ id, amount: value })).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const transfers = []; let left = 0, right = 0;
  while (left < debtors.length && right < creditors.length) {
    const from = debtors[left], to = creditors[right], amountMinor = Math.min(from.amount, to.amount);
    transfers.push({ from: from.id, to: to.id, amountMinor }); from.amount -= amountMinor; to.amount -= amountMinor;
    if (!from.amount) left++; if (!to.amount) right++;
  }
  return { spentMinor, remainingMinor: wallet.budgetMinor === null ? null : wallet.budgetMinor - spentMinor, categories, balances, transfers };
}
export function recordPayment(trip, { from, to, amount, date }) {
  const wallet = walletForTrip(trip), summary = walletSummary(wallet), amountMinor = parseMoney(amount, wallet.currency);
  if (!isDate(date) || from === to || !wallet.people.some(person => person.id === from) || !wallet.people.some(person => person.id === to)) throw new Error('Choose different travelers and a valid payment date.');
  if (amountMinor > Math.min(-(summary.balances[from] || 0), summary.balances[to] || 0)) throw new Error('The payment exceeds the outstanding balance.');
  if (wallet.payments.length >= 2000) throw new Error('This trip has reached 2,000 payment entries.');
  return { ...trip, wallet: { ...wallet, payments: [...wallet.payments, { id: crypto.randomUUID(), from, to, amountMinor, date }] } };
}
const csvCell = value => `"${String(value ?? '').replace(/^[\s\u0000-\u001f]*[=+@-]/, match => `'${match}`).replaceAll('"', '""')}"`;
export function expenseCSV(wallet) {
  const names = Object.fromEntries(wallet.people.map(person => [person.id, person.name]));
  const rows = [['Type', 'Date', 'Description', 'Category', 'Amount', 'Currency', 'Reporting amount', 'Reporting currency', 'Paid by / From', 'Split with / To', 'Rate', 'Rate date', 'Rate source', 'Notes']];
  for (const expense of wallet.expenses) rows.push(['Expense', expense.date, expense.title, expenseCategories[expense.category]?.[0] || expense.category, moneyInput(expense.amountMinor, expense.currency), expense.currency, moneyInput(expense.baseMinor, wallet.currency), wallet.currency, names[expense.paidBy], expense.splitWith.map(id => names[id]).join(' / '), expense.rate.value, expense.rate.date, expense.rate.source, expense.note]);
  for (const payment of wallet.payments) rows.push(['Payment', payment.date, 'Repayment (excluded from spending)', '', moneyInput(payment.amountMinor, wallet.currency), wallet.currency, '', wallet.currency, names[payment.from], names[payment.to], '', '', '', '']);
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function restoreExpense(trip, expense, currency) {
  if (walletForTrip(trip, currency).currency !== currency) throw new Error('Restore the original reporting currency before undoing this deletion.');
  return saveExpense(trip, { ...expense, id: undefined, amount: moneyInput(expense.amountMinor, expense.currency) }, currency);
}
