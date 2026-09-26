import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12 dark:bg-[#111713]">
    <div className="w-full max-w-md">
      <Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5 font-bold tracking-tight text-ink dark:text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-lg text-white">✳</span>TripPilot</Link>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-[#171e19] sm:p-9">
        <p className="text-sm font-medium text-forest dark:text-emerald-300">{signup ? "Your next adventure" : "Welcome back"}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink dark:text-white">{signup ? "Make a little room for travel." : "Good to see you again."}</h1>
        <p className="mt-3 mb-7 text-sm leading-6 text-slate-500 dark:text-slate-400">{signup ? "Create an account to keep all your trip details together." : "Sign in to pick up where your plans left off."}</p>
        <AuthForm mode={mode} />
      </section>
      <p className="mt-6 text-center text-xs text-slate-400">Your trips belong to you.</p>
    </div>
  </main>;
}
