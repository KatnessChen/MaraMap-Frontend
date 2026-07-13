# Client Requirements — 2026-04-23

## ✅ Personal Best 頁面

展示跑者歷年創 PB 的比賽與當前最佳成績。

- 當前最佳成績（全馬、半馬、超馬分距離顯示）
- 多人分頁（Davis / KC tab 切換）
- 點擊成績卡片連結至對應文章

---

## ✅ 後台文章管理頁面（部分）

已完成欄位：
- `is_personal_best` flag + 完賽成績（供 PB 頁面讀取）
- `is_ai_editing_locked` flag（鎖定 AI script 自動異動）

待完成：
- ✅ 主要貼文 / 次要貼文切換（依賴旅行 Group 機制）

---

## ✅ 1. 旅行 Group 機制

同一趟旅行的多篇文章要能被 group 在一起：
- **主要貼文**：馬拉松文章
- **次要貼文**：同趟旅行的其餘文章（旅遊、爬山等）
- 系統需能自行判定主/次貼文歸屬

---

## ✅ 2. Aside 文字可讀性改善（長輩友善）

統計數據與類別區塊部分文字過小過淺，需調整：
- 加大字體（建議最小 16px）
- 提高對比度（符合 WCAG AA 標準）
- 目標使用者：60 歲以上跑者

---

## ✅ 近期功能更新（非原始需求）

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

### 貼文新增／刪除功能
後台增加「新增貼文」「刪除貼文」功能。

### 貼文照片新增／刪除功能
後台貼文編輯內增加「新增照片」「刪除照片」功能。

### ✅ 澳門國家歸屬檢查
已確認：後端 `COUNTRY_NAME_MAP` 正確映射澳門 → `Macao S.A.R`，與地圖 GeoJSON 圖資名稱完全相符；資料庫內澳門相關文章的 `country` 欄位皆正確標記為「澳門」，與中國分開計算。

### ✅ Mobile 分類按鈕過小
分類按鈕由 `px-4 py-2 text-xs` 加大為 `px-5 py-3 text-sm`，並加上 `min-h-[44px]` 符合無障礙觸控目標。

### ✅ Lightbox 移除縮圖列
移除 Lightbox 下方縮圖列，主圖區域改為佔滿全部可用高度。

### 移除文章鎖定功能
移除 `is_ai_editing_locked` 鎖定文章的相關程式碼（前後台皆需移除），資料庫欄位暫時保留不刪除。

### 後台支援 Facebook Export 自動匯入
後台新增功能，讓使用者自行上傳 Facebook export data 的 zip 檔案，觸發完整自動化的文章匯入流程（對應 Backlog 中的 Recurring Data Inflow Pipeline）。

### 到訪國家 Hero Number 點擊聯動 ListView 標題
點擊「到訪國家」的 hero number 時，ListView 區塊標題改為「到訪國家 XXX」。

### 網站造訪人次位置調整
將「累計造訪人次」移動到「選擇期間」（月份篩選器）左邊，desktop / mobile 皆同；若空間不足需縮短文字以容納在同一行 div 中。

---

## Rogers 評估回饋 — 2026-07-13（馬拉松跑者視角 Review）

整體評分：🟢 On track。地圖已成為首頁與產品核心（choropleth 國家染色、cluster、CountryModal），PB 頁面與時間篩選皆已到位，方向正確。以下為尚待處理的缺口：

### 完賽時間未露出到 ListView / 地圖 popup
文章內頁已有大字時間與配速計算，但 ListView 列表項目與地圖 popup 只顯示分類與日期，沒有時間。跑者瀏覽某國家底下多場比賽時，時間應該並排可見，不用逐篇點進去看。

### PB 徽章未露出到地圖與列表
`is_personal_best` 已在資料模型與 PB 頁面呈現，但地圖 marker 與 ListView 上，PB 場次和一般訓練賽長得一模一樣。應加上視覺標記（如金色 marker 或 🏆 badge）。

### 「已征服全球 X%」數字算了但沒有渲染
`MapView.tsx` 已計算 `pct`（到訪國家 ÷ 195 國），但 JSX 中沒有任何地方顯示。這是最低成本、最高炫耀價值的功能（呼應 3Pulse 的「領土占領」心理），應放到 hero 數字區。

### 三個殭屍元件待清除
`PostFeed.tsx`、`AggregateStatsSection.tsx`、`StatisticsBlock.tsx` 已無任何頁面引用。其中 `AggregateStatsSection` 內含假資料 fallback（`Math.max(count, 15)`、硬編碼 253 場全馬），若日後被誤重新掛載會造成資料造假，建議直接刪除。

### Hero 全馬數只計算 Davis
`MapView.tsx` 的 race stats fetch 只打 `participant=Davis`，但網站是「Davis & Rose 環球跑旅」雙人站。需確認這是否為刻意設計，否則 Rose 的場次會從統計中消失。

### GeoJSON 依賴外部 GitHub 即時抓取
國家染色地圖的核心資料從 `raw.githubusercontent.com` 即時 fetch，建議改為打包進 `public/` 自行 host，避免外部依賴影響最重要的視覺效果。

### 新增功能建議：一鍵分享合成圖
地圖截圖 + 到訪國家數 + 全馬場次合成一張圖，一鍵可發 FB/IG。呼應客戶「對外展示、炫耀成就」的核心動機，長期價值高。

### 07-13 TODO 優先順序建議
- **先做**：#5 mobile 分類按鈕過小、#6 lightbox 移除縮圖列、#4 澳門國家歸屬、#1 百岳→登山改名
- **再做**：#9、#10 文案聯動類小項，與 #2、#3、#7 後台 CRUD 一併處理
- **最後**：#8 FB zip 自動匯入（方向正確但工程量最大，不應卡住前面的 UX 修正）

---

## Backlog（未來規劃，現階段不實作）

### 馬拉松子類別設定
後台支援設定子類別（普查承認 / 海外 / 超馬）。

### 類別管理
後台支援新增類別、修改類別名稱。
Use case：「七大馬」未來可能擴增為「八大馬」，需要彈性調整。

### 年度回顧頁面
獨立頁面，呈現每年度的跑步與旅行亮點統計。

### Recurring Data Inflow Pipeline
- 客戶每 1–3 個月匯出一次臉書貼文原始資料
- 跑 AI ingest pipeline 自動解析並匯入文章
- 客戶不手動新增或修改文章（避免改壞現有資料）
- 需設計增量匯入邏輯（避免重複建立已存在的文章）
