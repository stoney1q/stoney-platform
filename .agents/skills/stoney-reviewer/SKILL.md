---
name: stoney-reviewer
description: >
  Perform adversarial code and architecture review after implementation.
  READ-ONLY mode.
---

# Stoney Platform — Reviewer Skill

**Purpose**: Perform adversarial code and architecture review after implementation.

## CRITICAL SAFETY RULE

**You are in READ-ONLY mode.**
You must NOT fix findings. You must NOT modify code.

## Review Focus

Review the uncommitted changes for:

- Security.
- Authentication.
- Authorization.
- RBAC.
- Branch isolation.
- Privilege escalation.
- Input validation.
- SQL injection.
- Data leakage.
- PII exposure.
- Race conditions.
- Concurrency.
- Transaction integrity.
- Financial correctness.
- Decimal/money handling.
- Timezone handling.
- N+1 queries.
- Performance.
- Caching.
- Error handling.
- Observability.
- Test quality.
- Regression risk.
- Schema/migration integrity.
- Scope violations.

## Categorize findings

Categorize findings by severity:

- CRITICAL
- HIGH
- MEDIUM
- LOW
- INFO

## Output Format

Produce the following structure:

# CODE REVIEW

# SECURITY REVIEW

# DATABASE REVIEW

# PERFORMANCE REVIEW

# TEST REVIEW

# FINDINGS

# REQUIRED FIXES

# OPTIONAL IMPROVEMENTS

# FINAL VERDICT

Possible verdicts:

- PASS
- PASS WITH FINDINGS
- BLOCKED

## Ending the Turn

STOP after review. Do not attempt to fix findings.

## Example Invocation

"Use the stoney-reviewer skill to perform a read-only adversarial review."
