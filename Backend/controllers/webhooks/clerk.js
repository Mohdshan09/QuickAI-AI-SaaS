import { verifyWebhook } from "@clerk/backend/webhooks";
import { fromWebhookData, upsertUser, softDeleteUser } from "../../lib/userSync.js";
import { logAuthEvent, AUTH_EVENTS } from "../../lib/logger.js";

// Clerk webhook receiver (spec sections 12 & 13). Real-time sync of user
// create/update/delete into the local mirror; the lazy upsert in auth.js is the
// fallback for anything the webhook misses.
//
// Mounted BEFORE express.json() and requireAuth() with express.raw(), because
// signature verification needs the exact raw body and the endpoint is public
// (authenticated by the Standard Webhooks signature, not a Clerk session).
// Requires CLERK_WEBHOOK_SIGNING_SECRET (read automatically by verifyWebhook).

// Adapt the Express (raw-body) request into the Fetch Request that
// verifyWebhook expects.
const toFetchRequest = (req) =>
  new Request(`https://${req.headers.host || "localhost"}${req.originalUrl}`, {
    method: "POST",
    headers: req.headers,
    body: req.body, // Buffer from express.raw()
  });

export const clerkWebhook = async (req, res) => {
  let evt;
  try {
    evt = await verifyWebhook(toFetchRequest(req));
  } catch (error) {
    logAuthEvent(AUTH_EVENTS.AUTH_FAILED, { source: "webhook", reason: "bad_signature" });
    console.error("clerk webhook verification failed:", error.message);
    return res.status(400).json({ success: false, message: "Invalid webhook signature." });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        // Do not touch plan from webhooks — billing/plan is owned by auth.js.
        const row = await upsertUser(fromWebhookData(evt.data));
        logAuthEvent(row.was_created ? AUTH_EVENTS.USER_CREATED : AUTH_EVENTS.USER_SYNCED, {
          userId: row.id,
          source: "webhook",
          event: evt.type,
        });
        break;
      }
      case "user.deleted": {
        const row = await softDeleteUser(evt.data.id);
        if (row) {
          logAuthEvent(AUTH_EVENTS.USER_DELETED, { userId: evt.data.id, source: "webhook" });
        }
        break;
      }
      default:
        // Other event types are acknowledged and ignored.
        break;
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    // Signature was valid but processing failed — 500 so Clerk retries.
    console.error("clerk webhook processing failed:", error.message);
    return res.status(500).json({ success: false, message: "Webhook processing failed." });
  }
};
