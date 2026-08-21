# Authentication & Authorization Schema

## Status

This document reflects the **current** Prisma schema as of the Database Seed Loop (Loop 00).
The Authentication Loop (Loop 01) will introduce a controlled migration.

---

## Schema Discrepancy Notice

The original stub of this document listed `Session` and `AuditLog` as models in the schema.
**Neither model exists in the current Prisma schema.**

The actual schema contains exactly 5 models:

```text
Branch
Role
Permission
RolePermission
User
```

Session management will be handled by Firebase Authentication (identity tokens / session cookies),
not by a database `Session` table.

`AuditLog` is a planned future model and will be introduced in a dedicated loop.

---

## Current Models

### Branch

```prisma
model Branch {
  id       String  @id @default(cuid())
  name     String
  code     String  @unique
  address  String?
  phone    String?
  email    String?
  isActive Boolean @default(true)

  users User[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Role

```prisma
model Role {
  id          String  @id @default(cuid())
  name        String  @unique
  description String?

  users           User[]
  rolePermissions RolePermission[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Permission

```prisma
model Permission {
  id          String  @id @default(cuid())
  name        String  @unique
  description String?

  rolePermissions RolePermission[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### RolePermission

```prisma
model RolePermission {
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}
```

### User (current — pre-Firebase)

```prisma
model User {
  id String @id @default(cuid())

  firstName String
  lastName  String

  email        String @unique
  passwordHash String        // PENDING REMOVAL in Authentication Loop

  phone  String?
  avatar String?

  emailVerified Boolean @default(false)
  isActive      Boolean @default(true)

  branchId String
  roleId   String

  branch Branch @relation(fields: [branchId], references: [id])
  role   Role   @relation(fields: [roleId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([branchId])
  @@index([roleId])
}
```

---

## Pending Schema Changes (Authentication Loop)

The following changes are **proposed** and will be applied as a Prisma migration in Loop 01.
The schema must not be modified until the Authentication Loop is authorized.

### Add `firebaseUid`

```prisma
firebaseUid String? @unique
```

**Rationale**: Maps the verified Firebase `uid` (from the ID token) to the PostgreSQL User.
`firebaseUid` is immutable and guaranteed unique by Google. Email may change; uid never does.
Nullable (`String?`) initially during migration rollout; tightened to required post-provisioning.

### Remove `passwordHash`

```prisma
// passwordHash String  — REMOVE
```

**Rationale**: With Firebase as IdP, Stoney Platform application servers never handle passwords.
Retaining this field creates false expectations and dead code surface.

---

## Relationships (current and post-migration)

```
Branch
└── Users (User.branchId → Branch.id)

Role
├── Users (User.roleId → Role.id)
└── RolePermission (RolePermission.roleId → Role.id)

Permission
└── RolePermission (RolePermission.permissionId → Permission.id)

User
├── Branch  (User.branchId)
└── Role    (User.roleId → RolePermission → Permission)
```

**Planned post-auth additions (future loops):**

```
User
└── AuditLog (planned)
```

---

## Indexes

| Model          | Fields                   | Type                                    |
| -------------- | ------------------------ | --------------------------------------- |
| Branch         | `code`                   | `@unique`                               |
| Role           | `name`                   | `@unique`                               |
| Permission     | `name`                   | `@unique`                               |
| RolePermission | `(roleId, permissionId)` | Composite `@id`                         |
| User           | `email`                  | `@unique` + `@@index`                   |
| User           | `firebaseUid`            | `@unique` (pending Authentication Loop) |
| User           | `branchId`               | `@@index`                               |
| User           | `roleId`                 | `@@index`                               |
