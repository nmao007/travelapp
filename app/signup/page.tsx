import { AuthPage } from "@/components/auth/auth-page";
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthPage mode="signup" next={next} />;
}
