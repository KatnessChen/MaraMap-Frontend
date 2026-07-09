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
