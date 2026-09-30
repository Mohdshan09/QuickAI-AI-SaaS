// Single source of truth for mirroring a Clerk user into the local `users`
// table. Shared by the auth middleware (lazy sync), the Clerk webhook handler
// (real-time sync + deletion) and the backfill script, so the identity upsert
// exists in exactly one place and is guaranteed idempotent.
//
// Identity model (Phase 1 decision): the Clerk id IS the internal user id
// (users.id) and is also stored explicitly in users.clerk_user_id (UNIQUE).
import sql from "../config/Neon.js";

// Clerk exposes user data in two shapes: the backend SDK returns camelCase
// (clerkClient.users.getUser), while webhooks deliver snake_case (evt.data).
// Normalize both to one internal shape before writing.

const emailFromSdk = (u) =>
  u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
  u.emailAddresses?.[0]?.emailAddress ||
  null;

const emailFromWebhook = (d) =>
  d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ||
  d.email_addresses?.[0]?.email_address ||
  null;

/** Normalize a Clerk backend SDK user object (camelCase). */
export const fromClerkUser = (u) => ({
  id: u.id,
  email: emailFromSdk(u),
  firstName: u.firstName ?? null,
  lastName: u.lastName ?? null,
  imageUrl: u.imageUrl ?? null,
  role: u.publicMetadata?.role ?? null,
  clerkCreatedAt: u.createdAt ? new Date(u.createdAt) : null,
});

/** Normalize a Clerk webhook payload (evt.data, snake_case). */
export const fromWebhookData = (d) => ({
  id: d.id,
  email: emailFromWebhook(d),
  firstName: d.first_name ?? null,
  lastName: d.last_name ?? null,
  imageUrl: d.image_url ?? null,
  role: d.public_metadata?.role ?? null,
  clerkCreatedAt: d.created_at ? new Date(d.created_at) : null,
});

/**
 * Idempotently insert-or-update the local user from normalized Clerk data.
 * Repeated calls never create duplicates (ON CONFLICT on the primary key).
 * A valid Clerk identity implies an active account, so any prior soft-delete is
 * cleared (deleted_at = NULL) on sync.
 *
 * @param {ReturnType<typeof fromClerkUser>} n normalized user
 * @param {{ plan?: string }} [opts] plan is applied only when provided; otherwise
 *   the existing plan is preserved (billing/plan is owned by the auth middleware,
 *   not by webhooks or backfill).
 * @returns {Promise<object>} the users row plus boolean `was_created`
 */
export const upsertUser = async (n, { plan } = {}) => {
  const planArg = plan ?? null;
  const [row] = await sql`
    INSERT INTO users (
      id, clerk_user_id, email, first_name, last_name, image_url, plan, admin_role,
      clerk_created_at, last_active_at, synced_at, updated_at, deleted_at
    ) VALUES (
      ${n.id}, ${n.id}, ${n.email}, ${n.firstName}, ${n.lastName}, ${n.imageUrl},
      COALESCE(${planArg}, 'free'), ${n.role},
      ${n.clerkCreatedAt}, NOW(), NOW(), NOW(), NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      clerk_user_id    = EXCLUDED.clerk_user_id,
      email            = EXCLUDED.email,
      first_name       = EXCLUDED.first_name,
      last_name        = EXCLUDED.last_name,
      image_url        = EXCLUDED.image_url,
      plan             = COALESCE(${planArg}, users.plan),
      admin_role       = EXCLUDED.admin_role,
      clerk_created_at = COALESCE(EXCLUDED.clerk_created_at, users.clerk_created_at),
      last_active_at   = NOW(),
      synced_at        = NOW(),
      updated_at       = NOW(),
      deleted_at       = NULL
    RETURNING *, (xmax = 0) AS was_created
  `;
  return row;
};

/**
 * Soft-delete the local user (spec section 13). Owned data (resumes, jobs, AI
 * usage, future billing) is intentionally left intact; retention rules are a
 * later phase.
 * @returns {Promise<{id: string}|null>} the row if one existed, else null
 */
export const softDeleteUser = async (clerkUserId) => {
  const [row] = await sql`
    UPDATE users SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${clerkUserId}
    RETURNING id
  `;
  return row ?? null;
};

/** Shape a users row into the object attached to req.user / returned by /api/me. */
export const mapUser = (row) =>
  row && {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ") || null,
    firstName: row.first_name,
    lastName: row.last_name,
    imageUrl: row.image_url,
    plan: row.plan,
    status: row.status,
    role: row.admin_role,
    deletedAt: row.deleted_at,
  };
