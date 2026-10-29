import { getListedExams } from "../specs/loadSpecs.js";
import ExamPicker from "../components/ExamPicker.jsx";
import ExamDropdown from "../components/ExamDropdown.jsx";
import RecentExams from "../components/RecentExams.jsx";
import Seo from "../components/Seo.jsx";
import { siteUrl } from "../lib/site.js";
import { useLocale, useLocalePath, useT } from "../i18n/index.jsx";

export default function Home() {
  const t = useT();
  const { lang } = useLocale();
  const lp = useLocalePath();
  const exams = getListedExams();
  const homeUrl = siteUrl(lp("/"));

  // Structured data for the landing page: the site, the publisher and the free web app itself.
  // Nothing here is user- or exam-specific (crawlers see the same markup for everyone).
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "ExamSnap by Quick AI",
      url: homeUrl,
      inLanguage: lang,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Quick AI",
      url: homeUrl,
      logo: siteUrl("/favicon.svg"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "ExamSnap",
      url: homeUrl,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      inLanguage: lang,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    },
  ];

  return (
    <div>
      <Seo
        path="/"
        title={t("seo.home.title")}
        description={t("seo.home.desc")}
        jsonLd={jsonLd}
      />

      {/* Hero: intro on the left, quick-pick dropdown on the right (stacks on mobile). */}
      <div className="grid gap-6 lg:grid-cols-2 items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("tagline")}</h1>
          <p className="mt-3 text-slate-600 max-w-prose">{t("home.lead")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ExamDropdown />
        </div>
      </div>

      <RecentExams />

      <div className="mt-8">
        <ExamPicker exams={exams} />
      </div>
    </div>
  );
}
