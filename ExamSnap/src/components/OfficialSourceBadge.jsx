import { BadgeCheck, ExternalLink, ShieldAlert } from "lucide-react";

/** Shows exactly where the exam rules came from and when they were last checked. */
export default function OfficialSourceBadge({ exam }) {
  const checkedOn = exam.lastVerified
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${exam.lastVerified}T00:00:00Z`))
    : null;

  if (!exam.verified || !exam.sourceUrl) {
    return (
      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" aria-hidden /> Official source not verified</p>
        <p className="mt-1">Check the current official notification before using these sizes.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" aria-label="Official source information">
      <p className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-4 w-4" aria-hidden /> Official source checked</p>
      {exam.sourcePage && <p className="mt-1 text-emerald-900">{exam.sourcePage}</p>}
      {checkedOn && <p className="mt-1 text-xs text-emerald-800">Last checked: {checkedOn}</p>}
      <a href={exam.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 font-medium text-emerald-800 underline hover:text-emerald-950">
        Open official notification <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </aside>
  );
}
