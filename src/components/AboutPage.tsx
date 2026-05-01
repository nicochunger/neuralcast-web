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
          <p className="sectionEyebrow">{t("about.eyebrow")}</p>
          <h2>{t("about.title")}</h2>
          <p className="aboutLead">{t("about.lead")}</p>
          <div className="aboutHeroActions">
            <Link href="/" className="aboutPrimaryLink">
              {t("about.cta.listen")}
            </Link>
            <a href="#how-it-works" className="aboutSecondaryLink">
              {t("about.cta.how")}
            </a>
          </div>
        </div>
      </section>

      <section className="aboutBand">
        <div className="aboutSectionHeading">
          <p className="sectionEyebrow">{t("about.philosophy.eyebrow")}</p>
          <h3>{t("about.philosophy.title")}</h3>
        </div>
        <div className="aboutStoryText">
          <p>{t("about.philosophy.card1.body")}</p>
          <p>{t("about.philosophy.card2.body")}</p>
          <p>{t("about.philosophy.card3.body")}</p>
        </div>
      </section>

      <section className="aboutBand aboutNarrativeBand">
        <div className="aboutNarrativeBlock">
          <p className="sectionEyebrow">{t("about.why.eyebrow")}</p>
          <h3>{t("about.why.title")}</h3>
          <p>{t("about.why.body1")}</p>
          <p>{t("about.why.body2")}</p>
        </div>
      </section>

      <section className="aboutBand" id="how-it-works">
        <div className="aboutSectionHeading">
          <p className="sectionEyebrow">{t("about.how.eyebrow")}</p>
          <h3>{t("about.how.title")}</h3>
        </div>
        <div className="aboutCompactGrid">
          <article className="aboutStep">
            <strong>{t("about.how.step1.title")}</strong>
            <p>{t("about.how.step1.body")}</p>
          </article>
          <article className="aboutStep">
            <strong>{t("about.how.step2.title")}</strong>
            <p>{t("about.how.step2.body")}</p>
          </article>
        </div>
        <p className="aboutHostNote">
          <strong>{t("about.how.step3.title")}</strong> {t("about.how.step3.body")}
        </p>
      </section>

      <section className="aboutBand aboutClosingBand">
        <div className="aboutSectionHeading">
          <p className="sectionEyebrow">{t("about.closing.eyebrow")}</p>
          <h3>{t("about.closing.title")}</h3>
          <p className="aboutClosingText">{t("about.closing.body")}</p>
        </div>
      </section>
    </main>
  );
}
