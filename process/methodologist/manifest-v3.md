# Methodology Manifest
**Version:** v3 | **Date:** 2026-03-21 | **Project:** BrainDump
**Profile:** Commercial
**Artifact Weight:** Draft

---

## Changelog
- v3: Cycle 1 retrospective addendum -- codified the end-of-cycle Playwright demo validation process as Standing Rule 3, based on what was actually done during Cycle 1 Demo Sign-off -- 2026-03-21
- v2: Cycle 1 retrospective -- three process failures fixed: (1) Orchestrator must autonomously chain Builder-Verifier dispatch without waiting for user prompts, (2) strict role separation enforced so Orchestrator never writes code or runs tests, (3) Verification gate expanded to include CI monitoring and staging deployment confirmation -- 2026-03-21
- v1: Initial configuration -- 2026-03-19

## Profile Rationale
BrainDump is a multi-user public web service where real users rely on it to store their notes and ideas. Although the service is free, data loss would meaningfully impact users who depend on it. This places it firmly at Commercial: real users with real expectations, but no regulatory, financial, or safety-critical implications that would warrant Critical or Vital process weight.

## Agents

| Agent | Status | Notes |
|---|---|---|
| Methodologist | Active | |
| Orchestrator | Active | Routing and state management ONLY -- see Orchestrator Conduct Rules |
| Analyst | Active | |
| Auditor | Active | |
| Architect | Active | |
| Designer | Skipped | Builder implements UI from requirements; Nexus reviews at Demo Sign-off |
| Scaffolder | Active | Invoked when >=3 Builder tasks per cycle |
| Planner | Active | |
| Builder | Active | |
| Verifier | Active | Full verification including CI and staging -- see Verification Protocol |
| Sentinel | Active | Public-facing service with user data requires security awareness |
| DevOps | Active | Multi-user service needs CI pipeline and deployment infrastructure |
| Scribe | Skipped | Builder maintains README and inline docs; revisit if API surface grows |

### Acceptance criteria for skipped agents
- **Designer:** Builder implements UI directly from requirements using standard component patterns. The Nexus reviews the visual result at each Demo Sign-off and can request changes as new requirements.
- **Scribe:** Builder maintains a README with setup instructions, usage, and API documentation where applicable. If BrainDump develops a public API or the user base grows significantly, the Scribe should be activated.

## Orchestrator Conduct Rules

These rules are standing and apply every cycle until the Manifest is updated.

### Rule 1: Autonomous Build-Verify Dispatch

During the Build-Verify iterate loop, the Orchestrator is responsible for autonomous sequential dispatch. The sequence is:

1. Invoke Builder for a task.
2. Receive Builder result (handoff notes, committed code).
3. **Immediately** invoke Verifier for that task -- do not wait for a user prompt.
4. Receive Verifier result.
5. If PASS: immediately invoke Builder for the next task in the plan. Do not wait for a user prompt.
6. If FAIL: immediately re-invoke Builder with the Verifier's failure context. Do not wait for a user prompt.
7. If escalation condition is met (convergence signal): stop and escalate to the Nexus.

No human prompt is required or expected between these steps. The Orchestrator drives the loop until the cycle's tasks are exhausted or an escalation condition halts progress. The Nexus observes and may intervene at any time, but the Orchestrator must not pause to wait for permission that has already been granted by the plan.

### Rule 2: Strict Role Separation

The Orchestrator NEVER:
- Writes, modifies, or generates code (application code, test code, configuration files, scripts)
- Runs tests, linters, or any verification command
- Performs build, deploy, or infrastructure operations
- Reads source files to debug implementation issues

The Orchestrator ONLY:
- Maintains project state (project-state.md, escalation-log.md)
- Routes tasks to the correct agent with the correct context
- Tracks iteration counts and enforces loop bounds
- Writes routing slips (process/orchestrator/routing-*.md)
- Escalates to the Nexus when convergence signals or other triggers fire

If the Orchestrator finds itself about to write code, run a test, or perform any implementation or verification action, it must STOP and delegate to the appropriate agent (Builder for implementation, Verifier for verification, DevOps for infrastructure).

### Rule 3: End-of-Cycle Demo Validation via Playwright

At the end of every cycle, after all tasks are VERIFIED (local tests pass, CI green, staging healthy), the Orchestrator must ensure the following demo validation process is completed before presenting the Demo Sign-off Briefing to the Nexus. This rule was established during the Cycle 1 retrospective based on what was actually done.

**Step 1 -- Run Playwright against staging.** Execute the Playwright demo scripts against the staging environment (https://braindump.staging.nxlabs.cc). Not localhost. Not a mock. The real deployed environment. This step only proceeds after CI is green and staging is confirmed live via health check.

**Step 2 -- Screenshot every key scenario.** For each frontend-testable demo script (those marked as runnable via browser, not DB/curl-only scripts), take a screenshot at each meaningful scenario step. Screenshots must be saved under `tests/demo/TASK-XXX/` where XXX matches the demo script number the scenario belongs to. Use sequential numbering with a descriptive name (e.g., `01-empty-workspace.png`, `02-note-created.png`).

**Step 3 -- Map screenshots to demo script scenarios.** After capturing, each screenshot must be explicitly matched to its demo script file and scenario. The mapping must be reviewed: does the screenshot content match what the scenario expects to see? If a scenario expectation is not met (e.g., wrong UI state, missing element), that is a demo failure and must be reported to the Orchestrator as a FAIL before sign-off.

**Step 4 -- Validate against acceptance criteria.** The screenshot review is not cosmetic. It verifies that the acceptance criteria visible in the UI are actually passing. Any mismatch between the screenshot and the scenario expectation is escalated to the Nexus before sign-off is granted.

**Step 5 -- Commit screenshots to version control.** After validation and folder organization, all screenshots are committed to git. The commit hash is included in the Demo Sign-off Briefing as evidence.

**Step 6 -- Folder hygiene.** Screenshots may only be placed in folders that correspond to an existing demo script file (e.g., `TASK-009/` is valid only if `TASK-009-demo.md` exists). Screenshots for features that have no dedicated demo script (e.g., auto-save, version history, delete -- which are part of broader task scripts) must be placed in the closest matching existing script folder and the mapping documented in the Demo Sign-off Briefing.

**Demo sign-off gate.** The Orchestrator does not close a cycle or present the Demo Sign-off Briefing until: (a) Playwright has run against staging, (b) screenshots are committed with a recorded commit hash, and (c) the screenshot-to-scenario mapping has been reviewed and approved by the Nexus.

## Verification Protocol

These rules are standing and apply to every task verification from Cycle 2 onward.

### Local Verification (all tasks)
The Verifier runs the task's acceptance criteria checks: unit tests, integration tests, lint, and manual inspection as specified in the task plan.

### CI and Staging Verification (tasks that touch backend or frontend code)
After local verification passes, the Verifier must also:

1. **Monitor CI:** Poll `gh run list --branch <branch> --limit 1` and `gh run view <run-id>` until the GitHub Actions CI run triggered by the Builder's push completes. Do not mark the task verified while CI is still running.
2. **Confirm CI green:** All CI jobs must pass (lint, unit-tests, integration-tests, build-and-push). If any job fails, the Verifier reports FAIL with the failure details and the log URL (`gh run view <run-id> --log-failed`), and the Orchestrator routes back to Builder with that context.
3. **Confirm staging deployment:** After a successful build-and-push job, confirm the new container is live on staging by hitting the health endpoint (`https://braindump.staging.nxlabs.cc/api/health`) and verifying a 200 response. If the health check fails, the Verifier reports FAIL with the details.
4. **Only then mark VERIFIED:** A task is VERIFIED only when local tests pass AND CI is green AND staging is confirmed healthy.

If CI fails, the Verifier does not wait for the Nexus to notice. The Verifier reports the failure immediately, and the Orchestrator re-invokes Builder with the CI failure context per Rule 1.

## Documentation Requirements

| Agent | Produces | Depth |
|---|---|---|
| Analyst | Brief + Requirements List | Draft: structured brief with context, numbered requirements with clear acceptance criteria |
| Architect | Architecture Overview + ADRs | Draft: architecture overview document with key decisions recorded as lightweight ADRs |
| Planner | Task Plan + Release Map | Draft: task list with acceptance criteria, dependencies noted, grouped into demonstrable cycles |
| Verifier | Verification Reports + Demo Scripts | Draft: structured verification report per cycle with pass/fail per acceptance criterion, CI run URLs, staging health check results |
| Sentinel | Security Report | Draft: threat surface review, dependency audit, data handling assessment |
| DevOps | Environment Contract | Draft: CI pipeline definition, deployment configuration, environment documentation |

## Gate Configuration

| Gate | Status | Mode |
|---|---|---|
| Requirements Gate | Active | Lightweight -- Nexus reviews requirements list and confirms |
| Architecture Gate | Active | Lightweight -- Nexus reviews architecture overview and confirms |
| Plan Gate | Active | Lightweight -- Nexus reviews task plan before execution begins |
| Demo Sign-off | Active | Explore running software + retrospective question; Playwright demo validation required per Rule 3 |
| Go-Live | Active | Continuous Delivery -- deploy at Demo Sign-off when Nexus approves |

## Iteration Model

**Max iterations per task:** 3
**Convergence signal:** 2 consecutive iterations with non-decreasing failure count triggers escalation to Nexus.
**Cycle scope:** Planner-defined -- tasks are grouped into demonstrable increments at the Plan Gate. Each cycle ends with a Demo Sign-off. The Orchestrator executes only the tasks in the current cycle before moving to Demo Sign-off.
**CD philosophy:** Continuous Delivery -- code is always deployable, actual deployment happens at Demo Sign-off when the Nexus approves.

## Infrastructure Preconditions
- CI pipeline passing before Builder tasks begin (established in Cycle 1)
- Development environment documented in Environment Contract
- Data persistence strategy decided at Architecture Gate (users rely on this service to save their ideas)
- GitHub Actions CI workflow operational (lint, unit-tests, integration-tests, build-and-push)
- Staging environment accessible at https://braindump.staging.nxlabs.cc with health endpoint at /api/health

## Provisional Assumptions
- No existing codebase beyond the initial commit; greenfield project
- Web-based application with Markdown support for note-taking
- Multi-user with some form of user accounts or identity
- Data durability is important given users rely on the service to save their ideas
- Free service with no payment infrastructure required at this time
- No specific compliance or regulatory requirements (revisit if user base grows or if handling sensitive personal data beyond notes)
- Team size is solo developer for now (revisit if others join)

### Nexus Intake Note
The Nexus described BrainDump as a knowledge base web system for saving notes with Markdown support. It is a free, multi-user public service. The Nexus stated that losing the service would be "hard on the users" because "they still rely on us to save their ideas." This signals that data integrity and service reliability are meaningful concerns that the Analyst should factor into requirements and the Architect should address in the system design.
