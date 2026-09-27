import { scoreColor } from "../../lib/careerApi";

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>{children}</div>
);

export const ScoreRing = ({ score, size = 112 }) => {
  const c = scoreColor(score);
  const stroke = size >= 100 ? 10 : 8;
  const r = (size - stroke * 2) / 2 + stroke / 2;
  const vb = 120;
  const rv = (r / size) * vb;
  const circ = 2 * Math.PI * rv;
  const pct = score == null ? 0 : score / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={rv} fill="none" stroke="#F1F5F9" strokeWidth={(stroke / size) * vb} />
        <circle
          cx="60"
          cy="60"
          r={rv}
          fill="none"
          stroke={c.ring}
          strokeWidth={(stroke / size) * vb}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold ${c.text}`} style={{ fontSize: size * 0.24 }}>
          {score == null ? "—" : score}
        </span>
        <span className="text-[10px] text-gray-400">/ 100</span>
      </div>
    </div>
  );
};

export const FactorBar = ({ label, value, note }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="text-gray-500">{value}%</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#226bff] to-[#65adff]"
        style={{ width: `${value}%` }}
      />
    </div>
    {note && <p className="text-xs text-gray-500 mt-1.5">{note}</p>}
  </div>
);
