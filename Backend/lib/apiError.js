import { CreditError } from "./creditError.js";
import { AiError } from "./aiError.js";
import { EntitlementError } from "./entitlementError.js";
import { SubscriptionError } from "./subscriptionError.js";
import { PurchaseError } from "./purchaseError.js";
import { PaymentError } from "./paymentError.js";

// Map a CreditError/AiError/EntitlementError/SubscriptionError/PurchaseError/PaymentError to a
// consistent JSON response, matching the existing flat error shape
// ({ success:false, code, message }). Unknown errors become a generic 500 with no
// internals leaked.
export const sendApiError = (res, error) => {
  if (
    error instanceof CreditError ||
    error instanceof AiError ||
    error instanceof EntitlementError ||
    error instanceof SubscriptionError ||
    error instanceof PurchaseError ||
    error instanceof PaymentError
  ) {
    const body = { success: false, code: error.code, message: error.message };
    if (error.code === "INSUFFICIENT_CREDITS") {
      if (typeof error.required === "number") body.required = error.required;
      if (typeof error.available === "number") body.available = error.available;
    }
    return res.status(error.status).json(body);
  }
  console.error("AI/credit request error:", error);
  return res
    .status(500)
    .json({ success: false, code: "AI_REQUEST_FAILED", message: "Request failed. Please try again." });
};
