"use client";
import { useEffect, useState, type ReactNode } from "react";

export function ResponsiveComposer({ label, initiallyOpen = false, children }: { label: string; initiallyOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setOpen(media.matches || initiallyOpen);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [initiallyOpen]);
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary className="min-h-11 text-base font-semibold">{label}</summary><div className="mt-4">{children}</div></details>;
}
