"use client";
import Link from "next/link";
export default function TripError({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6"><p className="text-sm font-medium text-forest dark:text-emerald-300">TripPilot</p><h1 className="mt-4 text-3xl font-semibold">Your trip couldn’t load</h1><p className="mt-4 leading-7 text-slate-500 dark:text-slate-400">We couldn’t retrieve your trip details. Try again in a moment.</p><div className="mt-6 flex gap-3"><button onClick={reset} className="primary-button">Try again</button><Link href="/dashboard" className="secondary-button">All trips</Link></div></main>;
}
