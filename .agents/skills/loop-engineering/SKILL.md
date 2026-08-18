---
name: loop-engineering
description: >
  Loop Engineering lifecycle, quality gates, and definition of done for the Stoney Platform.
  Use when starting, managing, or completing a feature loop. Covers loop definition templates,
  lifecycle steps, parallel work rules, quality/security/docs/git gates, definition of done,
  and failure/blocker protocol.
---

# Loop Engineering — Stoney Platform

Every major feature must be implemented as a **loop** — a bounded engineering unit.

---

## Engineering Model

```
                    STONEY PLATFORM
                           │
                           ▼
                  LOOP ENGINEERING
                           │
                           ▼
                    ACTIVE LOOP
                           │
                           ▼
                  ENGINEERING PLAN
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           DATABASE      BACKEND      FRONTEND
              │            │            │
              └────────────┼────────────┘
                           ▼
                    INTEGRATION
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
             SECURITY              QA
                 │                   │
                 └─────────┬─────────┘
                           ▼
                    ACCEPTANCE TEST
                           │
                           ▼
                      DOCUMENT
                           │
                           ▼
                    GIT CHECKPOINT
                           │
                           ▼
                     LOOP COMPLETE
```

No loop is complete until its acceptance criteria and quality gates pass.

---

## Loop Definition Template

Each loop must define:

```
LOOP ID
TITLE
OBJECTIVE
CONTEXT
SCOPE
NON-GOALS
DEPENDENCIES
DATABASE CONTRACT
BACKEND CONTRACT
FRONTEND CONTRACT
SECURITY REQUIREMENTS
TEST REQUIREMENTS
OBSERVABILITY REQUIREMENTS
DOCUMENTATION REQUIREMENTS
ACCEPTANCE CRITERIA
VERIFICATION COMMANDS
GIT CHECKPOINT
```

Agents must not silently expand loop scope. If a new requirement appears:

1. Determine whether it is required for the active loop.
2. If required, incorporate it explicitly.
3. If not required, record it as future work.
4. Do not derail the active loop.

---

## Loop Lifecycle

Every loop follows this sequence. A failed step means the loop is not complete. Never hide failures.

```
DISCOVER
   ↓
PLAN
   ↓
CONTRACT
   ↓
IMPLEMENT
   ↓
INTEGRATE
   ↓
TEST
   ↓
SECURITY REVIEW
   ↓
QUALITY REVIEW
   ↓
DOCUMENT
   ↓
GIT CHECKPOINT
   ↓
ACCEPT
```

---

## Parallel Work Rules

Parallel agents are allowed only when dependencies are understood.

**Good** — stable contract exists first:

```
Stable API Contract
       │
 ┌─────┴─────┐
 ▼           ▼
Backend    Frontend
```

**Bad** — conflicting changes without coordination:

```
Agent A → changes database
Agent B → changes same database
Agent C → changes same API
Agent D → changes architecture
```

Do not allow simultaneous conflicting architectural changes. The Lead Architect must establish contracts before parallel work begins.

---

## Quality Gates

Before declaring a loop complete, run the appropriate:

- TypeScript validation
- ESLint
- Build
- Unit tests
- Integration tests
- E2E tests
- Database verification
- Security review

At minimum:

```bash
npm run lint
npm run build
```

plus all relevant tests.

If a command fails:

```
REPRODUCE → IDENTIFY ROOT CAUSE → FIX → RE-RUN → VERIFY
```

Never ignore failing validation.

---

## Security Gate

Before loop completion, explicitly review:

- Authentication
- Authorization
- Input validation
- Secrets
- Error handling
- Data exposure
- Privilege escalation
- Session security
- Rate limiting
- Logging

Document important findings.

---

## Documentation Gate

When implementation changes architecture, API behavior, schema, security behavior, or operational behavior: update the relevant documentation.

Documentation must describe the implementation that actually exists.

---

## Git Gate

Before committing:

```bash
git status
git diff
```

Ensure:

- No secrets
- No generated artifacts accidentally included
- No unrelated modifications
- No debug code
- No temporary files

Use focused commits. Examples:

```
feat(seed): complete foundational RBAC seed
feat(auth): implement authentication
feat(auth): add protected dashboard access
test(auth): add authentication coverage
fix(auth): enforce server-side permissions
```

Never push known-broken code.

---

## Definition of Done

A loop is DONE only when:

- [ ] Objective implemented
- [ ] Scope respected
- [ ] Database verified
- [ ] Backend verified
- [ ] Frontend verified
- [ ] Validation implemented
- [ ] Authorization verified
- [ ] Security reviewed
- [ ] Tests pass
- [ ] Build passes
- [ ] Documentation updated
- [ ] Git diff reviewed
- [ ] Focused commit created
- [ ] No known critical issues remain

---

## Failure / Blocker Protocol

If implementation becomes blocked, do NOT improvise a major architecture change. Instead report:

```
BLOCKER
CAUSE
AFFECTED LOOP
AFFECTED FILES
OPTIONS
RECOMMENDED OPTION
```

Only ask the user when the decision is genuinely product-level, destructive, security-sensitive, or irreversible.
