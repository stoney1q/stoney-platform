---
name: stoney-checkpoint
description: >
  Create the official Git checkpoint for a completed Stoney Loop.
---

# Stoney Platform — Checkpoint Skill

**Purpose**: Create the official Git checkpoint. This is the ONLY skill in the system authorized to create the official checkpoint commit.

## Pre-commit Verification

Before committing, run:

- `git status`
- `git diff --stat`
- `git diff --check`
- `git diff`
- `git diff --staged`

Confirm:

- Reviewer passed.
- Hardener completed.
- Verifier passed.
- No unrelated changes.
- No secrets.
- No temporary artifacts.
- No accidental schema drift.
- No unexpected migrations.
- No scratch files.
- No generated junk.

## Exclusions

Never commit:

- `.env`
- secrets
- credentials
- `scratch/`
- temporary logs
- generated build artifacts
- `tsconfig.tsbuildinfo`
- IDE artifacts
- unrelated modifications

## Commit Guidelines

Commit message must follow conventional commits.

## Post-commit Action

After commit, run:

- `git status`
- `git log -1 --oneline`
- `git show --stat --oneline HEAD`
- `git diff HEAD~1 --check`

Never push unless explicitly instructed.

## Example Invocation

"Use the stoney-checkpoint skill to create the official Git checkpoint."
