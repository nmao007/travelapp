import { packingCategories } from "@/lib/domain";
import { TripSection } from "@/components/trips/trip-section";
import { PackingForm, RemoveItem } from "@/components/trips/workspace-forms";
import { Panel, Empty } from "@/components/trips/workspace-ui";
import { ActionForm } from "@/components/trips/action-form";
import { togglePackingItem } from "@/app/actions/workspace";

import type { Trip, PackingItem } from "@/lib/domain";
import { ResponsiveComposer } from "@/components/trips/responsive-composer";

export function PackingView({ trip, items, basePath }: { trip: Trip; items: PackingItem[]; basePath?: string }) {
  const id = trip.id;
  const packed = items.filter((item) => item.packed).length;
  return <TripSection trip={trip} basePath={basePath} active="/packing" title="Leave with everything you need" description="Build your list, then check items off as they go into your bag.">
    <div className="mb-6"><Panel><div className="flex justify-between gap-4"><p className="font-semibold">{packed} of {items.length} packed</p><p className="text-sm text-slate-500">{items.length ? Math.round(packed / items.length * 100) : 0}%</p></div><progress aria-label="Packing progress" value={packed} max={items.length || 1} className="mt-4 h-2 w-full accent-forest" /></Panel></div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {!items.length && <Empty title="Your bag starts here">Add the essentials first, then the little things that make your trip more comfortable.</Empty>}
        {packingCategories.filter((category) => items.some((item) => item.category === category)).map((category) => <Panel key={category} title={category}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">{items.filter((item) => item.category === category).map((item) => <li key={item.id} className="py-3 first:pt-0 last:pb-0">
            <ActionForm action={togglePackingItem} operation="togglePackingItem" label={<><span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${item.packed ? "border-forest bg-forest text-white" : "border-slate-300 dark:border-slate-600"}`}>{item.packed ? "✓" : ""}</span><span className={`break-words text-left ${item.packed ? "text-slate-500 line-through" : ""}`}>{item.name}</span></>} pressed={item.packed} buttonLabel={`${item.packed ? "Unpack" : "Pack"} ${item.name}`} pendingLabel="Updating…" compact quiet buttonClass="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-60">
              <input type="hidden" name="tripId" value={id} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="packed" value={String(!item.packed)} />
            </ActionForm>
            <details className="ml-2"><summary className="min-h-11 py-3 text-xs text-slate-500 dark:text-slate-400">Edit item</summary><div className="mt-2 space-y-5"><PackingForm tripId={id} item={item} /><RemoveItem tripId={id} id={item.id} table="packing_items" /></div></details>
          </li>)}</ul>
        </Panel>)}
      </div>
      <div className="order-first lg:order-last lg:sticky lg:top-6"><Panel><ResponsiveComposer label="＋ Add item" initiallyOpen={!items.length}><PackingForm tripId={id} /></ResponsiveComposer></Panel></div>
    </div>
  </TripSection>;
}
