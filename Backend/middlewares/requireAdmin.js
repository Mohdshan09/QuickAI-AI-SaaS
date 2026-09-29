import { clerkClient } from "@clerk/express";
import sql from "../config/Neon.js";

// Admin roles, most-privileged first, and the permissions each grants.
// Phase 1 is read-only analytics, so all three admin roles can read the
// analytics endpoints; write-only permissions (pricing/limits/user actions)
// are declared here for Phase 2 gating.
export const ROLES = {
  super_admin: [
    "view_users", "view_usage", "view_requests", "view_services", "view_models",
    "view_costs", "view_errors", "view_activity", "view_audit",
    "edit_pricing", "edit_limits", "edit_budget", "manage_users",
  ],
  operations_admin: [
    "view_users", "view_usage", "view_requests", "view_services", "view_models",
    "view_costs", "view_errors", "view_activity",
  ],
  support_admin: ["view_users", "view_usage", "view_activity"],
};

const bootstrapEmails = () =>
  (process.env.ADMIN_BOOTSTRAP_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const primaryEmail = (user) =>
  user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
  user.emailAddresses?.[0]?.emailAddress ||
  null;

/**
 * Resolve a user's admin role from Clerk publicMetadata.role, running the
 * first-time bootstrap: an email in ADMIN_BOOTSTRAP_EMAILS is promoted to
 * super_admin, written back to Clerk publicMetadata and the local users mirror.
 * @returns {Promise<string|null>} the role, or null if not an admin
 */
export const resolveAdminRole = async (userId) => {
  const user = await clerkClient.users.getUser(userId);
  let role = user.publicMetadata?.role || null;

  if (!role) {
    const email = primaryEmail(user)?.toLowerCase();
    if (email && bootstrapEmails().includes(email)) {
      role = "super_admin";
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { ...user.publicMetadata, role },
      });
      await sql`UPDATE users SET admin_role = ${role} WHERE id = ${userId}`.catch(() => {});
    }
  }
  return role;
};

/**
 * Gate an admin route. Verifies (1) authentication, (2) admin role, and (3) the
 * required permission. Role comes from Clerk publicMetadata.role (with bootstrap).
 *
 * @param {string} [permission] required permission; omit for any admin role
 */
export const requireAdmin =
  (permission) =>
  async (req, res, next) => {
    try {
      const { userId } = req.auth();
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

      const role = await resolveAdminRole(userId);

      const perms = ROLES[role];
      if (!perms) {
        return res.status(403).json({ success: false, message: "Admin access required." });
      }
      if (permission && !perms.includes(permission)) {
        return res.status(403).json({ success: false, message: "Insufficient permissions." });
      }

      req.adminRole = role;
      req.adminPerms = perms;
      next();
    } catch (error) {
      console.error("requireAdmin failed", error);
      res.status(500).json({ success: false, message: "Admin authorization failed." });
    }
  };
