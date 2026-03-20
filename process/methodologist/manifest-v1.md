# Methodology Manifest
**Version:** v1 | **Date:** 2026-03-19 | **Project:** BrainDump
**Profile:** Commercial
**Artifact Weight:** Draft

---

## Changelog
- v1: Initial configuration -- 2026-03-19

## Profile Rationale
BrainDump is a multi-user public web service where real users rely on it to store their notes and ideas. Although the service is free, data loss would meaningfully impact users who depend on it. This places it firmly at Commercial: real users with real expectations, but no regulatory, financial, or safety-critical implications that would warrant Critical or Vital process weight.

## Agents

| Agent | Status | Notes |
|---|---|---|
| Methodologist | Active | |
| Orchestrator | Active | |
| Analyst | Active | |
| Auditor | Active | |
| Architect | Active | |
| Designer | Skipped | Builder implements UI from requirements; Nexus reviews at Demo Sign-off |
| Scaffolder | Active | Invoked when >=3 Builder tasks per cycle |
| Planner | Active | |
| Builder | Active | |
| Verifier | Active | |
| Sentinel | Active | Public-facing service with user data requires security awareness |
| DevOps | Active | Multi-user service needs CI pipeline and deployment infrastructure |
| Scribe | Skipped | Builder maintains README and inline docs; revisit if API surface grows |

### Acceptance criteria for skipped agents
- **Designer:** Builder implements UI directly from requirements using standard component patterns. The Nexus reviews the visual result at each Demo Sign-off and can request changes as new requirements.
- **Scribe:** Builder maintains a README with setup instructions, usage, and API documentation where applicable. If BrainDump develops a public API or the user base grows significantly, the Scribe should be activated.

## Documentation Requirements

| Agent | Produces | Depth |
|---|---|---|
| Analyst | Brief + Requirements List | Draft: structured brief with context, numbered requirements with clear acceptance criteria |
| Architect | Architecture Overview + ADRs | Draft: architecture overview document with key decisions recorded as lightweight ADRs |
| Planner | Task Plan + Release Map | Draft: task list with acceptance criteria, dependencies noted, grouped into demonstrable cycles |
| Verifier | Verification Reports + Demo Scripts | Draft: structured verification report per cycle with pass/fail per acceptance criterion |
| Sentinel | Security Report | Draft: threat surface review, dependency audit, data handling assessment |
| DevOps | Environment Contract | Draft: CI pipeline definition, deployment configuration, environment documentation |

## Gate Configuration

| Gate | Status | Mode |
|---|---|---|
| Requirements Gate | Active | Lightweight -- Nexus reviews requirements list and confirms |
| Architecture Gate | Active | Lightweight -- Nexus reviews architecture overview and confirms |
| Plan Gate | Active | Lightweight -- Nexus reviews task plan before execution begins |
| Demo Sign-off | Active | Explore running software + retrospective question |
| Go-Live | Active | Continuous Delivery -- deploy at Demo Sign-off when Nexus approves |

## Iteration Model

**Max iterations per task:** 3
**Convergence signal:** 2 consecutive iterations with non-decreasing failure count triggers escalation to Nexus.
**Cycle scope:** Planner-defined -- tasks are grouped into demonstrable increments at the Plan Gate. Each cycle ends with a Demo Sign-off. The Orchestrator executes only the tasks in the current cycle before moving to Demo Sign-off.
**CD philosophy:** Continuous Delivery -- code is always deployable, actual deployment happens at Demo Sign-off when the Nexus approves.

## Infrastructure Preconditions
- CI pipeline passing before Builder tasks begin (DevOps sets this up in the first cycle)
- Development environment documented in Environment Contract
- Data persistence strategy decided at Architecture Gate (users rely on this service to store their ideas)

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
