# Infra 花費追蹤工作流

> 目標：每月留下一筆可稽核的花費快照，年底一鍵產出年度報表。
> 建立於 2026-07-27。

---

## 先講結論：現在的量級

實測（2026-07-27）：

| 服務 | 用途 | 目前用量 | 免費額度 | 估算月費 |
|---|---|---|---|---|
| **Cloudflare R2** | 圖片／影片儲存 | **19.49 GiB / 14,784 物件** | 10 GB 儲存、1M Class A、10M Class B | **約 $0.16** |
| **Gemini API** | ETL 文章分類與分析 | 批次執行，非常駐 | 有免費層級 | 接近 $0（見下） |
| **GCP Cloud Run** | 後端 API（prod + dev） | 極低流量、scale-to-zero | 2M 請求／180,000 vCPU-秒／360,000 GiB-秒 | **$0**（遠未觸及） |
| **GCP Artifact Registry** | 後端 Docker image | **1.4 GB / 40 個 image 版本** | **0.5 GB** | **約 $0.09** ⚠️ 已超過 |
| **Vercel** | 前端部署 | Hobby | — | **$0** |
| **Supabase** | Postgres + Auth | Free | — | **$0** |

R2 物件組成：

```
.mov    70 files    7.27 GiB   ← 單檔最大宗
.mp4  1,341 files   7.18 GiB
.jpg 13,311 files   4.96 GiB
.png     18 files   0.07 GiB
```

**所以現階段年度總花費極可能低於 US$5。** 這個工作流的設計重點因此不是「精算每一分錢」，而是：

1. 留下**可稽核的歷史軌跡**（年底報表要有數字，不能靠回憶）；
2. **盯住成長觸發點** —— 什麼時候會跨出免費額度、開始真的要付錢。

不要為了每月 $0.16 建資料倉儲。整套維持在「每月 5 分鐘、一支腳本」的規模。

---

## 成長觸發點（真正要盯的東西）

| 觸發點 | 現況 | 跨過後的影響 |
|---|---|---|
| R2 儲存 > 10 GB | **已跨過**（19.49 GiB） | 目前約 $0.16/月，每多 1 GB 約 +$0.015/月 |
| 影片持續累積 | 影片已佔 14.45 GiB / 74% | 主要成長來源。上限調到 300MB/支後成長會加速 |
| **Artifact Registry > 0.5 GB** | **已跨過**（1.4 GB） | 約 $0.09/月。**唯一單調成長且無自動上限的項目** —— 見下節 |
| Cloud Run 免費額度 | 遠未接近 | 需 2M 請求／180,000 vCPU-秒（= 1 vCPU 連續處理 50 小時）才開始計費 |
| Vercel Hobby 限制 | 未接近 | 商業使用、頻寬或 build 時數超標 → Pro $20/月 |
| Supabase Free 限制 | 未接近 | DB 500MB／專案閒置暫停 → Pro $25/月 |
| Gemini 免費層級 | 批次執行、量小 | 若日後接 chatbot（見 `CHATBOT_PLAN.md`）會變成**常態性支出**，屆時才是重點 |

> 最值得注意的一條：**目前所有服務加起來的成本，遠低於未來 chatbot 單一功能的預期成本。** 年底報表應該把「現況」與「規劃中功能的預估」分開陳列。

---

## 資料來源與取得方式

### 1. R2 —— 可完全自動化 ✅

已驗證可用（本文開頭的數字就是這樣量出來的）。用既有的 `@aws-sdk/client-s3` 與 `.env` 內的 R2 憑證，`ListObjectsV2` 分頁掃過整個 bucket 即可得到物件數與總 bytes。

不需要 Cloudflare 帳單 API。**注意**：這個方法量的是「當下儲存量」，不是「當月計費量」（R2 storage 以 GB-月計算），但每月固定一天取樣的誤差對這個量級完全可以接受。

Class A/B 操作次數 `ListObjectsV2` 拿不到，需要從 Cloudflare Dashboard 的 R2 metrics 頁面手抄，或串 Cloudflare GraphQL Analytics API。**建議先手抄** —— 目前操作數遠低於免費額度，不值得為它寫整合。

### 2. Gemini —— 目前是盲區，需要先補上 instrumentation ⚠️

**現況：完全沒有 token 用量記錄。** `etl_local/02_classify/ai-classify.js`、`03_analyze/*/analyze.js` 直接呼叫 SDK，回應裡的 `usageMetadata`（`promptTokenCount` / `candidatesTokenCount` / `totalTokenCount`）被丟棄。

使用中的模型：
- `gemini-2.5-flash` —— 3 處（分類、base 分析）
- `gemini-2.5-pro` —— 2 處

**必要的第一步**：在每個呼叫點把 `usageMetadata` 附加寫進一份 JSONL 帳本。這是整個工作流唯一需要動到程式碼的地方。

```
etl_local/.cost-ledger.jsonl   （gitignore，不進版控）
{"ts":"2026-07-27T10:00:00Z","script":"02_classify","model":"gemini-2.5-flash",
 "promptTokens":1234,"outputTokens":567,"batch":"batch-11"}
```

因為 ETL 是**批次、非常駐**的，帳本會很小，一次完整匯入大概幾百行。

### 3. GCP（Cloud Run + Artifact Registry）—— 可用 gcloud 自動化 ✅

專案 ID：**`maramap`**（注意帳號下另有一個名為 MaraMap 的 `gen-lang-client-0686145933`，不要抓錯）。Billing 已啟用（帳戶 `01CC03-CD94CF-594056`）。

#### Cloud Run —— 目前結構上不太會計費

兩個服務：

```
maramap-backend-prod  (asia-east1)               maramap-backend-dev  (northamerica-northeast1)
  1 vCPU / 1Gi                                     1 vCPU / 512Mi
  concurrency 80, maxScale 20                      concurrency 80, maxScale 20
  timeout 3600s  ⚠️                                 timeout 300s
  startup-cpu-boost 開                             startup-cpu-boost 開
```

計費維度為 **CPU 時間、記憶體時間、請求數、egress**。關鍵在於「什麼時候開始算秒數」，而這由兩個設定決定 —— 兩個服務目前都是安全的預設值：

| 設定 | 目前值 | 意義 |
|---|---|---|
| **min instances** | **0**（未設定 `minScale`） | 沒請求時實例完全關掉，**閒置不計費** |
| **CPU throttling** | **開啟**（未設 `no-cpu-throttling`） | 只在處理請求期間計費，請求之間不算 |

**所以沒有流量時 Cloud Run 就是 $0。** 免費額度是每月 2M 請求 / 180,000 vCPU-秒 / 360,000 GiB-秒，以目前流量差得很遠。

**會開始產生費用的情境（依風險排序）**：

1. **⚠️ prod 的 `timeout=3600`（1 小時）** —— 最實際的風險。一個卡住的請求最多計費**一小時的 1 vCPU + 1Gi**；FB 雲端匯入正是長時間執行的請求，且 maxScale 20 表示理論上可同時 20 個。建議收斂，或只對 import 端點放寬。
2. **⚠️ 公開端點 + 無 rate limiting** —— `--allow-unauthenticated`，且每次首頁載入都打 `/api/v1/locations`（回 519 筆）。任何人都能拉高請求數與 CPU 時間。與 `CHATBOT_PLAN.md` 指出的是同一個風險面，而且現在就已存在。dev 也是 unauthenticated。
3. **設定 `--min-instances ≥ 1`** —— Cloud Run 意外帳單最常見的來源，等同 24/7 常駐計費。目前是 0，除非要解冷啟動否則別動。
4. **設定 `--no-cpu-throttling`** —— 會從「只算請求期間」變成「算整個實例生命週期」。
5. **冷啟動** —— 啟動時間也計費，低流量代表幾乎每次都是冷啟動。量小時無所謂，但確實在計費。

#### ⚠️ Artifact Registry —— 唯一「不處理就一定會漲」的項目

```
asia-east1/maramap-backend              24 個 image 版本    0.7 GB
northamerica-northeast1/maramap-backend 16 個 image 版本    0.5 GB
（另有 social-media-backend ×2 地區）                        0.2 GB
                                                    合計   1.4 GB
cleanup policy:                                     兩個 repo 都是 NONE
```

每次 push 到 `main` 或 `develop` 就 build 一個以 commit SHA 為 tag 的 image，**永不刪除**。

- 免費額度 **0.5 GB/月**，超出部分 **$0.10 / GiB / 月**
- 現況 `(1.4 − 0.5) × $0.10` ≈ **$0.09/月**，約 **$1/年**
- 成長率：repo 建於 2026-02-21，約 5.2 個月累積 1.4 GB → 約 **0.27 GB/月**（新 image 共用 base layer，增量遠小於整個 image）。照此速度一年後約 4.6 GB → 約 $0.41/月

**金額很小（一年一美元），但它是本專案唯一單調成長、無自動上限的支出。** 值得加 cleanup policy 的理由是「無上限」，不是「現在很貴」——不必當成急件處理。

#### 取數方式

```bash
# Cloud Run 設定（確認 min instances / CPU throttling 沒被改動）
gcloud run services describe SERVICE --region REGION --project maramap \
  --format="yaml(spec.template.metadata.annotations,spec.template.spec)"

# Artifact Registry 用量
gcloud artifacts repositories list --project maramap \
  --format="table(name,format,sizeBytes.size(units_out=G),createTime.date('%Y-%m-%d'))"
```

實際「花了多少錢」仍需看 Billing Console 或匯出 BigQuery billing export。以目前量級，**每月抄一次 Billing Console 的數字即可**，不值得建 billing export pipeline。

### 4. Vercel / Supabase —— 手動確認即可

兩者目前都是 $0。每月快照只需記錄「方案等級 + 是否收到超量通知」。等到真的開始付費，再考慮串 API。

---

## 實作規劃

### Step 1：Gemini 用量 instrumentation（唯一的程式改動）

**位置**：`MaraMap-Backend/etl_local/`

- 新增 `utils/cost-ledger.js`，匯出 `recordUsage({script, model, response, batch})`，從 `response.usageMetadata` 取值並 append 到 `.cost-ledger.jsonl`。
- 在 5 個 Gemini 呼叫點各加一行呼叫。
- `.gitignore` 加入 `.cost-ledger.jsonl`。

失敗必須是 no-op —— 記帳不能弄壞 ETL。整段包在 try/catch 裡。

### Step 2：每月快照腳本

**位置**：`MaraMap-Backend/utils/cost-snapshot.js`

```
node utils/cost-snapshot.js --month 2026-07
```

行為：
1. 掃 R2 → 物件數、總 bytes、副檔名分佈
2. 讀 `.cost-ledger.jsonl` → 依 model 加總該月 token
3. 讀 `docs/costs/pricing.json` → 套價格算金額
4. 提示手動輸入 R2 Class A/B 操作數、Vercel/Supabase 方案
5. 輸出 `docs/costs/2026-07.json`

### Step 3：價格表獨立成設定檔

**位置**：`MaraMap-Frontend/docs/costs/pricing.json`

價格會變，且**必須以官方頁面為準**——不要把價格寫死在腳本裡，也不要相信任何從記憶寫出來的數字。

```json
{
  "_verified_on": "YYYY-MM-DD",
  "_sources": {
    "r2": "https://developers.cloudflare.com/r2/pricing/",
    "gemini": "https://ai.google.dev/pricing",
    "gcp_free_tier": "https://docs.cloud.google.com/free/docs/free-cloud-features",
    "artifact_registry": "https://cloud.google.com/artifact-registry/pricing",
    "cloud_run": "https://cloud.google.com/run/pricing"
  },
  "r2": {
    "storage_usd_per_gb_month": null,
    "free_storage_gb": null,
    "class_a_usd_per_million": null,
    "class_b_usd_per_million": null,
    "egress_usd_per_gb": 0
  },
  "gemini": {
    "gemini-2.5-flash": { "input_usd_per_1m_tokens": null, "output_usd_per_1m_tokens": null },
    "gemini-2.5-pro":   { "input_usd_per_1m_tokens": null, "output_usd_per_1m_tokens": null }
  },
  "artifact_registry": {
    "free_storage_gb": 0.5,
    "storage_usd_per_gib_month": 0.10
  },
  "cloud_run": {
    "free_requests_per_month": 2000000,
    "free_vcpu_seconds_per_month": 180000,
    "free_gib_seconds_per_month": 360000,
    "free_egress_na_gb_per_month": 1
  }
}
```

**第一次使用前必須先去官方頁面把 `null` 填掉，並更新 `_verified_on`。** 腳本遇到 `null` 應該直接報錯，而不是靜默當成 0。

> GCP 那兩組數字是 2026-07-28 從官方頁面查證後填入的（來源見 `_sources`）。R2 與 Gemini 仍為 `null` —— **請勿憑印象填**，一律以官方頁面為準。價格會變，`_verified_on` 超過半年就該重查一次。

### Step 4：年度報表產生器

**位置**：`MaraMap-Backend/utils/cost-report.js`

```
node utils/cost-report.js --year 2026 --out docs/costs/2026-annual.md
```

讀該年所有 `docs/costs/YYYY-MM.json`，輸出：

- 逐月分項表（R2 儲存／R2 操作／Gemini／Vercel／Supabase／合計）
- 年度總計與各服務佔比
- R2 儲存量成長曲線（純文字，月增 GB）
- 缺漏月份警告（沒跑到快照的月份要明確標示，不能當 0）
- 下一年度成長觸發點預估

---

## 每月例行（約 5 分鐘）

1. 開 Cloudflare Dashboard → R2 → 抄下該月 Class A / Class B 操作數
2. 開 GCP Billing Console → 抄下該月 GCP 實際金額
3. 確認 Vercel / Supabase 是否仍在免費方案、有無超量通知
4. `node utils/cost-snapshot.js --month YYYY-MM`，依提示輸入上面三項
5. commit 產出的 `docs/costs/YYYY-MM.json`

年底：`node utils/cost-report.js --year YYYY`。

---

## 建議的執行順序

| 順序 | 項目 | 理由 |
|---|---|---|
| 1 | Step 1 Gemini instrumentation | **唯一有時效性的** —— 沒記錄的 token 事後補不回來 |
| 2 | Step 3 價格表 | 5 分鐘的事，且 Step 2 依賴它 |
| 3 | Step 2 快照腳本 | R2 部分已驗證可行，直接改寫即可 |
| 4 | Step 4 年報產生器 | 年底前做完就好，不急 |

先做 Step 1，其餘可以慢慢補 —— R2 用量任何時候掃都拿得到當下數字，但 Gemini token 用完就沒了。

---

## 建議的一次性動作（與每月例行無關，但投報率最高）

| 動作 | 理由 |
|---|---|
| **設定 GCP budget alert** | 最高投報率，一次設定終身受用。本文撰寫時無法代為查詢既有預算（需在 GCP 專案啟用 Billing Budget API，屬狀態變更），請至 Billing Console 自行確認／設定 |
| **兩個 Artifact Registry repo 加 cleanup policy** | 例：保留最近 10 個版本。唯一「不處理就一定會漲」的項目 |
| **收斂 prod 的 `timeout=3600`** | 或改為只有 import 路徑用長 timeout |
| **後端加 rate limiting** | 2026-07-11 效能稽核已記錄、至今未修。同時是 Cloud Run 成本與 chatbot 上線的前置條件 |
| **檢視 dev 服務是否還需要** | 目前公開且隨每次 `develop` push 重新部署 |

---

## 尚未決定

- 幣別與匯率：全部以 USD 記錄，年報是否需要換算 CAD/TWD。
- `social-media-backend` 這兩個 Artifact Registry repo 是否仍在使用？若已廢棄可直接刪除，省下 0.2 GB。
