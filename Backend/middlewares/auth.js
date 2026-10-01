import { clerkClient } from "@clerk/express";
import { fromClerkUser, upsertUser, mapUser } from "../lib/userSync.js";
import { logAuthEvent, AUTH_EVENTS } from "../lib/logger.js";
import { ensureWallet } from "../services/creditService.js";
import { ensureUserPlan } from "../services/entitlementService.js";

// Centralized authentication middleware (spec section 8). It:
//   1. confirms the Clerk session and obtains the Clerk user id,
//   2. resolves (creating if needed, idempotently) the internal DB user,
//   3. attaches that user to req.user for controllers to use,
//   4. rejects with 401 when unauthenticated and 500 when the DB user cannot be
//      resolved — never continuing with an undefined user (spec section 18).
//
// req.user.id is the internal application user id (which, by Phase 1 decision,
// equals the Clerk id). Controllers should read req.user.id rather than the raw
// Clerk session id.
export const auth = async (req, res, next) => {
  let userId;
  try {
    ({ userId } = await req.auth());
  } catch {
    userId = null;
  }

  // The global requireAuth() should have caught this already; defense in depth.
  if (!userId) {
    logAuthEvent(AUTH_EVENTS.AUTH_FAILED, { reason: "no_session" });
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  // Phase 4: plan & feature access come from the application database, NOT Clerk
  // (spec §26). We no longer read Clerk premium flags or privateMetadata.free_usage
  // here — the entitlement service is the sole authority. users.plan is kept only
  // as a display-only mirror ("free").
  // Non-authoritative plan mirror used only by display/storage caps (e.g. the
  // resume/job count caps in controllers/Career.js). Feature access is decided by
  // the entitlement service, never by this value.
  req.plan = "free";

  let clerkUser;
  try {
    clerkUser = await clerkClient.users.getUser(userId);
  } catch (error) {
    // We have a session id but the Clerk user lookup failed.
    logAuthEvent(AUTH_EVENTS.AUTH_FAILED, { userId, reason: "clerk_lookup_failed" });
    console.error("auth: Clerk lookup failed:", error.message);
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  // Resolve the internal user. This is identity-critical: if it fails we stop
  // rather than serve the request with no user (spec section 18).
  try {
    const row = await upsertUser(fromClerkUser(clerkUser), { plan: "free" });
    req.user = mapUser(row);
    logAuthEvent(row.was_created ? AUTH_EVENTS.USER_CREATED : AUTH_EVENTS.USER_SYNCED, {
      userId: req.user.id,
      source: "middleware",
    });
    // New user -> provision their credit wallet + initial grant (Phase 2 §19) and
    // their FREE application plan (Phase 4 §27). Best-effort and non-blocking:
    // neither must fail a request; the lazy ensures on GET /api/credits and
    // GET /api/entitlements plus the backfill scripts are the safety nets.
    if (row.was_created) {
      ensureWallet(req.user.id).catch((e) =>
        console.error("ensureWallet on signup failed (non-blocking):", e.message)
      );
      ensureUserPlan(req.user.id).catch((e) =>
        console.error("ensureUserPlan on signup failed (non-blocking):", e.message)
      );
    }
    next();
  } catch (error) {
    logAuthEvent(AUTH_EVENTS.AUTH_USER_NOT_FOUND, { userId, reason: "db_upsert_failed" });
    console.error("auth: user upsert failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not resolve your account. Please try again.",
    });
  }
};
