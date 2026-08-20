# ADR-002: Authentication Architecture & Identity Strategy

## Status

Accepted

## Date

2026-08-19

## Supersedes

ADR-001 listed "Auth.js" as the authentication technology. This ADR supersedes that choice with a more appropriate architecture for the Stoney Platform's requirements.

---

## Context

Stoney Platform is an enterprise business management platform for Stoney IT Solutions.
It manages repairs, inventory, sales, quotations, customers, suppliers, branches, and users,
all governed by a fine-grained RBAC model (`User → Role → Permission`) and multi-branch isolation
(`User → Branch`).

Authentication and authorization must be treated as separate, independent concerns.
Authentication answers "who is this user?" Authorization answers "what can this user do and where?"

The platform requires:

- Secure credential authentication with managed password hashing (never rolled in-house)
- Email verification out of the box
- Password reset flow without building custom secure token generation, storage, and expiry
- Future MFA support
- First-class mobile application compatibility (technician field apps, mobile POS)
- API and integration compatibility via standard OIDC tokens
- Server-side RBAC enforcement at all times

The existing installation (`next-auth@4.24.15`, `@auth/prisma-adapter@2.11.3`) was the initial
placeholder listed in ADR-001. After architectural evaluation it was determined to be insufficient
for the above requirements at the complexity Stoney Platform will reach.

---

## Decision

**Firebase Authentication is adopted as the Identity Provider (IdP).**

**PostgreSQL via Prisma 7 remains the sole source of truth for all authorization and business data.**

### Responsibility Boundary

| Concern                          | Owner                                        |
| -------------------------------- | -------------------------------------------- |
| Credential storage and hashing   | Firebase Authentication                      |
| Email verification               | Firebase Authentication                      |
| Password reset                   | Firebase Authentication                      |
| MFA                              | Firebase Authentication                      |
| OAuth / social login             | Firebase Authentication                      |
| Identity tokens (OIDC JWTs)      | Firebase Authentication                      |
| Session identity revocation      | Firebase Authentication                      |
| Application user record          | PostgreSQL – `User` model                    |
| Branch assignment                | PostgreSQL – `User.branchId`                 |
| Role assignment                  | PostgreSQL – `User.roleId`                   |
| Permission catalog               | PostgreSQL – `Permission` model              |
| Role-permission assignments      | PostgreSQL – `RolePermission` model          |
| Business authorization decisions | PostgreSQL resolved on the server            |
| Business domain data             | PostgreSQL (Repairs, Inventory, Sales, etc.) |

**Firebase is an Identity Provider. It is not the ERP database.**

No business domain records, inventory, quotations, repairs, customers, or relational
RBAC data will ever be stored in Firestore or any Firebase/Google Cloud NoSQL service.

---

## Authorization Flow

Every authenticated request follows this flow. No step may be skipped.

```
User (Browser / Mobile / API Client)
  │
  │  1. Authenticate with email/password (or OAuth)
  ▼
Firebase Authentication (Identity Provider)
  │
  │  2. Issues signed OIDC ID Token (JWT, 1h TTL) + refresh token
  ▼
Next.js Application Server (Server Action / Route Handler / Middleware)
  │
  │  3. Verify Firebase ID Token via Firebase Admin SDK (server-only)
  │     - Extracts: uid, email, email_verified
  ▼
Central Authorization Service  (src/lib/auth/guard.ts)
  │
  │  4. Resolve PostgreSQL User by email or firebaseUid
  │     - Fail if no matching User found (Firebase user exists but is not provisioned)
  │     - Fail if User.isActive = false
  ▼
Neon PostgreSQL via Prisma 7 (@prisma/adapter-neon)
  │
  │  5. Resolve:
  │     - User.branchId  → Branch record
  │     - User.roleId    → Role record
  │     - Role.rolePermissions → Permission names
  ▼
Authorization Guard
  │
  │  6. Evaluate request against resolved permissions and branch
  │     - requirePermission('repairs:update')
  │     - requireBranchAccess(targetBranchId)
  ▼
Business Domain Operation Executes
  (Repairs, Inventory, Quotations, Sales, POS, Reports, Settings, AI)
```

---

## Security Principles

These principles are non-negotiable and apply to every implementation file.

1. **Authentication and authorization are separate concerns.**
   Verifying identity (Firebase) and evaluating permissions (PostgreSQL) must remain in
   separate, independently testable layers.

2. **Authorization is always enforced server-side.**
   Permission and branch checks must occur in Server Actions, Route Handlers, or middleware
   executing on the server. Client-side permission checks are UX only and never constitute
   a security boundary.

3. **Firebase identity does not automatically grant application permissions.**
   A user authenticated by Firebase may not have a matching provisioned record in PostgreSQL.
   Provisioned application access requires an active `User` record with an assigned `roleId`
   and `branchId`. Unprovisioned Firebase users must receive a `403 Not Provisioned` response.

4. **PostgreSQL is the authoritative source for all RBAC decisions.**
   No permission inference from Firebase claims, email patterns, or external metadata.
   Permission state must be queried from the database on every request or via a short-lived
   server-side cache (TTL ≤ 60 seconds).

5. **Branch isolation must be enforced server-side.**
   All domain queries scoped to a branch must include a verified `branchId` from the resolved
   PostgreSQL `User` record. Branch ID from the client must never be trusted.

6. **Firebase credentials and service account keys must never be exposed to the browser.**
   - `FIREBASE_SERVICE_ACCOUNT_KEY` (or `GOOGLE_APPLICATION_CREDENTIALS`) is server-only.
   - Firebase Admin SDK (`firebase-admin`) imports are never used in client components.

7. **Firebase Admin SDK remains server-only.**
   The Admin SDK must only appear in `src/lib/auth/` server utilities, Server Actions, and
   Route Handlers. It must never be imported in any file reachable by the client bundle.

---

## Rejected Alternatives

### Option A: NextAuth v4 + bcryptjs + PostgreSQL (Self-hosted Credentials)

**Why rejected:**

NextAuth v4 credentials provider places the full security burden on the Stoney Platform
engineering team:

- Custom password reset tokens (generation, storage with TTL, single-use invalidation)
- Custom email verification tokens and webhook handling
- Custom brute-force protection and account lockout logic
- Custom MFA implementation (TOTP and/or SMS gateways)
- bcrypt work factor upgrade strategy as hardware improves
- Session revocation requires either database session polling on every request
  or a JWT blacklist, both of which add operational overhead

This represents a significant ongoing security maintenance liability that is out of proportion
with a business management platform whose core value is in its ERP business domains.
Additionally, NextAuth v4 has documented integration challenges with Next.js 16 App Router
Turbopack and Server Action authorization patterns.

### Option B-variant: Firebase Authentication + Firestore for ERP Data

**Why rejected:**

Using Firestore or any Firebase NoSQL database as the storage layer for `User`, `Branch`,
`Role`, `Permission`, or any business domain entity would eliminate the relational integrity
required by the platform. The RBAC model (`User → Role → RolePermission → Permission`),
the branch association (`User → Branch → Users`), and all business domain relationships
(e.g. `Repair → User → Branch`) depend on referential integrity and transactional consistency
that only a relational database can guarantee efficiently. PostgreSQL and Prisma 7 remain the
only data store for business logic.

---

## Consequences

### Benefits

- **Managed identity security**: Google's infrastructure handles credential storage (scrypt),
  brute-force detection, credential-stuffing defense, and security incident response.
- **Password reset and email verification**: Out-of-the-box APIs (`sendPasswordResetEmail`,
  `sendEmailVerification`) eliminate an entire class of bespoke token-management code.
- **Clean separation of identity and authorization**: Identity (Firebase) and business
  authorization (PostgreSQL) evolve independently.
- **PostgreSQL remains fully relational**: All RBAC, branch membership, and business domain
  data retains referential integrity, atomic transactions, and Prisma type safety.
- **Mobile and API compatibility**: Firebase ID tokens (OIDC JWTs) are supported natively
  by official mobile SDKs (React Native, Flutter, iOS, Android) and `Authorization: Bearer`
  headers for REST API integrations.
- **Future-proof for multi-tenant SaaS**: Firebase Auth supports multi-tenancy via Google
  Cloud Identity Platform if Stoney Platform evolves toward a SaaS model.
- **Cost**: Free tier includes 50,000 Monthly Active Users, which is sufficient for all
  foreseeable single-tenant and early multi-branch deployments.

### Tradeoffs

- **Firebase dependency**: An external GCP service is now a runtime dependency for authentication.
  Mitigation: credentials export is available via `firebase auth:export`; migration path exists.
- **Firebase Admin SDK**: Server-side service account credentials must be managed securely
  in environment variables and rotated via standard GCP IAM practices.
- **Identity synchronization**: Firebase user lifecycle (create, delete, disable) must be
  coordinated with PostgreSQL `User` record state. Out-of-sync states (Firebase user exists,
  no PostgreSQL record) require graceful handling.
- **Operational dependency**: Production authentication requires a live Firebase/GCP project.
  Local development requires the Firebase Auth Emulator for deterministic testing.

---

## Migration from next-auth

The packages `next-auth@4.24.15` and `@auth/prisma-adapter@2.11.3` are legacy placeholders
from the initial project scaffold. They will be removed in the Authentication implementation
loop. No NextAuth configuration, route handlers, or session callbacks will be implemented.

The `User.passwordHash` field in the Prisma schema will be dropped or replaced by
`firebaseUid` as part of the Authentication implementation loop migration. See §Schema Change
Proposal for the planned approach.

---

## Schema Change Proposal (Pending — Not Yet Applied)

The current `User` model requires two changes for Firebase integration:

### 1. Add `firebaseUid`

```prisma
firebaseUid String? @unique
```

**Why required**: The server-side authorization flow must map the verified Firebase `uid`
(resolved from the ID token) to the PostgreSQL `User` record. While `email` can serve as
the initial mapping key, `firebaseUid` is the canonical, immutable, and permanently unique
identifier issued by Firebase. Email addresses can be changed by the user; `uid` never changes.

**Why nullable initially (`String?`)**: During migration, existing seeded users and any
pre-existing records will not yet have a `firebaseUid`. The field should be nullable until
full provisioning is complete, then tightened to non-nullable in a follow-up migration.

**Uniqueness**: `@unique` is required. One Firebase user maps to exactly one PostgreSQL User.

### 2. Drop `passwordHash`

```prisma
// Remove: passwordHash String
```

**Why**: With Firebase as IdP, application servers never handle raw passwords or hashes.
Retaining `passwordHash` would be misleading and create the false impression that
custom credential authentication is still active. This field will be dropped.

**Note**: The existing seed administrator flow (environment-driven bcrypt) will be replaced
by a Firebase Admin SDK user provisioning flow in the Authentication implementation loop.

### Identity Mapping Strategy

| Strategy                            | Assessment                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Map by `email` only                 | **Fragile**: Email can change in Firebase; creates desync risk                                                                  |
| Map by `firebaseUid` only           | **Preferred for runtime** — immutable, opaque, guaranteed unique by Google                                                      |
| Map by both `email` + `firebaseUid` | **Recommended migration approach** — email for initial lookup during transition, `firebaseUid` for all subsequent verifications |

**Decision**: Use `email` as the provisioning-time mapping key during onboarding.
Once a User record is linked to a Firebase uid, `firebaseUid` becomes the canonical runtime
key. Both `User.email` and `User.firebaseUid` remain unique-indexed.

---

## Server Authorization Contract (Proposed — Not Yet Implemented)

The following TypeScript interfaces define the server-side authorization layer contract.
These are contracts only — no implementation files are created in this loop.

```typescript
// The fully-resolved user context available to every authorized server operation.
// This is NOT the Firebase token. It is the PostgreSQL-resolved business user.
interface AuthenticatedUser {
  id: string; // PostgreSQL User.id (cuid)
  firebaseUid: string; // Firebase uid — verified by Admin SDK
  email: string; // Verified email
  firstName: string;
  lastName: string;
  branchId: string;
  branch: { id: string; code: string; name: string; isActive: boolean };
  roleId: string;
  role: { id: string; name: string };
  permissions: string[]; // Resolved permission names: ['repairs:read', 'sales:create', ...]
  isActive: boolean;
}

/**
 * Resolves the authenticated user context from the current request.
 * Verifies the Firebase ID Token / session cookie (server-only).
 * Resolves the PostgreSQL User, Branch, Role, and Permissions.
 * Returns null if no valid session exists (not authenticated).
 * Throws if authenticated but not provisioned (Firebase user with no PostgreSQL record).
 */
declare function getCurrentUser(): Promise<AuthenticatedUser | null>;

/**
 * Requires valid authentication.
 * Returns the AuthenticatedUser or throws a 401 response.
 * Use as the first guard in any protected Server Action or Route Handler.
 */
declare function requireAuth(): Promise<AuthenticatedUser>;

/**
 * Requires the authenticated user to hold a specific role name.
 * Throws a 403 response if the user's role does not match.
 * Note: Prefer requirePermission() for fine-grained control.
 * Use requireRole() only for coarse administrative gates (e.g. 'Super Admin' only).
 */
declare function requireRole(roleName: string): Promise<AuthenticatedUser>;

/**
 * Requires the authenticated user to hold a specific permission.
 * Permission names follow the resource:action convention (e.g. 'repairs:assign').
 * Throws a 403 response if the user's role does not include the permission.
 * This is the primary authorization guard for all business domain operations.
 */
declare function requirePermission(
  permission: string
): Promise<AuthenticatedUser>;

/**
 * Requires the authenticated user to belong to a specific branch,
 * OR to hold a permission that grants cross-branch access (e.g. 'branches:read' for Super Admin/Admin).
 * Throws a 403 response if the user belongs to a different branch without override permission.
 * Must be called whenever operating on branch-scoped data passed in from the client.
 */
declare function requireBranchAccess(
  targetBranchId: string
): Promise<AuthenticatedUser>;
```

### Usage Pattern in Server Actions

```typescript
// Example: Update a repair ticket (requires repairs:update permission on correct branch)
async function updateRepairAction(repairId: string, data: UpdateRepairInput) {
  const user = await requirePermission('repairs:update');
  // user.branchId is now server-verified — never trust client-provided branchId
  await requireBranchAccess(data.branchId);
  // Proceed with Prisma update ...
}

// Example: Assign a technician to a repair (requires repairs:assign)
async function assignRepairAction(repairId: string, technicianId: string) {
  await requirePermission('repairs:assign');
  // Proceed ...
}
```

---

## Firebase Foundation Modules & Environment Variables

### Client Module (`src/lib/firebase/client.ts`)

- **SDK**: `firebase/app`, `firebase/auth` (Web SDK).
- **Scope**: Client components, browser context, token refresh.
- **Environment Variables**:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

### Admin Module (`src/lib/firebase/admin.ts`)

- **SDK**: `firebase-admin/app`, `firebase-admin/auth` (Node.js Server SDK).
- **Scope**: Server Actions, Route Handlers, server authorization guards. Strictly server-only.
- **Environment Variables**:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - _OR_ `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string)
  - _OR_ `GOOGLE_APPLICATION_CREDENTIALS` (GCP default)

### Implementation Status

- **Current State**: Foundation modules created with lazy singleton initialization.
- **Authentication Flows**: Pending next implementation phase (login/signup, token verification, session cookies, auth guards).

---

## References

- Firebase Authentication documentation: https://firebase.google.com/docs/auth
- Firebase Admin SDK for Node.js: https://firebase.google.com/docs/admin/setup
- Firebase Auth Emulator: https://firebase.google.com/docs/emulator-suite
- Google Cloud Identity Platform (future multi-tenant path): https://cloud.google.com/identity-platform
