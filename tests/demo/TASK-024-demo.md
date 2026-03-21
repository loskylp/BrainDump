# Demo Script — TASK-024: Rate Limiting on Auth Endpoints

**Task:** TASK-024
**Date:** 2026-03-21
**Environment:** https://braindump.staging.nxlabs.cc
**Prerequisites:** curl available; no active session cookies required; staging is running the image from commit `3a6991f`.

---

## Scenario 1 — Rate limit headers are present on the login endpoint (AC-4)

Given   A fresh request to `POST /api/auth/login` with any credentials

When    The request is sent

Then    The response includes `RateLimit-Limit: 10`, `RateLimit-Remaining: 9`, and `RateLimit-Reset: 900`
        No `X-RateLimit-*` (legacy) headers appear

**Steps:**

```
curl -si -X POST https://braindump.staging.nxlabs.cc/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"wrongpassword"}' \
  | grep -i ratelimit
```

Expected output (headers — HTTP status will be 401 because credentials are invalid):

```
ratelimit-limit: 10
ratelimit-policy: 10;w=900
ratelimit-remaining: 9
ratelimit-reset: 900
```

Verify `x-ratelimit-limit` is absent from the output.

---

## Scenario 2 — Requests within the window are not blocked (AC-2, AC-6)

Given   A fresh IP that has not previously hit the auth endpoints in the last 15 minutes

When    A single `POST /api/auth/login` request is sent with valid credentials for an existing account

Then    The response is HTTP 200 (or HTTP 401 if credentials are intentionally wrong), not HTTP 429

**Steps:**

Use a registered account. Send one login request:

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://braindump.staging.nxlabs.cc/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<registered-email>","password":"<password>"}'
```

Expected output: `200`

---

## Scenario 3 — The 11th request within the window is blocked with HTTP 429 (AC-2)

Given   An IP that has made exactly 10 `POST /api/auth/login` requests within the current 15-minute window

When    An 11th request is sent

Then    The response is HTTP 429 with body `{"error":"Too many requests, please try again later"}`

**Steps:**

Run a loop of 11 requests and observe the status codes:

```
for i in $(seq 1 11); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://braindump.staging.nxlabs.cc/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ratelimitdemo@example.com","password":"wrongpassword"}')
  echo "Request $i: $STATUS"
done
```

Expected output: requests 1–10 return `401` (within window); request 11 returns `429`.

Note: if the IP has already consumed some quota in an earlier probe, the 429 may appear earlier. Wait for the 15-minute window to reset (`RateLimit-Reset` value, in seconds from the first request) and repeat from a fresh window.

---

## Scenario 4 — Rate limiting on the register endpoint behaves identically (AC-3)

Given   An IP that has made exactly 10 `POST /api/auth/register` requests within the current 15-minute window

When    An 11th request is sent

Then    The response is HTTP 429

**Steps:**

```
for i in $(seq 1 11); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://braindump.staging.nxlabs.cc/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"demouser$i\",\"email\":\"rldemo$i@example.com\",\"password\":\"password123\"}")
  echo "Request $i: $STATUS"
done
```

Expected output: requests 1–10 return `201` (accounts created) or `409` (email taken if retrying); request 11 returns `429`.

---

## Scenario 5 — express-rate-limit is a production dependency (AC-1)

Given   The backend `package.json`

When    The `dependencies` section is inspected

Then    `express-rate-limit` appears with a version string, and is absent from `devDependencies`

**Steps:**

```
cat backend/package.json | grep -A 1 "express-rate-limit"
```

Expected output includes a line similar to:

```
"express-rate-limit": "^7.4.0"
```

within the `dependencies` block, not within `devDependencies`.

---

## Scenario 6 — Rate limiter uses the default in-memory store (AC-5)

Given   The `backend/src/middleware/rateLimiter.js` source file

When    The file is read

Then    The only `require` call is for `express-rate-limit`; no Redis, ioredis, or external store packages are imported

**Steps:**

```
grep "require(" backend/src/middleware/rateLimiter.js
```

Expected output:

```
const rateLimit = require('express-rate-limit');
```

No other `require` calls should appear.
