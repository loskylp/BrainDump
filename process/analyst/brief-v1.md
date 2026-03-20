# Brief -- BrainDump
**Version:** 1 | **Date:** 2026-03-19 | **Artifact Weight:** Draft

---

## Changelog
- v1: Initial brief from Nexus Intake Note -- 2026-03-19

---

## Problem Statement

People generate ideas and accumulate knowledge that they need to capture quickly and retrieve later. Existing tools are either too heavyweight (full document editors), too ephemeral (chat messages, sticky notes), or too locked-in (proprietary formats). BrainDump addresses this by providing a free, public web service where anyone can create an account and write Markdown-formatted notes that are organized, searchable, and durable. The Nexus has stated that users "rely on us to save their ideas," making data durability a first-class concern -- not an afterthought.

## Context and Ground Truths

- **Multi-user public service.** Anyone can register and use BrainDump. There is no invitation, paywall, or access restriction.
- **Free service.** No payment infrastructure exists or is planned. The service is sustained without charging users.
- **Markdown is the content format.** Users write notes in Markdown and expect them to render correctly. Markdown is not optional -- it is the primary authoring experience.
- **Data durability is a first-class concern.** The Nexus explicitly stated that losing the service would be "hard on the users" because they rely on it. This means data persistence, backup, and recovery must be addressed in architecture, not treated as operational nice-to-haves.
- **No existing codebase.** Greenfield project -- the initial commit is empty scaffolding.
- **No regulatory or compliance requirements identified.** However, the service stores user-generated content, so basic data handling expectations apply (users should be able to delete their own data, data should not leak between users).
- **No specific mobile or native requirements stated.** Web-based delivery only, though responsive design is expected for a modern web service.

## Scope and Boundaries

**In scope:**
- User registration and authentication
- Creating, editing, and deleting Markdown notes
- Organizing notes (some structure beyond a flat list)
- Viewing rendered Markdown
- Searching or finding notes
- Per-user data isolation (users see only their own notes)
- Data persistence with durability guarantees

**Out of scope:**
- Payment, billing, or subscription features
- Real-time collaboration or shared editing
- Native mobile applications
- Import/export from third-party services (may be revisited)
- Administrative dashboard or content moderation tooling (may be revisited as user base grows)
- Rich media embedding beyond what standard Markdown supports

**Adjacent systems (acknowledged, not integrated):**
- Email service (for account verification or password reset -- integration boundary to be decided at Architecture Gate)
- Backup/recovery infrastructure (required but implementation is an Architect concern)

## Delivery Channel

**Channel:** Web Application
**Decision status:** Nexus-stated
**Implications:** The system is a server-rendered or client-rendered web application accessible via standard browsers. Responsive design is expected. The Architect will decide the specific technology stack. UX is implemented directly by the Builder from requirements (Designer agent is skipped per Manifest).

## Stakeholders

| Role | Relationship to system | Needs | Authority |
|---|---|---|---|
| Nexus | Owner and operator | A reliable, simple knowledge base that retains users through trust in data durability | Full -- all scope and priority decisions |
| End Users | Primary users of the service | Capture ideas quickly, find them later, trust that data will not be lost | None -- provide feedback through usage patterns |

## User Roles

| Role | Description | Goals | Permissions needed |
|---|---|---|---|
| Anonymous Visitor | Unauthenticated user on the public site | Learn about BrainDump, register for an account | View public pages, register |
| Registered User | Authenticated user with an account | Create, organize, edit, search, and delete their own notes | Full CRUD on own notes, manage own account |

## Domain Model

**Key Entities and Relationships (Draft depth)**

| Entity | Definition | Key attributes |
|---|---|---|
| User | A registered person with an account on BrainDump | Username/email, credentials, account creation date |
| Note | A single piece of written content authored by a User, formatted in Markdown | Title, body (Markdown source), created date, last modified date |
| Folder | An organizational container that groups Notes | Name, owner (User), optional parent Folder |

**Relationships:**
- A **User** owns zero or more **Notes** (1:N). A Note belongs to exactly one User.
- A **User** owns zero or more **Folders** (1:N). A Folder belongs to exactly one User.
- A **Note** may belong to zero or one **Folder** (N:1, optional). Notes without a Folder exist at the root level.
- A **Folder** may contain zero or more child **Folders** (self-referential 1:N), enabling nested organization.

**Domain Invariants:**
- A User can only access their own Notes and Folders. Cross-user visibility does not exist.
- A Note always has Markdown source stored; rendered HTML is a derived view, never the source of truth.
- Deleting a Folder does not delete its Notes -- they are moved to root or the user is prompted (exact behavior to be decided in requirements).

## Open Context Questions

These questions should be surfaced to the Nexus before requirements are finalized at the Requirements Gate. The Analyst has made reasonable default assumptions (noted below) so that a complete Draft requirements set can be produced, but the Nexus should confirm or override.

1. **What organization model do users expect?** The Brief assumes folders (possibly nested). Alternative: tags/labels, or a flat list with search only. **Default assumption:** Folders with optional nesting.
2. **Should users be able to export their notes?** Data durability includes the ability to take your data with you. **Default assumption:** Not in v1, but flagged for future consideration.
3. **Is there a public-facing landing page or is the entire app behind authentication?** **Default assumption:** A minimal public landing page with registration/login; all note functionality requires authentication.
4. **Account recovery -- is email-based password reset required for v1?** **Default assumption:** Yes, basic email-based password reset is expected for a service users rely on.
5. **What happens when a user deletes their account?** **Default assumption:** All their notes and folders are permanently deleted.
