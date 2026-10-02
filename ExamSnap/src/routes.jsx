import { Outlet } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { LocaleProvider } from "./i18n/index.jsx";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import ExamPage, { getStaticPaths as examStaticPaths } from "./pages/ExamPage.jsx";
import CheckerPage, { getStaticPaths as checkerStaticPaths } from "./pages/CheckerPage.jsx";
import CustomPage from "./pages/CustomPage.jsx";

// Root wraps everything in the i18n provider (above Layout, since the header uses it).
function Root() {
  return (
    <LocaleProvider>
      {/* Default head; each page overrides the title/description (unhead: last wins). */}
      <Head>
        <title>ExamSnap by Quick AI — Exam photo & signature resizer</title>
        <meta
          name="description"
          content="Pick your government exam, upload a photo, and download a photo or signature guaranteed to meet the exact size and format. Free, private, works on your phone."
        />
      </Head>
      <Outlet />
    </LocaleProvider>
  );
}

// react-router route objects consumed by vite-react-ssg. The ':slug' route carries
// getStaticPaths so every exam page prerenders to its own static HTML file.
export const routes = [
  {
    path: "/",
    element: <Root />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Home />, entry: "src/pages/Home.jsx" },
          { path: "custom", element: <CustomPage />, entry: "src/pages/CustomPage.jsx" },
          {
            path: "check/:slug",
            element: <CheckerPage />,
            entry: "src/pages/CheckerPage.jsx",
            getStaticPaths: checkerStaticPaths,
          },
          {
            path: ":slug",
            element: <ExamPage />,
            entry: "src/pages/ExamPage.jsx",
            getStaticPaths: examStaticPaths,
          },
        ],
      },
    ],
  },
];
