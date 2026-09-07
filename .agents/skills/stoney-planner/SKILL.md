---
name: stoney-planner
description: >
  Convert an approved architecture into an implementation-ready execution plan for the Stoney Platform.
  Use this skill to draft the exact files, database changes, and test requirements before implementing.
---

# Stoney Platform â€” Planner Skill

**Purpose**: Convert an approved architecture into an implementation-ready plan.

## CRITICAL SAFETY RULE

**You are in READ-ONLY mode regarding application code.**
You are EXPLICITLY FORBIDDEN from using any mutating tools on the application codebase:

- DO NOT edit application files.
- DO NOT install packages.
- DO NOT modify Prisma schema or create migrations.
- DO NOT run database migrations or execute database writes.
- DO NOT stage or commit to Git.
- DO NOT implement the loop.

**Allowed Tools**:

- `list_dir`, `view_file`, `grep_search`
- `run_command` (only for `git status`, `git log`, `git diff --check`, or other non-destructive reads)
- `write_to_file` / `replace_file_content` (ONLY for creating/updating planning artifacts: `implementation_plan.md` and `task.md`)

## Git Baseline Check

Before drafting the plan, you must inspect:

- `git status`
- `git log --oneline -8`
- `git diff --check`
  Identify any unrelated/uncommitted changes and explicitly instruct the implementation phase to NEVER overwrite them.

## Required Behavior

1. Read the approved architecture.
2. Inspect the current repository to establish context.
3. Establish the Git baseline as detailed above.
4. Identify exact files to create/change.
5. Identify schema/migration changes.
6. Identify server actions.
7. Identify validation requirements.
8. Identify authorization/RBAC requirements.
9. Identify branch isolation requirements.
10. Identify concurrency requirements.
11. Identify UI routes/components.
12. Define test cases.
13. Define verification commands.
14. Define rollback/recovery considerations.
15. Identify dangerous/destructive operations (e.g., `prisma migrate reset`) requiring explicit human approval.

Every step in the plan must specify:

- exact file
- intended change
- reason
- dependencies
- tests required

## Output Format

You MUST use the `write_to_file` tool to create the `implementation_plan.md` artifact (in the `<appDataDir>\brain\<conversation-id>` directory).
You MUST set `ArtifactMetadata.RequestFeedback = true` to trigger Antigravity Planning Mode.

The plan MUST contain the following exact sections:

# OBJECTIVE

# APPROVED ARCHITECTURE

# IMPLEMENTATION BOUNDARY

# FILES TO CREATE

# FILES TO MODIFY

# FILES NOT TO TOUCH

# DATABASE CHANGES

# MIGRATION PLAN

# SERVER/API CHANGES

# UI CHANGES

# SECURITY REQUIREMENTS

# TEST PLAN

# VALIDATION PLAN

# GIT CHECKPOINT PLAN

# ROLLBACK/RECOVERY PLAN

## Ending the Turn

At the very end of your artifact summary or your response, you MUST state exactly:
**READY FOR IMPLEMENTATION: YES/NO**

After outputting this, you MUST STOP calling tools and request human approval before implementation begins. Use Planning Mode (`request_feedback = true` when saving `implementation_plan.md`).

## Example Invocation

"Use the stoney-planner skill to convert the approved Loop 10 architecture into an implementation plan."
