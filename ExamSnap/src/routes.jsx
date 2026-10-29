import { Outlet } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { LocaleProvider } from "./i18n/index.jsx";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import ExamPage, { getStaticPaths as examStaticPaths } from "./pages/ExamPage.jsx";
import CheckerPage, { getStaticPaths as checkerStaticPaths } from "./pages/CheckerPage.jsx";
import CustomPage from "./pages/CustomPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import ModerationPage from "./pages/ModerationPage.jsx";
import SpecAdminPage from "./pages/SpecAdminPage.jsx";

// Root for one language subtree. Language lives in the URL (/hi/…) so prerendered pages, their
// canonical URLs and the hreflang pair always agree; the provider never reads storage.
function LocaleRoot({ locale }) {
  return (
    <LocaleProvider lang={locale}>
      <Head>
        {/* Helmet merges head tags across the tree; this sets <html lang> for every page. */}
        <html lang={locale} />
        {/* Fallback only — each page's <Seo> overrides title/description. */}
        <title>ExamSnap by Quick AI</title>
        <meta name="description" content="Exam-ready photo and signature in 30 seconds." />
      </Head>
      <Outlet />
    </LocaleProvider>
  );
}

// Public pages, reused by both language subtrees. `prefix` is "" for English and "/hi" for
// Hindi; the page components themselves read the locale from context.
function publicPages(locale) {
  const prefix = locale === "hi" ? "/hi" : "";
  return [
    { index: true, element: <Home />, entry: "src/pages/Home.jsx" },
    { path: "custom", element: <CustomPage />, entry: "src/pages/CustomPage.jsx" },
    { path: "privacy", element: <PrivacyPage />, entry: "src/pages/PrivacyPage.jsx" },
    {
      path: "check/:slug",
      element: <CheckerPage />,
      entry: "src/pages/CheckerPage.jsx",
      getStaticPaths: () => checkerStaticPaths(prefix),
    },
    {
      path: ":slug",
      element: <ExamPage />,
      entry: "src/pages/ExamPage.jsx",
      getStaticPaths: () => examStaticPaths(prefix),
    },
  ];
}

// Operator tools stay English-only and are never linked from the public pages.
const adminPages = [
  { path: "analytics", element: <AnalyticsPage />, entry: "src/pages/AnalyticsPage.jsx" },
  { path: "moderation", element: <ModerationPage />, entry: "src/pages/ModerationPage.jsx" },
  { path: "admin/specs", element: <SpecAdminPage />, entry: "src/pages/SpecAdminPage.jsx" },
];

// react-router route objects consumed by vite-react-ssg. The ':slug' routes carry getStaticPaths
// so every exam page prerenders to its own static HTML file in both languages.
export const routes = [
  {
    path: "/",
    element: <LocaleRoot locale="en" />,
    children: [{ element: <Layout />, children: [...publicPages("en"), ...adminPages] }],
  },
  {
    path: "/hi",
    element: <LocaleRoot locale="hi" />,
    children: [{ element: <Layout />, children: publicPages("hi") }],
  },
];
