import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/AdminConsole";
import { AdminToolbar } from "@/components/AdminToolbar";
import { SiteHeader } from "@/components/SiteHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { getAuthSession } from "@/lib/auth";
import { isHostAdminConfigured } from "@/lib/hostAdmin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    redirect("/login?callbackUrl=/admin");
  }

  const hostAdminConfigured = isHostAdminConfigured();

  return (
    <main className="appShell adminShell" lang="en">
      <SiteHeader englishOnly extraActions={<SignOutButton label="Sign out" />} />
      <AdminToolbar email={session.user.email} />
      <AdminConsole isHostAdminConfigured={hostAdminConfigured} />
      {children}
    </main>
  );
}
