import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// The user's own credit ledger from GET /api/credits/transactions (spec §32). Shows every
// source — PURCHASE, SUBSCRIPTION_GRANT, AI_USAGE, etc. — newest first. Display-only.
export const useCreditHistory = ({ limit = 10 } = {}) => {
  const { getToken } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`/api/credits/transactions?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setTransactions(res.data.transactions);
    } catch {
      // Leave the last known value.
    } finally {
      setLoading(false);
    }
  }, [getToken, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, loading, refresh };
};
