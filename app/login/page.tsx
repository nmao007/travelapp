import { AuthPage } from "@/components/auth/auth-page";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <AuthPage mode="login" next={next} confirmationError={error === "confirmation"} />;
}
