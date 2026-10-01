import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// The UPI payment config (id, payee name, currency, optional static QR) from the backend —
// the single source of truth for the business UPI identity (spec §5, §14). Never hard-coded.
export const usePaymentConfig = () => {
  const { getToken } = useAuth();
  const [config, setConfig] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get("/api/payments/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setConfig(res.data.config);
    } catch {
      // Leave the last known value.
    }
  }, [getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { config, refresh };
};
