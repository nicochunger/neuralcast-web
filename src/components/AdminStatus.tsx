import type { ReactNode } from "react";

export type AdminStatusTone = "neutral" | "running" | "success" | "error" | "warning";

export function adminJobTone(status: string): AdminStatusTone {
  switch (status.toLowerCase()) {
    case "accepted": case "running": case "preparing": case "submitted": return "running";
    case "succeeded": case "processed": return "success";
    case "failed": return "error";
    default: return "neutral";
  }
}

export function AdminStatusBadge({ tone = "neutral", children }: { tone?: AdminStatusTone; children: ReactNode }) {
  return <span className="adminStateBadge" data-tone={tone}>{children}</span>;
}

export function AdminStatusNotice({ tone = "neutral", children }: { tone?: AdminStatusTone; children: ReactNode }) {
  return <div className="adminStateNotice" data-tone={tone} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
