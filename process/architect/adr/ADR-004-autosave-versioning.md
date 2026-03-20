# ADR-004: Auto-save and Versioning Architecture
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

REQ-015 (auto-save) and REQ-016 (version history) are explicitly non-overlapping mechanisms with distinct purposes and timers:

- **Auto-save (REQ-015):** Short debounce timer. Persists the current working state. Does NOT create version entries. Purpose: prevent data loss from browser crashes or accidental navigation.
- **Version creation (REQ-016):** 30-second idle timer. Creates a snapshot ONLY when content has changed since the last version (any change counts). Purpose: allow users to recover previous states.

The architecture must make the boundary between these two mechanisms crisp and unambiguous at every layer (client, API, database).

**Driver:** Data durability, Testability, Maintainability
**Door type:** One-way -- the interaction between these two timers is woven into the client state management, API design, and database write patterns

## Trade-off Analysis

### Timer Location

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Both timers client-side, server is passive | Simple server (just receives saves and version requests), responsive UX (no server round-trip for timer logic) | Client must be trusted for timer accuracy, multiple tabs could create duplicate versions, client-side bugs affect data integrity | Malicious or buggy client could flood version creation or skip auto-save | MEDIUM -- move timer logic to server |
| Both timers server-side (client sends every keystroke) | Server is authoritative, no client trust needed | Massive network traffic (every keystroke), latency affects UX, server must track per-user editing state | Unacceptable UX latency and bandwidth usage | HIGH -- fundamental API redesign |
| Auto-save timer client-side, version diff-check server-side | Client controls UX-sensitive timing, server controls data integrity (version creation) | Slightly more complex: client sends version-check request, server decides whether to create version | Minor complexity in API contract | LOW -- adjust which side does what |

**Recommendation:** Auto-save timer client-side, version decision server-side
**Because:** The auto-save debounce is a UX concern (client knows when the user stops typing). The version creation decision is a data integrity concern (server compares content against the last version authoritatively). This separation means a buggy or malicious client cannot create spurious versions -- the server always checks the diff.

### Auto-save Debounce Duration

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| 1 second | Very responsive, minimal data loss window | More API calls, more DB writes | Excessive write load for fast typists | LOW -- change a constant |
| 2 seconds | Good balance: saves within 2s of pause, moderate API call frequency | 2-second data loss window on crash | Acceptable for a web app where browser crashes are rare | LOW -- change a constant |
| 5 seconds | Fewer API calls and DB writes | 5-second data loss window, user may perceive lag in save indicator | Users may lose noticeable amounts of work on crash | LOW -- change a constant |

**Recommendation:** 2-second debounce
**Because:** Balances data loss prevention (2-second window is acceptable) against API call frequency. This is a two-way door -- the constant is easily tuned based on production observation.

## Decision

### Architecture

```
Client (React)                          Server (Express)
=================                       ==================

Editor onChange
    |
    v
[useAutoSave hook]
    |-- 2s debounce timer resets on each keystroke
    |-- On fire: PUT /api/notes/:id  ----->  Update notes row (title, body, updated_at)
    |                                         Return { saved: true, updated_at }
    |
    v
[useVersionTimer hook]
    |-- 30s idle timer resets on each keystroke
    |-- On fire: POST /api/notes/:id/check-version  ----->  versionService:
    |                                                          1. Load last version from note_versions
    |                                                          2. Compare body with current note body
    |                                                          3. If different: INSERT into note_versions
    |                                                          4. Return { version_created: bool, version_number }
    |
    v
[Save status indicator]
    |-- Shows: "Saving...", "Saved", "Error"
    |-- Version badge: "v3" updates when version is created
```

### Timer Interaction Rules

1. **Both timers reset on every keystroke.** When the user types, both the 2-second auto-save debounce and the 30-second version idle timer restart.

2. **Auto-save fires first during a pause.** If the user stops typing, the 2-second auto-save fires at t=2s. The 30-second version check fires at t=30s. By t=30s, the note row already has the latest content (from auto-save), so the version check compares `note_versions.last.body` against `notes.body`.

3. **Auto-save does not create versions.** The `PUT /api/notes/:id` endpoint updates only the `notes` table row. It never touches `note_versions`.

4. **Version check does not update the note.** The `POST /api/notes/:id/check-version` endpoint reads the current `notes.body`, compares it to the latest `note_versions.body`, and conditionally inserts a new version row. It does not modify the `notes` table.

5. **No overlap.** Auto-save owns `notes` row updates. Version creation owns `note_versions` inserts. They share no write path.

6. **Edge case -- new note with no versions:** When a note is first created, an initial version (version_number = 1) is created with the note's initial content (which may be empty). This ensures the version history always has at least one entry (REQ-016 acceptance scenario: "history contains the initial version").

7. **Edge case -- version restore:** When a user restores a prior version, the server updates the `notes` row with the restored content AND creates a new version entry (capturing the state before restoration). This is a server-side operation that bypasses both client timers.

### API Endpoints

```
PUT  /api/notes/:id           -- Auto-save: update title and/or body
POST /api/notes/:id/check-version  -- Version check: server diffs and conditionally creates version
GET  /api/notes/:id/versions  -- List versions (newest first)
GET  /api/notes/:id/versions/:version_id  -- View specific version content
POST /api/notes/:id/versions/:version_id/restore  -- Restore to prior version
```

### Multiple Tabs

If a user opens the same note in two browser tabs:
- Both tabs run independent auto-save debounce timers -- last write wins on the `notes` row
- Both tabs run independent version idle timers -- the server's diff check prevents duplicate versions (if the content hasn't changed since the last version, no new version is created regardless of how many tabs request a check)
- This is acceptable for v1. Real-time collaboration (multi-tab sync) is explicitly out of scope.

## Fitness Functions

**Dev:**
- Test: after auto-save fires, the `notes` row is updated and no `note_versions` row is created
- Test: after 30-second idle timer fires with changed content, a new `note_versions` row is created
- Test: after 30-second idle timer fires with unchanged content (compared to last version), no new `note_versions` row is created
- Test: creating a new note produces an initial version (version_number = 1)
- Test: restoring a version updates the `notes` row and creates a new version entry
- Test: rapid auto-save calls (simulating fast typing) do not create versions

**Prod:**
- Auto-save error rate: Warning > 0.1% of save requests fail | Critical > 1%
- Version creation rate: informational metric (expect low frequency -- at most one version per 30-second idle period per active note)
- Monitor for orphaned version-check requests that arrive without a preceding auto-save (indicates client bug)

## Consequences

- The client must implement two independent timer hooks -- this is the most complex piece of frontend state management in BrainDump
- The server's version diff check adds one read query (latest version) per version-check request -- acceptable frequency (at most once per 30 seconds per active editor)
- Last-write-wins for multi-tab means content can be lost if a user edits the same note in two tabs simultaneously -- this is an accepted trade-off given that real-time collaboration is out of scope
- The version_number is per-note and auto-incrementing -- the server must handle concurrent version creation requests atomically (use a transaction with SELECT FOR UPDATE or a database sequence)
