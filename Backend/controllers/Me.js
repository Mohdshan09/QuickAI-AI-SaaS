// GET /api/me — returns the authenticated application user (spec section 22).
// The `auth` middleware has already verified the Clerk session and resolved the
// internal user onto req.user, so this simply projects it. Lets the frontend
// confirm the Clerk identity -> application identity mapping is working.
export const getMe = (req, res) => {
  const { id, clerkUserId, email, name, imageUrl, plan } = req.user;
  res.json({ success: true, user: { id, clerkUserId, email, name, imageUrl, plan } });
};
