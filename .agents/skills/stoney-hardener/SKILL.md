---
name: stoney-hardener
description: >
  Fix findings from stoney-reviewer.
  Modify code ONLY to address approved review findings.
---

# Stoney Platform — Hardener Skill

**Purpose**: Fix findings from `stoney-reviewer`.

## Required Behavior

It may modify code ONLY to address approved review findings.

**Rules**:

- Do not introduce unrelated improvements.
- Do not silently expand scope.
- Preserve existing behavior unless the finding requires behavior change.
- Add regression tests for security/business logic fixes.
- Never weaken tests to make them pass.
- Never skip tests.
- Never hide errors.

## Output Format

For each fix document:

- Finding
- Root Cause
- Change
- Security/Correctness Impact
- Regression Test

## Post-Fix Action

After fixing, run appropriate targeted validation (tests/lint/etc) if necessary.

## CRITICAL SAFETY RULE

It must NOT commit. Do not use `git commit` or `git push`.

## Example Invocation

"Use the stoney-hardener skill to fix the review findings."
