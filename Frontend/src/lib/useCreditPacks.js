import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// Live credit-pack catalog from GET /api/credits/packs. The BACKEND is authoritative for
// price/credits; the frontend only displays what it returns (spec §6, §31, §37).
export const useCreditPacks = () => {
  const { getToken } = useAuth();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get("/api/credits/packs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setPacks(res.data.packs);
    } catch {
      // Leave the last known value.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { packs, loading, refresh };
};
