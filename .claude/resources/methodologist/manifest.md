<!--
Copyright 2026 Pablo Ochendrowitsch

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Methodology Manifest
**Version:** v1 | **Date:** [date] | **Project:** [project name]
**Profile:** [Casual | Commercial | Critical | Vital]
**Artifact Weight:** [Sketch | Draft | Blueprint | Spec]

---

*Distribution template. On project start, the Methodologist copies this to `process/methodologist/manifest-v1.md` and fills it in. Subsequent versions are written as `manifest-v2.md`, `manifest-v3.md`, etc. — all in `process/methodologist/`. The current Manifest is always the highest-numbered file in that directory. Do not edit directly; invoke the Methodologist to produce or update.*

---

## Changelog
- v1: Initial configuration — [date]

## Profile Rationale
[One to three sentences: why this profile was assigned based on the Nexus's intake answers.]

## Agents

| Agent | Status | Notes |
|---|---|---|
| Methodologist | Active | |
| Orchestrator | Active | |
| Analyst | Active | |
| Auditor | Active | |
| Architect | Active | |
| Designer | [Active \| Skipped] | [reason if skipped] |
| Scaffolder | [Active \| Skipped] | [Active: invoked when ≥3 Builder tasks per cycle and profile is not Casual] |
| Planner | Active | |
| Builder | Active | |
| Verifier | Active | |
| Sentinel | [Active \| Skipped] | [Skipped at Casual — Builder applies common sense] |
| DevOps | [Active \| Skipped] | [Skipped at Casual — Builder absorbs infrastructure tasks] |
| Scribe | [Active \| Skipped] | [Skipped at Casual — Builder maintains README] |

### Acceptance criteria for skipped agents
[For each skipped or combined agent: what alternative mechanism provides equivalent coverage, and what the Nexus verifies instead. Remove section if all agents are active.]

## Documentation Requirements

| Agent | Produces | Depth |
|---|---|---|
| Analyst | Brief + Requirements List | [Sketch: informal / Blueprint: full DoD per REQ] |
| Architect | Architecture artifacts | [Sketch: system metaphor / Blueprint: ADRs + fitness functions] |
| Planner | Task Plan + Release Map | [Sketch: task list / Blueprint: full plan with risk matrix] |
| Verifier | Verification Reports + Demo Scripts | [Sketch: checklist / Blueprint: full structured report] |
| [others as needed] | | |

## Gate Configuration

| Gate | Status | Mode |
|---|---|---|
| Requirements Gate | Active | [Lightweight \| Formal] |
| Architecture Gate | Active | [Lightweight \| Formal] |
| Plan Gate | Active | [Lightweight \| Formal] |
| Demo Sign-off | Active | [Explore running software + retrospective question \| Formal sign-off with security review] |
| Go-Live | Active | [Continuous Deployment \| Continuous Delivery \| Business decision] |

## Iteration Model

**Max iterations per task:** [N]
**Convergence signal:** [N] consecutive iterations with non-decreasing failure count triggers escalation.
**Cycle scope:** Planner-defined — tasks are grouped into demonstrable increments at the Plan Gate. Each cycle ends with a Demo Sign-off. The Orchestrator executes only the tasks in the current cycle before moving to Demo Sign-off.
**CD philosophy:** [Continuous Deployment | Continuous Delivery | Business decision]

## Infrastructure Preconditions

[What must be in place before Builder tasks begin. At Casual: often none.]

## Provisional Assumptions

[Assumptions made due to incomplete intake. Each is provisional and subject to revision. Remove section if intake was complete.]
