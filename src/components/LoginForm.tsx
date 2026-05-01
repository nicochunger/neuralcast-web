"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  callbackUrl: string;
}

const DEFAULT_ERROR_MESSAGE = "We couldn't sign you in with those credentials.";

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
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
      setError(DEFAULT_ERROR_MESSAGE);
      return;
    }

    if (result.error) {
      setError(DEFAULT_ERROR_MESSAGE);
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="authForm" onSubmit={handleSubmit}>
      <label className="authField">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="authField">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="authError">{error}</p> : null}
      <button className="authSubmitButton" type="submit" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
