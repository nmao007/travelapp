import { signOut } from "@/app/actions/auth";

export function LogoutButton() {
  return <form action={signOut}><button type="submit" className="text-sm font-medium text-slate-500 transition hover:text-ink dark:text-slate-400 dark:hover:text-white">Sign out</button></form>;
}
