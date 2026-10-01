import { getPlans } from "../services/planService.js";
import { sendApiError } from "../lib/apiError.js";

// GET /api/plans — active public plans with pricing + monthly credits (spec §31).
// The frontend consumes this instead of hardcoding plan config (spec §4, §41).
export const listPlans = async (req, res) => {
  try {
    const plans = await getPlans();
    res.json({
      success: true,
      plans: plans.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        billingInterval: p.billingInterval,
        monthlyCredits: p.monthlyCredits,
      })),
    });
  } catch (error) {
    sendApiError(res, error);
  }
};
