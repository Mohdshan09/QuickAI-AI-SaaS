import { clerkClient } from "@clerk/express";
import { fromClerkUser, upsertUser, mapUser } from "../lib/userSync.js";
import { logAuthEvent, AUTH_EVENTS } from "../lib/logger.js";
import { ensureWallet } from "../services/creditService.js";

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
  let userId, has;
  try {
    ({ userId, has } = await req.auth());
  } catch {
    userId = null;
  }

  // The global requireAuth() should have caught this already; defense in depth.
  if (!userId) {
    logAuthEvent(AUTH_EVENTS.AUTH_FAILED, { reason: "no_session" });
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  let clerkUser;
  try {
    const hasPremiumPlan = await has({ plan: "premium" });
    clerkUser = await clerkClient.users.getUser(userId);

    // Free-usage counter lives in Clerk privateMetadata (unchanged behavior).
    if (!hasPremiumPlan && clerkUser.privateMetadata.free_usage) {
      req.free_usage = clerkUser.privateMetadata.free_usage;
    } else {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: 0 },
      });
      req.free_usage = 0;
    }
    req.plan = hasPremiumPlan ? "premium" : "free";
  } catch (error) {
    // We have a session id but Clerk lookup / plan resolution failed.
    logAuthEvent(AUTH_EVENTS.AUTH_FAILED, { userId, reason: "clerk_lookup_failed" });
    console.error("auth: Clerk lookup failed:", error.message);
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  // Resolve the internal user. This is identity-critical: if it fails we stop
  // rather than serve the request with no user (spec section 18).
  try {
    const row = await upsertUser(fromClerkUser(clerkUser), { plan: req.plan });
    req.user = mapUser(row);
    logAuthEvent(row.was_created ? AUTH_EVENTS.USER_CREATED : AUTH_EVENTS.USER_SYNCED, {
      userId: req.user.id,
      source: "middleware",
    });
    // New user -> provision their credit wallet + initial grant (spec Phase 2 §19).
    // Best-effort and non-blocking: wallet creation must never fail a request; the
    // lazy ensure on GET /api/credits and the backfill script are the safety nets.
    if (row.was_created) {
      ensureWallet(req.user.id).catch((e) =>
        console.error("ensureWallet on signup failed (non-blocking):", e.message)
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
