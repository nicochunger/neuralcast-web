import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getHostAdminJobStatus, isHostAdminConfigured } from "@/lib/hostAdmin";

interface RouteContext {
  params: Promise<{
    jobId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isHostAdminConfigured()) {
    return NextResponse.json({ error: "Host admin API is not configured." }, { status: 503 });
  }

  const { jobId } = await context.params;

  if (!jobId.trim()) {
    return NextResponse.json({ error: "Job ID is required." }, { status: 422 });
  }

  try {
    const job = await getHostAdminJobStatus(jobId);
    return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load host job status.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
