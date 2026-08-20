# Loop 01 — Authentication & Authorization

## Objective

Establish a production-grade, decoupled authentication architecture using Firebase Authentication as the Identity Provider (IdP) and PostgreSQL/Prisma 7 as the single source of truth for Role-Based Access Control (RBAC) and Multi-Branch Authorization.

---

## Architecture Summary (ADR-002)

| Layer                       | Technology                   | Primary Responsibilities                                                                          |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| **Identity Provider (IdP)** | Firebase Authentication      | Credential storage/hashing, email verification, password reset, MFA, OIDC ID tokens (JWTs)        |
| **Server / App Layer**      | Next.js 16.3 (App Router)    | Token verification via Firebase Admin SDK, session cookie management, server authorization guards |
| **Database & RBAC**         | Neon PostgreSQL via Prisma 7 | `User`, `Branch`, `Role`, `Permission`, `RolePermission`, and all business domain entities        |

---

## Installed Dependencies

```json
{
  "dependencies": {
    "firebase": "^11.3.1",
    "firebase-admin": "^13.1.0"
  }
}
```

_Note: Legacy packages (`next-auth`, `@auth/prisma-adapter`, `bcryptjs`) remain temporarily installed until the authentication migration is fully complete._

---

## Modules & Architecture Components

### 1. Client Module (`src/lib/firebase/client.ts`)

- Utilizes the Firebase Web SDK (`firebase/app`, `firebase/auth`).
- Safe for SSR and client runtime through lazy singleton initialization (`getFirebaseClientApp()`, `getFirebaseClientAuth()`).
- Reads strictly from `process.env.NEXT_PUBLIC_FIREBASE_*`.
- Does **not** import or touch `firebase-admin`.

### 2. Admin Module (`src/lib/firebase/admin.ts`)

- Utilizes the Firebase Admin SDK (`firebase-admin/app`, `firebase-admin/auth`).
- Strictly server-only. Throws if executed on the client.
- Safe singleton initialization across Next.js development hot-reloads (`getApps()`).
- Credential resolution strategy:
  1. `FIREBASE_SERVICE_ACCOUNT_KEY` (single JSON string)
  2. Discrete variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  3. `GOOGLE_APPLICATION_CREDENTIALS` (GCP / Cloud Run default)
- Lazy evaluation ensures static build prerendering never crashes when credentials are not yet configured.

### 3. Shared Prisma Client Runtime (`src/lib/prisma.ts`)

- Provides singleton `PrismaClient` configured with `@prisma/adapter-neon` for WebSocket connection pooling.
- Preserves singleton in `globalThis` during development hot-reloading.

### 4. Server Authorization Guards (`src/lib/auth/guard.ts`)

- `getCurrentUser(sessionCookieOverride?)`: Resolves `AuthenticatedUser | null` from verified HTTP-only session cookie and PostgreSQL record. Links `firebaseUid` atomically if matching by verified email during onboarding.
- `requireAuth()`: Enforces authentication (throws `401 Unauthorized`).
- `requireRole(roleName)`: Enforces role assignment (throws `403 Forbidden`).
- `requirePermission(permissionName)`: Enforces fine-grained permission assignment (throws `403 Forbidden`).
- `requireBranchAccess(targetBranchId)`: Enforces multi-branch data isolation (throws `403 Forbidden`).

### 5. Session Route Handlers

- `POST /api/auth/session`: Exchanges client Firebase ID token for secure, HTTP-only `stoney_session` cookie (5-day TTL).
- `GET /api/auth/session`: Returns current user profile, role, branch, and resolved permissions.
- `DELETE /api/auth/session` & `POST /api/auth/logout`: Clears session cookie and revokes Firebase refresh tokens.

### 6. Client Auth Context & Hook (`src/lib/auth/context.tsx`)

- Provides `useAuth()` hook for React components.
- Exposes `user`, `firebaseUser`, `isLoading`, `error`, `signIn()`, `signOut()`, `sendPasswordReset()`, and `refreshUser()`.
- Synchronizes Firebase Auth client events with the server session cookie endpoint.

### 7. User Interface

- `src/app/login/page.tsx`: Enterprise login interface with validation and error states.
- `src/app/forgot-password/page.tsx`: Password reset interface utilizing Firebase Auth.
- `src/app/layout.tsx`: Configured with `<AuthProvider initialUser={currentUser}>` for instant SSR hydration with zero layout shift.
- `src/app/page.tsx`: Landing and session status dashboard showing user profile, branch assignment, role, and permission count.

---

## Environment Variables Specification

### Public Client Variables

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` _(optional)_

### Private Server Variables

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- _OR_ `FIREBASE_SERVICE_ACCOUNT_KEY`
- _OR_ `GOOGLE_APPLICATION_CREDENTIALS`

_No secrets, service account files, or credentials are committed. `.gitignore` protects all `.env*` files._

---

## Verification & Quality Gates

| Quality Gate                 | Command                      | Status                          |
| ---------------------------- | ---------------------------- | ------------------------------- |
| **Prisma Validate**          | `npx prisma validate`        | **PASS**                        |
| **Prisma Generate**          | `npx prisma generate`        | **PASS**                        |
| **ESLint**                   | `npm run lint`               | **PASS** (0 errors, 0 warnings) |
| **Next.js Production Build** | `npm run build`              | **PASS** (All routes compiled)  |
| **Auth Guard Test Suite**    | Automated guard verification | **PASS** (5/5 tests passing)    |
| **Database Seed**            | `npm run prisma:seed`        | **PASS** (Idempotent, 0 users)  |

---

## Current Status & Next Steps

- [x] Architecture Decision Record established ([ADR-002](file:///c:/Users/micha/Documents/stoney-platform/docs/decisions/ADR-002-authentication-strategy.md))
- [x] Schema migration applied (`firebaseUid String? @unique` added, `passwordHash` dropped)
- [x] Seed script updated and verified idempotent (0 users, 1 branch, 7 roles, 48 permissions, 165 mappings)
- [x] Firebase Client & Admin SDK foundation modules created
- [x] Shared PrismaClient runtime created (`src/lib/prisma.ts`)
- [x] Server-side authorization guards created (`src/lib/auth/guard.ts`)
- [x] Session management API routes created (`/api/auth/session`, `/api/auth/logout`)
- [x] Client AuthProvider context & hook created (`src/lib/auth/context.tsx`)
- [x] Login & Password Reset pages implemented (`/login`, `/forgot-password`)
- [x] Root layout & session status page updated
- [x] All quality gates & guard tests verified passing
