import { useEffect, useState, useCallback } from "react";
import EasyCrop from "react-easy-crop";
import { RotateCcw, RotateCw, Crop as CropIcon } from "lucide-react";
import { useT } from "../i18n/index.jsx";

// Crop UI (spec §FR-9/10/11): aspect ratio locked to the exam spec, pinch-zoom + drag,
// 90° rotate steps plus a fine rotation slider, and a face-oval guide for photos. Reports
// the crop rectangle (natural pixels) and rotation to the parent for the engine.
export default function Cropper({ file, aspect, isPhoto, onConfirm, onCancel }) {
  const t = useT();
  const [url, setUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [areaPixels, setAreaPixels] = useState(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const onCropComplete = useCallback((_area, areaPx) => setAreaPixels(areaPx), []);
  const rotate = (delta) => setRotation((r) => (((r + delta) % 360) + 360) % 360);

  return (
    <div>
      <div className="relative w-full h-[55vh] min-h-[320px] bg-slate-900 rounded-xl overflow-hidden">
        {url && (
          <EasyCrop
            image={url}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect || 1}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        )}
        {isPhoto && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[70%] aspect-[3/4] rounded-[50%] border-2 border-white/70" />
          </div>
        )}
      </div>

      {isPhoto && (
        <p className="mt-2 text-center text-xs text-slate-500">{t("crop.faceHint")}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => rotate(-90)}
          aria-label={t("crop.rotateLeft")}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">{t("crop.rotateLeft")}</span>
        </button>
        <button
          type="button"
          onClick={() => rotate(90)}
          aria-label={t("crop.rotateRight")}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <RotateCw className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">{t("crop.rotateRight")}</span>
        </button>
        <input
          type="range"
          min={-45}
          max={45}
          value={rotation > 180 ? rotation - 360 : rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          className="flex-1"
          aria-label="Fine rotation"
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700"
        >
          {t("result.redo")}
        </button>
        <button
          type="button"
          disabled={!areaPixels}
          onClick={() => onConfirm({ cropPixels: areaPixels, rotationDeg: rotation })}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          <CropIcon className="w-4 h-4" aria-hidden />
          {t("crop.apply")}
        </button>
      </div>
    </div>
  );
}
