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
| Storage | `chrome.storage.local` | Persists auth token only（session 進度存於 DB） |
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

User logs in with their MaraMap account (email + password派發). The token is stored locally and reused until it expires or the user logs out.

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
  → No session   → 顯示「擷取」按鈕
  → IN_PROGRESS  → 顯示確認框（繼續 / 重新擷取）
  → COMPLETED    → 顯示已完成（可選擇重新擷取）

[Logout]
  → Clear chrome.storage.local
  → Navigate to LoginPage
```

**Storage schema（僅存 token）：**
```typescript
{
  token: string;   // Bearer token，其餘 session 進度皆從 DB 取得
}
```

---

## 6. Scrape Flow

### 6.1 Trigger

User navigates to a Facebook personal profile or fan page, opens the popup, and clicks **「擷取」**.

### 6.2 How Scraping Works

The popup calls `chrome.scripting.executeScript()` to inject and run `scraper.ts` in the active Facebook tab. The content script scrolls the page, collects posts, and communicates results back via `chrome.runtime.sendMessage()`.

```
── 全新擷取 ──────────────────────────────────────────────
[User clicks 擷取]
  → POST /api/v1/scrape/sessions → 取得 session_id
  → 傳訊給 content script: { action: "START_SCRAPE", session_id }
  → Content script 由新到舊滾動，每批 10 篇：
      → POST /api/v1/ingest/batch { session_id, posts[10] }
      → PATCH /api/v1/scrape/sessions/:id { scraped_count, oldest_post_id, oldest_post_date }
  → 智慧結束偵測 → PATCH session { status: 'COMPLETED' }

── 繼續上次（Resume）────────────────────────────────────
[User confirms 繼續]
  → 傳訊給 content script:
    { action: "RESUME_SCRAPE", session_id, oldest_post_id, oldest_post_date }
  → Content script 執行定位（見 Section 8）
  → 從錨點之後繼續，流程同上

── 重新擷取 ─────────────────────────────────────────────
[User confirms 重新擷取]
  → DELETE /api/v1/scrape/sessions/:id
  → 重走「全新擷取」流程
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

> **圖片策略：**
> - 第一張圖片由 Extension 在瀏覽器內下載（有 Facebook session），縮圖至 300px 後轉為 Base64 送出。
> - 其餘圖片僅送 URL。後端 async worker 負責排程下載並存入 Supabase Storage。
> - 影片：僅收集影片封面縮圖 URL，不下載影片本體。
> - 若圖片下載失敗：標記為 `IMAGE_UNAVAILABLE`，不阻擋流程。

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

### 8.1 Session 儲存於資料庫

Session 進度完全儲存在後端 `scrape_sessions` table（每個用戶、每個目標頁面一筆）。Extension 本地**只存 auth token**，不存 session 狀態。

```typescript
// GET /api/v1/scrape/sessions?target_url=<url> 的回應
interface ScrapeSessionResponse {
  id: string;
  target_url: string;
  target_name: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  scraped_count: number;
  oldest_post_id: string | null;    // 目前最舊那篇的 source_id
  oldest_post_date: string | null;  // 目前最舊那篇的發文時間（ISO 8601）
  started_at: string;
  updated_at: string;
}
```

### 8.2 Resume：定位到 oldest post 的下一篇

繼續擷取時，content script 必須先滾動頁面找到上次最舊的那篇貼文，再從它的**下一篇**（更舊的）開始收集：

```
[Content script 收到 { oldest_post_id, oldest_post_date }]

Phase 1 — 定位錨點：
  → 向下滾動，對每篇貼文判斷：
      → source_id == oldest_post_id → 找到！停在此處
      → published_at 比 oldest_post_date 早超過 1 天 → 已超過，視為錨點不在頁上
  → 找到錨點：游標移到該貼文之後
  → 未找到（可能已被 Facebook 隱藏）：以 oldest_post_date 為日期截止點

Phase 2 — 從錨點繼續：
  → 只收集 published_at < oldest_post_date 的貼文
  → 批次大小 10 篇，流程同全新擷取
```

### 8.3 每批更新進度

每批送出後：
```
PATCH /api/v1/scrape/sessions/:id
{ scraped_count: <累計總數>, oldest_post_id: <本批最舊的 source_id>, oldest_post_date: <本批最舊的 published_at> }
```

滑到頁底時：
```
PATCH /api/v1/scrape/sessions/:id
{ status: 'COMPLETED' }
```

### 8.4 Popup Progress UI

- 已擷取篇數：`已擷取 172 篇`
- 最舊日期：`最舊至 2024-03-15`
- 停止按鈕（session 保持 IN_PROGRESS，可下次繼續）
- API 失敗時顯示錯誤 + 重試按鈕

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
| Facebook DOM changed (selector broken) | Show error: `「頁面結構已更新，請聯絡管理員」`, stop scraping |
| API 401 Unauthorized | Clear token, redirect to LoginPage |
| API 5xx / Network error | Retry up to 3 times with exponential backoff; if still failing, pause session and show error |
| User closes popup during scrape | Session saved to `chrome.storage.local`; content script continues until batch complete, then idles |
| User closes the tab/browser | Session marked INTERRUPTED on next open; resume prompt shown |

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
| `/api/v1/auth/login` | POST | 登入，取得 Bearer token |
| `/api/v1/scrape/sessions` | GET | 查詢目標頁面的 session（`?target_url=`） |
| `/api/v1/scrape/sessions` | POST | 建立新 session |
| `/api/v1/scrape/sessions/:id` | PATCH | 更新進度（scraped_count, oldest_post_*）或 status |
| `/api/v1/scrape/sessions/:id` | DELETE | 清除 session（重新擷取時） |
| `/api/v1/ingest/batch` | POST | 送出一批貼文資料 |

See `MaraMap-Backend/docs/SPEC.md` for full backend specification.
