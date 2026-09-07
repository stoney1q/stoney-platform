---
name: stoney-engineering
description: >
  Master engineering constitution for the Stoney Platform.
  Defines global rules, Stoney Loop lifecycle, model guidance, and engineering standards.
---

# Stoney Platform — Engineering Constitution

**Purpose**: Master engineering constitution. Defines the global rules that all other Stoney skills must follow.

## Stoney Loop Lifecycle

The canonical lifecycle is:

ARCHITECT
↓
PLANNER
↓
HUMAN APPROVAL
↓
IMPLEMENTER
↓
REVIEWER
↓
HARDENER
↓
VERIFIER
↓
CHECKPOINT

Specialist skills:

- **DATABASE** (`stoney-database`)
- **DEBUGGER** (`stoney-debugger`)
  can be invoked whenever required.

The lifecycle must enforce strict phase separation. A later phase must never silently perform the responsibilities of an earlier phase.

## Mandatory Principles

1. **READ BEFORE WRITE**: Always inspect the current implementation before changing it.
2. **PLAN BEFORE IMPLEMENTATION**: Do not write code without an approved plan.
3. **REVIEW BEFORE HARDENING**: Code must be reviewed for security and correctness before being finalized.
4. **VERIFY BEFORE CHECKPOINT**: All tests, builds, and linters must pass before a commit is made.
5. **NO SILENT SCOPE EXPANSION**: Stick strictly to the approved plan.
6. **NO UNAUTHORIZED DATABASE MUTATION**: Destructive operations require explicit human approval.
7. **NO BUSINESS LOGIC CHANGES DURING REVIEW**: The review phase is read-only.
8. **NO COMMITS DURING IMPLEMENTATION**: Commits happen only at the Checkpoint phase.

## Engineering Standards

- **Clean Architecture**: Strong separation of concerns.
- **SOLID Principles**: Adhere to SOLID where appropriate.
- **Strong TypeScript**: Strictly typed. No `any` unless absolutely necessary.
- **Domain-Driven Design**: Group related business logic and models together.
- **Secure-by-default design**: OWASP mindset.
- **Role-Based Access Control (RBAC)**: Ensure proper authorization checks.
- **Branch Isolation**: Every branch-scoped query must derive branch identity from trusted server-side authorization context. Never trust client-supplied branch IDs.
- **Input Validation**: Validate all inputs at the boundary.
- **Error Handling**: Graceful error handling and no PII leakage in logs.
- **Observability**: Proper logging and metrics.
- **Testing**: Maintain high test quality and coverage. Never weaken tests to make them pass.
- **Performance**: Avoid N+1 queries, leverage caching.
- **Financial Correctness**: Never use floating-point arithmetic for financial values. Use Decimal/database arithmetic and serialize safely.
- **Database Safety**: No destructive database operations without explicit human approval.
- **Migration Discipline**: Ensure safe migrations.
- **Secrets Protection**: Do not expose credentials or secrets.

## Model Guidance

- **Gemini 3.1 Pro** is the preferred model for architecture, planning, implementation, security review, hardening, database work, debugging, and final verification.
- Cheaper/faster models may only be used for mechanical low-risk tasks when explicitly appropriate.
- When in doubt, use Gemini 3.1 Pro.

## Example Invocation

"Use the stoney-engineering skill to review the engineering constitution."
