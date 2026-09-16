"use client";

import Link from "next/link";
import { adminText as t } from "@/lib/adminCopy";

interface AdminToolbarProps {
  email?: string | null;
}

export function AdminToolbar({ email }: AdminToolbarProps) {

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
