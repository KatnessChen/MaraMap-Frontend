# MaraMap Chrome Extension — Antigravity Project Instructions

## Project Overview

This repo is a **Chrome Extension (MV3)** that scrapes Facebook personal profiles and fan pages, then sends the collected posts to the MaraMap Backend API. It is the data ingestion client for the MaraMap platform.

Full architecture spec: [`docs/SPEC.md`](../docs/SPEC.md)

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript (strict mode) |
| UI | React 18, CSS Modules |
| Bundler | Vite + `vite-plugin-web-extension` |
| Extension | Chrome MV3 |
| Local storage | `chrome.storage.local` (auth token only) |

---

## Backend API

### OpenAPI Spec

Always read the spec before generating HTTP requests or modifying API call code:

```
/Users/kc/Develop/06_MaraMap/MaraMap-Backend/docs/openapi.json
```

To regenerate after backend changes:

```bash
cd /Users/kc/Develop/06_MaraMap/MaraMap-Backend
pnpm gen:spec
```

### Conventions

- All endpoints are prefixed `/api/v1/` except `GET /health-check`
- `POST /api/v1/auth/login` — **no** `Authorization` header required
- All other endpoints require `Authorization: Bearer <token>`
- Token type: **Supabase JWT**, valid for **1 hour** — no refresh token
- On `401`: clear `chrome.storage.local` and redirect to `LoginPage`
- `POST /api/v1/ingest` returns **202 Accepted** (async) — do not await processing
- Duplicate posts (`source_id` collision) return **409 Conflict** — skip silently

### Key Endpoints Used by This Extension

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/v1/auth/login` | POST | Returns `{ token }`. No auth required. |
| `/api/v1/scrape/sessions` | GET | `?target_url=` — returns session or 404 |
| `/api/v1/scrape/sessions` | POST | Create session for target URL |
| `/api/v1/scrape/sessions/:id` | PATCH | Update `scraped_count`, `oldest_post_*`, or `status` |
| `/api/v1/scrape/sessions/:id` | DELETE | Clear session (user restarts) |
| `/api/v1/ingest/batch` | POST | Send batch of 10 posts. Returns 202. |

---

## Scrape Session Logic

- Session progress is stored **in the database** (`scrape_sessions` table), not in `chrome.storage.local`
- `chrome.storage.local` stores **only the auth token**
- On `ScrapePage` load: call `GET /api/v1/scrape/sessions?target_url=<current_fb_url>`
  - `404` → fresh start
  - `IN_PROGRESS` → prompt user: continue or restart
  - `COMPLETED` → show completion, offer restart
- Resume: content script scrolls to find `oldest_post_id`, then collects posts older than `oldest_post_date`
- Each batch of 10 posts: `PATCH` session with `{ scraped_count, oldest_post_id, oldest_post_date }`
- Page bottom reached: `PATCH` session with `{ status: 'COMPLETED' }`

---

## Image Strategy

- **First image per post**: Extension downloads it in-browser (authenticated session), resizes to 300px, sends as `thumbnail_base64`
- **Remaining images**: Send URLs only — backend async worker downloads them via Cloud Tasks
- **Videos**: Capture thumbnail URL only, never download video content
- **Download failure**: Mark as `IMAGE_UNAVAILABLE`, do not block post ingestion

---

## MV3 Constraints

- Service Worker terminates after ~30s of inactivity — use `chrome.alarms` every 25s as keepalive during active scraping
- All cross-context communication via `chrome.runtime.sendMessage()`
- Content scripts injected via `chrome.scripting.executeScript()` from the popup

---

## Important Rules

- Never store session progress in `chrome.storage.local` — always use the DB
- Never download images other than the first thumbnail in the Extension
- Always handle `401` by clearing storage and redirecting to login
- Always skip `409` (duplicate `source_id`) silently
