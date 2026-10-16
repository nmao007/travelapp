import { expenseCategories, walletForTrip, configureWallet, saveExpense, restoreExpense, removeWalletEntry, walletSummary, recordPayment, parseMoney, convertMinor, formatMoney, moneyInput } from './wallet-model.js';
import { downloadExpenseCSV } from './wallet-export.js';
import { createExpenseRates } from './expense-rates.js';
import { placeArt } from './place-art.js';
import { closeDialogSmooth, playMotion } from './motion.js';
import { enhanceDropdowns, refreshDropdowns } from './dropdowns.js';
import { setPanelOpen } from './expansion.js';
import { countryCurrencies } from './country-currencies.js';

const node = (tag, className = '', text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const shortDate = day => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'SGD', 'NZD', 'CNY', 'THB', 'KRW', 'MXN', 'AED', 'KWD'];
function field(form, label, name, { type = 'text', value = '', placeholder = '', maxLength = 120 } = {}) {
  const wrap = node('label', 'wallet-field', label), input = node('input'); input.type = type; input.name = name; input.value = value; input.placeholder = placeholder; input.maxLength = maxLength;
  wrap.append(input); form.append(wrap); return input;
}
function selectField(form, label, name, choices, selected) {
  const wrap = node('label', 'wallet-field', label), select = node('select'); select.name = name;
  for (const [value, text] of choices) { const option = node('option', '', text); option.value = value; select.append(option); }
  select.value = selected; wrap.append(select); form.append(wrap); return select;
}
function currencies(current) { return [...new Set([current, ...commonCurrencies])].map(currency => [currency, currency]); }

export function createWallet({ state, commit, icon }) {
  const root = document.getElementById('trip-wallet'), rateLookup = createExpenseRates();
  let defaultCurrency = 'USD';
  try { defaultCurrency = countryCurrencies[new Intl.Locale(navigator.language).maximize().region]?.[1] || 'USD'; } catch { /* The reporting currency stays explicit. */ }
  let spendingDialog = null, spendingContent = null, spendingCurrency = null;
  let snapshot = '', lastTrip = null, showAll = false, showAllPayments = false, removedExpense = null, rateVersion = 0, activeDialog = null;
  const wallet = () => walletForTrip(state.trip, defaultCurrency);
  const action = (label, handler, className = 'wallet-quiet') => { const button = node('button', className, label); button.type = 'button'; button.addEventListener('click', () => { try { handler(); } catch (failure) { const target = activeDialog?.querySelector('.wallet-error') || spendingContent?.querySelector('.wallet-message') || root.querySelector('.wallet-message') || node('p', 'wallet-message'); target.setAttribute('role', 'alert'); target.textContent = failure.message || 'Could not save this change.'; if (!target.isConnected) (spendingContent || root).prepend(target); } }); return button; };
  function update(next) { commit(next); render(); }
  function createDialog(title, onSave) {
    const tripId = state.trip.id, trigger = document.activeElement;
    const dialog = node('dialog', 'editor-dialog wallet-dialog'); dialog.dataset.walletDialog = 'true';
    const form = node('form', 'wallet-form'); form.noValidate = true;
    const heading = node('div', 'editor-heading'), label = node('h2', '', title); label.id = `wallet-title-${crypto.randomUUID()}`; dialog.setAttribute('aria-labelledby', label.id);
    const close = action('', () => closeDialogSmooth(dialog), 'small-action'); close.innerHTML = icon('close'); close.setAttribute('aria-label', `Close ${title.toLowerCase()}`); heading.append(label, close);
    const body = node('div', 'wallet-form-body'), error = node('p', 'wallet-error'); error.setAttribute('role', 'alert');
    const footer = node('div', 'wallet-form-footer'), save = node('button', 'primary-action', 'Save'); save.type = 'submit'; footer.append(save); form.append(heading, body, error, footer); dialog.append(form); document.body.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialogSmooth(dialog); });
    dialog.addEventListener('close', () => {
      rateVersion++; if (activeDialog === dialog) activeDialog = null; dialog.remove();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true }); else (spendingContent?.querySelector('[data-add-expense]') || root.querySelector('[data-open-spending]'))?.focus({ preventScroll: true });
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (save.disabled) return;
      if (state.trip?.id !== tripId) { error.textContent = 'Reopen this expense from the current trip.'; return; }
      error.textContent = '';
      try { if (onSave() !== false) await closeDialogSmooth(dialog); } catch (failure) { error.textContent = failure.message || 'Could not save this entry.'; }
    });
    activeDialog = dialog;
    return { dialog, form, body, footer, save, error, open() { enhanceDropdowns(dialog); dialog.showModal(); playMotion(dialog, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180 }); body.querySelector('input:not(:disabled)')?.focus({ preventScroll: true }); } };
  }
  function openSettings() {
    const current = wallet(), people = current.people.map(person => ({ ...person }));
    let currency, budget;
    const sheet = createDialog('Trip budget', () => {
      const updatedPeople = [...sheet.body.querySelectorAll('[data-person-id]')].map(row => ({ id: row.dataset.personId, name: row.querySelector('input').value }));
      update(configureWallet(state.trip, { currency: currency.value, budget: budget.value, people: updatedPeople }, defaultCurrency));
    });
    const pair = node('div', 'wallet-form-pair'); sheet.body.append(pair);
    currency = selectField(pair, 'Currency', 'reportingCurrency', currencies(current.currency), current.currency);
    currency.disabled = Boolean(current.expenses.length || current.payments.length);
    budget = field(pair, 'Budget', 'budget', { value: current.budgetMinor === null ? '' : moneyInput(current.budgetMinor, current.currency), placeholder: 'Optional', maxLength: 22 }); budget.inputMode = 'decimal';
    if (currency.disabled) sheet.body.append(node('p', 'wallet-hint', 'Reporting currency is fixed while entries exist.'));
    const group = node('div', 'wallet-people'); sheet.body.append(node('h3', 'wallet-subheading', 'Travelers'), group);
    const addPerson = person => {
      const row = node('div', 'wallet-person'); row.dataset.personId = person.id;
      const input = node('input'); input.value = person.name; input.maxLength = 50; input.setAttribute('aria-label', 'Traveler name');
      const used = current.expenses.some(expense => expense.paidBy === person.id || expense.splitWith.includes(person.id)) || current.payments.some(payment => payment.from === person.id || payment.to === person.id);
      const remove = action('', () => row.remove(), 'wallet-icon-button'); remove.innerHTML = icon('close'); remove.setAttribute('aria-label', `Remove ${person.name || 'traveler'}`); remove.disabled = used; if (used) remove.title = 'This traveler appears in saved entries'; row.append(input, remove); group.append(row);
    };
    people.forEach(addPerson);
    sheet.body.append(action('+ Add traveler', () => { if (group.children.length >= 20) { sheet.error.textContent = 'Up to 20 travelers per trip.'; return; } addPerson({ id: crypto.randomUUID(), name: '' }); group.lastElementChild.querySelector('input').focus(); }));
    sheet.open();
  }
  function openExpense(existing = null) {
    const current = wallet(); let rate = existing?.rate || null, currency, amount, manual, quote, rateStatus, title, date, category, payer, note, refreshRateButton;
    const sheet = createDialog(existing ? 'Edit expense' : 'Add expense', () => {
      const splitWith = [...sheet.body.querySelectorAll('[name=splitWith]:checked')].map(input => input.value);
      const selectedRate = currency.value === current.currency ? { value: 1, date: date.value, source: 'same currency' } : manual && !manual.closest('label').hidden ? { value: Number(manual.value), date: date.value, source: 'manual' } : rate;
      update(saveExpense(state.trip, { id: existing?.id, title: title.value, amount: amount.value, currency: currency.value, date: date.value, category: category.value, paidBy: payer.value, splitWith, note: note.value, rate: selectedRate }, defaultCurrency));
    });
    title = field(sheet.body, 'Expense', 'title', { value: existing?.title || '', placeholder: 'Dinner, flights, tickets…' });
    const pair = node('div', 'wallet-form-pair amount-pair'); sheet.body.append(pair);
    amount = field(pair, 'Amount', 'amount', { value: existing ? moneyInput(existing.amountMinor, existing.currency) : '', placeholder: '0.00', maxLength: 22 }); amount.inputMode = 'decimal';
    currency = selectField(pair, 'Currency', 'expenseCurrency', currencies(existing?.currency || current.currency), existing?.currency || current.currency);
    quote = node('output', 'wallet-converted'); quote.setAttribute('aria-live', 'polite'); rateStatus = node('p', 'wallet-hint'); sheet.body.append(quote, rateStatus);
    manual = field(sheet.body, `1 ${currency.value} in ${current.currency}`, 'manualRate', { placeholder: 'Exchange rate', maxLength: 24 }); manual.inputMode = 'decimal'; manual.closest('label').hidden = true;
    const rateControl = action('Use my rate', () => {
      if (!manual.closest('label').hidden) { loadRate(); return; }
      rateVersion++; sheet.save.disabled = false; manual.closest('label').hidden = false; manual.value = rate?.value || ''; manual.closest('label').firstChild.textContent = `1 ${currency.value} in ${current.currency}`; rateStatus.textContent = 'Manual rate'; rateControl.textContent = 'Use reference rate'; conversion(); manual.focus({ preventScroll: true });
    }); rateControl.hidden = currency.value === current.currency; sheet.body.append(rateControl);
    const info = node('div', 'wallet-form-pair'); sheet.body.append(info);
    category = selectField(info, 'Category', 'category', Object.entries(expenseCategories).map(([key, value]) => [key, value[0]]), existing?.category || 'Food');
    date = field(info, 'Paid on', 'expenseDate', { type: 'date', value: existing?.date || today() });
    payer = selectField(sheet.body, 'Paid by', 'paidBy', current.people.map(person => [person.id, person.name]), existing?.paidBy || current.people[0].id);
    const split = node('fieldset', 'wallet-split'); split.append(node('legend', '', 'Split equally with'));
    for (const person of current.people) {
      const label = node('label'), input = node('input'); input.type = 'checkbox'; input.name = 'splitWith'; input.value = person.id; input.checked = existing ? existing.splitWith.includes(person.id) : true; label.append(input, node('span', '', person.name)); split.append(label);
    }
    sheet.body.append(split); if (current.people.length === 1) { payer.closest('label').hidden = true; split.hidden = true; }
    note = field(sheet.body, 'Note', 'note', { value: existing?.note || '', placeholder: 'Optional', maxLength: 1000 });
    const noteField = note.closest('label'); noteField.hidden = !existing?.note;
    const addNote = action('+ Note', () => { addNote.hidden = true; setPanelOpen(noteField, true); note.focus({ preventScroll: true }); }); addNote.hidden = Boolean(existing?.note); sheet.body.append(addNote);
    function conversion() {
      if (refreshRateButton) refreshRateButton.hidden = currency.value === current.currency || !manual.closest('label').hidden;
      try {
        const source = manual.closest('label').hidden ? rate?.value : Number(manual.value), units = parseMoney(amount.value, currency.value);
        quote.textContent = currency.value === current.currency ? '' : `${formatMoney(convertMinor(units, currency.value, current.currency, source), current.currency)} ${current.currency}`;
      } catch { quote.textContent = ''; }
    }
    async function loadRate(useSaved = false) {
      const version = ++rateVersion; manual.closest('label').hidden = true; sheet.save.disabled = false; rateControl.hidden = currency.value === current.currency; rateControl.textContent = 'Use my rate';
      if (currency.value === current.currency) { rate = { value: 1, date: date.value, source: 'same currency' }; rateStatus.textContent = ''; conversion(); return; }
      if (useSaved && rate) {
        if (rate.source === 'manual') { rateControl.textContent = 'Use reference rate'; manual.closest('label').hidden = false; manual.value = rate.value; manual.closest('label').firstChild.textContent = `1 ${currency.value} in ${current.currency}`; }
        rateStatus.textContent = `${rate.source === 'manual' ? 'Manual' : 'Saved reference'} rate · ${rate.date}`; conversion(); return;
      }
      rate = null; quote.textContent = ''; sheet.save.disabled = true; rateStatus.textContent = 'Loading reference rate…';
      try {
        const fresh = await rateLookup(currency.value, current.currency);
        if (version !== rateVersion || !sheet.dialog.open) return;
        rate = fresh; rateStatus.textContent = `Frankfurter · ${fresh.date} · reference rate`;
      } catch {
        if (version !== rateVersion || !sheet.dialog.open) return;
        rateControl.textContent = 'Use reference rate'; manual.closest('label').hidden = false; manual.value = ''; manual.closest('label').firstChild.textContent = `1 ${currency.value} in ${current.currency}`; rateStatus.textContent = 'Rate unavailable. Enter your exchange rate.';
      } finally { if (version === rateVersion) { sheet.save.disabled = false; conversion(); } }
    }
    currency.addEventListener('change', () => loadRate()); amount.addEventListener('input', conversion); manual.addEventListener('input', conversion);
    if (existing) {
      refreshRateButton = action('Refresh rate', () => loadRate()); refreshRateButton.hidden = existing.currency === current.currency || existing.rate.source === 'manual'; sheet.body.append(refreshRateButton);
      sheet.footer.prepend(action('Delete', () => { const previous = removedExpense; removedExpense = { tripId: state.trip.id, expense: existing, currency: current.currency }; try { update(removeWalletEntry(state.trip, 'expenses', existing.id)); } catch (failure) { removedExpense = previous; throw failure; } closeDialogSmooth(sheet.dialog); }, 'wallet-delete'));
    }
    sheet.open(); loadRate(Boolean(existing));
  }
  function openPayment(transfer) {
    const current = wallet(), names = Object.fromEntries(current.people.map(person => [person.id, person.name])); let amount, date;
    const sheet = createDialog('Record payment', () => update(recordPayment(state.trip, { ...transfer, amount: amount.value, date: date.value })));
    sheet.body.append(node('p', 'wallet-payment-description', `${names[transfer.from]} → ${names[transfer.to]}`));
    amount = field(sheet.body, `Amount · ${current.currency}`, 'paymentAmount', { value: moneyInput(transfer.amountMinor, current.currency), maxLength: 22 }); amount.inputMode = 'decimal';
    date = field(sheet.body, 'Paid on', 'paymentDate', { type: 'date', value: today() });
    sheet.body.append(node('p', 'wallet-hint', 'Records a payment already made. No money is transferred.')); sheet.open();
  }
  function downloadCSV() { downloadExpenseCSV(wallet()); }

  function openSpending() {
    if (spendingDialog?.open) return;
    const dialog = node('dialog', 'editor-dialog wallet-dialog wallet-overview-dialog');
    const layout = node('div', 'wallet-form'), heading = node('div', 'editor-heading');
    const title = node('h2', '', 'Trip spending'); title.id = `spending-${crypto.randomUUID()}`;
    dialog.setAttribute('aria-labelledby', title.id);
    const copy = node('div', 'wallet-overview-title'); spendingCurrency = node('span', 'wallet-currency', wallet().currency); copy.append(title, spendingCurrency);
    const controls = node('div', 'wallet-overview-controls');
    const settings = action('', openSettings, 'wallet-icon-button'); settings.innerHTML = icon('edit'); settings.setAttribute('aria-label', 'Edit budget and travelers');
    const close = action('', () => closeDialogSmooth(dialog), 'small-action'); close.innerHTML = icon('close'); close.setAttribute('aria-label', 'Close trip spending'); controls.append(settings, close); heading.append(copy, controls);
    spendingContent = node('div', 'wallet-spending-content'); layout.append(heading, spendingContent); dialog.append(layout); document.body.append(dialog); spendingDialog = dialog;
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialogSmooth(dialog); });
    dialog.addEventListener('close', () => {
      if (spendingDialog === dialog) { activeDialog?.close(); spendingDialog = null; spendingContent = null; spendingCurrency = null; }
      dialog.remove(); root.querySelector('[data-open-spending]')?.focus({ preventScroll: true });
    });
    renderSpending(); dialog.showModal(); close.focus({ preventScroll: true });
    playMotion(dialog, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180 });
  }
  function render() {
    const visible = state.trip && state.workspaceView === 'transportation'; root.hidden = !visible;
    if (lastTrip !== state.trip?.id) { activeDialog?.close(); spendingDialog?.close(); showAll = false; showAllPayments = false; removedExpense = null; snapshot = ''; lastTrip = state.trip?.id; }
    if (!visible) { activeDialog?.close(); spendingDialog?.close(); return; }
    const current = wallet(), next = JSON.stringify([state.trip.id, current, showAll, showAllPayments, removedExpense?.expense.id]); if (next === snapshot) return; snapshot = next;
    const summary = walletSummary(current); root.replaceChildren();
    const button = action('', openSpending, 'wallet-launcher'); button.dataset.openSpending = 'true'; button.setAttribute('aria-haspopup', 'dialog');
    const art = node('span', 'wallet-launcher-icon'); art.innerHTML = placeArt('wallet');
    const copy = node('span', 'wallet-launcher-copy'); copy.append(node('strong', '', 'Trip spending'));
    if (summary.remainingMinor !== null) copy.append(node('small', '', `${formatMoney(Math.abs(summary.remainingMinor), current.currency)} ${summary.remainingMinor < 0 ? 'over budget' : 'left'}`));
    else copy.append(node('small', '', current.expenses.length ? `${current.expenses.length} ${current.expenses.length === 1 ? 'expense' : 'expenses'}` : 'Budget & expenses'));
    const amount = node('span', 'wallet-launcher-amount', formatMoney(summary.spentMinor, current.currency));
    const arrow = node('span', 'wallet-launcher-arrow'); arrow.innerHTML = icon('arrow'); button.append(art, copy, amount, arrow); root.append(button);
    if (spendingDialog?.open) renderSpending();
  }
  function renderSpending() {
    const root = spendingContent; if (!root) return;
    const current = wallet(), summary = walletSummary(current), names = Object.fromEntries(current.people.map(person => [person.id, person.name])); root.replaceChildren();
    spendingCurrency.textContent = current.currency;
    const card = node('div', 'wallet-overview'), art = node('span', 'wallet-art'); art.innerHTML = placeArt('wallet');
    const spent = node('div', 'wallet-spent'); spent.append(node('span', '', 'Spent'), node('strong', '', formatMoney(summary.spentMinor, current.currency))); card.append(spent, art);
    if (summary.remainingMinor !== null) {
      const remaining = node('div', `wallet-remaining${summary.remainingMinor < 0 ? ' over-budget' : ''}`); remaining.append(node('strong', '', formatMoney(Math.abs(summary.remainingMinor), current.currency)), node('span', '', summary.remainingMinor < 0 ? 'over budget' : 'left'));
      card.append(remaining);
      const progress = node('div', 'wallet-progress'); progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', 'Budget spent'); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
      const percent = current.budgetMinor ? Math.round(summary.spentMinor / current.budgetMinor * 100) : summary.spentMinor ? 100 : 0; progress.setAttribute('aria-valuenow', String(Math.min(100, percent))); progress.setAttribute('aria-valuetext', `${percent}% of budget spent`);
      const fill = node('span'); fill.style.width = `${Math.min(100, percent)}%`; progress.append(fill); card.append(progress);
      card.append(node('small', 'wallet-budget-total', `Budget ${formatMoney(current.budgetMinor, current.currency)}`));
    } else card.append(action('Set budget', openSettings, 'wallet-set-budget'));
    root.append(card);
    const tools = node('div', 'wallet-tools'), add = action('+ Add expense', () => openExpense(), 'primary-action'); add.dataset.addExpense = 'true'; tools.append(add);
    if (current.expenses.length || current.payments.length) tools.append(action('Export CSV', downloadCSV)); root.append(tools);
    if (removedExpense?.tripId === state.trip.id) { const notice = node('div', 'wallet-undo'); notice.setAttribute('role', 'status'); notice.append(node('span', '', 'Expense removed'), action('Undo', () => { const recovery = removedExpense, next = restoreExpense(state.trip, recovery.expense, recovery.currency); removedExpense = null; try { update(next); } catch (failure) { removedExpense = recovery; throw failure; } })); root.append(notice); }
    const categories = Object.entries(summary.categories).sort((a, b) => b[1] - a[1]);
    if (categories.length) {
      const breakdown = node('div', 'wallet-categories');
      for (const [category, value] of categories) { const row = node('div', 'wallet-category'); row.append(node('span', '', expenseCategories[category]?.[0] || category), node('strong', '', formatMoney(value, current.currency))); const track = node('div', 'wallet-category-track'), bar = node('span'); bar.style.width = `${value / summary.spentMinor * 100}%`; track.append(bar); row.append(track); breakdown.append(row); }
      root.append(breakdown);
    }
    if (!current.expenses.length) root.append(node('p', 'wallet-empty', 'Flights, food, tickets. Keep it all here.'));
    const list = node('div', 'wallet-expenses');
    const expenses = [...current.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    for (const expense of (showAll ? expenses : expenses.slice(0, 5))) {
      const button = action('', () => openExpense(expense), 'wallet-expense'), symbol = node('span', 'wallet-expense-icon'); symbol.innerHTML = placeArt(expenseCategories[expense.category]?.[1] || 'wallet');
      const copy = node('span', 'wallet-expense-copy'); copy.append(node('strong', '', expense.title), node('small', '', `${shortDate(expense.date)}${current.people.length > 1 ? ` · ${names[expense.paidBy]} paid` : ''}`));
      const amounts = node('span', 'wallet-expense-amount'); amounts.append(node('strong', '', formatMoney(expense.baseMinor, current.currency)));
      if (expense.currency !== current.currency) amounts.append(node('small', '', `${formatMoney(expense.amountMinor, expense.currency)} ${expense.currency}`));
      button.append(symbol, copy, amounts); list.append(button);
    }
    root.append(list);
    if (expenses.length > 5) root.append(action(showAll ? 'Show fewer' : `View all ${expenses.length}`, () => { showAll = !showAll; snapshot = ''; render(); }));
    if (current.people.length > 1) {
      const group = node('section', 'wallet-balances'); group.append(node('h3', '', 'Who owes whom'));
      if (!summary.transfers.length) group.append(node('p', 'wallet-hint', current.expenses.length ? 'All settled.' : 'Shared expenses will appear here.'));
      for (const transfer of summary.transfers) {
        const row = node('div', 'wallet-transfer'), text = node('span'); text.append(node('strong', '', `${names[transfer.from]} → ${names[transfer.to]}`), node('small', '', formatMoney(transfer.amountMinor, current.currency)));
        row.append(text, action('Record paid', () => openPayment(transfer))); group.append(row);
      }
      for (const payment of [...current.payments].reverse().slice(0, showAllPayments ? undefined : 5)) {
        const row = node('div', 'wallet-payment'); row.append(node('span', '', `${names[payment.from]} → ${names[payment.to]} · ${formatMoney(payment.amountMinor, current.currency)} paid`));
        row.append(action('Undo', () => update(removeWalletEntry(state.trip, 'payments', payment.id)))); group.append(row);
      }
      if (current.payments.length > 5) group.append(action(showAllPayments ? 'Fewer payments' : `All ${current.payments.length} payments`, () => { showAllPayments = !showAllPayments; snapshot = ''; render(); }));
      root.insertBefore(group, list);
    } else root.append(action('Split with friends', openSettings));
  }
  return { render, close() { activeDialog?.close(); spendingDialog?.close(); } };
}
