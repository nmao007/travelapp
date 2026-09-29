"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PreviewContext } from "@/components/trips/preview-context";
import { sampleTrip, applyPreviewOperation, type PreviewStore } from "@/lib/preview";
import { isTimeZone, currencies } from "@/lib/domain";
import { OverviewView } from "@/components/trips/views/overview";
import { ItineraryView } from "@/components/trips/views/timeline";
import { BudgetView } from "@/components/trips/views/budget";
import { PackingView } from "@/components/trips/views/packing";
import { SettingsView } from "@/components/trips/views/settings";

const storageKey = "trippilot-local-preview-v1";
export function LocalPreview({ section = "" }: { section?: string }) {
  const [store, setStore] = useState<PreviewStore>(sampleTrip);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const current = useRef(store);
  const search = useSearchParams();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as PreviewStore;
        if (saved.version === 1 && Array.isArray(saved.activities) && Array.isArray(saved.expenses) && Array.isArray(saved.items) && (!saved.trip || (typeof saved.trip.title === "string" && isTimeZone(saved.trip.time_zone) && currencies.some((value) => value === saved.trip?.currency)))) {
          current.current = saved; setStore(saved);
        }
      }
    } catch { setStorageError(true); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem(storageKey, JSON.stringify(store)); }
      catch { setStorageError(true); }
    }
  }, [store, loaded]);
  async function perform(operation: string, form: FormData) {
    const result = applyPreviewOperation(current.current, operation, form, crypto.randomUUID());
    if (result.error || !result.store) return { error: result.error ?? "Unable to save sample changes." };
    current.current = result.store; setStore(result.store);
    return { success: "Saved to the local sample trip." };
  }
  function restore() { const next = sampleTrip(); current.current = next; setStore(next); }
  if (!loaded) return <p role="status" className="p-8">Loading your local sample trip…</p>;
  const props = { ...store, trip: store.trip!, basePath: "/preview" };
  return <PreviewContext.Provider value={{ perform }}>
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-xs leading-5 text-amber-900">Local preview · sample day: Sep 27, 2026 · saved only on this browser. No account or database access needed.{storageError && <p role="alert">Browser storage is unavailable. Changes last for this session only.</p>}</div>
    {!store.trip ? <main className="mx-auto max-w-lg px-6 py-20"><h1 className="text-3xl font-semibold">Sample trip deleted</h1><p className="my-5 text-slate-500">Your real trips have not been changed.</p><button className="primary-button" onClick={restore}>Start a fresh sample trip</button></main> : section === "timeline" ? <ItineraryView {...props} showAdd={search.get("add") === "1"} /> : section === "budget" ? <BudgetView {...props} showAdd={search.get("add") === "1"} /> : section === "packing" ? <PackingView {...props} /> : section === "settings" ? <SettingsView {...props} /> : <OverviewView {...props} now={new Date("2026-09-27T04:00:00Z")} />}
  </PreviewContext.Provider>;
}
