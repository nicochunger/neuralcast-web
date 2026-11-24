"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";

export function AboutPage() {
  const { t } = useI18n();

  return (
    <main className="appShell aboutShell">
      <SiteHeader />

      <section className="aboutHero">
        <div className="aboutHeroContent">
          <h1>{t("about.title")}</h1>
          <p className="aboutLead">{t("about.lead")}</p>
          <div className="aboutHeroActions">
            <Link href="/" className="aboutPrimaryLink">
              {t("about.cta.listen")}
            </Link>
          </div>
        </div>
      </section>

      <section className="aboutBand">
        <div className="aboutSectionHeading">
          <h2>{t("about.philosophy.title")}</h2>
        </div>
        <div className="aboutStoryText">
          <p>{t("about.philosophy.card1.body")}</p>
          <p>{t("about.philosophy.card2.body")}</p>
          <p>{t("about.philosophy.card3.body")}</p>
        </div>
      </section>

      <section className="aboutBand aboutNarrativeBand">
        <div className="aboutNarrativeBlock">
          <h2>{t("about.why.title")}</h2>
          <p>{t("about.why.body1")}</p>
          <p>{t("about.why.body2")}</p>
        </div>
      </section>

      <section className="aboutBand" id="how-it-works">
        <div className="aboutSectionHeading">
          <h2>{t("about.how.title")}</h2>
        </div>
        <div className="aboutCompactGrid">
          <article className="aboutStep">
            <h3>{t("about.how.step1.title")}</h3>
            <p>{t("about.how.step1.body")}</p>
          </article>
          <article className="aboutStep">
            <h3>{t("about.how.step2.title")}</h3>
            <p>{t("about.how.step2.body")}</p>
          </article>
        </div>
        <p className="aboutHostNote">
          <strong>{t("about.how.step3.title")}</strong> {t("about.how.step3.body")}
        </p>
      </section>

      <section className="aboutBand aboutClosingBand">
        <div className="aboutSectionHeading">
          <h2>{t("about.closing.title")}</h2>
          <p className="aboutClosingText">{t("about.closing.body")}</p>
        </div>
      </section>
    </main>
  );
}
