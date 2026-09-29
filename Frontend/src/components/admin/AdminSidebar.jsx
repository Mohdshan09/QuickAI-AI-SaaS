import { useClerk, useUser } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  Activity,
  Users,
  ListChecks,
  Boxes,
  Cpu,
  TriangleAlert,
  DollarSign,
  CreditCard,
  ScrollText,
  Settings,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { prettyLabel } from "../../lib/adminApi";

// Enabled in Phase 1 (read-only analytics).
const navItems = [
  { to: "/admin", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/admin/usage", label: "Usage Overview", Icon: Activity },
  { to: "/admin/users", label: "Users", Icon: Users },
  { to: "/admin/requests", label: "AI Requests", Icon: ListChecks },
  { to: "/admin/services", label: "Services", Icon: Boxes },
  { to: "/admin/models", label: "Models", Icon: Cpu },
  { to: "/admin/errors", label: "Errors", Icon: TriangleAlert },
  { to: "/admin/costs", label: "Costs", Icon: DollarSign },
];

// Reserved for later phases — shown disabled so the roadmap is visible.
const deferredItems = [
  { label: "Credits", Icon: CreditCard },
  { label: "Audit Logs", Icon: ScrollText },
  { label: "Settings", Icon: Settings },
];

const AdminSidebar = ({ sidebar, setSidebar }) => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const role = user?.publicMetadata?.role;

  const linkClass = ({ isActive }) =>
    `px-3.5 py-2.5 flex items-center gap-3 rounded text-sm ${
      isActive ? "bg-gradient-to-r from-[#3c81f6] to-[#9234EA] text-white" : "text-slate-600"
    }`;
  const iconClass = (isActive) => `w-4 h-4 ${isActive ? "text-white" : ""}`;

  return (
    <div
      className={`w-60 bg-white border-r border-gray-200 flex flex-col justify-between max-sm:absolute top-14 bottom-0 z-20
        ${sidebar ? "translate-x-0" : "max-sm:translate-x-full"} transition-all duration-300 ease-in-out`}
    >
      <div className="my-6 w-full px-3">
        <div className="px-3.5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin</p>
          {role && <p className="text-xs text-gray-400 mt-0.5">{prettyLabel(role)}</p>}
        </div>

        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setSidebar?.(false)} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon className={iconClass(isActive)} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        <p className="px-3.5 mt-4 mb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
          Coming soon
        </p>
        {deferredItems.map(({ label, Icon }) => (
          <div
            key={label}
            className="px-3.5 py-2.5 flex items-center gap-3 rounded text-sm text-gray-300 cursor-not-allowed"
            title="Available in a later phase"
          >
            <Icon className="w-4 h-4" />
            {label}
          </div>
        ))}
      </div>

      <div className="w-full border-t border-gray-200 p-4 px-5 flex items-center justify-between">
        <NavLink to="/ai" className="flex items-center gap-2 text-sm text-gray-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" />
          Back to app
        </NavLink>
        <LogOut
          className="w-4.5 h-4 text-gray-400 hover:text-gray-700 transition cursor-pointer"
          onClick={() => signOut()}
        />
      </div>
    </div>
  );
};

export default AdminSidebar;
