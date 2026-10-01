import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// --- error-code helpers (the BACKEND is authoritative; these just read codes) ---

// Feature isn't available on the user's plan (spec §24).
export const isFeatureNotAvailable = (err) =>
  err?.response?.data?.code === "FEATURE_NOT_AVAILABLE";

// Monthly usage limit reached for a generic AI feature (spec §24).
export const isUsageLimitReached = (err) =>
  err?.response?.data?.code === "USAGE_LIMIT_REACHED";

// Map an API error to a clear, user-facing message (spec §24). Falls back to the
// backend message, then the raw error. Credit errors keep their own message.
export const entitlementErrorMessage = (err) => {
  const code = err?.response?.data?.code;
  if (code === "FEATURE_NOT_AVAILABLE")
    return "This feature isn't available on your current plan.";
  if (code === "USAGE_LIMIT_REACHED")
    return "You've reached your monthly limit for this feature.";
  return err?.response?.data?.message || err?.message || "Something went wrong.";
};

// Live plan + per-feature entitlement/usage state from GET /api/entitlements.
// Display-only: never used to decide access, only to show plan name and usage.
export const useEntitlements = () => {
  const { getToken } = useAuth();
  const [plan, setPlan] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get("/api/entitlements", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setPlan(res.data.plan);
        setFeatures(res.data.features);
      }
    } catch {
      // Leave the last known values; the backend remains the source of truth.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plan, features, loading, refresh };
};
