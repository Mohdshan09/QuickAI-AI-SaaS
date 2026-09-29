import { Menu, X, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { useUser, SignIn } from "@clerk/clerk-react";
import { assets } from "../../assets/assets";
import AdminSidebar from "../../components/admin/AdminSidebar";
import { useAdminApi } from "../../lib/adminApi";
import { Spinner } from "../../components/admin/ui";

const AdminLayout = () => {
  const navigate = useNavigate();
  const [sidebar, setSidebar] = useState(false);
  const { user, isLoaded } = useUser();
  const api = useAdminApi();
  // null = still checking, true/false = admin decision from the backend.
  const [isAdmin, setIsAdmin] = useState(null);

  // Ask the backend (which also runs the env-allowlist bootstrap) rather than
  // trusting the client Clerk session, which can lag right after promotion.
  useEffect(() => {
    if (!isLoaded || !user) return;
    let alive = true;
    api
      .getMe()
      .then((r) => alive && setIsAdmin(!!r.isAdmin))
      .catch(() => alive && setIsAdmin(false));
    return () => {
      alive = false;
    };
  }, [api, isLoaded, user]);

  if (!isLoaded) return null;

  // Not signed in → Clerk sign-in.
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <SignIn />
      </div>
    );
  }

  // Waiting on the backend admin check.
  if (isAdmin === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner label="Checking admin access…" />
      </div>
    );
  }

  // Signed in but not an admin → blocked (backend enforces this on every route too).
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 text-center px-6">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <h1 className="text-lg font-semibold text-slate-800">Admin access required</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          Your account doesn’t have permission to view the admin module.
        </p>
        <Link to="/ai" className="mt-2 text-sm text-[#3c81f6] hover:underline">
          Back to the app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start justify-start h-screen">
      <nav className="w-full px-8 min-h-14 flex items-center justify-between border-b border-gray-200">
        <img className="cursor-pointer" onClick={() => navigate("/ai")} src={assets.logo} alt="Logo" />
        {sidebar ? (
          <X onClick={() => setSidebar(false)} className="w-6 h-6 text-gray-600 sm:hidden" />
        ) : (
          <Menu onClick={() => setSidebar(true)} className="w-6 h-6 text-gray-600 sm:hidden" />
        )}
      </nav>

      <div className="flex-1 w-full flex h-[calc(100vh-64px)]">
        <AdminSidebar sidebar={sidebar} setSidebar={setSidebar} />
        <div className="flex-1 bg-[#F4F7FB] overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
