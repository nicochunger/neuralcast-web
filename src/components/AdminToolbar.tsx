"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface AdminToolbarProps {
  email?: string | null;
}

export function AdminToolbar({ email }: AdminToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="adminToolbar">
      <p className="adminSignedInText">
        {t("admin.signedInAs", { email: email ?? "" })}
      </p>
      <Link href="/" className="adminBackLink">
        {t("nav.backToRadio")}
      </Link>
    </div>
  );
}
