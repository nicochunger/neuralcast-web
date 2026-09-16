"use client";

import { signOut } from "next-auth/react";
import { useI18n } from "@/lib/i18n";

export function SignOutButton({ label }: { label?: string }) {
  const { t } = useI18n();

  return (
    <button
      className="headerContextButton"
      type="button"
      onClick={() => {
        void signOut({ callbackUrl: "/" });
      }}
    >
      {label ?? t("auth.signOut")}
    </button>
  );
}
