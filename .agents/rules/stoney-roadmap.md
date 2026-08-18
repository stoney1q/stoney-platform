# Stoney Platform — Technology, Roadmap & Active Context

---

## Current Technology Stack

### Frontend

```
Next.js 16.3.0
React 19.2.8
TypeScript 5.9.x
Tailwind CSS 4
shadcn/ui
Base UI
Lucide React
React Hook Form
Zod
```

### Backend / Data

```
Node.js
Prisma 7.9.1
PostgreSQL (Neon)
bcryptjs
```

### Authentication — DECISION PENDING

Currently installed: `next-auth@4.24.15`

Firebase Authentication is being considered as an alternative.

**Do NOT implement authentication** until the authentication loop evaluates:

| Option A               | Option B                                  |
| ---------------------- | ----------------------------------------- |
| NextAuth v4 + bcryptjs | Firebase Authentication + PostgreSQL RBAC |

Evaluation criteria: security, architecture, maintainability, cost, scalability, developer experience, Next.js integration, PostgreSQL RBAC integration, long-term business requirements.

Do not change authentication technology merely because Firebase exists.

If Firebase Authentication is selected, PostgreSQL remains source of truth for: User, Role, Permission, RolePermission, Branch.

Do not move the core ERP database to Firestore unless a separate architecture review explicitly approves it.

### UI Stack — Do Not Add Libraries

Existing UI: Tailwind CSS, shadcn/ui, Base UI, Lucide. Do not introduce unnecessary component libraries.

---

## Documentation System

```
docs/
├── api/
├── architecture/
├── business/
├── database/
├── decisions/
├── deployment/
├── diagrams/
├── engineering/
├── loops/
└── ui/
```

Existing loops:

```
docs/loops/
├── 00-project-bootstrap.md
├── 01-authentication.md
├── 02-dashboard.md
├── 03-products.md
├── 04-inventory.md
├── 05-services.md
├── 06-media.md
├── 07-repairs.md
├── 08-quotations.md
└── 09-ai.md
```

Before creating a document: **SEARCH FIRST**. If an appropriate document exists: **UPDATE IT**. Do not create duplicates.

---

## Product Roadmap

| Feature               | Status      |
| --------------------- | ----------- |
| Database Foundation   | COMPLETE    |
| RBAC Foundation       | COMPLETE    |
| Database Seed         | IN PROGRESS |
| Authentication        | NEXT        |
| Dashboard             | NEXT        |
| Products              | PLANNED     |
| Inventory             | PLANNED     |
| Customers / Suppliers | PLANNED     |
| Repairs               | PLANNED     |
| Sales / Quotations    | PLANNED     |
| CMS                   | PLANNED     |
| AI / Automation       | PLANNED     |
| Reports / Analytics   | PLANNED     |
| System Settings       | PLANNED     |

Do not skip foundational dependencies.

---

## Initial Repository Inspection

Before implementation, execute:

```bash
git status
git log --oneline -10
npm list --depth=0
npx prisma validate
```

Then inspect:

```
package.json, prisma/schema.prisma, prisma.config.ts, prisma/seed.ts,
.gitignore, src/generated/prisma/, src/app/, src/components/, src/lib/, docs/
```

Also inspect: `README.md`, `ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`

Do not modify these merely because they exist. Understand them first.

---

## Initial Status Report Template

After inspection, produce:

```
STONEY PLATFORM STATUS

Repository:
Git:
Dependencies:
Prisma:
Database:
Schema:
Seed:
Authentication:
Frontend:
Backend:
Documentation:
Current Loop:
Broken:
Incomplete:
Risks:

RECOMMENDED NEXT ACTION:
```

Do not ask the user to repeat information already present in the repository.

---

## Immediate Active Loop — DATABASE SEED

After repository inspection, the immediate priority is to verify and complete `prisma/seed.ts`.

Expected foundational data:

```
Head Office / HQ

Super Admin, Admin, Manager, Technician, Sales, Cashier, Inventory Officer
```

The seed must be idempotent.

Correct Prisma import:

```typescript
import { PrismaClient } from '../src/generated/prisma/client';
```

Verify the seed actually executes. Do not merely claim it should work.

---

## Authentication Loop — After Seed

After the seed is verified, activate **LOOP — AUTHENTICATION**.

Before implementation, compare Option A (NextAuth v4 + bcryptjs) vs Option B (Firebase Authentication + PostgreSQL RBAC).

Do not implement both. Select one based on an explicit architecture decision.
