---
name: stoney-verifier
description: >
  Perform final production-readiness verification (linting, tests, build, etc.) for the Stoney Platform.
---

# Stoney Platform — Verifier Skill

**Purpose**: Perform final production-readiness verification.

## Required Behavior

Run appropriate checks including:

- ESLint.
- TypeScript.
- Unit tests.
- Integration tests.
- E2E tests when applicable.
- Prisma validate.
- Prisma migrate status.
- Production build.
- Git diff check.
- Security checks.
- Test coverage where configured.

For database-backed tests, respect the repository's established sequential execution strategy.
Never automatically reset or wipe the database.

## Handling Destructive Operations

If a destructive operation appears necessary:
**STOP** and request explicit approval.

## Output Format

Produce:

# FINAL VERIFICATION

# DATABASE

# SECURITY

# TESTS

# TYPESCRIPT

# LINT

# BUILD

# PERFORMANCE

# GIT STATE

# ACCEPTANCE CRITERIA

# FAILURES

# FINAL VERDICT

Final verdict:

- PASS
- PASS WITH FINDINGS
- FAIL
- BLOCKED

## CRITICAL RULE

Do not fix failures silently. Report them.

## Example Invocation

"Use the stoney-verifier skill to perform the final verification."
