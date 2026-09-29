"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

export function JourneyDialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current; dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="j-dialog" aria-labelledby="journey-dialog-title" onCancel={close}>
    <header><h2 id="journey-dialog-title">{title}</h2><button className="j-icon-button" type="button" aria-label="Close dialog" onClick={close}><Icon name="close" /></button></header>
    <div className="j-dialog-body">{children}</div>
  </dialog>;
}
