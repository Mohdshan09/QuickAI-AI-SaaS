import { Head } from "vite-react-ssg";
import { getExams } from "../specs/loadSpecs.js";
import ExamPicker from "../components/ExamPicker.jsx";
import ExamDropdown from "../components/ExamDropdown.jsx";
import { useT } from "../i18n/index.jsx";

export default function Home() {
  const t = useT();
  const exams = getExams();

  return (
    <div>
      <Head>
        <title>ExamSnap by Quick AI — Exam photo & signature resizer</title>
        <meta
          name="description"
          content="Pick your government exam, upload a photo, and download a photo or signature guaranteed to meet the exact size and format. Free, private, works on your phone."
        />
        <link rel="canonical" href="https://quickai.com/examsnap/" />
      </Head>

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

      <div className="mt-8">
        <ExamPicker exams={exams} />
      </div>
    </div>
  );
}
