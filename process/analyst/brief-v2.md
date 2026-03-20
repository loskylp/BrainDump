# Brief -- BrainDump
**Version:** 2 | **Date:** 2026-03-19 | **Artifact Weight:** Draft

---

## Changelog
- v1: Initial brief from Nexus Intake Note -- 2026-03-19
- v2: Revised with detailed Nexus product description -- 2026-03-19. Problem statement sharpened to developer audience. Domain model updated with Note Version entity. Split-pane editor, auto-save, full-text search, CommonMark standard, and PostgreSQL added as ground truths. Open questions 1, 3, and 4 resolved; two new questions added. Later updated with Nexus clarification on versioning granularity (activity-based with diff detection) and retention policy (all versions kept). All open questions now resolved. Later updated with Nexus product vision (professional/technical design aesthetic), three feature clarifications (live renderer, note catalog, full-text search), persona (Carla the Writer), and broadened audience definition to include technical-leaning knowledge workers. Later updated to address AUDIT-001 (public landing page with registration CTA -- Open Question 3 now concrete) and AUDIT-002 (versioning trigger simplified to 30-second idle + any change -- all "significant diff" language removed).

---

## Problem Statement

Technical professionals -- developers, researchers, students, and other knowledge workers -- need a reliable place to write, organize, and retrieve structured notes. Existing tools force them into either heavyweight editors that break flow, proprietary platforms that lock in content, or plain-text files that lack structure and searchability. BrainDump is a free, public web application for technical documentation management that removes friction between thinking and writing. It provides a split-pane editing experience -- Markdown source with syntax highlighting on the left, real-time CommonMark-rendered preview on the right -- with a persistent note catalog for at-a-glance collection management and indexed full-text search for fast retrieval. The system is backed by a PostgreSQL database that ensures referential integrity, indexed metadata search, and data durability. Users rely on this service to preserve their technical knowledge; data loss would meaningfully impact them.

## Context and Ground Truths

- **Target audience: technical professionals and knowledge workers.** BrainDump is not a generic note-taking app. Its primary audience includes developers writing technical documentation, but extends to researchers, students, and other technically comfortable users who work with structured text (see Persona: Carla the Writer). The UI, vocabulary, and feature set reflect a professional/technical orientation while remaining intuitive to non-developers.
- **Multi-user public service.** Anyone can register and use BrainDump. There is no invitation, paywall, or access restriction.
- **Free service.** No payment infrastructure exists or is planned.
- **Markdown standard: CommonMark.** The system follows the CommonMark specification for parsing and rendering Markdown. This is not an implementation detail -- it is the contract with users about how their content will behave.
- **Professional/technical design aesthetic.** BrainDump should look and feel like a professional note manager oriented toward technical documentation, with dynamic Markdown rendering. The visual design is clean, functional, and technically oriented -- not playful, generic, or consumer-app styled. This applies to all UI surfaces: the catalog, the editor, and the search results.
- **Split-pane editor with syntax highlighting and live rendering.** The editing experience is a side-by-side layout: a source editor panel with syntax highlighting on the left, and a live-rendered CommonMark preview panel on the right. The preview updates in real time as the user types -- there is no manual "render" action. This is a core UX requirement, not a nice-to-have.
- **Note catalog (sidebar).** The workspace includes a persistent sidebar that lists all of the user's notes with chronological sorting (newest first by default). This is a distinct, always-visible UI component -- not a separate page. It serves as the primary navigation for the note collection, giving users an at-a-glance view of their entire catalog.
- **Auto-save.** Notes are saved automatically as the user edits. There is no manual "save" action required. This reduces friction and protects against data loss from browser crashes or accidental navigation.
- **Basic version history with time-based idle trigger.** The system maintains a version history for each note, allowing users to recover previous states. A new version is created when 30 seconds of inactivity have elapsed AND the content has changed compared to the last version (any change, not a subjective "significant" threshold). If 30 seconds of inactivity elapse with no change, no version is created. All versions are retained indefinitely -- there is no pruning or cap.
- **Full-text search with indexed metadata.** Search is not a simple string match -- it uses database-level indexing (PostgreSQL full-text search capabilities) to deliver fast queries across note titles and bodies. This is a core feature, not a secondary convenience.
- **PostgreSQL as the database.** This is a Nexus decision, not an Architect choice. PostgreSQL provides the relational integrity, full-text indexing, and durability guarantees the system requires.
- **Monolithic server architecture.** The Nexus has specified a monolithic server that manages business logic and referential integrity. This is an architectural constraint, not a suggestion.
- **Data durability is a first-class concern.** The combination of auto-save, version history, PostgreSQL persistence, and backup strategy collectively address this. The Nexus stated that losing the service would be "hard on the users."
- **No existing codebase.** Greenfield project.
- **No regulatory or compliance requirements identified.** Basic data handling expectations apply (users can delete their own data, data does not leak between users).

## Scope and Boundaries

**In scope:**
- Public landing page with app description, feature highlights, and registration CTA
- User registration, authentication, and password reset
- Split-pane note editor: Markdown source with syntax highlighting + real-time CommonMark preview
- Creating, editing (with auto-save), and deleting notes
- Note catalog sidebar: persistent side-list showing all notes with chronological sorting
- Basic version history for notes with the ability to view and restore previous versions
- Organizing notes in folders (single-level in v1)
- Full-text search across note titles and bodies using PostgreSQL indexing
- Professional/technical design aesthetic throughout all UI surfaces
- Per-user data isolation
- Data persistence in PostgreSQL with durability guarantees
- Responsive web design
- Account management including account deletion

**Out of scope:**
- Payment, billing, or subscription features
- Real-time collaboration or shared editing
- Native mobile applications
- Import/export from third-party services (may be revisited)
- Administrative dashboard or content moderation tooling (may be revisited)
- Nested folders (explicitly deferred beyond v1)
- Rich media embedding beyond what CommonMark supports
- Offline editing or local-first sync

**Adjacent systems (acknowledged, not integrated):**
- Email service (required for password reset -- integration boundary to be decided at Architecture Gate)
- Backup/recovery infrastructure (required; implementation is an Architect concern but the requirement is captured)

## Delivery Channel

**Channel:** Web Application
**Decision status:** Nexus-stated
**Implications:** The system is a web application accessible via standard browsers. The core editing experience is a split-pane layout optimized for desktop use but must degrade gracefully on smaller viewports. The Architect decides the specific frontend and backend technology stack within the constraint of a monolithic server and PostgreSQL database. UX is implemented directly by the Builder from requirements (Designer agent is skipped per Manifest).

## Stakeholders

| Role | Relationship to system | Needs | Authority |
|---|---|---|---|
| Nexus | Owner and operator | A reliable technical documentation platform that technical professionals trust with their knowledge | Full -- all scope and priority decisions |
| End Users (Technical professionals) | Primary users of the service | Write and organize technical notes with minimal friction, find them quickly via search and catalog, trust that content is durable and versioned | None -- provide feedback through usage patterns |

## User Roles

| Role | Description | Goals | Permissions needed |
|---|---|---|---|
| Anonymous Visitor | Unauthenticated user on the public site | Learn about BrainDump, register for an account | View public pages, register |
| Registered User | Authenticated user with an account (developer, researcher, student, or other technical professional) | Create, organize, edit, search, and delete their own notes; browse the note catalog; review version history; rely on auto-save | Full CRUD on own notes and folders, view/restore note versions, manage own account |

## Personas

### Carla the Writer
**Role:** PhD student organizing bibliographic sources
**Background:** Carla is a researcher, not a developer, but she is technically comfortable -- she uses Markdown for formatting citations and structured notes. She is not intimidated by a split-pane editor, but she is not writing code in it.
**Usage pattern:** Creates many notes (one per bibliographic source). Relies on Markdown for formatting citations, block quotes, and structured annotations. Needs fast full-text search to find sources by keyword across dozens or hundreds of notes. Uses the note catalog sidebar to scan her collection at a glance and locate recent additions.
**Key needs:**
- Fast, accurate search across both note titles and bodies (she searches by author name, keyword, or concept)
- A readable, well-organized catalog view that handles large note collections without becoming unwieldy
- An intuitive UI that does not require developer knowledge to operate
- Data durability -- her bibliographic notes represent months of research effort

**Design implications:** Carla validates that the UI must be intuitive enough for non-developers while retaining the professional/technical aesthetic. Search speed and catalog readability are high-priority UX concerns. The system cannot assume all users think in terms of code -- Markdown is a writing tool for Carla, not a programming tool.

---

## Domain Model

**Key Entities and Relationships (Draft depth)**

| Entity | Definition | Key attributes |
|---|---|---|
| User | A registered person with an account on BrainDump | Username/email, credentials, account creation date |
| Note | A piece of structured content authored by a User, written in CommonMark Markdown (technical documentation, research notes, bibliographic entries, or other knowledge artifacts) | Title, body (Markdown source), created date, last modified date, current version number |
| Note Version | A historical snapshot of a Note's content at a point in time | Version number, title snapshot, body snapshot, timestamp, parent Note reference |
| Folder | An organizational container that groups Notes | Name, owner (User) |

**Relationships:**
- A **User** owns zero or more **Notes** (1:N). A Note belongs to exactly one User.
- A **User** owns zero or more **Folders** (1:N). A Folder belongs to exactly one User.
- A **Note** has one or more **Note Versions** (1:N). A new version is created when 30 seconds of user inactivity have elapsed and the content has changed (any change) compared to the last version. The current state of the Note is always the latest version. All versions are retained indefinitely.
- A **Note** may belong to zero or one **Folder** (N:1, optional). Notes without a Folder exist at the root level.
- In v1, **Folders** are single-level only (no parent-child nesting).

**Domain Invariants:**
- A User can only access their own Notes, Note Versions, and Folders. Cross-user visibility does not exist.
- A Note always stores CommonMark Markdown source as the source of truth. Rendered HTML is a derived view, never persisted as authoritative content.
- Deleting a Folder does not delete its Notes -- they are moved to the root level.
- Deleting a Note deletes all its associated Note Versions.
- Auto-save persists the current working state continuously (short debounce, e.g., a few seconds). Version creation is a separate, lower-frequency mechanism: a new version is created only when 30 seconds of inactivity have elapsed AND the content differs from the last version (any change counts -- there is no subjective "significance" threshold). If 30 seconds elapse with no change, no version is created. Auto-save and version creation are non-overlapping concerns with distinct timers. Versions are never pruned -- all versions are retained indefinitely.

## Open Context Questions

Questions resolved since v1 are marked as such. New questions are appended.

1. ~~**What organization model do users expect?**~~ **Resolved:** Folders, confirmed by the Nexus. Single-level in v1; nested folders explicitly deferred.
2. ~~**Should users be able to export their notes?**~~ **Deferred:** Explicitly out of scope for v1. Flagged for future consideration. Does not block requirements or architecture.
3. ~~**Is there a public-facing landing page or is the entire app behind authentication?**~~ **Resolved (AUDIT-001):** Yes, there is a public landing page. Unauthenticated visitors see a page with an app description, feature highlights, and a prominent registration CTA on the side. All note functionality remains behind authentication. See REQ-017.
4. ~~**Account recovery -- is email-based password reset required for v1?**~~ **Resolved:** Yes, confirmed by the Nexus. Professional service expectation for a tool developers rely on.
5. ~~**What happens when a user deletes their account?**~~ **Resolved by standing default:** All notes, versions, and folders are permanently deleted. Consistent with all Nexus decisions; not contested.
6. ~~**What is the versioning granularity?**~~ **Resolved (AUDIT-002, simplified):** Time-based idle trigger. A new version is created when 30 seconds of user inactivity have elapsed AND the content has changed (any change) compared to the last version. If 30 seconds elapse with no change, no version is created. Previous "significant diff" / "meaningful change" language has been removed -- any difference from the last version qualifies. Auto-save persists the working state continuously (short debounce); version creation is a separate, lower-frequency operation on a 30-second idle timer.
7. ~~**How many versions should be retained?**~~ **Resolved:** All versions are kept indefinitely. No pruning, no cap.

**All open context questions are now resolved.** The remaining item (Open Question 2, note export) is a future consideration explicitly out of scope for v1 and does not block requirements or architecture work. Open Question 5 (account deletion behavior) uses the standing default assumption (permanent deletion of all data) which is consistent with all other Nexus decisions and has not been contested.
