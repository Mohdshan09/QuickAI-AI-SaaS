import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getExamBySlug, getListedExams } from "../specs/loadSpecs.js";
import SpecTable, { SpecWarning } from "../components/SpecTable.jsx";
import OfficialSourceBadge from "../components/OfficialSourceBadge.jsx";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import ExamDiscussion from "../components/ExamDiscussion.jsx";
import Seo from "../components/Seo.jsx";
import { siteUrl } from "../lib/site.js";
import { track, EVENTS } from "../lib/analytics.js";
import { useLocalePath, useT } from "../i18n/index.jsx";
import { saveRecentExam } from "../lib/recentExams.js";

// One indexable SEO page per exam (spec §FR-23/24). Prerendered to static HTML via
// getStaticPaths below, so crawlers see the spec table and copy — not an empty root div.
export default function ExamPage() {
  const t = useT();
  const lp = useLocalePath();
  const { slug } = useParams();
  const exam = getExamBySlug(slug);

  useEffect(() => {
    if (exam) {
      track(EVENTS.EXAM_SELECTED, { exam: exam.slug });
      saveRecentExam({ key: `exam:${exam.slug}`, kind: "exam", slug: exam.slug, name: exam.name, organization: exam.organization });
    }
  }, [exam]);

  if (!exam) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600">{t("home.noResults")}</p>
        <Link to={lp("/")} className="mt-4 inline-block text-blue-600 hover:underline">
          ← {t("brand")}
        </Link>
      </div>
    );
  }

  const dims = exam.processableDocuments
    .filter((d) => d.dimensionSpecified)
    .map((d) => `${d.width}×${d.height}px`);
  const title = t("seo.exam.title", {
    name: exam.name,
    dims: dims.length ? ` (${dims.join(", ")})` : "",
  });
  const description = t("seo.exam.desc", { name: exam.name });
  // Breadcrumbs give Google the site hierarchy for this exam page (home → exam).
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ExamSnap", item: siteUrl(lp("/")) },
      { "@type": "ListItem", position: 2, name: exam.name, item: siteUrl(lp(`/${exam.slug}`)) },
    ],
  };

  return (
    <div>
      <Seo
        path={`/${exam.slug}`}
        title={title}
        description={description}
        jsonLd={breadcrumb}
      />

      <nav className="text-sm text-slate-400 mb-3">
        <Link to={lp("/")} className="hover:underline">
          {t("brand")}
        </Link>{" "}
        / {exam.name}
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">
        {exam.name} — {t("tagline")}
      </h1>
      {exam.posts && <p className="mt-1 text-sm text-slate-500">{exam.posts}</p>}
      <Link to={lp(`/check/${exam.slug}`)} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
        {t("checker.haveFile")}
      </Link>

      {/* Phones put the tool first, so repeat the trust warning above it. */}
      {!exam.verified && (
        <SpecWarning className="mt-4 rounded-xl border border-amber-200 sm:hidden" />
      )}

      {/* Two columns on desktop: specs on the left, the tool on the right. On a phone the tool
          comes first so the upload is never buried under four spec cards. */}
      <div className="mt-5 grid gap-6 lg:grid-cols-5 items-start">
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-2 lg:sticky lg:top-20">
          <SpecTable exam={exam} />
          <div className="mt-4">
            <OfficialSourceBadge exam={exam} />
          </div>
        </div>
        <div className="order-1 min-w-0 lg:order-2 lg:col-span-3">
          <ClientToolFlow exam={exam} allowOverride={false} />
        </div>
      </div>
      <ExamDiscussion examRef={exam.slug} examName={exam.name} />
    </div>
  );
}

// vite-react-ssg: enumerate one static route per exam so each page prerenders to HTML.
// `prefix` is "" for English and "/hi" for Hindi.
export function getStaticPaths(prefix = "") {
  return getListedExams().map((e) => `${prefix}/${e.slug}`);
}
