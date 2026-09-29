import { clerkClient } from "@clerk/express";
import sql from "../config/Neon.js";

// Best-effort mirror of the Clerk user into the local `users` table so admin
// analytics can paginate/sort/filter/join by usage server-side. Also refreshes
// last_active_at (which the admin uses as "last active"). Never blocks or fails
// the request — a mirror error is logged and swallowed.
const mirrorUser = async (user, plan) => {
  try {
    const email =
      user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      null;
    const role = user.publicMetadata?.role ?? null;
    const clerkCreatedAt = user.createdAt ? new Date(user.createdAt) : null;
    await sql`
      INSERT INTO users (
        id, email, first_name, last_name, image_url, plan, admin_role,
        clerk_created_at, last_active_at, synced_at
      ) VALUES (
        ${user.id}, ${email}, ${user.firstName ?? null}, ${user.lastName ?? null},
        ${user.imageUrl ?? null}, ${plan}, ${role}, ${clerkCreatedAt}, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email          = EXCLUDED.email,
        first_name     = EXCLUDED.first_name,
        last_name      = EXCLUDED.last_name,
        image_url      = EXCLUDED.image_url,
        plan           = EXCLUDED.plan,
        admin_role     = EXCLUDED.admin_role,
        last_active_at = NOW(),
        synced_at      = NOW()
    `;
  } catch (error) {
    console.error("user mirror failed (request still served):", error.message);
  }
};

export const auth = async (req, res, next) => {
  try {
    const { userId, has } = await req.auth();
    const hasPremiumPlan = await has({ plan: "premium" });

    const user = await clerkClient.users.getUser(userId);

    if (!hasPremiumPlan && user.privateMetadata.free_usage) {
      req.free_usage = user.privateMetadata.free_usage;
    } else {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: 0,
        },
      });

      req.free_usage = 0;
    }

    req.plan = hasPremiumPlan ? "premium" : "free";
    await mirrorUser(user, req.plan);
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
