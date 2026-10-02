import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { BarChart3, Users, CalendarDays, Eye } from "lucide-react";
import { API_BASE } from "../lib/apiClient.js";
import { isAdminBrowser, setAdminBrowser } from "../lib/admin.js";

// Owner-only analytics: total distinct visitors (excluding the owner's own browser). Not real
// auth — a simple email gate (checked server-side) flags this browser as the owner's. noindex.
export default function AnalyticsPage() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setAuthed(isAdminBrowser());
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch(API_BASE + "analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStats)
      .catch(() => setError("Couldn't load analytics. Is the backend deployed?"));
  }, [authed]);

  const login = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch(API_BASE + "admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) {
        setAdminBrowser(true);
        setAuthed(true);
      } else if (r.status === 401) {
        setError("That email isn't the admin.");
      } else {
        // 404/500/etc — the function isn't reachable here.
        setError("Analytics backend not reachable (status " + r.status + "). Deploy the app, or run it with `vercel dev` locally.");
      }
    } catch {
      setError("Couldn't reach the analytics backend. The API only runs on a Vercel deploy (or `vercel dev`), not plain `npm run dev`.");
    }
  };

  const signOut = () => {
    setAdminBrowser(false);
    setAuthed(false);
    setStats(null);
  };

  return (
    <>
      <Head>
        <title>Analytics — ExamSnap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {!authed ? (
        // Login: a single centered card.
        <div className="flex min-h-[60vh] items-center justify-center">
          <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <BarChart3 className="h-6 w-6 text-blue-600" aria-hidden />
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">ExamSnap Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">Enter the admin email to view visitor stats.</p>

            <label className="mt-5 block text-left text-sm">
              <span className="mb-1 block text-slate-600">Admin email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            {error && <p className="mt-2 text-left text-sm text-red-600">{error}</p>}
            <button type="submit" className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700">
              View analytics
            </button>
            <p className="mt-3 text-xs text-slate-400">
              Flags this browser as the owner's so your own visits aren't counted.
            </p>
          </form>
        </div>
      ) : (
        // Dashboard: centered column.
        <div className="mx-auto max-w-3xl">
          <nav className="text-sm text-slate-400 mb-3">
            <Link to="/" className="hover:underline">ExamSnap</Link> / Analytics
          </nav>
          <header className="text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-slate-900">
              <BarChart3 className="w-6 h-6 text-blue-600" aria-hidden />
              Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-500">Visitors so far — your own admin visits are excluded.</p>
          </header>

          {error && <p className="mt-5 text-center text-sm text-red-600">{error}</p>}
          {!stats && !error && <p className="mt-10 text-center text-slate-500">Loading…</p>}

          {stats && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat icon={Users} label="Total users" value={stats.totalUsers} accent="text-blue-600" />
              <Stat icon={CalendarDays} label="Users today" value={stats.todayUsers} accent="text-green-600" />
              <Stat icon={Eye} label="Total visits" value={stats.totalVisits} accent="text-slate-700" />
            </div>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            "Users" counts distinct browsers (anonymous id), excluding your admin browser.
          </p>
          <div className="mt-4 text-center">
            <button type="button" onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
              Sign out of admin on this browser
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, accent = "text-slate-900" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        {label}
      </p>
      <p className={`mt-2 text-4xl font-bold tabular-nums ${accent}`}>{value ?? "—"}</p>
    </div>
  );
}
