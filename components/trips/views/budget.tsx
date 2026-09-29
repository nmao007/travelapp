import Link from "next/link";
import { formatDate, formatMoney, expenseCategories } from "@/lib/domain";
import { TripSection } from "@/components/trips/trip-section";
import { ExpenseForm, RemoveItem } from "@/components/trips/workspace-forms";
import { Panel, Empty } from "@/components/trips/workspace-ui";

import type { Trip, Expense } from "@/lib/domain";
import { ResponsiveComposer } from "@/components/trips/responsive-composer";

export function BudgetView({ trip, expenses, showAdd = false, basePath }: { trip: Trip; expenses: Expense[]; showAdd?: boolean; basePath?: string }) {
  const id = trip.id;
  const path = basePath ?? `/trip/${id}`;
  const spent = expenses.reduce((sum, expense) => sum + expense.amount_minor, 0);
  const remaining = trip.budget_minor === null ? null : trip.budget_minor - spent;
  return <TripSection trip={trip} basePath={basePath} active="/budget" title="Keep spending in view" description={`Log costs before and during your trip. Every amount is recorded in ${trip.currency}.`}>
    <div className="mb-5 md:hidden"><Panel><div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-500 dark:text-slate-400">Spent</p><p className="mt-2 break-words text-xl font-semibold">{formatMoney(spent, trip.currency)}</p></div><div><p className="text-xs text-slate-500 dark:text-slate-400">{remaining !== null && remaining < 0 ? "Over budget" : "Remaining"}</p><p className="mt-2 break-words text-xl font-semibold">{remaining === null ? "Not set" : formatMoney(Math.abs(remaining), trip.currency)}</p></div></div><Link href={`${path}/settings`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-forest dark:text-emerald-300">{trip.budget_minor === null ? "Set a trip budget" : `${formatMoney(trip.budget_minor, trip.currency)} budget · Edit`} →</Link></Panel></div>
    <div className="mb-6 hidden gap-4 md:grid md:grid-cols-3">
      <Panel title="Spent"><p className="break-words text-3xl font-semibold">{formatMoney(spent, trip.currency)}</p><p className="mt-2 text-xs text-slate-500">{expenses.length} recorded expenses</p></Panel>
      <Panel title="Trip budget"><p className="break-words text-3xl font-semibold">{trip.budget_minor === null ? "Not set" : formatMoney(trip.budget_minor, trip.currency)}</p><Link href={`${path}/settings`} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-forest dark:text-emerald-300">Set or edit budget →</Link></Panel>
      <Panel title={remaining !== null && remaining < 0 ? "Over budget" : "Remaining"}><p className={`break-words text-3xl font-semibold ${remaining !== null && remaining < 0 ? "text-red-700 dark:text-red-300" : ""}`}>{remaining === null ? "—" : formatMoney(Math.abs(remaining), trip.currency)}</p><p className="mt-2 text-xs text-slate-500">{remaining === null ? "Set a budget to see what’s left" : "Based on recorded expenses"}</p></Panel>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {expenses.length > 0 && <Panel title="By category"><div className="space-y-3">{expenseCategories.map((category) => ({ category, amount: expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount_minor, 0) })).filter((entry) => entry.amount > 0).map(({ category, amount }) => <div key={category}><div className="flex justify-between gap-3 text-sm"><span>{category}</span><span>{formatMoney(amount, trip.currency)}</span></div><div className="mt-2 h-1.5 rounded-full bg-mint dark:bg-slate-800"><div className="h-full rounded-full bg-forest dark:bg-emerald-400" style={{ width: `${amount / spent * 100}%` }} /></div></div>)}</div></Panel>}
        {!expenses.length && <Empty title="No expenses recorded yet">Add bookings you’ve paid for or a quick cost as you go. Your totals will update here.</Empty>}
        {[...expenses].reverse().map((expense) => <Panel key={expense.id}>
          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{expense.category} · {formatDate(expense.date)}</p><h3 className="mt-1 break-words font-semibold">{expense.title}</h3></div><p className="shrink-0 font-semibold">{formatMoney(expense.amount_minor, trip.currency)}</p></div>
          {expense.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-500 dark:text-slate-400">{expense.notes}</p>}
          <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="min-h-11 py-3 text-sm font-medium">Edit expense</summary><div className="mt-4 space-y-6"><ExpenseForm trip={trip} expense={expense} /><RemoveItem tripId={id} id={expense.id} table="expenses" /></div></details>
        </Panel>)}
      </div>
      <div className="order-first lg:order-last lg:sticky lg:top-6"><Panel><ResponsiveComposer label="＋ Add expense" initiallyOpen={showAdd || !expenses.length}><ExpenseForm trip={trip} /></ResponsiveComposer></Panel></div>
    </div>
  </TripSection>;
}
