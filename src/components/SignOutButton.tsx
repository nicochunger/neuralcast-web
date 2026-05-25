"use client";

import { signOut } from "next-auth/react";
import { useI18n } from "@/lib/i18n";

export function SignOutButton() {
  const { t } = useI18n();

  return (
    <button
      className="headerContextButton"
      type="button"
      onClick={() => {
        void signOut({ callbackUrl: "/" });
      }}
    >
      {t("auth.signOut")}
    </button>
  );
}
