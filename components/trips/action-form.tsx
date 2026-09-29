"use client";

import { useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/domain";
import { PreviewContext } from "@/components/trips/preview-context";

export function ActionForm({ action, operation = "", children, label, pendingLabel = "Saving…", reset = false, compact = false, quiet = false, confirm, buttonClass, buttonLabel, pressed }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  operation?: string;
  children?: ReactNode; label: ReactNode; pendingLabel?: string; reset?: boolean;
  compact?: boolean; quiet?: boolean; confirm?: string; buttonClass?: string; buttonLabel?: string;
  pressed?: boolean;
}) {
  const preview = useContext(PreviewContext);
  const [state, formAction, pending] = useActionState(preview ? (_state: ActionState, form: FormData) => preview.perform(operation, form) : action, {});
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success && reset) ref.current?.reset(); }, [state, reset]);
  return <form ref={ref} action={formAction} className={compact ? "space-y-2" : "space-y-5"}>
    {children}
    {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{state.error}</p>}
    {state.success && !quiet && <p role="status" className="rounded-xl bg-mint p-3 text-sm text-forest dark:bg-emerald-950/40 dark:text-emerald-200">{state.success}</p>}
    {confirming && <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">{confirm}</p>}
    <div className="flex flex-wrap items-center gap-3">
      {confirm && !confirming ? <button type="button" onClick={() => setConfirming(true)} className={buttonClass ?? "secondary-button"}>{label}</button> : <button type="submit" disabled={pending} aria-label={buttonLabel} aria-pressed={pressed} className={buttonClass ?? "primary-button"}>{pending ? pendingLabel : confirming ? "Confirm deletion" : label}</button>}
      {confirming && <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="secondary-button">Cancel</button>}
    </div>
  </form>;
}
