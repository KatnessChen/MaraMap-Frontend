# MaraMap TODO

> 本檔結構：**TODO（待處理）** → **Backlog（未來規劃）** → **已完成紀錄（依會議日期存檔）**。
> 待辦項目一律集中在最上方的 TODO 區；各次會議區塊只保留已完成事項作為紀錄。
> 最後更新：2026-07-27

---

## 🔴 TODO（待處理）

### P1 — Rogers 評估回饋（2026-07-13，馬拉松跑者視角）

#### 2. 完賽時間未露出到 ListView / 地圖 popup
文章內頁已有大字時間與配速，但 ListView 與地圖 popup 只顯示分類與日期。跑者瀏覽某國家底下多場比賽時，時間應並排可見，不用逐篇點進去。
*（已驗證 2026-07-27：`ListView` / `TimelineView` / `MapView` 皆無成績欄位）*

#### 3. PB 徽章未露出到地圖與列表
`is_personal_best` 已在資料模型與 PB 頁面呈現，但地圖 marker 與 ListView 上，PB 場次和一般訓練賽長得一模一樣。應加上視覺標記（金色 marker 或 🏆 badge）。
*（已驗證 2026-07-27：`components/` 內無任何 `is_personal_best` 參照）*

#### 4. 「已征服全球 X%」算了但沒有渲染
`MapView.tsx:586` 已計算 `pct`（到訪國家 ÷ 195 國），但 JSX 中沒有任何地方顯示 —— eslint 目前把它報為 unused variable。這是最低成本、最高炫耀價值的功能，應放到 hero 數字區。

#### 5. Hero 全馬數只計算 Davis
`MapView.tsx:535` 的 race stats 只打 `stats?participant=Davis`，但網站是「Davis & Rose 環球跑旅」雙人站。需確認是否為刻意設計，否則 Rose 的場次會從統計中消失。

#### 6. GeoJSON 依賴外部 GitHub 即時抓取
`MapView.tsx:480` 從 `raw.githubusercontent.com` 即時 fetch 國家圖資。建議打包進 `public/` 自行 host，避免外部依賴影響最重要的視覺效果。

#### 7. 一鍵分享合成圖（新功能建議）
地圖截圖 + 到訪國家數 + 全馬場次合成一張圖，一鍵發 FB/IG。呼應客戶「對外展示、炫耀成就」的核心動機，長期價值高。

---

### P2 — 客戶會議回饋（2026-07-23）未完成項

#### 8. 網址改為 maramap.vercel.app
前端部署設定 + 站內絕對連結 / metadata / OG URL 一併更新。
*（已驗證 2026-07-27：codebase 內尚無任何 `maramap.vercel.app` 字串）*

---

### ⏸ 待客戶回覆（阻塞中）

#### 9. ETL 九大馬新賽事清單
`etl/02_classify/ai-classify.js` 的賽事清單仍是原本七場（東京、波士頓、倫敦、柏林、芝加哥、紐約、雪梨），新增的兩場是哪兩場未知，已在檔案內留 TODO。此為之後匯入新文章時 AI 分類用，不影響現有顯示。

---

## 📋 Backlog（未來規劃，現階段不實作）

### Infra 花費追蹤 → [`COST_TRACKING.md`](./COST_TRACKING.md)
每月快照 + 年度報表。實測現況：R2 19.49 GiB（約 $0.16/月）、Artifact Registry 1.4 GB（約 $0.09/月，**已超過 0.5 GB 免費額度**）、Cloud Run / Vercel / Supabase 皆 $0。年度總計預估 < US$5。
**唯一有時效性的一步**：Gemini token 用量目前完全沒記錄，沒記到的事後補不回來 —— 建議優先做 instrumentation。
一次性動作（投報率最高）：GCP budget alert、Artifact Registry cleanup policy、收斂 prod `timeout=3600`、後端 rate limiting。

### 整站英文化 → [`I18N_PLAN.md`](./I18N_PLAN.md)
前台 UI 僅約 217 條字串（後台 542 條不需翻）；地名已是雙語資料可沿用。
真正的大工程是 634 篇、31 萬字的文章內文。
**阻塞項**：需先跟客戶確認英文版的目標讀者，才能決定要不要做全文翻譯。

### AI Chatbot → [`CHATBOT_PLAN.md`](./CHATBOT_PLAN.md)
語料庫僅 30 萬字（約 20–25 萬 token），塞得進單一 context —— v1 不需要 RAG／pgvector，用 tool-calling 包既有 API 即可。
**硬性前置**：後端目前無 rate limiting，在此狀態下開放公開 LLM 端點等於把帳單上限交給陌生人。

### 媒體排序
後台編輯文章時，可自行調整照片／影片的顯示順序（拖曳排序），決定文章頁 carousel 與 lightbox 的呈現次序。目前順序固定沿用匯入／上傳當下的順序，無法調整。

### 馬拉松子類別設定
後台支援設定子類別（普查承認 / 海外 / 超馬）。

### 類別管理
後台支援新增類別、修改類別名稱。
Use case：「九大馬」未來可能再擴增，需要彈性調整。

### 年度回顧頁面
獨立頁面，呈現每年度的跑步與旅行亮點統計。

---
---

# 已完成紀錄

> 以下依會議日期存檔，僅保留已完成事項。未完成項目一律上移至最上方 TODO 區。

---

## 2026-07-27

### ✅ 字體 regression 修復：明體變細、900 字重消失
**症狀**：全站明體（`font-serif`，共 60 處 / 14 個檔案，大量搭配 `font-black`）忽然變細。

**根因**：`e09bdc8` 為了修 Vercel build 失敗，把 `next/font/google` 整段移除，`--font-serif` 改成純字型名稱堆疊 —— 但那只是「使用者本機有裝才會用到」，**全站等於沒有載入任何 web font**。macOS 掉到 Songti TC（宋體）、Windows 掉到 PMingLiU（新細明體），兩者都沒有 Black/900 字重，只能靠瀏覽器合成假粗體。

實測佐證：`document.fonts` 內只剩 Next.js 內部的 Geist；canvas 量測 `"Noto Serif TC"` 的寬度（425.51）與不存在的假字型完全相同 → 確認未載入。

**build 失敗的真因**：Vercel builder 連不到 `fonts.gstatic.com`（`Error while requesting resource`），9 個 woff2 抓不到後 Turbopack 噴 27 個 `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`。`next/font/google` 在建置期抓不到字體時沒有 graceful fallback，直接硬失敗；當次又因 package manager 由 npm 改 pnpm 而丟掉 build cache，沒有可用的快取字體。**是建置期連外失敗，不是字體設定錯誤。**

**修法**：改為 runtime `<link>`（`layout.tsx` 加 preconnect + `fonts.googleapis.com/css2` stylesheet），字體由瀏覽器在使用者端載入。build 完全不連外 → 根治建置失敗；repo 不增加體積；字重維持 400/700/900。

**驗證**：`document.fonts` 已載入 Noto Serif TC 400/700/**900** 真實字面（非合成）；canvas 量測 400 = 489.28、900 = 517.72，皆與 fallback 基準 425.51 不同 → 確認為真字體與真字重。`pnpm build` 通過且產出的 HTML 內含該 stylesheet link，codebase 已無任何 `next/font` import。

> 取捨：訪客端仍會連到 Google Fonts（隱私 + 一次外部連線）。若日後要完全去除第三方依賴，需改 `next/font/local` 自行 host subset 後的 woff2（約 8–12MB 進 git）。

### ✅ 地圖預設分類改為「所有文章」
`MapView.tsx` 的 `activeCategory` 預設值原本寫死 `"馬拉松"`，導致 `旅遊` / `登山` 文章一進站完全不會出現在地圖上——即使該文章有正確座標，看起來也像「資料掉了」。改為 `null`（所有文章），並讓「取消目前篩選」也回到 `null` 而非掉回馬拉松。

> 起因是排查文章 `d97b0818` 有 `fallback_lat/lng` 卻不顯示。已逐層確認 DB、後端 query、線上 prod API 三層資料都正確，純粹被預設篩選擋掉。

### ✅ 後台媒體上限調高：照片 15MB、影片 300MB
`IMAGE_MAX_BYTES` 8MB → 15MB、`VIDEO_MAX_BYTES` 200MB → 300MB（前後端同步）。媒體是瀏覽器經 presigned PUT 直傳 R2，不經過 Cloud Run，故不受 32MiB 請求上限限制；presign 有效期 1 小時，300MB 有充足餘裕。前端兩處寫死的「200MB / 8MB」文案改為由常數推導，避免日後再次不同步。

> 後端 `claimTmpMedia` 的 HEAD 把關仍是 **video-only**，`IMAGE_MAX_BYTES` 在後端沒有實際強制點（繞過前端直接打 API 不會被擋）。此為既有設計，待日後補 photo 分支。

---

## Client Requirements — 2026-04-23

### ✅ Personal Best 頁面
展示跑者歷年創 PB 的比賽與當前最佳成績。
- 當前最佳成績（全馬、半馬、超馬分距離顯示）
- 多人分頁（Davis / KC tab 切換）
- 點擊成績卡片連結至對應文章

### ✅ 後台文章管理頁面
- `is_personal_best` flag + 完賽成績（供 PB 頁面讀取）
- `is_ai_editing_locked` flag（鎖定 AI script 自動異動）
- 主要貼文 / 次要貼文切換（依賴旅行 Group 機制）

### ✅ 1. 旅行 Group 機制
同一趟旅行的多篇文章要能被 group 在一起：
- **主要貼文**：馬拉松文章
- **次要貼文**：同趟旅行的其餘文章（旅遊、爬山等）
- 系統需能自行判定主/次貼文歸屬

### ✅ 2. Aside 文字可讀性改善（長輩友善）
- 加大字體（最小 16px）
- 提高對比度（符合 WCAG AA 標準）
- 目標使用者：60 歲以上跑者

### ✅ 近期功能更新（非原始需求）
- **SiteHeader**：文章頁面加入全站導覽列
- **Media Carousel**：文章圖片/影片改為可滑動 carousel，支援全螢幕 lightbox、左右箭頭、mobile swipe 拖曳動畫
- **時間 Filter**：改為年+月起訖區間選取，有 Apply/Clear 操作
- **Windows Chrome 修正**：100vh 超出螢幕問題（scrollbar cascade）
- **Category Buttons**：自動填滿 aside 剩餘空間，字級隨容器縮放，空間不足時可捲動

---

## 客戶會議回饋 — 2026-07-06

### ✅ Category Button「全部」按鈕文案調整
大字改成「XXX 篇」（篇數），下方小字改成「所有類別」。

### ✅ Map/List Toggle 文案
「清單」→「列表」。

### ✅ ListView 預設展開層級
預設只展開到國家層級，文章收合。

### ✅ ListView 台灣排序
亞洲國家清單中，台灣固定排在第一個。

### ✅ 地圖 Popup 可點擊區域擴大
標題、圖片、View Log 全部可點擊。

### ✅ 文章圖片 Lightbox 顯示
點開圖片以填滿瀏覽器視窗的 lightbox 顯示，圖片 contain。

### ✅ 同行足跡文章圖片未顯示
`findByTripId` 補上 `media` 欄位查詢與 cover_image fallback 邏輯，已修復。

### ✅ 後台頁面無法捲動
移除 `globals.css` 中 `html, body { overflow: hidden }` 全域規則，已修復。

### ✅ Header / 頁面導覽文案調整
- Header 導覽列「PB」→「最佳成績」，移除「地圖」連結
- PB 頁面加「← 回到首頁」
- 文章詳情頁「返回日誌列表」→「← 回到首頁」

### ✅ 網站標題樣式
Header 改為深色背景（`bg-ink`）；「Davis & Rose」serif italic 紅色放大，「環球跑旅」serif black 白色。

### ✅ ListView UI 改善
- 「所有類別」模式下標頭改顯示「所有文章 XXX」
- 展開/收合改為單一旋轉 chevron icon
- hover cursor pointer + 微上移互動

### ✅ Month Picker 套用範圍擴大（含 UI 修正）
- Month picker 已同步套用到 hero 數字統計、category buttons 篇數、ListView。
- Month picker 移至全頁頂端橫跨整行，與 Map/List toggle 同列。
- ListView date filter bug 修復（backend query param 從 camelCase 改為 snake_case）。
- Popup 年月改橫向排列；點任何 popup 外的地方都關閉；trigger 改 toggle。
- Mobile toggle 改為 icon；Desktop 字樣垂直置中縮小。
- 清除按鈕從「✕」改為「清除」文字。
- ListView 空狀態加 fallback placeholder。

### ✅ 統計瀏覽人次功能
- `page_views` Supabase table + `increment_page_view` RPC function。
- Backend `POST /api/v1/stats/visit`（bot 過濾 + localhost 跳過）、`GET /api/v1/stats/visits`。
- Frontend `PageViewTracker` 每次換頁自動送 POST。
- Desktop aside 底部顯示累計人次；Mobile 隱藏。

---

## 客戶會議回饋 — 2026-07-13

### ✅ 分類「百岳」統一改名為「登山」
首頁地圖統計卡片顯示文字「百岳」改為「登山」（後台子分類「大百岳」「小百岳」為台灣百岳名單專有名詞，保留不變）。

### ✅ 刪除貼文
後台列表新增刪除按鈕（`window.confirm` 二次確認），呼叫既有 `DELETE /posts/:id`；後端同步刪除該文章在 R2 的所有照片檔案（best-effort，R2 失敗不會擋下刪除）。新增 `R2Service`（`src/storage/`）供後續照片上傳/刪除功能共用。

### ✅ 澳門國家歸屬檢查
已確認：後端 `COUNTRY_NAME_MAP` 正確映射澳門 → `Macao S.A.R`，與地圖 GeoJSON 圖資名稱完全相符；資料庫內澳門相關文章的 `country` 欄位皆正確標記為「澳門」，與中國分開計算。

### ✅ Mobile 分類按鈕過小
分類按鈕由 `px-4 py-2 text-xs` 加大為 `px-5 py-3 text-sm`，並加上 `min-h-[44px]` 符合無障礙觸控目標。

### ✅ Lightbox 移除縮圖列
移除 Lightbox 下方縮圖列，主圖區域改為佔滿全部可用高度。

### ✅ 移除文章鎖定功能
移除前台編輯頁的鎖定 checkbox 與儲存阻擋文案、後端 `update()` 的鎖定檢查與 403 拋出、DTO 欄位與對應測試。資料庫 `is_ai_editing_locked` 欄位保留不刪除。

### ✅ 後台支援 Facebook Export 自動匯入
後台新增 `/admin/import` 頁面，上傳 Facebook 匯出 zip 後即時串流顯示進度，自動執行解壓縮 → 01_ingest → 02_classify → 03_analyze(base/marathon/hiking) → 04_format → 05_merge → 06_import → R2 圖片上傳 → 07_trips → 08_geocode 全流程（後兩步為原本手動流程未涵蓋的步驟）。**僅限本機開發環境使用**：部署到 Cloud Run 的容器不含 `etl/` 目錄，且該服務預設資源（512MB / 5 分鐘逾時 / CPU 節流 / 無持久化磁碟）不足以處理數百 MB 的解壓縮與多分鐘的 AI 分類作業，故設計為本機 `npm run start:dev` 執行的管理工具，取代原本手動依序執行 8 道指令的流程。新增 `src/fb-import/` 模組（`fb-import.service.ts`、`zip-extractor.ts` 等），對應 Backlog 中的 Recurring Data Inflow Pipeline。

- ✅ **略過貼文救回審核**：流程在 `05_merge` 後暫停，列出被 AI 判定為 `skip`（分類失敗）的貼文供管理員手動指定分類救回，其餘欄位維持匯入後於後台編輯。`ai-classify.js` 新增 `skipped.json` 輸出；後端拆成 `runPreparePipeline`（跑到 05_merge 為止）+ `runFinalizePipeline`（合併救回貼文後跑 06_import 起）兩段，新增 `POST /admin/fb-import/:batch/confirm` 端點；前端 `/admin/import` 改為 idle/preparing/review/finalizing/done 狀態機，略過貼文為 0 篇時自動跳過審核畫面直接完成。尚未用真實 FB 匯出資料驗證過（本機無測試資料），機制已透過安全的失敗路徑（缺少 posts JSON）做過即時串流煙霧測試。

### ✅ 到訪國家 Hero Number 點擊聯動 ListView 標題
點擊「到訪國家」hero number（desktop aside + mobile）時，ListView 標題改為「到訪國家 XXX」（XXX 為國家數）；點擊其他分類/海外馬/所有文章時重設回原本文案。

### ✅ 網站造訪人次位置調整
「累計造訪人次」從 desktop aside 底部移到頂端「選擇期間」左邊，desktop / mobile 共用同一列；mobile 下文字縮短為「XXX 人次」。

---

## Rogers 評估回饋 — 2026-07-13（馬拉松跑者視角 Review）

整體評分：🟢 On track。地圖已成為首頁與產品核心（choropleth 國家染色、cluster、CountryModal），PB 頁面與時間篩選皆已到位，方向正確。

> 本次回饋的**未完成項目已上移至最上方 TODO 區 P1**（項目 2–7）。

### ✅ 三個殭屍元件待清除
確認 `PostFeed.tsx`、`AggregateStatsSection.tsx`、`StatisticsBlock.tsx` 全站無任何引用後刪除（移至垃圾桶）。含假資料 fallback 的 `AggregateStatsSection` 一併清掉。

### 07-13 TODO 優先順序建議（歷史紀錄）
- **先做**：#5 mobile 分類按鈕過小、#6 lightbox 移除縮圖列、#4 澳門國家歸屬、#1 百岳→登山改名
- **再做**：#9、#10 文案聯動類小項，與 #2、#3、#7 後台 CRUD 一併處理
- **最後**：#8 FB zip 自動匯入（方向正確但工程量最大，不應卡住前面的 UX 修正）

---

## 客戶會議回饋 — 2026-07-23

### ✅ Mobile 分類按鈕改為多行堆疊
按鈕雖已加大（07-13 調整為 `px-5 py-3 text-sm` + `min-h-[44px]`），但橫向捲動在 mobile 上仍難操作。`MapView.tsx` mobile chip 容器由 `chip-scroll overflow-x-auto` + 每顆 `shrink-0` 改為 `flex flex-wrap`，6 顆按鈕在 390px 寬度下自動排成 3 行全部顯示，無左右滑動。

### ✅ Lightbox 支援縮放與拖曳
`log/[id]/page.tsx` 新增 `useZoomPan` hook，比照 Facebook 圖片檢視體驗：
- 滾輪縮放（以游標為錨點）、雙擊 / 雙擊觸控切換 100% ↔ 250%、兩指 pinch 縮放（以兩指中點為錨點）
- 放大後滑鼠拖曳 / 單指拖曳平移，位移依縮放倍率 clamp 不會拖出畫面
- 底部縮放控制列（縮小 / 百分比 / 放大 / 重設，按鈕 44px 觸控目標），鍵盤 `+` `-` `0`
- 縮放上限 500%；1x 時單指仍是左右換圖，換圖自動重設回 100%；影片不套用縮放

### ✅ 新增「時間軸」檢視
新增 `TimelineView.tsx`，Map / List toggle 擴充為三段（地圖 / 列表 / 時間軸）。文章由新到舊排序、依年份分組（年份標頭 sticky），顯示月/日、分類、國家 · 城市與標題。與 ListView 共用同一份 `listPoints`，因此類別 filter 與時間範圍 filter 完全一致（已驗證：2023 年 + 馬拉松 → 21 筆）。

### ✅ 時間軸間距與左側 padding 一致化
- 移除時間軸每列的紅點標記；月/日改為右對齊並與時間軸線拉開約 1.5rem，文字不再貼線。
- 全站 mobile 左側 gutter 統一為 1rem（`px-4 md:px-6`）：SiteHeader、日期/檢視切換列、mobile hero 與分類按鈕、ListView 標頭與洲別列、TimelineView 標頭與年份標頭。年份標頭（如「2026」）現在與同頁標題（如「馬拉松」）用同一組 padding class，左緣對齊。
- 註：mobile 曾試過 1.5rem gutter，但會擠壓「選擇期間」按鈕並讓 hero 折行，故採 1rem。

### ✅ 字體：僅 List / Timeline 文章標題改黑體
原本 `font-serif`（Noto Serif TC）共 **60 處**、分布 13 個檔案。曾一次全改黑體，後依客戶決定改回：**只有 ListView 與 TimelineView 的文章標題維持黑體**，其餘（文章頁標題與內文首字、成績卡、Header logo、後台各頁、hero 單位字等）全部還原為細明體。Noto Serif TC 的載入與 `--font-serif` token 一併還原。

> ⚠️ 此處還原的 Noto Serif TC 載入，曾於 2026-07-27 被 `e09bdc8` 移除，同日已改用 runtime `<link>` 修復 —— 見 2026-07-27 區塊。

### ✅ ListView 城市與標題改為上下排列並與國家對齊
文章列改為 meta 行在上（日期 + 城市，mono 14px）、標題在下（16px，最多兩行），與時間軸的呈現一致；日期不再獨佔右側欄位。縮排改為 `pl-[55px] md:pl-[87px]`，使 meta / 標題左緣與上一層「國家」文字對齊（實測 447.25 vs 447）。

### ✅ 時間軸可切換排序方向
標頭右側「由新到舊」改為可點擊按鈕，切換為「由舊到新」；年份分組順序一併反轉。預設仍為由新到舊。

### ✅ 時間軸分類文字維持主題色
曾依後台 `CATEGORY_STYLES` 分色（馬拉松粉、旅遊紫、登山綠），客戶認為太花，已改回統一主題紅 `text-brand`，`utils/categoryColors.ts` 移除。

### ✅ 時間軸配色收斂為黑
年份、每列分類、標頭篇數統計由 `text-brand` 改為 `text-ink`；主題紅只留在其他檢視。

### ✅ 桌面版側欄與控制列微調
- 時間軸年份 `text-2xl → text-xl`、文章標題 `text-base md:text-lg → text-base`。
- Hero number 上緣 `pt-8 → pt-4`，與 List / Timeline 標頭標題對齊（實測兩者 top 皆為 135.8）。
- 側欄收合後整塊消失並隱藏分隔線，只留下 toggle；按鈕由 28px 圓形改為 20×56px 圓角長方形。收合／展開改為滑進滑出動畫：aside 是 flex item，動畫 `width` 會被 flex 演算法忽略而直接跳掉，改用 `margin-left`（`ml-0 ↔ -ml-80`，300ms ease-in-out）讓固定寬度面板往左滑出、地圖平滑補上；toggle 移出 aside 成為 sibling（否則會跟著滑出畫面），`left` 同步 300ms 補間。整塊收合僅限桌面（`hidden md:flex`），mobile 用底部面板、無收合。
- 動畫順帶修正：`MapResizer` 由「toggle 時立即 `invalidateSize`」改為 `ResizeObserver` + 160ms debounce，只在滑動結束後校正一次，避免 marker cluster 在動畫中途同步重算造成卡頓（慢速裝置尤其明顯）；marker cluster layer 也 memoize（`useMemo` on `points`），避免無關 re-render 重建數百個 marker。
- 側欄右側分隔線 `bg-ink/60 → bg-ink/20`。
- Map/List/Timeline toggle 字級 `md:text-[11px] → text-sm`；「選擇期間」字級 `md:text-sm → md:text-[13px]`。

### ✅ 時間軸 meta 間距調整
分類與國家間距 `gap-x-2 → gap-x-4`；國家與城市屬同一組資訊，分隔符由「 · 」改為緊貼的「·」。

### ✅ Mobile 底部區塊瘦身
分類按鈕由 `px-5 py-3 min-h-[44px]` 縮為 `px-3.5 py-1.5 min-h-[36px]`，間距 `gap-2→1.5`。6 顆按鈕從 3 行縮成 2 行，地圖可視高度增加。hero 列先縮為 `py-2`，客戶反映上緣太緊後改為 `pt-3 pb-2`。

### ✅ Map/List/Timeline toggle padding
先由 `px-3 py-1.5` 放大為 `px-5 py-2.5`，客戶反映過寬後收斂為 `px-3.5 py-2`。

### ✅ Month picker「起始 / 結束」不換行
標籤寬度 `w-8` 不足以容納兩個中文字（含 letter-spacing）而折行，改為 `w-12 whitespace-nowrap`。

### ✅ 文章頁國家/城市分隔符改為點
`locationLabel` 由 `國家 / 城市` 改為 `國家·城市`，與時間軸一致。

### ✅ 「選擇期間」padding 縮小
觸發按鈕由 `px-3 py-1.5` 縮為 `px-2.5 py-1`；因 toggle 變寬後 390px 下會擠壓此按鈕，mobile 文案由「選擇期間」縮短為「期間」（desktop 維持原文案）。

### ✅ 載入文字對比度不足
載入文字改為實心 `text-ink`（原本 `text-ink/40`～`/60`）並移除 `animate-pulse`（脈動會讓透明度再往下掉一半）。涵蓋：首頁「Initializing Spatial Data...」、地圖「Generating Spatial Log...」、ListView / TimelineView「Loading...」、文章頁「正在載入紀錄...」、PB 頁載入字。後台的「正在載入文章...」未改（非前台，暫留）。

### ✅ 分類「七大馬」改名為「九大馬」
前台顯示、後台四處子分類選單、後端 `getCategories` 白名單、ETL 分類 prompt 皆改為「九大馬」。

**資料已改名（客戶手動處理）+ 相容邏輯已移除**：客戶已將資料庫 `sub_categories` 全部從「七大馬」改為「九大馬」。前端 `MAJORS_SUB_CAT_ALIASES` / `matchesSubCat` 與後端白名單的舊值皆已刪除，改為直接比對「九大馬」。全 codebase 已無「七大馬」（ETL 產出的歷史 JSON 不算）。

### ✅ 後台建立文章：影片大小上限
原需求為 200MB。**已於 2026-07-27 實作並調高為 300MB（照片 15MB）** —— 見上方 2026-07-27 區塊。

### ✅ Hero Number 到訪國家統計來源修正
到訪國家數原本讀 `stats?participant=Davis` 的 `country_count`（只看 Davis 有比賽的國家），改為從 `basePoints`（全部文章、所有分類、不限有無座標）取 distinct `country_en`，自然含旅遊/登山才去的國家；有時間篩選時改用 `filteredBase`。移除 `totalCountryCount` state 與對應 fetch 賦值。

**「41」的真相 — 是計數 bug 不是真國家數**：客戶記得 ListView 標題曾顯示「到訪國家(41)」。查證：`getCountryCount`（後端）、metadata.country、top-level country 全都是 39，含隱藏文章的整張表也是 39。真正的 41 來自 ListView `distinctCountryCount` 的算法缺陷——它加總「每個洲底下的國家數」＝計算 (洲, 國) 配對數。那 43 篇 FB 轉貼（category `daily`）`metadata.country` 為空 → 落入 `未知` bucket，且 continent 標記不一致（部分「亞洲」、部分空→「其他」），於是 `未知` 被跨兩個洲重複計數：**39 真國家 + 2 個幽靈「未知」= 41**。客戶昨天隱藏那批 daily 貼文後，未知 bucket 消失，數字回到正確的 **39**。所以 41 從來不是真的國家數。

**修正**：`ListView.distinctCountryCount` 改為數 distinct 國名（跨洲去重）並排除 `未知`，杜絕空 country 貼文再次灌水。

**結論（客戶 2026-07-23 確認）**：維持 **39**，那 2 個本來就是垃圾轉貼撐出來的，不是真國家。曾暫加的 `EXTRA_VISITED_COUNTRIES` 補數常數已移除。Hero 到訪國家改讀全文章 distinct、ListView 修掉跨洲重複計數，兩者現在一致顯示 39。

---

## Backlog 已完成項

### ✅ 新增貼文
後台已有建立文章功能（`/admin/new`）。

### ✅ 貼文照片／影片新增／刪除功能
後台編輯頁已支援照片與影片的新增／刪除（`MediaManager`）。

### ✅ Recurring Data Inflow Pipeline
已透過 2026-07-13「後台支援 Facebook Export 自動匯入」實作：`/admin/import` 上傳 zip 即自動跑完整 pipeline（增量匯入邏輯沿用 `06_import` 既有的 content-signature dedup，客戶本人仍不需手動新增/修改文章）。
