# PHASE_1_AUTH_REQUIREMENTS.md

# Phase 1 — Authentication Foundation

## 1. Objective

Establish a production-ready authentication foundation using **Clerk** while keeping the application's user identity and business data inside PostgreSQL.

Phase 1 is strictly an **authentication and user identity phase**.

It must not implement subscriptions, payments, credits, or billing.

The final identity flow should be:

Clerk → Backend Authentication → Internal User → Application Features

---

# 2. Current Situation

The application currently uses Clerk in development mode as a temporary authentication solution.

The objective is to remove any dummy/temporary user identification and establish a proper relationship between:

- Clerk user
- Application database user
- Authenticated backend requests

Clerk will remain responsible for authentication.

PostgreSQL will remain the source of truth for application-specific user data.

---

# 3. Technology Decisions

### Authentication

Use:

- Clerk

Clerk is responsible for:

- Sign up
- Sign in
- Sign out
- Session management
- Authentication
- User identity
- Email verification
- Authentication UI

### Database

Use:

- PostgreSQL
- Existing NeonDB database

The application database must maintain its own `users` record.

### Important

Do not build a custom authentication system.

Do not implement JWT generation manually.

Do not store Clerk passwords or authentication secrets in PostgreSQL.

Do not use email as the primary user identifier.

---

# 4. User Identity Architecture

The application must maintain two identities:

### Clerk Identity

Managed by Clerk.

Example:

```text
clerkUserId



Application Identity

Managed by PostgreSQL.

Example:

user.id

The relationship is:

Clerk User
    |
    | clerkUserId
    ↓
PostgreSQL User
    |
    | internal user.id
    ↓
Application Data

The internal database user.id must be used for application-level relationships.

5. Database User Model

Create or update the users table.

Recommended structure:

users

id
clerk_user_id
email
name
image_url
created_at
updated_at
Requirements

id

Internal application user ID
Primary key

clerk_user_id

Clerk user identifier
Required
Unique

email

User's current email
Stored for application purposes
Must not be used as the primary identity

name

User's display name
Nullable

image_url

Clerk profile image URL
Nullable

created_at

Record creation timestamp

updated_at

Last synchronization/update timestamp
6. Database Constraints

The database must enforce:

users.id → PRIMARY KEY

users.clerk_user_id → UNIQUE

Do not allow multiple application users to have the same Clerk user ID.

Recommended:

UNIQUE(clerk_user_id)

Email uniqueness should only be added if the application's business requirements require it.

Do not assume email is immutable.

7. Clerk → Database User Mapping

Every authenticated request must resolve:

Clerk User
    ↓
clerk_user_id
    ↓
users.clerk_user_id
    ↓
users.id

Application services should use:

user.id

instead of directly depending on Clerk IDs.

Example:

AIUsage.userId
Resume.userId
JobApplication.userId
CreditWallet.userId
Subscription.userId

Future modules should reference the internal database user ID.

8. Backend Authentication Middleware

Create centralized authentication middleware.

Responsibilities:

Verify the Clerk session.
Obtain the authenticated Clerk user ID.
Find the corresponding database user.
Attach the internal user to the request context.
Reject unauthenticated requests.
Handle missing database users safely.

Conceptually:

Request
   ↓
Clerk Authentication
   ↓
Authenticated?
   │
   ├── No → 401 Unauthorized
   │
   └── Yes
        ↓
   clerkUserId
        ↓
   Find users.clerk_user_id
        ↓
   Database User
        ↓
   req.user
        ↓
   Controller
9. Never Trust Frontend userId

The frontend must never be allowed to determine which user performs an operation.

Do NOT rely on:

{
  "userId": "123"
}

for authorization.

Instead:

Authenticated Clerk Session
        ↓
Backend resolves user
        ↓
Backend obtains internal user.id
        ↓
Use internal user.id

If an API receives a userId from the frontend, it must not use that value for authorization.

10. Protected API Requirements

Every private API route must require authentication.

Example:

GET /api/profile
POST /api/resume
GET /api/resumes
POST /api/analyze-jd
POST /api/optimize-resume
GET /api/usage

Expected behavior:

Authenticated user
→ request allowed

Unauthenticated user
→ 401 Unauthorized
11. User Creation

When a user successfully authenticates for the first time, the application must ensure that an internal database user exists.

Flow:

New Clerk User
      ↓
Authentication
      ↓
Backend
      ↓
Find clerk_user_id
      ↓
User exists?
   /       \
 Yes       No
  |         |
 Continue   Create
            |
            ↓
       PostgreSQL User

User creation must be idempotent.

Repeated requests must never create duplicate users.

12. User Synchronization

The application should synchronize relevant Clerk user information with PostgreSQL.

Fields:

email
name
image_url
updated_at

Synchronization can occur through Clerk webhooks and/or a safe backend synchronization strategy.

The synchronization process must be idempotent.

Example:

Clerk user updated
       ↓
Webhook
       ↓
Find clerk_user_id
       ↓
Update PostgreSQL user
13. User Deletion

When a Clerk user is deleted, the application must have a defined database behavior.

Recommended approach:

Clerk User Deleted
        ↓
Webhook
        ↓
Application User
        ↓
Soft delete / controlled deletion

The exact deletion strategy must consider future user-owned data such as:

Resumes
Job applications
AI usage
Credit transactions
Payments
Subscriptions

Do not blindly hard-delete the entire user record if financial or audit records may later depend on it.

For Phase 1, establish the deletion mechanism and leave detailed billing/data-retention rules for later phases.

14. Frontend Authentication

Continue using Clerk's frontend authentication functionality.

The frontend should use Clerk for:

Sign in
Sign up
Sign out
Session state
Current authenticated user

Remove any temporary authentication state that was only used for development.

Do not maintain a second independent authentication system.

15. API Authentication Flow

The frontend should call the backend while authenticated through Clerk.

Conceptually:

User
 ↓
Clerk Login
 ↓
Clerk Session
 ↓
Frontend API Request
 ↓
Backend
 ↓
Verify Clerk Authentication
 ↓
Resolve internal User
 ↓
Business Logic

The backend must remain responsible for authorization.

16. Development and Production Environments

Maintain separate environment configuration for:

Development
Production

Development:

Clerk Development Environment
+
Development Database

Production:

Clerk Production Environment
+
Production Database

Do not mix development and production Clerk credentials.

Do not commit Clerk secrets to Git.

17. Environment Variables

Use environment variables for Clerk configuration.

Example:

CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

Use the appropriate environment-specific values.

Never commit:

CLERK_SECRET_KEY

to the repository.

18. Error Handling

Authentication errors should return consistent HTTP responses.

Unauthenticated
401 Unauthorized
Authenticated but not authorized
403 Forbidden
Authenticated but database user missing

The backend should handle this explicitly.

It should either:

Create/synchronize the missing user if appropriate, or
Return a controlled server error.

Do not silently continue with an undefined user.

19. Security Requirements
Required
Verify authentication on the backend.
Never trust frontend user IDs.
Never expose Clerk secret keys.
Use HTTPS in production.
Validate authenticated user context.
Use database constraints for identity uniqueness.
Keep Clerk authentication separate from application authorization.
Do not store passwords.
Do not store authentication tokens unnecessarily.
Not allowed
Frontend userId → database query

without validating that it belongs to the authenticated user.

20. Logging

Add basic logs for important authentication lifecycle events.

Examples:

USER_CREATED
USER_SYNCED
USER_DELETED
AUTH_FAILED
AUTH_USER_NOT_FOUND

Logs should not contain:

Passwords
Authentication secrets
Session tokens
Sensitive personal information unnecessarily
21. Testing Requirements

Before completing Phase 1, verify the following.

New User
Sign up with Clerk
        ↓
Database user created
Existing User
Login
 ↓
Existing database user found
 ↓
No duplicate created
API Authentication
Authenticated request
→ 200 / normal response
Unauthenticated request
→ 401
User Isolation

User A must not be able to access:

User B's resume
User B's applications
User B's AI usage

even if User A manually changes IDs in an API request.

User Update

Changing relevant Clerk profile information should eventually synchronize with PostgreSQL.

User Deletion

Deleting the Clerk account should trigger the application's defined deletion/synchronization behavior.

22. Phase 1 API Requirements

No billing APIs are required in Phase 1.

The backend should only establish the authentication foundation.

Possible internal endpoints:

GET /api/me

Returns the authenticated application's user.

Example:

{
  "id": "internal-user-id",
  "clerkUserId": "clerk-user-id",
  "email": "user@example.com",
  "name": "User Name"
}

This endpoint can be used by the frontend to verify that:

Clerk identity
        ↓
Application identity

is working correctly.

23. Phase 1 Database Migration

Create the required database migration for the users table.

Before applying the migration:

Check whether a users table already exists.
Preserve existing user data where possible.
Add clerk_user_id.
Add the required unique constraint.
Avoid destructive migrations without explicit confirmation.

If existing development users exist, provide a controlled migration/mapping strategy.