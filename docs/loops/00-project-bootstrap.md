# Loop 00 — Project Bootstrap & Database Seed

## Objective

Establish a reproducible, secure, and idempotent foundational database seed for Stoney Platform, resolving all Prisma 7 driver adapter requirements and Next.js build blockers.

---

## Prisma 7 Driver Adapter Architecture Decision

### Context

Prisma 7 with `provider = "prisma-client"` enforces driver adapters for SQL database connectivity. Connecting to Neon PostgreSQL without a driver adapter fails at runtime with `PrismaClientInitializationError` and fails TypeScript type checking (`TS2554: Expected 1 arguments, but got 0`).

### Decision & Rationale

We installed and configured:

- `@prisma/adapter-neon` (v7.9.1)
- `@neondatabase/serverless` (v1.1.0)
- `dotenv` (v17.4.2 as direct dependency)

**Reasoning:**

- Matches the production Neon PostgreSQL database infrastructure.
- Uses WebSocket pool connection management via `PrismaNeon` for Node.js server scripts.
- Eliminates native binary engine overhead while preserving full type safety and Prisma 7 standards.

---

## Seed Configuration & Execution

### Seed Command

```bash
npm run prisma:seed
# Invokes: prisma db seed (configured in prisma.config.ts -> tsx prisma/seed.ts)
```

### Verification Commands

```bash
npx prisma validate
npx prisma generate
npm run prisma:seed
npm run lint
npm run build
```

---

## Seeded Foundational Data

### 1. Branch (1)

- **Head Office** (`HQ`) — Primary Headquarters (Active: `true`)

### 2. Roles (7)

1. **Super Admin** — Full platform and system access with all administrative privileges
2. **Admin** — System administrator with broad operational and management privileges
3. **Manager** — Branch and operations manager overseeing daily business workflows
4. **Technician** — Service and repair specialist managing technical repair jobs and diagnostics
5. **Sales** — Sales representative handling quotations, customer accounts, and sales transactions
6. **Cashier** — Front-desk point-of-sale operator processing payments and register transactions
7. **Inventory Officer** — Stock and warehouse specialist managing inventory levels, movements, and suppliers

### 3. Permissions Taxonomy (48)

Granular permissions structured using the `resource:action` convention across 14 platform domains:

- **Dashboard**: `dashboard:read`
- **Users**: `users:read`, `users:create`, `users:update`, `users:delete`
- **Roles**: `roles:read`, `roles:create`, `roles:update`, `roles:delete`
- **Permissions**: `permissions:read`
- **Branches**: `branches:read`, `branches:create`, `branches:update`, `branches:delete`
- **Products**: `products:read`, `products:create`, `products:update`, `products:delete`
- **Inventory**: `inventory:read`, `inventory:create`, `inventory:update`, `inventory:adjust`
- **Customers**: `customers:read`, `customers:create`, `customers:update`, `customers:delete`
- **Suppliers**: `suppliers:read`, `suppliers:create`, `suppliers:update`, `suppliers:delete`
- **Repairs**: `repairs:read`, `repairs:create`, `repairs:update`, `repairs:delete`, `repairs:assign`
- **Sales**: `sales:read`, `sales:create`, `sales:update`, `sales:void`
- **Quotations**: `quotations:read`, `quotations:create`, `quotations:update`, `quotations:delete`, `quotations:approve`
- **Reports**: `reports:read`, `reports:export`
- **Settings**: `settings:read`, `settings:update`

### 4. Role-Permission Assignments (165 total mappings)

- **Super Admin**: 48 mappings (all permissions)
- **Admin**: 33 mappings (broad management and operations)
- **Manager**: 26 mappings (branch operations, inventory, customers, repairs, sales)
- **Technician**: 10 mappings (repairs, inventory, customers, quotations)
- **Sales**: 17 mappings (sales, customers, quotations, inventory)
- **Cashier**: 7 mappings (sales, POS, customers)
- **Inventory Officer**: 12 mappings (inventory, products, suppliers, reports)

### 5. Role-Permission Seeding Strategy

Role-permission mappings are inserted using `createMany` with `skipDuplicates: true` based on the composite primary key `(roleId, permissionId)`. This guarantees fast batch execution over WebSocket pool connections without network round-trip bottlenecks.

---

## Secure Initial Administrator Strategy

The seed user creation is environment-driven:

- Optional environment variables:
  - `SEED_ADMIN_EMAIL` (e.g. `admin@stoney.internal`)
  - `SEED_ADMIN_PASSWORD` (minimum 8 characters required)
  - `SEED_ADMIN_FIRST_NAME` (defaults to `"Super"`)
  - `SEED_ADMIN_LAST_NAME` (defaults to `"Admin"`)
- If variables are not provided, user creation is skipped safely (0 users seeded).
- Passwords are encrypted with `bcryptjs` (salt rounds: 12).
- Passwords, hashes, and tokens are never logged or exposed.

---

## Idempotency Verification

- First execution completed successfully.
- Second execution completed successfully.
- Database record counts verified across both runs:
  - Branches: **1**
  - Roles: **7**
  - Permissions: **48**
  - RolePermissions: **165**
  - Users: **0** (development default)
- Duplicate records created: **0**

---

## Quality Gate Summary

- [x] Seed import fixed (`../src/generated/prisma/client`)
- [x] Prisma 7 driver adapter resolved (`@prisma/adapter-neon` + `@neondatabase/serverless`)
- [x] Direct dependency for `dotenv` added
- [x] Branch seeded (`HQ`)
- [x] 7 roles seeded
- [x] 48 permissions seeded
- [x] 165 role-permission mappings seeded
- [x] Initial admin strategy securely implemented (skips if env vars not provided)
- [x] Seed idempotency verified (2 consecutive runs, 0 duplicates)
- [x] Prisma validate passes
- [x] Prisma generate passes
- [x] ESLint passes (0 errors, 0 warnings)
- [x] Next.js 16.3 production build passes (TS2554 error resolved)
- [x] Documentation updated
- [x] No secrets exposed
