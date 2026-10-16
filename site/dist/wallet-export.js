import { expenseCSV } from './wallet-model.js';
export function downloadExpenseCSV(wallet) {
  const content = expenseCSV(wallet), filename = 'trip-expenses.csv';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = filename; link.hidden = true;
  try { document.body.append(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
  return { filename, content };
}
