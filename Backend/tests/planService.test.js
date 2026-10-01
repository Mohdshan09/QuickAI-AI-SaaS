// Integration tests for the plan catalog (spec §44 Plan). Runs against the dev Neon
// DB; assumes `npm run seed:plans` has populated FREE/STARTER/PRO. Run: npm test
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { getPlans, getPlan } from "../services/planService.js";
import { PLANS } from "../config/plans.js";

test("all three plans exist with correct price and monthly credits", async () => {
  const plans = await getPlans();
  const byKey = Object.fromEntries(plans.map((p) => [p.key, p]));

  for (const key of ["FREE", "STARTER", "PRO"]) {
    assert.ok(byKey[key], `${key} should be an active plan`);
    assert.equal(byKey[key].price, PLANS[key].price);
    assert.equal(byKey[key].monthlyCredits, PLANS[key].monthlyCredits);
    assert.equal(byKey[key].currency, "INR");
    assert.equal(byKey[key].billingInterval, "MONTHLY");
  }
  // POWER was intentionally dropped.
  assert.equal(byKey.POWER, undefined);
});

test("getPlans is ordered by price ascending", async () => {
  const plans = await getPlans();
  const prices = plans.map((p) => p.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test("getPlan returns a single plan by key", async () => {
  const pro = await getPlan("PRO");
  assert.equal(pro.key, "PRO");
  assert.equal(pro.monthlyCredits, 60);
});
