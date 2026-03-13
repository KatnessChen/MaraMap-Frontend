# 🧩 MaraMap Chrome Extension — Technical Specification

## 1. Overview

The MaraMap Chrome Extension is the data ingestion front-end of the MaraMap platform. It runs in the user's browser, scrapes Facebook personal or fan page posts on demand, and sends structured data to the MaraMap Backend API.

**Core Responsibilities:**
- Authenticate the user with their MaraMap credentials
- Detect the current Facebook page context (personal profile / fan page)
- Scrape post data (text, metadata, image URLs, one thumbnail)
- Send data in batches to the Backend Ingestion API
- Track scrape session progress and support resume after interruption

---

## 2. Tech Stack

| Layer | Choice | Reason |
| ----- | ------ | ------ |
| Language | TypeScript | Type safety across popup, content script, and background |
| UI Framework | React 18 | Component model for popup pages |
| Bundler | Vite + `vite-plugin-web-extension` | MV3-compatible multi-entry build |
| Styling | CSS Modules | Scoped styles, no external dependencies |
| Storage | `chrome.storage.local` | Persists auth token only (session progress stored in DB) |
| Manifest | MV3 | Required for Chrome Web Store compliance |

---

## 3. Project Structure

```
MaraMap-Chrome-Extension/
├── docs/
│   └── SPEC.md
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
├── src/
│   ├── popup/                    # React Popup UI
│   │   ├── main.tsx              # React root
│   │   ├── App.tsx               # Route: LoginPage | ScrapePage
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx     # Email + password form
│   │   │   └── ScrapePage.tsx    # Main scrape control panel
│   │   ├── components/
│   │   │   ├── ProgressBar.tsx
│   │   │   └── StatusMessage.tsx
│   │   └── popup.html
│   ├── content/                  # Content Script (injected into Facebook)
│   │   └── scraper.ts
│   ├── background/               # MV3 Service Worker
│   │   └── background.ts
│   └── lib/
│       ├── api.ts                # MaraMap Backend API client
│       ├── storage.ts            # chrome.storage.local helpers
│       └── types.ts              # Shared TypeScript types
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Manifest (MV3)

```json
{
  "manifest_version": 3,
  "name": "MaraMap Scraper",
  "version": "1.0.0",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://*.facebook.com/*"],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    {
      "matches": ["https://*.facebook.com/*"],
      "js": ["content/scraper.js"],
      "run_at": "document_idle"
    }
  ]
}
```

---

## 5. Authentication Flow

User logs in with their MaraMap account (email + password issued by admin). The token is stored locally and reused until it expires or the user logs out.

```
[Popup opens]
  → Read chrome.storage.local for { token }
  → token exists? → Show ScrapePage
  → no token?    → Show LoginPage

[LoginPage — User submits credentials]
  → POST /api/v1/auth/login { email, password }
  → 200 OK → store token in chrome.storage.local
  → Navigate to ScrapePage

[ScrapePage loads]
  → GET /api/v1/scrape/sessions?target_url=<current_facebook_url>
  → No session   → Show "Collect" button
  → IN_PROGRESS  → Show confirmation dialog (Continue / Restart)
  → COMPLETED    → Show completion message (option to Restart)

[Logout]
  → Clear chrome.storage.local
  → Navigate to LoginPage
```

**Storage schema (auth token only):**
```typescript
{
  token: string;   // Bearer token — all session progress is fetched from the DB
}
```

---

## 6. Scrape Flow

### 6.1 Trigger

User navigates to a Facebook personal profile or fan page, opens the popup, and clicks **"Collect"**.

### 6.2 How Scraping Works

The popup calls `chrome.scripting.executeScript()` to inject and run `scraper.ts` in the active Facebook tab. The content script scrolls the page, collects posts, and communicates results back via `chrome.runtime.sendMessage()`.

```
── Fresh Scrape ──────────────────────────────────────────
[User clicks "Collect"]
  → POST /api/v1/scrape/sessions → receive session_id
  → Send message to content script: { action: "START_SCRAPE", session_id }
  → Content script scrolls newest-to-oldest, batches of 10:
      → POST /api/v1/ingest/batch { session_id, posts[10] }
      → PATCH /api/v1/scrape/sessions/:id { scraped_count, oldest_post_id, oldest_post_date }
  → Smart end detection → PATCH session { status: 'COMPLETED' }

── Resume ───────────────────────────────────────────────
[User confirms Continue]
  → Send message to content script:
    { action: "RESUME_SCRAPE", session_id, oldest_post_id, oldest_post_date }
  → Content script performs anchor seek (see Section 8)
  → Continue from anchor, same flow as above

── Restart ──────────────────────────────────────────────
[User confirms Restart]
  → DELETE /api/v1/scrape/sessions/:id
  → Restart "Fresh Scrape" flow
```

### 6.3 Data Collected Per Post

| Field | Source | Notes |
| ----- | ------ | ----- |
| `source_id` | Facebook post URL (`story_fbid` or `/posts/XXX`) | Idempotency key |
| `published_at` | `data-utime` attribute or `<abbr>` | ISO 8601 |
| `author` | Page title or post author element | |
| `raw_html` | Post container `innerHTML` | AI worker converts to Tiptap JSON |
| `image_urls` | `<img src>` within post | All image URLs collected |
| `thumbnail_base64` | First image only, resized to 300px, fetched as Blob in browser | Stored immediately for preview |

> **Image Strategy:**
> - First image: downloaded in-browser by the Extension (authenticated Facebook session), resized to 300px, sent as Base64.
> - All other images: URLs only — the backend async worker downloads and stores them in Supabase Storage.
> - Videos: capture thumbnail URL only, never download the video itself.
> - If an image download fails: mark as `IMAGE_UNAVAILABLE`, do not block ingestion.

---

## 7. Batch Ingestion API Call

Extension sends posts in batches of **10 posts per request**.

```typescript
// POST /api/v1/ingest/batch
interface IngestBatchPayload {
  session_id: string;
  posts: {
    source_id: string;
    published_at: string;        // ISO 8601
    author: string;
    raw_html: string;
    image_urls: string[];
    thumbnail_base64?: string;   // First image only, 300px, Base64
    video_thumbnail_url?: string;
  }[];
}
```

---

## 8. Progress Tracking & Resume

### 8.1 Session Stored in the Database

Session progress is stored entirely in the backend `scrape_sessions` table (one row per user per target Facebook page). The Extension stores only the **auth token** locally — no session state.

```typescript
// Response shape for GET /api/v1/scrape/sessions?target_url=<url>
interface ScrapeSessionResponse {
  id: string;
  target_url: string;
  target_name: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  scraped_count: number;
  oldest_post_id: string | null;    // source_id of the oldest post scraped so far
  oldest_post_date: string | null;  // published_at of the oldest post scraped so far (ISO 8601)
  started_at: string;
  updated_at: string;
}
```

### 8.2 Resume: Seek to the Post After the Oldest

When resuming, the content script must scroll to find the previously oldest scraped post, then begin collecting from the **next post** (older):

```
[Content script receives { oldest_post_id, oldest_post_date }]

Phase 1 — Locate anchor:
  → Scroll downward, evaluating each post:
      → source_id == oldest_post_id → Found! Stop here
      → published_at is more than 1 day earlier than oldest_post_date → Overshot; anchor not on page
  → Anchor found: move cursor to the post immediately after it
  → Anchor not found (may have been hidden by Facebook): use oldest_post_date as date cutoff

Phase 2 — Continue from anchor:
  → Collect only posts where published_at < oldest_post_date
  → Batch size: 10 posts, same flow as fresh scrape
```

### 8.3 Updating Progress Per Batch

After each batch:
```
PATCH /api/v1/scrape/sessions/:id
{ scraped_count: <cumulative total>, oldest_post_id: <source_id of oldest post in batch>, oldest_post_date: <published_at of oldest post in batch> }
```

When page bottom is reached:
```
PATCH /api/v1/scrape/sessions/:id
{ status: 'COMPLETED' }
```

### 8.4 Popup Progress UI

- Posts collected: e.g. `172 posts collected`
- Oldest date reached: e.g. `Oldest: 2024-03-15`
- Stop button (session remains IN_PROGRESS, resumable next time)
- On API failure: show error message with a retry button

---

## 9. Smart End Detection

The content script uses a multi-layer approach to decide when the Facebook page has no more posts to load:

1. **Scroll & observe:** Scroll to bottom, wait for new content (MutationObserver, 3-second debounce).
2. **Height check:** If `scrollHeight` hasn't changed after 3 consecutive scrolls → likely at bottom.
3. **Loading indicator:** If Facebook's loading spinner disappears and no new posts appear → end detected.
4. **Consecutive check:** Require 5 consecutive failed scroll attempts before stopping.
5. **Hard limits (user-configurable):**
   - Max posts: 500 (default)
   - Max time: 30 minutes
   - Date range: optional oldest post date cutoff

---

## 10. Background Service Worker

`background.ts` handles:
- Message routing between popup and content script
- Listening for tab navigation events (reset state if user navigates away from Facebook)
- Alarm-based keepalive (MV3 service workers are terminated after ~30s of inactivity; use `chrome.alarms` to keep alive during long scrapes)

> **MV3 Keepalive:** MV3 service workers terminate after ~30 seconds of inactivity. During active scraping, use `chrome.alarms.create()` with a 25-second interval to keep the worker alive.

---

## 11. Error Handling

| Scenario | Behaviour |
| -------- | --------- |
| Facebook DOM changed (selector broken) | Show error: "Page structure has changed, please contact your administrator.", stop scraping |
| API 401 Unauthorized | Clear token, redirect to LoginPage |
| API 5xx / Network error | Retry up to 3 times with exponential backoff; if still failing, pause session and show error |
| User closes popup during scrape | Content script continues until current batch completes, then idles; session progress is already saved in DB |
| User closes the tab/browser | Session remains IN_PROGRESS in DB; resume prompt shown on next open |

---

## 12. Development & Build

```bash
# Install
npm install

# Dev mode (watch + reload)
npm run dev

# Production build
npm run build
# Output: dist/ — load as unpacked extension in chrome://extensions
```

**Key Vite config:**
- Multiple entry points: `popup/popup.html`, `content/scraper.ts`, `background/background.ts`
- `vite-plugin-web-extension` handles manifest injection and MV3 compatibility
- TypeScript strict mode enabled

---

## 13. Backend API Endpoints Used

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/api/v1/auth/login` | POST | Obtain Bearer token |
| `/api/v1/scrape/sessions` | GET | Fetch session for target page (`?target_url=`) |
| `/api/v1/scrape/sessions` | POST | Create new session |
| `/api/v1/scrape/sessions/:id` | PATCH | Update progress (scraped_count, oldest_post_*) or status |
| `/api/v1/scrape/sessions/:id` | DELETE | Delete session (user restarts) |
| `/api/v1/ingest/batch` | POST | Send a batch of scraped posts |

See `MaraMap-Backend/docs/SPEC.md` for full backend specification.
