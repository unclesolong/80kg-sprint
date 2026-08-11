# 減脂追蹤 API Worker

Phase 3/4 的 Cloudflare Worker 參考實作。這個目錄和 Vite 前端分開；OpenAI、USDA 等秘密只存在 Worker 環境，不會進入 `VITE_*` 或瀏覽器 bundle。

目前是原始碼與測試完成的部署候選，**尚未部署，也未設定任何 production secret**。

## Endpoints

| Method | Path | 說明 | AI 同意 header |
| --- | --- | --- | --- |
| `GET` | `/v1/health` | 僅回傳服務與 provider 是否已設定，不洩漏值 | 不需要 |
| `POST` | `/v1/plan/generate` | 以問卷、本地能量分析與 SafetyBounds 產生計畫草稿 | `X-AI-Consent: granted` |
| `POST` | `/v1/review/weekly` | 只分析每週 aggregate，產生可確認的調整草稿 | `X-AI-Consent: granted` |
| `POST` | `/v1/food/parse` | 只拆解名稱、份量、生熟與確認問題；schema 沒有營養欄位 | `X-AI-Consent: granted` |
| `POST` | `/v1/food/search` | 依 deterministic ranking 搜尋 Local／BLS／USDA／Open Food Facts | `X-AI-Consent: granted` |

AI endpoints 只回傳草稿。Worker 不知道 IndexedDB，也沒有寫入 `DailyLog`、`MealLine` 或 `PlanVersion` 的能力；前端仍須通過本地 Safety Engine、顯示 Draft Form，並等待使用者按下「套用並儲存」。

### 計畫能量分析契約

前端會先依下列順序建立 `localRecommendation.energyPlan`：

1. 最近 7–14 天同時具有靜止與活動能量的每日紀錄。
2. 使用者在問卷填寫的穿戴裝置平均值與涵蓋天數。
3. Mifflin-St Jeor BMR 與生活／運動活動係數估算。

計畫草稿與 `PlanVersion` 會保存 `restingEnergyKcal`、`activeEnergyKcal`、`estimatedTdeeKcal`、來源、信心度與樣本天數，供首頁顯示「攝取、活動、靜止、TDEE」表格。AI 必須原樣複製這份 deterministic 分析，只能在安全邊界內調整攝取與行為草稿；若修改數字或來源，Worker 與前端都會拒絕回應並保留本地草稿。

## Response contract

成功：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "...",
    "source": "ai",
    "attempts": 1
  }
}
```

若 OpenAI 未設定、timeout、refusal、回傳 malformed JSON、schema 不符或 domain safety 不符，計畫／每週／解析 endpoints 最多重試一次，之後以 HTTP 200 回傳 `meta.source = "fallback"`。Plan fallback 只複製已由本地引擎產生且經 Worker 再驗證的安全數值；Weekly fallback 保持數值不變；Food fallback 只做保守文字拆解，不產生 kcal。

請求本身不安全或格式錯誤時使用 sanitized error：

```json
{
  "ok": false,
  "error": {
    "code": "SAFETY_RESTRICTED",
    "message": "目前條件不適合由 AI 產生減脂數字。",
    "retryable": false,
    "fields": ["goal_bmi_below_18_5"]
  },
  "requestId": "..."
}
```

回應不包含 OpenAI／USDA／BLS／Open Food Facts 的 raw body、raw error、prompt 或 secret。

## OpenAI Responses API

- 直接呼叫 `POST https://api.openai.com/v1/responses`。
- Plan 與 Weekly 使用 `OPENAI_MODEL_PLANNER`、`reasoning.effort = medium`。
- Food Parse 使用 `OPENAI_MODEL_PARSER`、`reasoning.effort = low`。
- 所有輸出使用 `text.format.type = json_schema`、`strict = true`、`additionalProperties = false`。
- 回傳 JSON 先通過固定版 `zod@4.1.12` 的 strict runtime schema，再進入 deterministic domain safety validation。
- 固定 output token 上限；請求另有 body／文字／timeout 限制。
- 每次都設定 `store: false`。這代表不要求 Responses API 儲存回應，**不代表供應商的安全與濫用監控絕對零留存**；前端隱私說明仍須如實揭露。

Worker 的第二層 domain validation 會拒絕超出 SafetyBounds、低於熱量保護值、每週超過 1% 或 0.9 kg、疼痛中增加活動、腎臟風險下提供高蛋白等結果。驗證失敗不會 silent clamp 後冒充有效 AI 結果。

## Request safety and privacy

- Plan 請求只接受基本數字、活動摘要、SafetyBounds 與本地推薦；unknown keys 會被拒絕。
- Weekly 只接受 aggregate，不接受逐日 raw notes。
- Food Parse 單次最多 500 字。
- 不接受姓名、Email、地址、公司、完整生日或任意 raw notes 欄位。
- Request body 依 endpoint 限制為 2–24 KiB。
- CORS 預設只允許 `https://unclesolong.github.io`、`localhost`、`127.0.0.1` 與 `[::1]`；自訂正式 origin 必須加入 `ALLOWED_ORIGINS`。
- 所有 JSON 回應使用 `Cache-Control: no-store`。本實作不使用 Cache API，因此不會把健康／AI response 寫入 Cache Storage。

`X-AI-Consent: granted` 是後端的額外門檻；前端仍需提供完整同意與撤回 UI。這個門檻同時套用在會把食物 query 傳給 Worker／外部 provider 的 `/v1/food/search`。不要以這個 header 取代產品內的 consent record。

## Food providers

優先序固定為：

1. Local curated ingredients
2. BLS
3. USDA FoodData Central
4. Open Food Facts

exact barcode 會優先於一般來源排序。同 barcode、同 source ID，以及名稱／品牌／營養高度接近的候選會合併。raw/cooked 明確候選優先；缺值維持 `undefined`，不補成 `0`。常見 query 使用 Worker isolate 內 10 分鐘記憶體快取，不使用 Cache Storage。

### BLS gateway contract

德國 BLS 的授權與可用資料介面依部署來源而異，因此 `BlsFoodProvider` 不假設一個不存在的公開 API。若有合法資料來源，可設定 `BLS_API_BASE_URL` 指向 operator-controlled gateway。搜尋採：

```text
GET {BLS_API_BASE_URL}?query=Hähnchen&limit=5&locale=zh-TW
```

可回傳 `foods`、`items` 或 `results`，每列至少包含：

```json
{
  "id": "BLS-code",
  "name": "food name",
  "kcalPer100g": 120,
  "proteinG": 23.1,
  "carbsG": 0,
  "fatG": 2.6,
  "fiberG": null,
  "sodiumMg": null,
  "weightState": "raw"
}
```

未設定或 gateway 失敗時只回傳空候選，不會阻擋 Local、USDA、Open Food Facts 或前端手動新增。

## Limits

基本 rate limit 使用 IP + `X-Device-Id` 的短雜湊（記憶體中不保存原字串），在單一 Worker isolate 的記憶體中計數：Plan 每小時 4 次、Weekly 每小時 8 次、Parse 每 10 分鐘 30 次、Search 每 10 分鐘 60 次。這是基本濫用緩解，不是跨 isolate 的精確全域限制；production 若需要強一致限制，應接 Cloudflare Rate Limiting、Durable Object 或同等服務。

## Local validation

```bash
cd api-worker
npm ci
npm run test
npm run typecheck
```

測試不會連線到 OpenAI 或外部 food provider；所有 upstream fetch 都是 stub。

## Configure and deploy

1. 複製 `wrangler.toml.example` 為未追蹤的 `wrangler.toml`。
2. 將兩個模型 placeholder 換成帳號可用、正式環境已 pin 的 Responses API 模型／snapshot。
3. 設定 secrets：

```bash
npx wrangler@4 secret put OPENAI_API_KEY
npx wrangler@4 secret put USDA_API_KEY
```

4. 視需要在 `wrangler.toml` 設 `BLS_API_BASE_URL`、自訂 `ALLOWED_ORIGINS` 與具聯絡資訊的 `FOOD_PROVIDER_USER_AGENT`。
5. 先測試，再部署：

```bash
npm run test
npm run typecheck
npm run deploy
```

6. 部署成功後才檢查：

```bash
curl https://YOUR-WORKER.workers.dev/v1/health
```

health check 成功後，才能在 GitHub Pages build 設定 `VITE_AI_API_BASE_URL` 與 `VITE_AI_ENABLED=true`。不要把任何 Worker secret 改名為 `VITE_*`。
