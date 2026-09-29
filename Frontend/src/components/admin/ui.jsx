// Small shared primitives for the admin module, matching the app's light theme
// (white cards, gray-200 borders, brand blue→purple gradient).

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-gray-200 rounded-xl ${className}`}>{children}</div>
);

export const SectionTitle = ({ children, right }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-slate-700">{children}</h2>
    {right}
  </div>
);

export const StatusPill = ({ status }) => {
  const ok = status === "success";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
      }`}
    >
      {ok ? "Success" : "Error"}
    </span>
  );
};

export const Badge = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
};

export const Spinner = ({ label = "Loading…" }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
    <div className="w-4 h-4 border-2 border-gray-200 border-t-[#3c81f6] rounded-full animate-spin" />
    {label}
  </div>
);

export const EmptyState = ({ children = "No data yet." }) => (
  <div className="py-12 text-center text-sm text-gray-400">{children}</div>
);

export const PageHeader = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between mb-6">
    <div>
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);
