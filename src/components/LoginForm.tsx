"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

interface LoginFormProps {
  callbackUrl: string;
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    const result = await signIn("credentials", {
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
      callbackUrl,
      redirect: false
    });

    setIsPending(false);

    if (!result) {
      setError(t("auth.error"));
      return;
    }

    if (result.error) {
      setError(t("auth.error"));
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="authForm" onSubmit={handleSubmit}>
      <label className="authField">
        <span>{t("auth.email")}</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="authField">
        <span>{t("auth.password")}</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="authError">{error}</p> : null}
      <button className="authSubmitButton" type="submit" disabled={isPending}>
        {isPending ? t("auth.signingIn") : t("auth.signIn")}
      </button>
    </form>
  );
}
