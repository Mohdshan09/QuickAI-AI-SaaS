import axios from "axios";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// Live plan catalog from GET /api/plans (public — pricing is not user-specific).
// The BACKEND is authoritative; the frontend only displays what it returns (spec §4, §41).
export const usePlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get("/api/plans");
      if (res.data?.success) setPlans(res.data.plans);
    } catch {
      // Leave the last known value.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plans, loading, refresh };
};
