import { Camera, ImageUp } from "lucide-react";
import { useT } from "../i18n/index.jsx";

// Image input (spec §FR-5/6). Two explicit choices so existing files can always be picked:
//   • "Choose from gallery / files" — a plain file input (NO `capture`), so phones show the
//     gallery/file picker. This is what you need for a signature, which is usually already an
//     image/scan, not something you shoot live.
//   • "Take a photo" — a second input WITH `capture="environment"` for the live camera.
// A single `capture` input forces the camera on mobile and hides the gallery, which blocks
// uploading an existing signature — hence the split.
export default function Uploader({ onFile, docLabel }) {
  const t = useT();

  const pick = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center">
      <p className="font-medium text-slate-800">
        {docLabel ? `${t("upload.cta")} — ${docLabel}` : t("upload.cta")}
      </p>
      <p className="mt-1 text-sm text-slate-500">{t("upload.hint")}</p>

      <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
        {/* Gallery / files — no capture, so the picker (incl. existing images) opens. */}
        <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white cursor-pointer hover:bg-blue-700">
          <ImageUp className="w-5 h-5" aria-hidden />
          {t("upload.gallery")}
          <input type="file" accept="image/*,.heic,.heif" onChange={pick} className="sr-only" />
        </label>

        {/* Camera — capture hints the live camera on phones. */}
        <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
          <Camera className="w-5 h-5" aria-hidden />
          {t("upload.camera")}
          <input
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            onChange={pick}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}
