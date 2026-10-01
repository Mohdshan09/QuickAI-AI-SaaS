import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// Live subscription state from GET /api/subscription (null => FREE user). Display-only;
// the backend resolves the plan and never trusts the client (spec §13, §37, §41). Also
// exposes cancel()/resume(), the only subscription actions a user can take in Phase 5.
export const useSubscription = () => {
  const { getToken } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get("/api/subscription", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setSubscription(res.data.subscription);
    } catch {
      // Leave the last known value.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const act = useCallback(
    async (action) => {
      const token = await getToken();
      const res = await axios.post(
        `/api/subscription/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) setSubscription(res.data.subscription);
      return res.data;
    },
    [getToken]
  );

  const cancel = useCallback(() => act("cancel"), [act]);
  const resume = useCallback(() => act("resume"), [act]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subscription, loading, refresh, cancel, resume };
};
