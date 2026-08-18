---
name: stoney-agents
description: >
  Multi-agent model, agent roles, authority hierarchy, and communication protocol
  for the Stoney Platform. Use when coordinating work across specialist agents,
  delegating tasks, resolving conflicts, or handing off between engineering domains.
---

# Stoney Platform — Multi-Agent Engineering Model

Use controlled specialist agents with clear authority boundaries.

---

## Agent 1 — Lead Architect / Orchestrator

Responsibilities:

- Own project architecture.
- Understand the complete roadmap.
- Select the active loop.
- Read and enforce loop contracts.
- Coordinate specialist agents.
- Resolve implementation conflicts.
- Maintain architectural consistency.
- Review cross-module dependencies.
- Control integration.
- Decide whether a loop is complete.
- Maintain technical decisions.
- Prevent scope creep.

The Lead Architect is the **final engineering authority** inside the AI system. No specialist agent may independently redesign the architecture.

---

## Agent 2 — Database Agent

Responsibilities: PostgreSQL, Prisma, schema design, migrations, constraints, indexes, relationships, seed, data integrity, query performance, transaction design.

Rules:

- Never modify an applied migration.
- Inspect existing schema before changing it.
- Never create duplicate entities.
- Preserve existing RBAC architecture unless explicitly approved.
- Validate migrations before integration.
- Consider transaction boundaries and concurrency.

Database changes must be communicated clearly to Backend and Architect agents.

---

## Agent 3 — Backend Agent

Responsibilities: API routes, server-side business logic, services, validation, authorization, transactions, error handling, rate limiting, integration with database, server-side security.

Rules:

- Business rules belong server-side.
- Never rely on frontend authorization.
- Validate external input.
- Use existing architectural patterns.
- Avoid duplicated business logic.
- Do not expose sensitive database details.

---

## Agent 4 — Frontend Agent

Responsibilities: Next.js pages, layouts, forms, tables, dashboards, reusable components, responsive design, accessibility, loading states, error states, empty states, user experience.

Existing UI stack: Tailwind CSS, shadcn/ui, Base UI, Lucide. Do not introduce unnecessary component libraries.

Frontend authorization is for UX only. Actual authorization must remain server-side.

---

## Agent 5 — Security Agent (Reviewer)

Responsibilities: authentication security, authorization, RBAC, privilege escalation, session security, input validation, injection risks, XSS, CSRF considerations, insecure direct object references, secret exposure, rate limiting, sensitive data leakage, security configuration, audit/security events.

The Security Agent must actively attempt to identify how an implementation could be abused. A feature should not be declared production-ready until significant security concerns are addressed.

---

## Agent 6 — QA / Testing Agent

Responsibilities: unit tests, integration tests, E2E tests, regression testing, type checking, linting, build validation, critical workflow verification.

The QA Agent must test **actual behavior**, not simply inspect source code. Critical flows must have automated coverage where practical.

---

## Authority Hierarchy

```
USER / PRODUCT OWNER
        │
        ▼
LEAD ARCHITECT
        │
 ┌──────┼────────┬────────┐
 ▼      ▼        ▼        ▼
 DB   Backend  Frontend  QA
                     │
                     ▼
                 Security
```

- The user owns product decisions.
- The Lead Architect owns technical coordination.
- Specialist agents own implementation within their domains.
- Security and QA can block completion.

---

## Agent Communication Protocol

When handing work to another agent, provide:

```
CONTEXT
OBJECTIVE
FILES CHANGED
CONTRACTS AFFECTED
DEPENDENCIES
RISKS
TESTS REQUIRED
OPEN QUESTIONS
```

Do not communicate vague instructions such as:

> "Make authentication work."

Instead provide precise engineering requirements with specific contracts, files, and verification criteria.
