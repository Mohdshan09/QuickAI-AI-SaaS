import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useMemo } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// Drop empty params and build a query string.
const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

// One place for every /api/admin call, with the Clerk token attached.
// Each method returns response.data ({ success, ... }).
export const useAdminApi = () => {
  const { getToken } = useAuth();

  const request = useCallback(
    async (method, url) => {
      const token = await getToken();
      const res = await axios({ method, url, headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    [getToken]
  );

  return useMemo(
    () => ({
      getMe: () => request("get", "/api/admin/me"),
      getDashboard: () => request("get", "/api/admin/dashboard"),
      getUsageOverview: (params) => request("get", `/api/admin/usage/overview${qs(params)}`),
      listUsers: (params) => request("get", `/api/admin/users${qs(params)}`),
      getUser: (id) => request("get", `/api/admin/users/${id}`),
      listRequests: (params) => request("get", `/api/admin/ai/requests${qs(params)}`),
      getRequest: (id) => request("get", `/api/admin/ai/requests/${id}`),
      getServices: () => request("get", "/api/admin/ai/services"),
      getModels: () => request("get", "/api/admin/ai/models"),
      getErrors: (params) => request("get", `/api/admin/ai/errors${qs(params)}`),
      getCosts: (params) => request("get", `/api/admin/costs${qs(params)}`),
    }),
    [request]
  );
};

// --- formatters ----------------------------------------------------------
export const fmtInt = (n) => (Number(n) || 0).toLocaleString("en-US");

export const fmtTokens = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

// Cost is often fractions of a cent — show enough precision to be useful.
export const fmtCost = (n) => {
  const v = Number(n) || 0;
  if (v === 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
};

export const fmtPct = (frac) => `${((Number(frac) || 0) * 100).toFixed(1)}%`;

export const fmtMs = (ms) => {
  const v = Number(ms) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

// Prettify a SERVICE / ERROR_CODE enum key: RESUME_OPTIMIZATION -> Resume Optimization
export const prettyLabel = (s) =>
  String(s ?? "—")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
