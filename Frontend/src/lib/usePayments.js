import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

// Phase 7: the user's UPI payments. Exposes history + the two user actions (create a payment
// record, submit the UTR). The backend is authoritative for amount and status (spec §7, §31);
// the frontend never declares a payment successful (spec §29).
export const usePayments = () => {
  const { getToken } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get("/api/payments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setPayments(res.data.payments);
    } catch {
      // Leave the last known value.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Create a PENDING payment for a purpose + reference (purchase id or plan key). Returns the
  // payment (with amount/upiId) so the caller can show UPI instructions.
  const createPayment = useCallback(
    async (purpose, referenceId) => {
      const token = await getToken();
      const res = await axios.post(
        "/api/payments",
        { purpose, referenceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data?.payment;
    },
    [getToken]
  );

  // Submit the UTR the user got from their UPI app. Moves the payment to ADMIN_REVIEW.
  const submitPayment = useCallback(
    async (paymentId, { utr, userNote } = {}) => {
      const token = await getToken();
      const res = await axios.post(
        `/api/payments/${paymentId}/submit`,
        { utr, userNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refresh();
      return res.data?.payment;
    },
    [getToken, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { payments, loading, refresh, createPayment, submitPayment };
};
