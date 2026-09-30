import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// Display-only hint of what each AI action costs. The BACKEND is authoritative —
// this is just so the UI can say "uses N credits" before the call.
export const AI_ACTION_COSTS = { match: 2, tailor: 3 };

// True when a request failed specifically because the user is out of credits.
export const isInsufficientCredits = (err) =>
  err?.response?.data?.code === "INSUFFICIENT_CREDITS";

// Live credit balance from GET /api/credits. Never computes the balance locally;
// call refresh() after an AI action to pull the authoritative value.
export const useCredits = () => {
  const { getToken } = useAuth();
  const [balance, setBalance] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get("/api/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setBalance(res.data.balance);
    } catch {
      // Leave the last known value; the backend remains the source of truth.
    }
  }, [getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, refresh };
};
