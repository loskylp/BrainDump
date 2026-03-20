# Fitness Functions Index -- BrainDump
**Generated from:** ADR-001 through ADR-009 | **Date:** 2026-03-19 | **Revised:** 2026-03-19 (ADR-007/ADR-003 infra update)

This index lists all defined fitness functions. Each row references its defining ADR for full context. Agents that need to enumerate fitness functions (Planner, Verifier) read this index and follow pointers to ADRs for rationale and implementation details.

---

## Dev-side Checks

| ID | Characteristic | Check | Source |
|---|---|---|---|
| FF-D01 | Build integrity | Project builds and all tests pass in CI | ADR-001 |
| FF-D02 | Bundle size | Lighthouse CI: LCP < 2.5s, bundle < 500KB gzipped (excl. CodeMirror) | ADR-001 |
| FF-D03 | Auth: protected routes | Test suite: protected routes return 401 without valid session | ADR-002 |
| FF-D04 | Auth: login failure | Test suite: wrong password returns 401 (not 500) | ADR-002 |
| FF-D05 | Auth: no enumeration | Test suite: password reset response identical for registered/unregistered emails | ADR-002 |
| FF-D06 | Auth: token expiry | Test suite: expired reset tokens are rejected | ADR-002 |
| FF-D07 | Auth: logout | Test suite: after logout, session invalidated, protected routes return 401 | ADR-002 |
| FF-D08 | Durability: restart | Integration test: write note, restart app, read back -- content intact | ADR-003 |
| FF-D09 | Durability: cascade delete user | Integration test: delete user, verify all associated data deleted | ADR-003 |
| FF-D10 | Durability: folder delete | Integration test: delete folder, verify notes have folder_id = NULL | ADR-003 |
| FF-D11 | Durability: migrations | CI: apply all migrations to fresh DB, run full test suite | ADR-003 |
| FF-D12 | Durability: FK constraints | Schema introspection test: all expected FKs exist | ADR-003 |
| FF-D13 | Auto-save: no version | Test: auto-save updates notes row, does NOT create note_versions row | ADR-004 |
| FF-D14 | Versioning: idle + change | Test: 30s idle + changed content creates new version | ADR-004 |
| FF-D15 | Versioning: idle + no change | Test: 30s idle + unchanged content does NOT create version | ADR-004 |
| FF-D16 | Versioning: initial | Test: new note has initial version (version_number = 1) | ADR-004 |
| FF-D17 | Versioning: restore | Test: restore updates notes row and creates new version entry | ADR-004 |
| FF-D18 | Versioning: rapid save | Test: rapid auto-save calls do not create versions | ADR-004 |
| FF-D19 | Search: title match | Test: note with term in title is returned by search | ADR-005 |
| FF-D20 | Search: body match | Test: note with term only in body is returned by search | ADR-005 |
| FF-D21 | Search: ranking | Test: title match ranks higher than body-only match | ADR-005 |
| FF-D22 | Search: isolation | Test: search results scoped to authenticated user only | ADR-005 |
| FF-D23 | Search: empty results | Test: non-existent term returns empty set | ADR-005 |
| FF-D24 | Search: performance | Test: search across 200 notes completes in < 200ms | ADR-005 |
| FF-D25 | Search: snippets | Test: ts_headline returns highlighted matching terms | ADR-005 |
| FF-D26 | Isolation: note access | Test: User A cannot access User B's note (returns 404) | ADR-006 |
| FF-D27 | Isolation: folder access | Test: User A cannot access User B's folder (returns 404) | ADR-006 |
| FF-D28 | Isolation: version access | Test: User A cannot access User B's note version (returns 404) | ADR-006 |
| FF-D29 | Isolation: search scope | Test: User A's search never includes User B's notes | ADR-006 |
| FF-D30 | Isolation: list scope | Test: list endpoints return only authenticated user's resources | ADR-006 |
| FF-D31 | Isolation: RLS active | Test: RLS policy blocks access when app-level filter bypassed | ADR-006 |
| FF-D32 | Deploy: CI speed | CI pipeline completes in < 10 minutes | ADR-007 |
| FF-D33 | Deploy: image build | Docker image builds and starts within 5 seconds | ADR-007 |
| FF-D34 | Deploy: health check | Health check returns 200 after container start | ADR-007 |
| FF-D43 | Deploy: migration-on-startup | Entrypoint script runs migrations before starting application server | ADR-007 |
| FF-D35 | Aesthetic: config frozen | CI flags changes to tailwind.config.js for review | ADR-008 |
| FF-D36 | Aesthetic: accessibility | Lighthouse CI accessibility audit passes | ADR-008 |
| FF-D37 | Aesthetic: no inline overrides | Lint rule: no inline styles overriding Tailwind tokens | ADR-008 |
| FF-D38 | Responsive: desktop | Test: at 1920px, all three panels visible | ADR-009 |
| FF-D39 | Responsive: tablet | Test: at 800px, editor+preview visible, sidebar toggled | ADR-009 |
| FF-D40 | Responsive: mobile | Test: at 375px, single panel with tab bar | ADR-009 |
| FF-D41 | Responsive: no scrollbar | Test: no horizontal scrollbar at 375/768/1024/1920px | ADR-009 |
| FF-D42 | Responsive: touch targets | Test: interactive elements >= 44px on viewports < 768px | ADR-009 |

---

## Production Monitoring Thresholds

| ID | Characteristic | Metric | Warning | Critical | Source |
|---|---|---|---|---|---|
| FF-P01 | Availability | Health check via Uptime Kuma (auto-registered via Docker labels, https://status.nxlabs.cc) | 2 consecutive failures | 5 consecutive failures | ADR-007 |
| FF-P02 | App startup | JS error rate in browser sessions | > 1% of sessions | > 5% of sessions | ADR-001 |
| FF-P03 | Auth security | 401 response rate (5-min window) | Spike > 5x baseline | Any 200 on protected route without valid session | ADR-002 |
| FF-P04 | Auth enumeration | Password reset request rate per IP | > 10 req/min from same IP | N/A (warning only) | ADR-002 |
| FF-P05 | Backup integrity | **N/A** -- Backup responsibility delegated to nxlabs infrastructure team (Nexus decision). BrainDump does not run or monitor backups. Durability SLA dependent on nxlabs team's backup policy. | N/A | N/A | ADR-003 (closed) |
| FF-P06 | Backup verification | **N/A** -- Backup responsibility delegated to nxlabs infrastructure team (Nexus decision). BrainDump does not run or monitor backups. Durability SLA dependent on nxlabs team's backup policy. | N/A | N/A | ADR-003 (closed) |
| FF-P07 | Disk capacity | Database volume usage (infra-level monitoring) | > 80% | > 90% | ADR-003 |
| FF-P08 | Auto-save reliability | Save request error rate | > 0.1% | > 1% | ADR-004 |
| FF-P09 | Search performance | Search query p95 latency | > 500ms | > 2000ms | ADR-005 |
| FF-P10 | Search quality | Zero-result search rate | > 50% of searches | N/A (informational) | ADR-005 |
| FF-P11 | Data isolation | RLS policy violations in PG logs | 1 violation | Any violation (investigate) | ADR-006 |
| FF-P12 | Resource enumeration | 404 rate on resource endpoints | Spike (potential enumeration) | N/A (informational) | ADR-006 |
| FF-P13 | TLS certificate | **INFRA RESPONSIBILITY** -- managed by Traefik ACME on nxlabs.cc. Auto-renews via Let's Encrypt. | N/A (infra) | N/A (infra) | ADR-007 (revised) |
| FF-P14 | Server resources | CPU and memory utilization | CPU > 80% (5 min) or mem > 80% | CPU > 95% or mem > 95% | ADR-007 |
| FF-P15 | Deploy: Watchtower | Watchtower successfully pulls and restarts on image update (check Watchtower logs) | Pull failure | Restart failure | ADR-007 (revised) |
