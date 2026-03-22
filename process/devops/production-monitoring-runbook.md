# Production Monitoring Runbook
**Project:** BrainDump
**Date:** 2026-03-21
**Status:** Active
**ADR:** ADR-007 (Deployment Model), ADR-001 through ADR-011 (Fitness Functions)
**Task:** TASK-032

---

## Purpose

This runbook documents the production-side procedures for verifying BrainDump's fitness functions in the live environment at `https://braindump.nxlabs.cc`. It covers:

- Uptime Kuma alert configuration verification
- Reading Docker container logs
- Memory trend monitoring via the health endpoint
- Manual fitness function checks (FF-P01 through FF-P05)
- Error rate monitoring

Fitness functions are defined in the Architect's output. This runbook is the operator's verification guide for the prod-side obligations from TASK-032.

---

## 1. Uptime Kuma Alert Configuration

### How the monitor is registered

BrainDump uses AutoKuma to register its Uptime Kuma monitor automatically via Docker labels. When the production container starts, AutoKuma reads the following labels from `docker-compose.production.yml` and creates the monitor:

```
kuma.braindump-production.http.name=BrainDump Production
kuma.braindump-production.http.url=https://braindump.nxlabs.cc/api/health
```

The monitor polls the health endpoint and expects HTTP 200.

### Verifying the monitor is active

1. Open the Uptime Kuma dashboard: `https://status.nxlabs.cc`
2. Confirm a monitor named "BrainDump Production" is listed and shows status UP.
3. Confirm the monitored URL is `https://braindump.nxlabs.cc/api/health`.
4. Confirm the check interval is 60 seconds (default AutoKuma setting).

If the monitor is missing:

```sh
# Check AutoKuma log to see if label registration was attempted
ssh deploy@nxlabs.cc "docker logs autokuma --tail 50"
```

If AutoKuma is not functioning, register the monitor manually:
1. Open `https://status.nxlabs.cc`.
2. Add monitor: Type = HTTP(s), URL = `https://braindump.nxlabs.cc/api/health`, interval = 60 seconds.
3. Set alert thresholds: Warning at 2 consecutive failures, Critical at 5 consecutive failures.

### Alert thresholds (per ADR-007 fitness functions)

| Level | Trigger | Action |
|---|---|---|
| Warning | 2 consecutive health check failures | Investigate container status and logs immediately |
| Critical | 5 consecutive health check failures | Escalate; production is considered down |

### Verifying alert notification is configured

In Uptime Kuma, open the "BrainDump Production" monitor settings and confirm:
- At least one notification channel is attached (email, Slack, Telegram, or equivalent).
- A test notification can be triggered via the "Test" button in the notification channel settings.

**Note:** Notification channel configuration requires operator action in the Uptime Kuma UI. There is no automated path for this from the repository. This is documented as a required operator step before Go-Live (TASK-032, AC-1).

---

## 2. Reading Docker Container Logs

All application output (stdout and stderr) flows to Docker logs. Structured log entries (JSON) are written by the application and can be parsed downstream.

### Standard log commands

```sh
ssh deploy@nxlabs.cc

# Live log stream (Ctrl+C to stop)
docker compose -f /opt/braindump/docker-compose.production.yml logs -f --tail=100

# Last 100 lines (snapshot, no follow)
docker compose -f /opt/braindump/docker-compose.production.yml logs --tail=100

# Equivalent using the container name directly
docker logs braindump-braindump-production-1 --tail=100 -f
```

### Filtering log output

```sh
ssh deploy@nxlabs.cc

# Show only structured event logs (auth_failure, search, export)
docker logs braindump-braindump-production-1 --tail=500 2>&1 | grep '"event"'

# Show only auth failure events (stderr)
docker logs braindump-braindump-production-1 --tail=500 2>&1 | grep '"event":"auth_failure"'

# Show only search latency events
docker logs braindump-braindump-production-1 --tail=500 | grep '"event":"search"'

# Show only export events
docker logs braindump-braindump-production-1 --tail=500 | grep '"event":"export"'

# Show migration output from container start
docker logs braindump-braindump-production-1 2>&1 | grep -E '(entrypoint|migration|Migrations)'
```

### Structured log fields

The application emits the following structured JSON log entries:

**Auth failure** (written to stderr via `console.error`):
```json
{ "event": "auth_failure", "endpoint": "login|register", "email": "user@example.com", "reason": "INVALID_CREDENTIALS|EMAIL_TAKEN|VALIDATION_ERROR", "ip": "1.2.3.4" }
```

**Search latency** (written to stdout via `console.log`):
```json
{ "event": "search", "query": "rust ownership", "duration_ms": 12, "result_count": 3 }
```

**Export request** (written to stdout via `console.log`):
```json
{ "event": "export", "userId": "uuid", "note_count": 42 }
```

---

## 3. Memory Trend Monitoring via `/api/health`

The health endpoint returns process statistics in non-test environments:

```sh
curl -s https://braindump.nxlabs.cc/api/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "db": "connected",
  "process": {
    "uptime_s": 12345,
    "memory_rss_mb": 87,
    "node_version": "v20.x.x"
  }
}
```

### Checking memory trend manually

Run the following from any machine with internet access (no SSH required):

```sh
# Single snapshot
curl -s https://braindump.nxlabs.cc/api/health | jq '.process.memory_rss_mb'

# Sample every 30 seconds for 5 minutes (10 samples)
for i in $(seq 1 10); do
  echo "$(date -u +%H:%M:%S) $(curl -s https://braindump.nxlabs.cc/api/health | jq '.process.memory_rss_mb') MB"
  sleep 30
done
```

### Memory fitness function threshold

Fitness function FF-P05 requires RSS memory < 256 MB under normal load. If `memory_rss_mb` approaches 200 MB, investigate:

1. Check for memory leaks in recent deploys (compare `uptime_s` — a recently restarted container with high memory is more concerning than a long-running one).
2. Check for unusual traffic patterns that might indicate a search or export abuse pattern.
3. If memory consistently exceeds 200 MB, consider scheduling a container restart during low-traffic hours: `docker compose -f /opt/braindump/docker-compose.production.yml up -d`

---

## 4. Manual Fitness Function Checks

Run these checks after every production deployment to confirm the system meets its quality attributes.

### FF-P01: Health endpoint responds < 500ms

```sh
# Measure response time with curl's built-in timing
curl -o /dev/null -s -w "HTTP %{http_code} -- %{time_total}s\n" https://braindump.nxlabs.cc/api/health
```

**Pass criterion:** HTTP 200 and `time_total` < 0.500 seconds.

If response time exceeds 500ms:
1. Check database connection: the health endpoint calls `sequelize.authenticate()`. Slow DB connections will inflate this time.
2. Check container resource usage: `ssh deploy@nxlabs.cc "docker stats braindump-braindump-production-1 --no-stream"`

---

### FF-P02: Login rate limiter returns 429 after 10 requests

The auth rate limiter (implemented in TASK-016) blocks after 10 requests per IP per 15-minute window.

```sh
# Send 11 login attempts from the same IP and confirm the 11th returns 429.
# IMPORTANT: Use a test account email — this will trigger auth_failure log entries.

for i in $(seq 1 11); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST https://braindump.nxlabs.cc/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ratelimit-test@example.com","password":"wrong-password"}')
  echo "Request $i: HTTP $STATUS"
done
```

**Pass criterion:** Requests 1-10 return HTTP 401 (invalid credentials). Request 11 returns HTTP 429 (rate limit hit).

If 429 is not returned, check:
1. That `authRateLimiter` middleware is applied to `/api/auth/login` in `backend/src/routes/auth.js`.
2. That the rate limiter is not bypassed by a reverse-proxy header stripping the client IP.

---

### FF-P03: Search returns results < 200ms for common queries

```sh
# Measure search latency. Requires an active session cookie.
# Replace COOKIE with a valid session cookie from a logged-in browser session.

curl -o /dev/null -s -w "HTTP %{http_code} -- %{time_total}s\n" \
  -H "Cookie: connect.sid=COOKIE" \
  "https://braindump.nxlabs.cc/api/search?q=test"
```

**Pass criterion:** HTTP 200 and `time_total` < 0.200 seconds.

Alternatively, check the structured search log for duration_ms values:

```sh
ssh deploy@nxlabs.cc \
  "docker logs braindump-braindump-production-1 --tail=200 2>&1 | grep '\"event\":\"search\"' | jq '.duration_ms'"
```

**Pass criterion:** All `duration_ms` values < 200.

If search is slow:
1. Check PostgreSQL connection and GIN index health.
2. Check whether the search vector trigger is functioning: `EXPLAIN ANALYZE SELECT * FROM notes WHERE search_vector @@ plainto_tsquery('english', 'test');` (run on the production DB via the postgres container).

---

### FF-P04: Export ZIP contains all user notes

```sh
# Download the export ZIP for a known test account and verify its contents.
# Replace COOKIE with a valid session cookie.

curl -s -L \
  -H "Cookie: connect.sid=COOKIE" \
  "https://braindump.nxlabs.cc/api/notes/export" \
  -o /tmp/braindump-export-check.zip

# Verify it is a valid ZIP
file /tmp/braindump-export-check.zip
# Expected: Zip archive data

# Count files in the archive
unzip -l /tmp/braindump-export-check.zip | tail -1
# Expected: shows the correct number of .md files matching the user's note count
```

**Pass criterion:** ZIP downloads successfully (HTTP 200), `file` identifies it as a ZIP archive, and the file count matches the user's note count.

If the export fails:
1. Check container logs for errors in the `/api/notes/export` handler.
2. Verify the `archiver` npm package is present in the production image: `docker exec braindump-braindump-production-1 node -e "require('archiver'); console.log('ok')"`

---

### FF-P05: Memory RSS < 256MB under normal load

```sh
curl -s https://braindump.nxlabs.cc/api/health | jq '.process.memory_rss_mb'
```

**Pass criterion:** `memory_rss_mb` < 256.

For trend data, use the sampling loop from Section 3 above.

---

## 5. Error Rate Monitoring

### Grepping Docker logs for 5xx responses

Express does not log HTTP status codes by default. 5xx errors are surfaced in two ways:

1. **Uncaught errors** logged by the centralised error handler in `app.js`:
   ```
   Unhandled error: <Error object>
   ```

2. **Structured application errors** that produce 5xx responses (any error whose code is not in `ERROR_MAP` maps to 500).

```sh
ssh deploy@nxlabs.cc

# Show all unhandled errors in the last 500 log lines
docker logs braindump-braindump-production-1 --tail=500 2>&1 | grep "Unhandled error"

# Count unhandled errors in the last 500 lines
docker logs braindump-braindump-production-1 --tail=500 2>&1 | grep -c "Unhandled error"
```

### Calculating error rate over a time window

Docker log lines do not carry HTTP status codes without a Morgan or similar access log middleware. For a 5-minute error rate calculation, count unhandled error log entries and compare to estimated request volume.

**To add access logging for precise 5xx rate tracking (operator action):**

Add Morgan access logging to `backend/src/app.js` in a future maintenance cycle:
```js
const morgan = require('morgan');
app.use(morgan('combined'));  // Apache combined log format, includes status code
```

This would allow `grep " 5[0-9][0-9] "` to count 5xx responses precisely.

**Current workaround -- manual rate estimation:**

```sh
ssh deploy@nxlabs.cc

# Count "Unhandled error" entries in the last 5 minutes of log output.
# This requires knowing approximately how many log lines are produced per minute.
# As a rough guide, sample the last 1000 lines and note the timestamp range.
docker logs braindump-braindump-production-1 --tail=1000 2>&1 | head -1
docker logs braindump-braindump-production-1 --tail=1000 2>&1 | tail -1
# Note the time range, then count:
docker logs braindump-braindump-production-1 --tail=1000 2>&1 | grep -c "Unhandled error"
```

**Alert threshold (TASK-032, AC-6):** Alert if 5xx responses exceed 1% of total requests over any 5-minute window. This requires Morgan access logging to measure precisely; until that is added, any non-zero `Unhandled error` count should be investigated immediately.

**Note (operator action required):** Automated 5xx alerting at > 1% rate requires either Morgan access logging piped to a log aggregator, or a dedicated APM tool. This cannot be configured from the repository alone. Adding Morgan logging is the recommended next step for precise error rate measurement. Document this as a post-Go-Live improvement.

---

## 6. Database Connection Pool Monitoring

The Sequelize connection pool is configured in `backend/src/config/database.js`. Pool health is indirectly observable via the health endpoint (a failed `sequelize.authenticate()` call returns 503).

For active pool metrics, check Sequelize pool state from within the container:

```sh
ssh deploy@nxlabs.cc

# Check database connectivity via health endpoint
curl -s https://braindump.nxlabs.cc/api/health | jq '{status: .status, db: .db}'

# Check active connections at the PostgreSQL level (run from postgres container)
docker exec postgres psql -U braindump_prod -d braindump_prod \
  -c "SELECT count(*) AS active FROM pg_stat_activity WHERE datname = 'braindump_prod' AND state = 'active';"

# Check idle connections
docker exec postgres psql -U braindump_prod -d braindump_prod \
  -c "SELECT count(*) AS idle FROM pg_stat_activity WHERE datname = 'braindump_prod' AND state = 'idle';"
```

**Thresholds:** The default Sequelize pool has a maximum of 5 connections. If active + idle connections consistently approach 5, consider increasing the pool size in `backend/src/config/database.js` (requires a new deploy).

---

## 7. Self-Verification Evidence (TASK-032)

| Check | Method | Pass Criterion |
|---|---|---|
| Structured logging — auth failure | POST /api/auth/login with bad credentials; check `docker logs` for `"event":"auth_failure"` | JSON log entry present in stderr |
| Structured logging — search latency | GET /api/search?q=test (authenticated); check `docker logs` | JSON log entry with `duration_ms` present |
| Structured logging — export | GET /api/notes/export (authenticated); check `docker logs` | JSON log entry with `note_count` present |
| Health endpoint process stats | GET /api/health | Response includes `process.uptime_s`, `process.memory_rss_mb`, `process.node_version` |
| FF-P01: Health < 500ms | curl with `time_total` | < 0.500s |
| FF-P02: Rate limiter 429 | 11-request curl loop | Request 11 returns 429 |
| FF-P03: Search < 200ms | curl with `time_total` or search log `duration_ms` | < 200ms |
| FF-P04: Export ZIP valid | curl export endpoint + `unzip -l` | Valid ZIP with correct file count |
| FF-P05: Memory < 256MB | GET /api/health `.process.memory_rss_mb` | < 256 |
| Uptime Kuma monitor active | https://status.nxlabs.cc | "BrainDump Production" monitor shows UP |
| Uptime Kuma alert configured | Uptime Kuma UI | Notification channel attached, test notification sent successfully |

**Operator actions required before Go-Live:**
1. Verify Uptime Kuma notification channel is attached and sends a test alert (AC-1).
2. Run the FF-P02 rate limiter curl test from the production network (or a known external IP) to confirm CrowdSec is not interfering.
3. Add Morgan access logging in a post-Go-Live maintenance cycle to enable precise 5xx rate calculation (AC-6 full implementation).
