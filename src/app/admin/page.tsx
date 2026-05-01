import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { getAuthSession } from "@/lib/auth";

export default async function AdminPage() {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <main className="appShell adminShell">
      <SiteHeader extraActions={<SignOutButton />} />

      <section className="adminHero">
        <div>
          <p className="sectionEyebrow">Control room</p>
          <h2>Admin dashboard</h2>
          <p className="adminLead">
            Signed in as <strong>{session.user.email}</strong>. This is the protected area where we can add live radio controls next.
          </p>
        </div>
        <Link href="/" className="adminBackLink">
          Back to radio
        </Link>
      </section>

      <section className="adminGrid" aria-label="Planned controls">
        <article className="adminPanel">
          <h3>Playback</h3>
          <p>Skip a track, interrupt the queue, or trigger a station reset from one place.</p>
          <button type="button" className="adminGhostButton" disabled>
            Skip current song
          </button>
        </article>

        <article className="adminPanel">
          <h3>AI host</h3>
          <p>Force a spoken break, inject a specific script, or queue a custom station message.</p>
          <button type="button" className="adminGhostButton" disabled>
            Trigger host snippet
          </button>
        </article>

        <article className="adminPanel">
          <h3>Station health</h3>
          <p>Expose a quick status area for stream health, backend reachability, and current automation state.</p>
          <button type="button" className="adminGhostButton" disabled>
            Add monitoring actions
          </button>
        </article>
      </section>
    </main>
  );
}
