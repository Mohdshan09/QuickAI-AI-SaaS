import React from "react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Camera,
  BadgeCheck,
  PenLine,
  CheckCircle2,
} from "lucide-react";

// Landing-page section introducing ExamSnap (a separate app served under /examsnap/).
// The CTA is a real anchor so it does a full navigation through the Vercel rewrite — not a
// react-router navigate(), which would stay inside the QuickAI SPA.
const features = [
  { Icon: Camera, label: "Photo + signature, guided" },
  { Icon: BadgeCheck, label: "Guaranteed to pass validation" },
  { Icon: ShieldCheck, label: "100% private — on your device" },
  { Icon: PenLine, label: "Exam presets — no specs to memorise" },
];

const checks = ["350 × 450 px", "20–50 KB", "JPEG · white background"];

const ExamSnapSection = () => {
  return (
    <section className="px-4 sm:px-20 xl:px-32 my-24">
      <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-[#f6f9ff] to-[#faf5ff] shadow-lg">
        {/* soft decorative glows */}
        <div className="pointer-events-none absolute -top-20 -right-16 w-60 h-60 rounded-full bg-[#3c81f6]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-60 h-60 rounded-full bg-[#9234EA]/10 blur-3xl" />

        <div className="relative grid lg:grid-cols-2 gap-10 items-center p-8 sm:p-12">
          {/* Left — copy */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold px-3 py-1 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" /> New
            </span>

            <h2 className="mt-4 text-slate-800 text-3xl sm:text-[42px] font-semibold leading-tight">
              Introducing{" "}
              <span className="bg-gradient-to-r from-[#3c81f6] to-[#9234EA] bg-clip-text text-transparent">
                ExamSnap
              </span>
            </h2>

            <p className="mt-3 text-gray-500 max-w-md">
              Exam-ready photo &amp; signature in 30 seconds. Pick your government exam, upload a
              photo, and download a file that’s guaranteed to fit — the exact pixels, KB and format
              the form needs. Everything runs on your device.
            </p>

            <ul className="mt-6 grid sm:grid-cols-2 gap-3">
              {features.map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-100">
                    <Icon className="w-4 h-4 text-primary" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <a
              href="https://quick-ai-frontend-zeta.vercel.app/examsnap/"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3c81f6] to-[#9234EA] px-7 py-3 font-bold text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition"
            >
              Open ExamSnap <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Right — mock preview card */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-2xl bg-white shadow-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">SSC CGL</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                </span>
              </div>

              <div className="mt-4 flex gap-4">
                {/* passport-style photo placeholder */}
                <div className="flex h-28 w-[84px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 border border-gray-200">
                  <Camera className="w-7 h-7 text-slate-400" />
                </div>

                <ul className="flex-1 space-y-2">
                  {checks.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <span>ssc-cgl_photo.jpg</span>
                <span className="font-medium text-slate-700">48 KB</span>
              </div>

              <div className="mt-3 w-full rounded-lg bg-gradient-to-r from-[#3c81f6] to-[#9234EA] py-2.5 text-center text-sm font-bold text-white">
                Download
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExamSnapSection;
