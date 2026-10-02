import { useClerk, useUser } from "@clerk/clerk-react";
import {
  Hash,
  House,
  SquarePen,
  Image,
  Eraser,
  Scissors,
  FileText,
  Users,
  LogOut,
  Briefcase,
  FileUser,
  Camera,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEntitlements } from "../lib/useEntitlements.js";

const Sidebar = ({ sidebar, setSidebar }) => {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  // Authoritative plan name from the application backend, not Clerk.
  const { plan } = useEntitlements();

  // Primary: the job-hunting flow
  const navItems = [
    { to: "/ai", label: "Dashboard", Icon: House },
    { to: "/ai/jobs", label: "Jobs", Icon: Briefcase },
    { to: "/ai/resumes", label: "Resumes", Icon: FileUser },
    { to: "/ai/community", label: "Community", Icon: Users },
  ];

  // Secondary: the general AI tools
  const extraItems = [
    { to: "/ai/write-article", label: "Write Article", Icon: SquarePen },
    { to: "/ai/gen-image", label: "Generate Images", Icon: Image },
    { to: "/ai/remove-bg", label: "Remove Background", Icon: Eraser },
    { to: "/ai/review-resume", label: "Review Resume", Icon: FileText },
    { to: "/ai/blog-titles", label: "Blog Titles", Icon: Hash },
    { to: "/ai/remove-obj", label: "Remove Object", Icon: Scissors },
  ];

  const linkClass = ({ isActive }) =>
    `px-3.5 py-2.5 flex items-center gap-3 rounded ${
      isActive
        ? "bg-gradient-to-r from-[#3c81f6] to-[#9234EA] text-white"
        : ""
    }`;
  const iconClass = (isActive) => `w-4 h-4 ${isActive ? "text-white" : ""}`;

  return (
    <div
      className={`w-60 bg-white border-r border-gray-200 flex flex-col justify-between items-center max-sm:absolute top-14 bottom-0
        ${
          sidebar ? "translate-x-0" : "max-sm:translate-x-full"
        } transition-all duration-300 ease-in-out`}
    >
      <div className="my-7 w-full">
        <img
          src={user?.imageUrl}
          alt="user-avatar"
          className="w-14 rounded-full mx-auto"
        />
        <h1 className="mt-1 text-center">{user?.firstName}</h1>

        <div>
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/ai"}
              onClick={() => setSidebar(false)}
              className={linkClass}
            >
              {({ isActive }) => (
                <>
                  <Icon className={iconClass(isActive)} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          <p className="px-3.5 mt-4 mb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
            Extras
          </p>
          {extraItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebar(false)}
              className={linkClass}
            >
              {({ isActive }) => (
                <>
                  <Icon className={iconClass(isActive)} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {/* ExamSnap is a separate app under /examsnap/ — a real anchor (full navigation
              through the Vercel rewrite), not a react-router NavLink. */}
          <a
            href="https://quick-ai-frontend-zeta.vercel.app/examsnap/"
            className="px-3.5 py-2.5 flex items-center gap-3 rounded font-semibold text-gray-800 hover:bg-gray-50"
          >
            <Camera className="w-4 h-4" />
            ExamSnap
          </a>
        </div>
      </div>
      <div className="w-full border-t border-gray-200 p-4 px-7 flex items-center justify-between ">
        <div
          className="flex gap-2 items-center cursor-pointer"
          onClick={openUserProfile}
        >
          <img src={user?.imageUrl} alt="" className="w-8 rounded-full" />
          <div>
            <h1 className="text-sm font-medium">{user?.fullName}</h1>
            <p className="text-xs text-gray-500">{plan?.name || "Free"}&nbsp;Plan</p>
          </div>
        </div>
        <LogOut
          className="w-4.5 text-gray-400 hover:text-gray-700 transition cursor-pointer"
          onClick={() => signOut()}
        />
      </div>
    </div>
  );
};

export default Sidebar;
