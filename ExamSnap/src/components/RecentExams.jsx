import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, ChevronRight } from "lucide-react";
import { getRecentExams } from "../lib/recentExams.js";

export default function RecentExams() {
  const [items, setItems] = useState([]);
  useEffect(() => setItems(getRecentExams()), []);
  if (!items.length) return null;
  return <section className="mt-8" aria-labelledby="recent-exams"><h2 id="recent-exams" className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Clock3 className="h-4 w-4 text-slate-500" aria-hidden /> Continue where you left off</h2><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => item.kind === "custom" ? <Link key={item.key} to="/custom" state={{ preset: item.preset }} className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 hover:border-blue-400"><span><span className="font-medium text-slate-900">{item.name}</span><span className="block text-xs text-slate-500">Custom {item.preset.type} preset</span></span><ChevronRight className="h-4 w-4 text-blue-400" /></Link> : <Link key={item.key} to={`/${item.slug}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-400"><span><span className="font-medium text-slate-900">{item.name}</span><span className="block text-xs text-slate-500">{item.organization}</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></Link>)}</div></section>;
}
