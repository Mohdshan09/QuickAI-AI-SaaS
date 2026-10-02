import { Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { ShieldCheck } from "lucide-react";
import { useT } from "../i18n/index.jsx";

// Privacy page (spec §10). ExamSnap now sends a little NON-image data off-device (exam names,
// spec numbers, outcomes, an anonymous ID) to improve the catalog. Images and personal data
// still never leave the device. This page states exactly what is and isn't stored.
export default function PrivacyPage() {
  const t = useT();
  return (
    <div className="max-w-prose">
      <Head>
        <title>Privacy — ExamSnap by Quick AI</title>
        <meta
          name="description"
          content="What ExamSnap stores and what it never stores. Your images and personal data never leave your device."
        />
      </Head>

      <nav className="text-sm text-slate-400 mb-3">
        <Link to="/" className="hover:underline">{t("brand")}</Link> / {t("footer.privacy")}
      </nav>

      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <ShieldCheck className="w-6 h-6 text-blue-600" aria-hidden />
        Privacy
      </h1>

      <p className="mt-4 text-slate-700">
        ExamSnap processes your photo and signature entirely on your device. <strong>Your images never
        leave your device</strong> — there is no image upload and no image is ever sent to any server.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-slate-800">What we store</h2>
      <p className="mt-2 text-slate-600">
        To learn which exams to add and verify next, and to catch wrong sizes, we store a small amount of
        non-image data when you process an unlisted exam or report an outcome:
      </p>
      <ul className="mt-2 list-disc pl-5 text-slate-600 space-y-1">
        <li>Exam names and the size/format numbers you entered</li>
        <li>Links to official notifications you choose to share</li>
        <li>Outcomes (whether a portal accepted or rejected a file) and short error text you type</li>
        <li>An anonymous ID (a random value in your browser), used only to count distinct submitters</li>
        <li>A one-way hashed form of your IP address, used only to rate-limit abuse</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-slate-800">What we never store</h2>
      <ul className="mt-2 list-disc pl-5 text-slate-600 space-y-1">
        <li>Your images (photo, signature, thumb impression, declaration)</li>
        <li>Your name, email or any account details</li>
        <li>Your raw IP address or any device identifier</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-slate-800">Your anonymous ID</h2>
      <p className="mt-2 text-slate-600">
        The anonymous ID lives only in your browser and is not linked to you. You can reset it any time by
        clearing this site's data in your browser settings.
      </p>

      <p className="mt-6 text-sm text-slate-400">
        Please don't include personal details in the optional "portal error message" field when reporting a
        rejection.
      </p>
    </div>
  );
}
