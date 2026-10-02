import { ArrowRight } from "lucide-react";
import { useT } from "../i18n/index.jsx";

// Lightweight cross-promotion to Quick AI shown after a successful download. A plain anchor
// — it loads nothing extra, keeping ExamSnap's bundle lean (the whole point of the separate
// app). Points at the main site on the same domain.
export default function CrossPromo() {
  const t = useT();
  return (
    <a
      href="/"
      className="mt-4 inline-flex items-center justify-center gap-1 text-sm text-blue-700 hover:underline"
    >
      {t("crossPromo")}
      <ArrowRight className="w-4 h-4" aria-hidden />
    </a>
  );
}
