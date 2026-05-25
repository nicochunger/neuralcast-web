import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginPageContent } from "@/components/LoginPageContent";
import { getAuthSession, isAdminAuthConfigured } from "@/lib/auth";

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const isConfigured = isAdminAuthConfigured();
  const { callbackUrl } = await searchParams;
  const destination = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/admin";

  if (!isConfigured) {
    return (
      <main className="appShell authShell">
        <SiteHeader />
        <LoginPageContent callbackUrl={destination} isConfigured={false} />
      </main>
    );
  }

  const session = await getAuthSession();

  if (session?.user?.isAdmin) {
    redirect(destination);
  }

  return (
    <main className="appShell authShell">
      <SiteHeader />
      <LoginPageContent callbackUrl={destination} isConfigured />
    </main>
  );
}
