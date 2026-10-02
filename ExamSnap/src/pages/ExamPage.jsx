import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { getExamBySlug, getListedExams } from "../specs/loadSpecs.js";
import SpecTable from "../components/SpecTable.jsx";
import ClientToolFlow from "../components/ClientToolFlow.jsx";
import { track, EVENTS } from "../lib/analytics.js";
import { useT } from "../i18n/index.jsx";

// One indexable SEO page per exam (spec §FR-23/24). Prerendered to static HTML via
// getStaticPaths below, so crawlers see the spec table and copy — not an empty root div.
export default function ExamPage() {
  const t = useT();
  const { slug } = useParams();
  const exam = getExamBySlug(slug);

  useEffect(() => {
    if (exam) track(EVENTS.EXAM_SELECTED, { exam: exam.slug });
  }, [exam]);

  if (!exam) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600">{t("home.noResults")}</p>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          ← {t("brand")}
        </Link>
      </div>
    );
  }

  const dims = exam.processableDocuments
    .filter((d) => d.dimensionSpecified)
    .map((d) => `${d.width}×${d.height}px`);
  const title = `${exam.name} photo & signature size & format${
    dims.length ? ` (${dims.join(", ")})` : ""
  } — ExamSnap`;
  const description = `Resize and compress your ${exam.name} photo and signature to the exact required pixel size and KB range, free and on your phone. Validated before download.`;

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://quickai.com/examsnap/${exam.slug}`} />
      </Head>

      <nav className="text-sm text-slate-400 mb-3">
        <Link to="/" className="hover:underline">
          {t("brand")}
        </Link>{" "}
        / {exam.name}
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">
        {exam.name} — {t("tagline")}
      </h1>
      {exam.posts && <p className="mt-1 text-sm text-slate-500">{exam.posts}</p>}
      <Link to={`/check/${exam.slug}`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
        {t("checker.haveFile")}
      </Link>

      {/* Two columns on desktop: specs on the left, the tool on the right — so the page
          reads across rather than as one long scroll. Stacks on mobile. */}
      <div className="mt-5 grid gap-6 lg:grid-cols-5 items-start">
        <div className="lg:col-span-2 lg:sticky lg:top-20">
          <SpecTable exam={exam} />
        </div>
        <div className="lg:col-span-3">
          <ClientToolFlow exam={exam} allowOverride={false} />
        </div>
      </div>
    </div>
  );
}

// vite-react-ssg: enumerate one static route per exam so each page prerenders to HTML.
export function getStaticPaths() {
  return getListedExams().map((e) => `/${e.slug}`);
}
