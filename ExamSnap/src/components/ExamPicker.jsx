import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search, Settings2 } from "lucide-react";
import { useT } from "../i18n/index.jsx";

// Searchable exam list, popular exams first (spec §FR-1). Pure presentation over the
// resolved exam list passed in; selecting an exam navigates to its SEO page.
export default function ExamPicker({ exams }) {
  const t = useT();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return exams;
    return exams.filter((e) =>
      [e.name, e.organization].join(" ").toLowerCase().includes(needle),
    );
  }, [q, exams]);

  const popular = filtered.filter((e) => e.popular);
  const rest = filtered.filter((e) => !e.popular);

  return (
    <div>
      <label className="sr-only" htmlFor="exam-search">
        {t("home.searchPlaceholder")}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          aria-hidden
        />
        <input
          id="exam-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("home.searchPlaceholder")}
          className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
        />
      </div>

      {filtered.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">{t("home.noResults")}</p>
      )}

      {popular.length > 0 && (
        <Section title={t("home.popular")} exams={popular} />
      )}
      {rest.length > 0 && <Section title={t("home.all")} exams={rest} />}

      <Link
        to="/custom"
        className="mt-5 flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 hover:border-blue-400"
      >
        <Settings2 className="w-5 h-5 text-slate-500 shrink-0" aria-hidden />
        <span>
          <span className="font-medium text-slate-800">{t("home.custom")}</span>
          <span className="block text-sm text-slate-500">{t("home.customDesc")}</span>
        </span>
      </Link>
    </div>
  );
}

function Section({ title, exams }) {
  return (
    <section className="mt-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {exams.map((e) => (
          <li key={e.id}>
            <Link
              to={`/${e.slug}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-400"
            >
              <span>
                <span className="font-medium text-slate-900">{e.name}</span>
                <span className="block text-xs text-slate-400">{e.organization}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
