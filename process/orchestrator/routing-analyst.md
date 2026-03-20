# Routing Instruction
**To:** Analyst
**Phase:** INGESTION
**Task:** Produce Brief v1 (Domain Model) and Requirements List v1 from the Nexus Intake Note
**Load these artifacts:**
- `process/methodologist/manifest-v1.md` (section: Nexus Intake Note, Provisional Assumptions, Infrastructure Preconditions)
**Produce:**
- `process/analyst/brief-v1.md` (Domain Model with shared vocabulary, context, stakeholder needs)
- `process/analyst/requirements-v1.md` (Numbered requirements with acceptance criteria)
**Return to:** Orchestrator when complete

## Context for the Analyst

BrainDump is a multi-user web knowledge base with Markdown note support, offered as a free public service. The Nexus stated that losing the service would be "hard on the users" because "they still rely on us to save their ideas."

Key concerns to address during requirements elicitation:

1. **Data durability is a first-class concern.** The Methodologist has flagged this explicitly. Users rely on this service to store their ideas -- data loss would meaningfully impact them. Requirements should capture expectations around data persistence, backup, and recovery.

2. **Multi-user with identity.** The service supports multiple users, implying some form of user accounts or authentication. Requirements should clarify the user model.

3. **Markdown support.** Notes support Markdown formatting. Requirements should specify the scope of Markdown support (editing, rendering, or both).

4. **Web-based delivery.** This is a web application. The Analyst should consider the implications for accessibility and device support.

5. **No payment infrastructure.** The service is free. No billing or subscription requirements at this time.

6. **No regulatory requirements currently identified.** However, the service stores user-generated content, so basic data handling expectations should be captured.

The Brief should establish the domain vocabulary (what is a "note," what is a "knowledge base," what does "multi-user" mean in this context). The Requirements List should have clear, testable acceptance criteria suitable for the Planner to decompose into tasks.
