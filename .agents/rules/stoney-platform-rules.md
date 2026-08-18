# Stoney Platform — Core Rules

These rules apply to every interaction with the `stoney-platform` codebase.

---

## Project Identity

- **Project**: `stoney-platform`
- **Local repository**: `C:\Users\micha\Documents\stoney-platform`
- **GitHub repository**: `stoney1q/stoney-platform`
- **Primary branch**: `main`
- The existing repository is the single source of truth.
- Existing work must be preserved.

---

## Absolute Rules

### NEVER

- Create another Stoney project.
- Create `stoney-platform-app`.
- Recreate the application.
- Delete existing features.
- Delete existing documentation.
- Delete existing migrations.
- Rewrite the architecture without evidence.
- Replace the current stack simply because another technology is preferred.
- Perform unrelated refactors.
- Expose secrets.
- Print `.env` credentials.
- Commit `.env`.
- Modify applied migrations.
- Introduce duplicate implementations of existing functionality.
- Declare a feature complete without verification.

### ALWAYS

- Inspect before modifying.
- Understand existing code before replacing it.
- Prefer incremental changes.
- Preserve existing architectural decisions unless there is a documented reason to change them.
- Keep changes scoped to the active loop.
- Validate every meaningful change.
- Update relevant documentation.
- Maintain security boundaries.
- Use Git checkpoints.
- Report blockers clearly.
- Fix root causes rather than symptoms.

---

## Source of Truth — Priority Order

1. Actual repository
2. Database state
3. Applied migrations
4. Existing tests
5. Existing architecture documentation
6. Loop documentation
7. Project roadmap
8. AI assumptions

Never invent repository state.

If documentation conflicts with the repository:

- Report the discrepancy.
- Preserve working code.
- Update documentation after the correct state is established.

---

## Database Architecture

Existing database:

```
Neon PostgreSQL → Prisma 7 → src/generated/prisma/
```

Existing foundation entities:

```
Branch, Role, Permission, RolePermission, User
```

RBAC model:

```
User → Role → RolePermission ← Permission
```

Existing RBAC migration: `20260805221829_rbac_foundation` — do not recreate it.

### Prisma Generator

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

### Correct Generated Client Import

```typescript
import { PrismaClient } from '../src/generated/prisma/client';
```

Never assume the old Prisma import path (`@prisma/client`) works.

---

## Security & Environment

Never expose:

```
DATABASE_URL, database passwords, API keys, Firebase secrets,
OAuth secrets, session secrets, private credentials
```

Never commit:

```
.env, .env.local, .env.*.local
```

Inspect `.gitignore` before making security-related commits.

If secrets appear to have been committed publicly: **STOP**. Do not reproduce them. Report the security issue and recommend credential rotation.

---

## Authorization Principle

- **Authentication** answers: WHO ARE YOU?
- **Authorization** answers: WHAT ARE YOU ALLOWED TO DO?

Keep these concerns separate. Server-side authorization is mandatory.

Prefer reusable authorization primitives:

```
requireAuth(), requireRole(), requirePermission()
```

Never rely on frontend button visibility for security.

---

## Engineering Principles

**Prefer**: Simple, Explicit, Typed, Validated, Tested, Secure, Observable, Maintainable, Scalable.

**Avoid**: Premature abstraction, Unnecessary dependencies, Magic behavior, Duplicated business logic, Global mutable state, Client-side security, Hidden side effects, Large unrelated refactors.

---

## AI-Specific Rule

Do not optimize for producing the largest amount of code.
Optimize for producing the smallest amount of **correct production-quality code**.

Before writing code, understand: WHY, WHAT, WHERE, DEPENDENCIES, RISKS, VERIFICATION.

---

## Operational Awareness

At every moment, know:

1. What loop are we in?
2. What is its objective?
3. What is its scope?
4. What has been verified?
5. What remains?
6. What is the next safe action?

Do not drift between unrelated tasks. Do not silently expand scope. Do not lose project context. Do not rebuild existing work. Do not declare success without verification.
