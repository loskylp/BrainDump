# ADR-003: Data Persistence and Schema Design
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

Data durability is a first-class concern for BrainDump. Users rely on the service to preserve their technical knowledge -- the Nexus stated that data loss would be "hard on the users." The schema must support: user accounts, notes with Markdown content, version history (indefinite retention), single-level folders, full-text search indexing, and server-side sessions. Account deletion must permanently remove all user data (REQ-014). All foreign key relationships must enforce referential integrity at the database level (REQ-012).

**Driver:** Data persistence, Data durability, Reliability
**Door type:** One-way -- the schema is the foundation of every feature; migrating to a fundamentally different data model is a project-level effort

## Trade-off Analysis

### Schema Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Normalized relational (separate tables for each entity, FK constraints) | Referential integrity enforced by database, clean separation of concerns, efficient queries, well-understood patterns | More JOINs for composite views, migration overhead for schema changes | Schema migrations as app evolves (managed by Sequelize) | MEDIUM -- migrations handle incremental changes; fundamental restructuring is expensive |
| Document-style (notes as JSONB with embedded versions) | Flexible schema, fewer JOINs for reading a note with its versions | No referential integrity for embedded data, version list grows unbounded in a single column, harder to query across versions, search indexing more complex | Unbounded JSONB arrays degrade performance; no FK constraints means orphaned data is possible | HIGH -- extracting embedded data into tables requires data migration |

**Recommendation:** Normalized relational schema
**Because:** Referential integrity is an explicit requirement (REQ-012). Version history is indefinitely retained (REQ-016) -- storing versions as separate rows scales linearly and allows efficient querying. The relational model maps directly to the domain model in the Brief.

### Backup Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Daily pg_dump (full logical backup) | Simple, portable, restorable to any PostgreSQL instance, proven approach | Backup window grows with data size, storage for daily snapshots | Backup file corruption (mitigated by checksum verification) | LOW -- change backup tool or frequency |
| Continuous WAL archiving (PITR) | Point-in-time recovery, minimal data loss window | More complex setup, requires WAL archive storage, harder to verify | Complexity may exceed solo developer's ops capacity | MEDIUM -- switch from pg_dump to WAL archiving |
| Application-level export | No database tooling needed | Incomplete (misses session state, indexes), slow, error-prone | Data loss from incomplete backup | HIGH -- must implement proper DB backup anyway |

**Recommendation:** Daily pg_dump with retention
**Because:** pg_dump is simple, well-understood, and produces a complete backup that can be restored to any PostgreSQL instance. For a service with <1000 users and text-only content, a daily full backup is fast (seconds to minutes) and the backup file is small. This matches the Commercial profile -- sufficient durability without the operational complexity of WAL archiving. Upgrade to PITR if the user base grows significantly.

## Decision

### Schema

```sql
-- Users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Folders (single-level, user-owned)
CREATE TABLE folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notes (user-owned, optionally in a folder)
CREATE TABLE notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,
    title           VARCHAR(500) NOT NULL DEFAULT '',
    body            TEXT NOT NULL DEFAULT '',
    search_vector   TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index (see ADR-005)
CREATE INDEX idx_notes_search ON notes USING GIN(search_vector);

-- Note Versions (immutable snapshots)
CREATE TABLE note_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id         UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    body            TEXT NOT NULL,
    version_number  INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_note_versions_note_id ON note_versions(note_id, version_number DESC);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions (managed by connect-pg-simple, schema provided by library)
-- CREATE TABLE "session" ( ... )  -- auto-created by connect-pg-simple
```

### Key Schema Decisions

1. **UUIDs as primary keys:** Prevents enumeration attacks (sequential IDs reveal user/note counts), safe for distributed generation if needed later.

2. **ON DELETE CASCADE on user_id:** When a user deletes their account, all their notes, versions, folders, reset tokens, and sessions are deleted atomically by the database. This satisfies REQ-014 without application-level cleanup code.

3. **ON DELETE SET NULL on folder_id:** When a folder is deleted, its notes are moved to root level (folder_id becomes NULL) per Brief domain invariant.

4. **ON DELETE CASCADE on note_id (versions):** When a note is deleted, all its versions are deleted per REQ-006 and Brief domain invariant.

5. **search_vector column:** Maintained tsvector for full-text search (see ADR-005). Updated via trigger on INSERT/UPDATE.

6. **version_number:** Integer incrementing per note. The combination (note_id, version_number) is unique. Descending index supports "newest first" listing.

7. **TIMESTAMPTZ:** All timestamps are timezone-aware, stored in UTC.

### Backup Configuration

**Status: CLOSED.** Backup responsibility is delegated to the nxlabs infrastructure team. BrainDump does not run or monitor backups. Durability SLA is dependent on nxlabs team's backup policy.

The backup trade-off analysis above remains valid as rationale for *why* pg_dump is the right approach for the shared PostgreSQL instance. BrainDump's only backup-related obligation is ensuring that schema migrations are tested in CI (migration test: apply all migrations to fresh DB + run test suite). Production backup execution, scheduling, retention, storage, and verification are entirely the nxlabs infrastructure team's responsibility.

## Fitness Functions

**Dev:**
- Integration test: write a note, restart the application, read the note back -- content is intact
- Integration test: delete a user, verify all associated notes, versions, folders, and sessions are deleted (CASCADE)
- Integration test: delete a folder, verify its notes have folder_id = NULL (SET NULL)
- Migration test in CI: apply all migrations to a fresh database, then run the full test suite
- Schema validation: all tables have the expected foreign key constraints (introspection test)

**Prod:**
- Backup health: N/A for BrainDump. Backup responsibility is delegated to the nxlabs infrastructure team. BrainDump does not run or monitor backups. FF-P05 and FF-P06 are marked N/A in the fitness functions index (see below).
- Database disk usage monitoring -- Warning: > 80% volume capacity | Critical: > 90% (infrastructure-level monitoring, not BrainDump-managed)

## Consequences

- UUID primary keys add 16 bytes per row compared to integer keys -- acceptable for text-heavy content where the key is a small fraction of row size
- CASCADE deletes mean the database handles referential cleanup atomically -- the application does not need to orchestrate multi-table deletions
- The search_vector column adds write overhead (trigger on every note update) -- acceptable because reads (searches) are far more frequent than writes in a note-taking app
- Database backups are the nxlabs infrastructure team's responsibility -- BrainDump does not run or monitor backups. Durability SLA is dependent on nxlabs team's backup policy. Data written between backups can be lost in a catastrophic failure. This is an accepted trade-off for Commercial profile.
- Sequelize migrations are the only way schema changes reach the database -- no manual DDL in production
- Migrations run against the shared PostgreSQL instance, so destructive schema changes must be backward-compatible or coordinated with a maintenance window (see ADR-007)
