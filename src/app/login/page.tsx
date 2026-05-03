import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "@/components/LoginForm";
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

        <section className="authCard">
          <p className="sectionEyebrow">Admin access</p>
          <h2>Sign in to manage NeuralCast</h2>
          <p className="authLead">
            This private area will be used for live controls like skipping songs and triggering host snippets.
          </p>
          <div className="authNotice">
            <p>Admin login is not configured yet.</p>
            <p>Add `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` in Vercel and your local env file.</p>
          </div>
        </section>
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

      <section className="authCard">
        <p className="sectionEyebrow">Admin access</p>
        <h2>Sign in to manage NeuralCast</h2>
        <p className="authLead">
          This private area will be used for live controls like skipping songs and triggering host snippets.
        </p>
        <LoginForm callbackUrl={destination} />
      </section>
    </main>
  );
}
