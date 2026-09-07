# Stoney Antigravity Engineering Workflow

## 1. Philosophy

The Stoney Platform relies on a deterministic, highly-controlled engineering lifecycle. Agentic development introduces massive velocity but also significant risks of scope creep, regressions, and destructive data actions. This workflow harnesses Antigravity's capabilities while enforcing strict boundaries between architecture, planning, implementation, and review.

## 2. Lifecycle

Every feature (Loop) follows this exact sequence:
**DISCOVERY** â†’ **DOMAIN DEPENDENCY REVIEW** â†’ **ARCHITECTURE DESIGN** â†’ **IMPLEMENTATION PLAN** â†’ **HUMAN APPROVAL** â†’ **IMPLEMENTATION** â†’ **VERIFICATION** â†’ **READ-ONLY CODE REVIEW** â†’ **CORRECTIVE HARDENING** â†’ **FINAL VERIFICATION** â†’ **GIT CHECKPOINT**

## 3. Capability/Skill Architecture

Custom slash commands (e.g., `/stoney-plan`) are not supported by the Antigravity IDE natively. Instead, Stoney capabilities are implemented as **Custom Skills** located in `.agents/skills/`. You invoke them conversationally (e.g., "Run the stoney-architect skill").

### STONEY ARCHITECT (`stoney-architect`)

- **Purpose**: Perform domain dependency analysis and architecture design.
- **Allowed Tools**: Read-only tools (`list_dir`, `view_file`, `grep_search`).
- **Forbidden**: `write_to_file`, `replace_file_content`, `run_command` (destructive).
- **Output**: Markdown response detailing architecture.

### STONEY PLANNER (`stoney-planner`)

- **Purpose**: Convert architecture into a concrete plan.
- **Mechanism**: Enters Antigravity **Planning Mode**.
- **Output**: Generates `implementation_plan.md` (with `request_feedback=true`).
- **Stop Condition**: Must halt and wait for explicit human approval via the IDE UI.

### STONEY IMPLEMENTER (`stoney-implementer`)

- **Purpose**: Implement the approved plan and nothing else.
- **Mechanism**: **Execution Mode**.
- **Output**: Creates/updates `task.md` (TODO list) and performs file edits.
- **Stop Condition**: Halts immediately when the tasks in the approved plan are complete.

### STONEY VERIFIER (`stoney-verifier`)

- **Purpose**: Run deterministic verification checks.
- **Mechanism**: Executes background terminal tasks via `run_command`.
- **Requirements**: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

### STONEY REVIEWER (`stoney-reviewer`)

- **Purpose**: Perform STRICT READ-ONLY post-implementation code review.
- **Mechanism**: Inspects `git diff` and project state.
- **Forbidden**: Making ANY code modifications.
- **Output**: A detailed findings report (in chat or artifact) stopping immediately after generation.

### STONEY HARDENER (`stoney-hardener`)

- **Purpose**: Fix ONLY the findings approved from the Reviewer phase.
- **Mechanism**: Targeted execution mode file edits.

### STONEY CHECKPOINT (`stoney-checkpoint`)

- **Purpose**: Create a clean Git checkpoint.
- **Mechanism**: Verifies `git diff --check`, stages files with `git add`, and commits with `git commit -m`.

## 4. Planning Protocol

Planning must always precede implementation. The `stoney-planner` uses the system's native Planning Mode to output `implementation_plan.md`. This plan MUST include:

- Files to create/delete/modify.
- Prisma schema updates.
- Server actions and UI routes.
- RBAC and security constraints.
- Rollback strategies.
  The agent must STOP after presenting the plan.

## 5. Implementation Protocol

Implementation is handled by `stoney-implementer`.

- **Artifact**: `task.md` must be created tracking all `[ ]` pending and `[x]` completed steps.
- **Rule**: Never silently expand scope. If an unforeseen dependency arises, the agent must pause and request plan revision.

## 6. Verification Protocol

Managed by `stoney-verifier`.

- Background tasks (`npm run build`, `vitest`) are launched using `WaitMsBeforeAsync`.
- The agent tracks task IDs and waits for asynchronous completion notifications without polling or blocking the event loop.

## 7. Read-Only Review Protocol

Managed by `stoney-reviewer`.

- Uses `run_command` with `git diff` to inspect exact delta.
- Audits specifically for: Branch isolation leakage, privilege escalation risks, money handling (Decimal), and test coverage.
- Strictly forbidden from attempting inline fixes.

## 8. Corrective Hardening Protocol

Managed by `stoney-hardener`.

- Takes the findings from the review phase and executes surgical fixes.
- Runs `stoney-verifier` again immediately after fixes are complete.

## 9. Git Checkpoint Protocol

Managed by `stoney-checkpoint`.

- Establishes the baseline commit via `git log`.
- Discards temporary scratch files from being staged.
- Only commits verified, passing code.

## 10. Database Safety Protocol

- **Strict Human Consent**: `prisma migrate reset`, `prisma db push`, `prisma migrate dev`, or destructive PostgreSQL queries require explicit user approval (enforced by the `accidental-data-loss-prevention` skill).
- The agent must state the exact destructive command and explicitly ask "Do I have your consent to execute this?"

## 11. Test Database Concurrency Protocol

- Vitest tests mutate the test database heavily (e.g., `deleteMany`).
- **Rule**: All test executions MUST run sequentially. `vitest.config.ts` must maintain `pool: 'forks'`.
- Background agents must not concurrently invoke tasks that mutate the same database.

## 12. Model Selection Strategy

- **Architecture, Code Review, Security Auditing**: Gemini 3.1 Pro (Highest reasoning).
- **Complex Implementation**: Gemini 3.1 Pro.
- **Routine Boilerplate / Basic Verification**: Gemini 3.1 Flash (if configured/available).

## 13. Background Agent Strategy

- Agents can spawn asynchronous verification or deployment tasks.
- Agents must use `schedule` (Condition: "any") to intelligently wait for background results, or simply yield turn control to the messaging system, allowing it to natively wake up the agent when tasks finish.

## 14. Artifact Strategy

- **`implementation_plan.md`**: Design blueprint requiring user approval.
- **`task.md`**: Living checklist used purely during execution.
- **`walkthrough.md`**: User-facing summary upon Loop completion.
- **`scratch/`**: Temporary location for isolation scripts or one-off tests.

## 15. Scope Control Rules

- The agent must not guess user intent. If a requirement is underspecified, the agent must ask clarifying questions.
- Unrelated codebase refactoring is forbidden unless explicitly approved.

## 16. Emergency/Failure Recovery

If an implementation enters an unrecoverable state:

1. `git restore .` (Discard uncommitted changes).
2. Reset the database state (requiring Human Approval).
3. Return to the Planning phase.

## 17. Standard Loop Template

Copy and paste this template to drive the agent through the lifecycle:

```text
LOOP XX â€” DOMAIN DEPENDENCY REVIEW
Use the stoney-architect skill to review dependencies for Loop XX.

LOOP XX â€” ARCHITECTURE
Use the stoney-architect skill to design the architecture for Loop XX.

LOOP XX â€” IMPLEMENTATION PLAN
Use the stoney-planner skill to draft the implementation plan.

LOOP XX â€” IMPLEMENTATION
Use the stoney-implementer skill to execute the approved plan.

LOOP XX â€” VERIFICATION
Use the stoney-verifier skill to run lint, tsc, tests, and build.

LOOP XX â€” CODE REVIEW
Use the stoney-reviewer skill to perform a strictly read-only audit of the diff.

LOOP XX â€” HARDENING
Use the stoney-hardener skill to fix the identified review findings.

LOOP XX â€” FINAL VERIFICATION
Use the stoney-verifier skill to confirm the hardening fixes.

LOOP XX â€” GIT CHECKPOINT
Use the stoney-checkpoint skill to commit the completed Loop XX to Git.
```

---

# RECOMMENDED DAILY WORKFLOW

When opening a new Loop in Antigravity, follow these exact steps:

1. **Start the Loop**:
   _User prompt:_ "We are starting Loop 10. Use the `stoney-architect` skill to perform a domain dependency review and architecture design."
2. **Request the Plan**:
   _User prompt:_ "The architecture is approved. Use the `stoney-planner` skill to generate the implementation plan."
3. **Approve the Plan**:
   _Action:_ Click "Proceed" in the UI when the `implementation_plan.md` artifact is presented.
4. **Execute**:
   _User prompt:_ "Use the `stoney-implementer` skill to execute the approved plan."
5. **Verify**:
   _User prompt:_ "Use the `stoney-verifier` skill to test the implementation."
6. **Review**:
   _User prompt:_ "Use the `stoney-reviewer` skill to perform a read-only code review of the uncommitted changes."
7. **Harden**:
   _User prompt:_ "Use the `stoney-hardener` skill to apply fixes for the findings, then verify again."
8. **Checkpoint**:
   _User prompt:_ "All tests pass. Use the `stoney-checkpoint` skill to commit Loop 10."
