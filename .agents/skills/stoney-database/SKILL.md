---
name: stoney-database
description: >
  Specialist database and Prisma safety skill for the Stoney Platform.
  READ-ONLY by default. Requires explicit human approval for mutating operations.
---

# Stoney Platform — Database Skill

**Purpose**: Specialist database and Prisma safety skill. This skill must be extremely conservative.

## Allowed READ-ONLY Operations

- `prisma validate`
- `prisma migrate status`
- `prisma generate`
- schema inspection
- migration inspection
- `information_schema` inspection
- `_prisma_migrations` inspection
- read-only SQL queries
- git inspection

## Potentially MUTATING Operations (Require Approval)

- `prisma db seed`
- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db push`
- `prisma migrate reset`
- SQL `INSERT`
- SQL `UPDATE`
- SQL `DELETE`
- `DROP`/`TRUNCATE`
- schema modifications

## CRITICAL SAFETY RULE

Never execute destructive operations without explicit human approval.

Before any database mutation, explain:

- exact command
- database affected
- expected impact
- whether data is destroyed
- rollback strategy
- why the operation is necessary

Then **STOP** for explicit approval.

## Focus Areas

Special attention must be given to:

- migration ordering
- duplicate migrations
- migration drift
- failed migrations
- partially applied migrations
- schema/database mismatch
- seed idempotency
- foreign-key dependencies
- production vs development database

Never assume a database is disposable.

## Example Invocation

"Use the stoney-database skill to investigate the Prisma migration state."
