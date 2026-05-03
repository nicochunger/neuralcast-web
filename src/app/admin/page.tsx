import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/AdminConsole";
import { SiteHeader } from "@/components/SiteHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { getAuthSession } from "@/lib/auth";
import { isHostAdminConfigured } from "@/lib/hostAdmin";

export default async function AdminPage() {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    redirect("/login?callbackUrl=/admin");
  }

  const hostAdminConfigured = isHostAdminConfigured();

  return (
    <main className="appShell adminShell">
      <SiteHeader extraActions={<SignOutButton />} />
      <div className="adminToolbar">
        <p className="adminSignedInText">
          Signed in as <strong>{session.user.email}</strong>.
        </p>
        <Link href="/" className="adminBackLink">
          Back to radio
        </Link>
      </div>
      <AdminConsole isHostAdminConfigured={hostAdminConfigured} />
    </main>
  );
}
