"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="headerContextButton"
      type="button"
      onClick={() => {
        void signOut({ callbackUrl: "/" });
      }}
    >
      Sign out
    </button>
  );
}
