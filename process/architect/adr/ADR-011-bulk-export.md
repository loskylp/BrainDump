# ADR-011: Bulk Export (ZIP) Architecture
**Date:** 2026-03-21 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

REQ-020 requires exporting a user's complete note collection as a ZIP archive. The ZIP must contain one `.md` file per note, organized into subdirectories matching the user's folder structure. Current content only (no version history). REQ-019 (single-note export) is client-side (Blob download from in-memory editor content). Bulk export differs: the catalog sidebar only loads note titles and metadata, not bodies. Fetching all note bodies client-side would require N API calls (one per note) or a bulk endpoint.

**Driver:** Data portability, Performance
**Door type:** Two-way -- the export endpoint is isolated; changing the approach requires updating one route and one client-side caller

## Trade-off Analysis

### Generation Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Backend endpoint streams ZIP | Single HTTP request, server has direct DB access to all note bodies, efficient for large collections, progress can be streamed via chunked transfer | Server CPU/memory for ZIP generation, adds a backend route | Memory pressure for very large collections (mitigated by streaming) | LOW -- change endpoint implementation |
| Client-side: fetch all bodies then build ZIP | No backend change, consistent with REQ-019 pattern | N API calls to fetch bodies (or a new bulk-fetch endpoint anyway), large memory footprint in browser, blocking UI thread during ZIP generation | Browser crashes or freezes for large collections, poor UX | MEDIUM -- move to backend |
| Client-side with Web Worker | Non-blocking ZIP generation | Still requires N API calls or bulk-fetch endpoint, complex client-side code | Same N+1 problem as above | MEDIUM -- move to backend |

**Recommendation:** Backend endpoint streams ZIP
**Because:** The server has direct DB access and can query all notes with bodies in a single query. Streaming the ZIP response avoids holding the entire archive in memory. This is the simplest, most efficient approach for a complete collection export. A single GET request replaces N individual note fetches.

## Decision

### Backend Endpoint

```
GET /api/notes/export
```

**Response:** `application/zip` with `Content-Disposition: attachment; filename="braindump-export-{username}-{YYYY-MM-DD}.zip"`

**Implementation:**
1. Query all notes for the authenticated user, including folder names (LEFT JOIN folders)
2. Use `archiver` (npm package) or `jszip` to build the ZIP in a streaming fashion
3. Pipe the ZIP stream directly to the HTTP response (no buffering the entire archive in memory)
4. For each note:
   - Determine the directory path: folder name (sanitized) or root
   - Determine the filename: note title (sanitized, same rules as REQ-019) + `.md`
   - Track filenames per directory to detect collisions; append numeric suffix if needed
5. Set appropriate headers: Content-Type, Content-Disposition, Transfer-Encoding: chunked

**Query:**
```sql
SELECT n.id, n.title, n.body, f.name AS folder_name
FROM notes n
LEFT JOIN folders f ON n.folder_id = f.id
WHERE n.user_id = :user_id
ORDER BY f.name NULLS FIRST, n.title;
```

### Filename Sanitization

Reuse the same sanitization rules as REQ-019 (single-note export):
- Replace special characters with hyphens
- Replace spaces with hyphens
- Remove consecutive hyphens
- Lowercase
- Truncate to 100 characters before `.md` extension
- Collision resolution: append `-2`, `-3`, etc. within the same directory

### Folder Name Sanitization

Folder names are sanitized using the same rules as note filenames (filesystem-safe). Empty or invalid folder names fall back to `unnamed-folder`.

### Empty Collection

If the user has no notes, return HTTP 200 with an empty ZIP (valid ZIP file with no entries). The frontend disables the "Export All" button when the note count is 0.

### Security

- Authentication required (existing `authenticate` middleware)
- Ownership enforced by `WHERE user_id = :user_id` (same pattern as all note queries)
- Rate limiting: not applied to export (it is a user-initiated, infrequent action). If abuse is detected, add rate limiting later.

### Frontend Integration

- "Export All" button in the sidebar header or a workspace actions menu
- On click: `window.location.href = '/api/notes/export'` (or `fetch` + Blob download)
- Button disabled when note count is 0 with tooltip "No notes to export"
- Optional: show a loading spinner during download for large collections

## Fitness Functions

**Dev:**
- Test: export with 5 notes (3 root, 2 in folder) produces a valid ZIP with correct directory structure
- Test: export with filename collisions produces unique filenames with numeric suffix
- Test: export with no notes returns a valid (empty) ZIP or 200 with appropriate response
- Test: export respects per-user isolation (User A's export contains only User A's notes)
- Test: exported .md files contain raw Markdown content (not HTML)
- Test: folder names in ZIP are sanitized for filesystem safety
- Test: ZIP filename follows the pattern `braindump-export-{username}-{YYYY-MM-DD}.zip`

**Prod:**
- Export endpoint p95 latency: Warning > 5000ms | Critical > 30000ms (large collections may take time)
- Monitor export request frequency per user: Warning > 10/hour (potential abuse)

## Consequences

- Adds one backend route and one npm dependency (archiver or jszip)
- Server memory usage during export scales with the number of notes (streaming mitigates this but the query result set is held in memory briefly)
- The endpoint does not include version history -- this is a scoping decision confirmed by the Nexus; adding version history later would require a query change and ZIP structure adjustment
- Export is a read-only operation -- no data mutation risk
- The ZIP format is universally supported across operating systems -- no compatibility concerns
