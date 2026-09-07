---
name: stoney-architect
description: >
  Perform a rigorous domain dependency review and architecture design for the Stoney Platform.
  Use this skill to design the architecture before any code is written or planned.
---

# Stoney Platform — Architect Skill

**Purpose**: Perform domain dependency analysis and architecture design BEFORE implementation.

## CRITICAL SAFETY RULE

**You are in READ-ONLY mode.**
You are EXPLICITLY FORBIDDEN from using any mutating tools on the application codebase:

- DO NOT edit application code (`write_to_file`, `replace_file_content`, etc.)
- DO NOT install packages
- DO NOT modify Prisma schema or create migrations
- DO NOT modify database data or run database seeds
- DO NOT commit or push to Git
- DO NOT implement the loop

**Allowed Tools**:

- `list_dir`, `view_file`, `grep_search`
- `run_command` (only for `git status`, `git log`, `git diff --check`, or other non-destructive reads)

## Required Behavior

Follow these steps strictly:

1. Read the current roadmap (`ROADMAP.md`) and milestones (`docs/business/milestones.md` if present).
2. Read relevant domain documentation in `docs/`.
3. Inspect the actual repository to understand the current state.
4. Inspect `prisma/schema.prisma` and existing domain implementations.
5. Identify completed dependencies.
6. Identify missing dependencies.
7. Identify security implications.
8. Identify branch-isolation requirements.
9. Identify concurrency requirements.
10. Identify data-integrity risks.
11. Identify performance considerations.
12. Define database changes.
13. Define backend/server-action changes.
14. Define UI routes/components.
15. Define tests.
16. Define acceptance criteria.
17. Explicitly define deferred scope.

Explicitly identify:

- What already exists.
- What is missing.
- What should NOT be changed.
- Whether schema changes are required.
- Whether migrations are required.
- Database mutation requirements.

## Output Format

Produce a structured architecture document (as a markdown response or scratchpad artifact) containing:

# DOMAIN DEPENDENCY REVIEW

# CURRENT STATE

# DEPENDENCIES

# DOMAIN BOUNDARIES

# SECURITY MODEL

# DATA MODEL

# API/SERVER ACTION DESIGN

# UI ARCHITECTURE

# PERFORMANCE

# CONCURRENCY

# OBSERVABILITY

# TESTING STRATEGY

# DATABASE/MIGRATION IMPACT

# RISKS

# DEFERRED SCOPE

# ACCEPTANCE CRITERIA

# IMPLEMENTATION STAGES

## Ending the Turn

At the very end of your output, you MUST state exactly:
**READY FOR IMPLEMENTATION: YES/NO**

After outputting this, you MUST STOP calling tools and yield back to the user to wait for human approval.

## Example Invocation

"Use the stoney-architect skill for Loop 10."
