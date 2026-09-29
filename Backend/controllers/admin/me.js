import { resolveAdminRole, ROLES } from "../../middlewares/requireAdmin.js";

// GET /api/admin/me — reports whether the signed-in user is an admin.
// Auth-only (no requireAdmin): this runs the bootstrap promotion, so the admin
// UI can gate on a real server check instead of the (possibly stale) client
// Clerk session. Returns 200 with isAdmin:false for non-admins (not 403).
export const getMe = async (req, res) => {
  try {
    const { userId } = req.auth();
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

    const role = await resolveAdminRole(userId);
    const permissions = ROLES[role] || [];
    res.json({ success: true, isAdmin: !!ROLES[role], role: role || null, permissions });
  } catch (error) {
    console.error("getMe failed", error);
    res.status(500).json({ success: false, message: "Failed to resolve admin status." });
  }
};
