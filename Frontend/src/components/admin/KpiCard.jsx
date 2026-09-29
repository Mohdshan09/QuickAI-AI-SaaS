import { Card } from "./ui";

// A single stat tile. `sub` lines render as small muted key/value rows.
const KpiCard = ({ label, value, accent = "text-slate-800", Icon, sub = [] }) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {Icon && <Icon className="w-4 h-4 text-gray-300" />}
    </div>
    <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    {sub.length > 0 && (
      <div className="mt-3 space-y-1">
        {sub.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs text-gray-500">
            <span>{k}</span>
            <span className="font-medium text-slate-600">{v}</span>
          </div>
        ))}
      </div>
    )}
  </Card>
);

export default KpiCard;
