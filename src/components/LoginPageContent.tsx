"use client";

import { LoginForm } from "@/components/LoginForm";
import { useI18n } from "@/lib/i18n";

interface LoginPageContentProps {
  callbackUrl: string;
  isConfigured: boolean;
}

export function LoginPageContent({ callbackUrl, isConfigured }: LoginPageContentProps) {
  const { t } = useI18n();

  return (
    <section className="authCard">
      <p className="sectionEyebrow">{t("auth.eyebrow")}</p>
      <h2>{t("auth.title")}</h2>
      <p className="authLead">{t("auth.lead")}</p>
      {isConfigured ? (
        <LoginForm callbackUrl={callbackUrl} />
      ) : (
        <div className="authNotice">
          <p>{t("auth.notConfigured")}</p>
          <p>{t("auth.configureEnv")}</p>
        </div>
      )}
    </section>
  );
}
