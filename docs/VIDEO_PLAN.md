# 影片壓縮與播放調查

> 目標：處理後台手動上傳的大影片 —— 播放體驗，以及（已延後的）自動壓縮 job。
> 建立於 2026-07-28。

---

## 先講數字：影片量正在快速成長

同一個 bucket，24 小時內掃了三次：

| 掃描時間 | 物件數 | 影片支數 | 影片容量 | **>60MB** |
|---|---|---|---|---|
| 2026-07-27 早 | 14,239 | 1,345 | 7.71 GB | **1 支** |
| 2026-07-27 晚 | 14,468 | 1,367 | 9.89 GB | **17 支** |
| **2026-07-28** | **14,789** | **1,415** | **15.75 GB** | **57 支（7.62 GB）** |

Bucket 總量 21.15 GB。最新一批上傳在 2026-07-28 01:50，仍在持續。

> ⚠️ **量測陷阱**：第一次掃描時客戶正在上傳，掃出「>60MB 只有 1 支」是**錯的**，並據此做出「壓縮沒什麼可做」的錯誤判斷。
> **任何 bucket 統計都要先確認當下沒有進行中的上傳**，並在報告裡標註掃描時間。

### 目前影片大小分佈

| 區間 | 支數 | 說明 |
|---|---|---|
| < 10 MB | 1,202 | FB 匯出，已被 FB 轉檔過 |
| 10–30 MB | 125 | 同上 |
| 30–60 MB | 31 | 同上，FB 的上限約 58 MB |
| 60–120 MB | 31 | ← 手動上傳的原始檔 |
| > 120 MB | 26 | ← 同上 |

`.mov` 共 **74 支 / 8.03 GB**，其中 **56 支超過 60 MB**。

---

## 為什麼只有一部分影片需要處理

專案有兩條媒體上傳路徑，狀況完全不同：

| 路徑 | 機制 | 檔案特性 |
|---|---|---|
| **批次匯入**（絕大多數） | FB DYI export zip → ETL 直傳 R2 | **已被 FB 轉檔壓縮過**，影片 ≤ 58 MB。不需要再壓 |
| **後台手動補文** | presigned URL，瀏覽器直傳 R2，上限 200 MB | **客戶相機的原始檔**，約 100 MB/分鐘。所有大檔都來自這裡 |

所以壓縮的對象只有第二條路徑的產出。

---

## 壓縮 job：已規劃，客戶決定延後

**狀態：不實作。** 客戶決定先觀察使用者體驗與帳單。以下是調研結論，供日後重啟時直接使用。

### ffmpeg 是什麼

**不是 npm 套件**，是一支命令列執行檔（C 撰寫），影音處理的業界標準。Node 的角色只是外包工頭：從 R2 下載 → `spawn` 呼叫 ffmpeg → 上傳結果 → 更新 DB。

npm 上的 `fluent-ffmpeg` 只是幫忙組指令字串，**仍需系統先安裝 ffmpeg 執行檔**。因此「哪台機器有 ffmpeg」直接決定 job 能跑在哪。專案已有 `spawn` 子行程的先例（`fb-import.service.ts` 就是這樣呼叫 ETL 腳本），建議直接 spawn，不加包裝層。

### 執行環境比較

**建議：GitHub Actions 排程。** job 本身應落在 **MaraMap-Backend**（R2 與 Supabase 的憑證、`R2Service`、既有的 `backup-r2.yml` 都在那邊）；本文放在前端 docs 只是因為調查是從影片播放體驗切入的。

| | GitHub Actions | Cloud Run Job + Scheduler |
|---|---|---|
| 運算資源 | repo 是 **public** → 4 vCPU / 16 GB / 14 GB SSD，**免費無上限分鐘數** | 需付 CPU 時間 |
| ffmpeg | **未預裝**，需 `apt-get install -y ffmpeg`（約 20–30 秒） | 需改 Dockerfile（alpine 上約 +80 MB，且該 image 同時是 HTTP service） |
| 新增基礎設施 | 無，與現有 `backup-r2.yml` 同一套路 | 需新增 job 資源與 Cloud Scheduler |
| 即時觸發 | 不適合 | 容易做到「上傳完立刻壓」 |

GitHub Actions 的 runner **本身就是運算機器**（一台全新 Ubuntu VM，跑完銷毀），不只是觸發器。R2 egress 免費，所以下載原檔不花錢。

#### GitHub Actions 的限制（實測與查證）

| 限制 | 影響 |
|---|---|
| ffmpeg 未預裝於 ubuntu-22.04 / 24.04 runner image | 每次 job 多 20–30 秒安裝時間 |
| `schedule` 事件在尖峰時段會延遲，整點最嚴重 | 只能當「大約每天一次」，cron 挑非整點（如 `17 7 * * *`）|
| **public repo 閒置 60 天，排程自動停用** | 若數月未推 code，job 會默默停止。需要偵測機制 |
| 單次 job 上限 6 小時、磁碟 14 GB | 對 200 MB 影片不成問題 |
| Secrets | `R2_*` 已存在（`backup-r2.yml` 在用）；改 DB 需新增 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` |
| 併發 | 需設 `concurrency` group，避免前一輪未完成就開新的 |

### 選片規則

```
候選 = 副檔名為影片 且 (size > 60MB 或 副檔名為 .mov)
```

> ⚠️ **`.mov` 那條是關鍵**。只用大小門檻的話，小於 60 MB 的 `.mov` 不會被處理，容器相容性問題就不會被順帶修好。

再以 ffprobe 二次過濾：已經是 1080p 以下且位元率夠低的就跳過，避免二次壓縮損失畫質。輸出若沒有明顯小於原檔（例如未達 80%），保留原檔 —— 對已優化的來源，重壓有時反而更大。

需要一份持久化的「已處理清單」（建議放 R2 的 JSON ledger），否則不是每晚重壓全部、就是壓完又被當成新檔。**若確定只做一次性 backfill，這套狀態可以整個省掉。**

### 建議編碼參數

```bash
ffmpeg -i input.mov \
  -vf "scale='min(1920,iw)':-2,format=yuv420p" \
  -c:v libx264 -crf 23 -preset slow \
  -c:a aac -b:a 128k \
  -movflags +faststart output.mp4
```

- **H.264 而非 H.265/AV1** —— 相容性優先，讀者年齡層偏高、裝置可能較舊
- **1080p 上限** —— 風景與賽道畫面降到 720p 在桌機全螢幕會明顯糊
- `format=yuv420p` —— iPhone 來源可能是 yuv422 或 HDR，不轉會有相容性與色偏問題
- `+faststart` —— moov atom 移到檔頭，才能邊下載邊播

實測基準：一支 75 秒、127 MB、平均 **14.2 Mbps** 的影片，預估壓到 **30–45 MB**（約三分之一）。

### 原檔保留

建議壓完把原檔 copy 到 `originals/` 前綴，靠 Cloudflare 儀表板的 lifecycle 規則 30 天後自動清除（`tmp/` 已在用同一機制）。

> ⚠️ **不要直接刪除原檔**。`backup-r2.yml` 是每週日才跑，若影片在兩次備份之間上傳又被壓縮，原檔從未進過 B2，就是永久消失。

### 為什麼「等帳單再決定」不是好的判斷依據

R2 儲存約 $0.015/GB/月、egress 免費。目前 21 GB 約 **$0.3/月**；就算長到 50 GB 也不到 $1。B2 備份約 $6/TB/月。

**帳單會一直很便宜，不會給出任何訊號。** 壓縮的目的從來不是省錢，而是播放體驗 —— 14.2 Mbps 的影片，手機網路低於這個頻寬就會持續緩衝。判斷依據應該是「讀者點下去要等多久」，不是帳單金額。

花費追蹤另見 [`COST_TRACKING.md`](./COST_TRACKING.md)。

---

## `.mov` 播放相容性（**未結案**）

### 現況

74 支 `.mov`，分佈在多篇文章，全部來自後台手動上傳（`source = manual`）。R2 對這些物件回應 `Content-Type: video/quicktime`。

### 已確認的事實

- **MDN 容器相容表：QuickTime (MOV) 官方僅 Safari 支援**，Chrome / Firefox 皆不在清單
- Chrome 中 `video.canPlayType('video/quicktime')` 回傳 `""`（明確表示不支援）
- **檔案本身沒有問題**：抽驗多支皆為 **H.264 + AAC**，容器結構 `ftyp > moov > wide > mdat` —— **moov 在 mdat 之前，已是 faststart**，所以不是「必須下載完才能播」
- 抽驗樣本：75 秒 / 127 MB / 平均 14.2 Mbps

### 互相衝突的證據（尚未釐清）

| 支持「播不出來」 | 支持「播得出來」 |
|---|---|
| 主輪播對這些 `.mov` 不顯示第一幀（空白灰底） | **客戶實測 Chrome 可正常播放** |
| 強制 `.load()` 等 11 秒仍 `readyState = HAVE_NOTHING`、`duration = null`、`error = null` | Chrome 的 demuxer 對 H.264-in-MOV 實務上通常寬容 |
| `canPlayType` 回空字串 | Safari 原生支援；LINE / FB 內建瀏覽器走 WKWebView（Safari 引擎）與 Android WebView（Chrome 引擎） |

### 已嘗試的修法

把一支物件的 Content-Type 從 `video/quicktime` 改為 `video/mp4`：

```js
CopyObjectCommand({ Bucket, Key, CopySource: `${Bucket}/${Key}`,
                    MetadataDirective: 'REPLACE', ContentType: 'video/mp4' })
```

位元組與 ETag 完全不變，CDN 立即生效。**但結果不明確** —— 改過的物件與未改的對照組，在頁面內用 JS 建 video element 探測時表現一致：15 秒內既無 `loadedmetadata` 也無 `error`，停在 `HAVE_NOTHING`。兩者都不報錯這點，反而暗示**探測方法本身有問題**（CDP 環境下載入 120 MB 媒體的行為可能不正常），而非檔案有問題。

已改動且**尚未還原**的物件：
`your_facebook_activity/posts/media/1785162825348-90624707-1c84-40c6-92d7-134ad62ec28a.mov`

### 下一步

1. **用最直接的方式判斷**：在 Chrome 與 Firefox 直接開影片 URL（不要用頁面內 JS 探測），看原生播放器能否播放
2. 若確認是 Content-Type 造成 → 批次改 Content-Type 即可，**不需要 ffmpeg、不需要重新編碼、不需要 job**
3. 若改 Content-Type 無效 → 需要 `ffmpeg -c copy` 換容器。這是**重新封裝而非重新編碼**，每支數秒、零畫質損失，與客戶延後的「壓縮」是兩件事

### 為什麼沒有在上傳端擋掉 `.mov`

曾考慮移除 `video/quicktime` 支援，強制客戶匯出 MP4。**已否決** —— iPhone 預設輸出 `.mov`，若實際只影響 Firefox 桌機（約 1–3%，此讀者族群更低），等於為少數讀者讓客戶每次補文都要多一道轉檔工序，不划算。

> 註：`page_views` 資料表僅有 `path` / `human_views` / `bot_views`，**未記錄 user agent**，因此無法從自有數據得出瀏覽器分佈。

---

## 已完成的前端改動

`src/app/(public)/log/[id]/page.tsx` —— 減少影片頁的重複 metadata 下載。

問題：影片頁把同一支影片 render 多次（主輪播、縮圖列、Lightbox），每個 `<video>` 各自抓一份 metadata。一篇 19 支影片的文章會產生大量請求。

| 位置 | 改動 | 理由 |
|---|---|---|
| 縮圖列 | `<video>` → 純圖示方塊（`Play` icon + 底色） | 56 px 下第一幀本來就無法辨識，圖示已足夠表意。**完全不發網路請求** |
| Lightbox | 加上 `preload="none"` | strip 內 N 支影片全部 render；已有 `controls`，讀者本來就要按播放 |
| 主輪播 | **不動**（維持 `preload="metadata"`）| 第一幀就是這裡的視覺，改成 `none` 會變空白框 |
| `MediaManager.tsx`（後台）| **不動** | 僅後台流量，且第一幀對挑選媒體有用 |

實測：19 支影片的文章，縮圖列的 `<video>` 元素從 **19 個降為 0 個**。

---

## 待辦

- [ ] 用瀏覽器直接開影片 URL，確認 `.mov` 在 Chrome / Firefox 的實際播放狀況
- [ ] 依上述結果決定：批次改 Content-Type，或 `ffmpeg -c copy` 換容器
- [ ] 決定是否還原那支已改 Content-Type 的物件
- [ ] （延後）壓縮 job —— 重啟時直接沿用本文的執行環境、選片規則與編碼參數
- [ ] 影片封面 poster：可大幅改善列表與輪播的載入體驗，但需在 media schema / DTO 增加欄位，範圍較大
