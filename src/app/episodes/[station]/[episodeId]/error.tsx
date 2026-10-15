"use client";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return <div className="appShell"><SiteHeader /><main><p role="alert">{t("episodes.unavailable")}</p><button onClick={reset}>{t("episodes.retry")}</button><Link href="/episodes">{t("episodes.back")}</Link></main></div>;
}
