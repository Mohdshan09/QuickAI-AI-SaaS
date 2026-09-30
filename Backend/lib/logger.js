// Structured, secret-free logging for authentication lifecycle events
// (spec section 20). These are intentionally minimal and MUST NOT contain
// passwords, Clerk secrets, session tokens, or unnecessary personal data —
// only ids and coarse context needed to trace the identity flow.

export const AUTH_EVENTS = Object.freeze({
  USER_CREATED: "USER_CREATED",
  USER_SYNCED: "USER_SYNCED",
  USER_DELETED: "USER_DELETED",
  AUTH_FAILED: "AUTH_FAILED",
  AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",
});

/**
 * Emit one auth lifecycle log line as JSON.
 * @param {string} event  one of AUTH_EVENTS
 * @param {object} [fields] safe context (userId, source, reason). Never secrets.
 */
export const logAuthEvent = (event, fields = {}) => {
  const line = { event, at: new Date().toISOString(), ...fields };
  // AUTH_FAILED / AUTH_USER_NOT_FOUND are problems; the rest are informational.
  const isError = event === AUTH_EVENTS.AUTH_FAILED || event === AUTH_EVENTS.AUTH_USER_NOT_FOUND;
  (isError ? console.warn : console.log)(`[auth] ${JSON.stringify(line)}`);
};
