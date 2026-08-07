# 80KG Sprint

一個以 iPhone 為主、可長期使用的減脂規劃與健康紀錄 PWA。除了既有 7 天 Sprint，使用者也能建立有安全邊界與版本歷史的長期計畫、完成每週檢討，以及用批次飲食流程記錄營養。

介面使用繁體中文，日期依 `Europe/Berlin` 本地日期處理。App 支援離線、iOS safe area、深／淺色模式，以及加入 iPhone 主畫面。

> [!IMPORTANT]
> GitHub 只儲存程式碼。每日健康紀錄與正式計畫預設只儲存在使用者裝置的 IndexedDB，不會上傳到 GitHub。只有使用者明確啟用並主動按下 AI／外部食物搜尋按鈕時，白名單資料才會送到獨立 API Worker；不啟用時所有核心流程仍可本地使用。
>
> 不可將匯出的 JSON、CSV、TXT、PNG、PDF 紀錄或任何含個人健康資料的檔案 commit 到 GitHub。更改 repository 名稱或網站網域前，必須先從設定頁匯出 JSON 備份；不同網址會使用不同的瀏覽器儲存空間。

## V02 一週衝刺流程

- 首頁只先回答四件事：今天還可吃多少、活動距基本目標多少、現在唯一要做什麼、3 日體重趨勢是否在目標區間。
- 每日紀錄分為「早上 20 秒」、「白天飲食與水分」、「晚上 30 秒結算」三個階段，其他細節都收在進階區。
- 睡眠歸在醒來日：例如 `8/1` 紀錄的是 `7/31 晚上 → 8/1 早上`。
- Apple Watch 一般模式只需要活動能量、靜態能量、運動分鐘與步數。個別運動是選填，預設不再加入活動總量，避免重複計算。
- 白天只顯示目前進度；必須在晚上按「完成今日結算」才會產生最終赤字。之後修改飲食或活動，系統會自動取消結算並要求再次確認。
- 飲食快捷模板會同步加入熱量、蛋白質、碳水、脂肪、纖維與鈉，5 秒內可以復原；模板內容可在設定頁修改。
- 早上可記錄下肢緊繃／疼痛 `0–5`。分數達 2 時不建議補跑，達 3 時優先走路或休息；這是保守提醒，不是診斷。
- 趨勢頁以晨間體重、3 日趨勢和每日目標區間為主；7 日平均必須滿 7 筆才顯示。未結算日不會混入平均或累積赤字。
- 設定頁可分享分析圖卡 PNG、A4 PDF、AI 文字摘要，也可匯出 CSV 或完整 JSON 備份。舊版 JSON 缺少 V02 欄位時會以相容預設值補齊。

PNG 與 PDF 都在瀏覽器記憶體中產生，不會自動上傳。若要交給 ChatGPT 分析，建議同時提供 PDF 與 CSV／AI 文字摘要，數字判讀會比只有截圖更可靠。

## V03 iPhone 介面

- 首頁第一屏固定為 Sprint Hero、兩個預算、今日唯一行動與三步流程；詳細營養與統計收進「更多資料」。
- 介面分為唯一 Hero、低對比一般卡片與無邊框區段，放大 iPhone 上的正文、標籤與按鈕字級。
- 全站導覽與主要資料類型統一使用 Lucide 圖示，不再混用 emoji、文字符號與不同風格圖示。
- 飲食頁可複製昨天早餐、昨天整天飲食或最近一次雞胸餐；原有完整營養資料仍會一起計算。
- 晚間只有資料齊全時才顯示可用的「完成今日結算」，完成後會短暫顯示攝取、消耗與推估赤字。
- 已驗證 375、390、430 與 760 px 寬度，首頁雙預算與三步入口不會產生橫向捲動。

## V05 批次飲食與趨勢分析

- 飲食選單先累積多項草稿，最後只儲存一次；重複點選同餐次常用食材會增加份量。
- 選單提供最近 14 天、常用、套餐、我的食物、手動新增與跨來源搜尋，關閉未儲存草稿時會先在選單內確認。
- 主體重圖改為圖下固定資訊列，進階圖表只顯示有單位、限制列數的格式化資訊。
- 首頁改顯示晚餐主餐預算；營養素標示完整度，體重預測依 7／14 筆晨重分級顯示信心。
- IndexedDB 維持版本 1，`BackupPayload.schemaVersion` 維持 1；載入既有紀錄不會自動遷移或回寫。

## V06 長期減脂 Planner（Phase 1–5）

- 既有使用者仍可直接使用 7 日 Sprint；首頁與設定提供非阻斷式的「建立長期減脂計畫」入口。
- 建立流程包含基本資料、生活型態、10 項安全篩檢與本機計算的計畫草稿；只有最後明確確認後才會寫入 Planner。
- 熱量、蛋白質、喝水、睡眠與運動目標先由 deterministic Safety Engine 限制在安全邊界內。阻擋或需專業協助的情況不會產生自助減脂處方。
- 首頁、紀錄頁與趨勢頁會讀取選定日期當時生效的 immutable `PlanVersion`；每週檢討的調整會建立新版本，不會覆蓋歷史版本。
- Planner 使用獨立的 `80kg-sprint-planner` IndexedDB version 1 和獨立 JSON 備份。原有 `80kg-sprint` DB、stores 與 `BackupPayload.schemaVersion = 1` 完全不變。
- Phase 3 提供獨立 Cloudflare Worker：OpenAI 金鑰只存在 Worker secret，Responses API 使用 strict JSON Schema 與 `store: false`，並有 CORS、大小、timeout、rate limit、domain safety 與安全錯誤邊界。
- Phase 4 的 AI 功能完全選用：第一次使用會逐項列明送出／不送出的資料；撤回後停止新請求，也可只清除本機 `aiRuns`，不影響 DailyLog 或正式計畫。
- 初始計畫永遠先產生 deterministic 本地安全草稿。AI 只協助修改草稿；schema 或安全驗證失敗時保留本地版本，使用者最後確認前不會寫入正式 `PlanVersion`。
- 每週檢討只送完整週的 aggregate，不送原始每日紀錄。資料不足時完全不呼叫 AI；熱量、有氧、肌力與重點都能逐項接受或拒絕，套用時建立 immutable 新版本。
- AI 食物解析只拆解名稱、份量、生熟與品牌疑問，不產生 kcal／蛋白質。營養來自 Local、BLS gateway、USDA 或 Open Food Facts 候選，經使用者確認後才加入同一次批次草稿；未知值顯示 `—`，不冒充 `0`。
- Phase 5 加入原創 WebP 視覺、375／390／430／760 px 響應式處理、深淺色、safe area、44 px touch target、focus trap、reduced motion 與圖表的螢幕閱讀摘要。

## 本機啟動

需要目前仍受支援的 Node.js LTS 與 npm。

```bash
npm ci
npm run dev
```

Vite 顯示本機網址後，以瀏覽器開啟。開發模式使用根路徑 `/`；production build 會自動使用 GitHub Pages 專案路徑 `/80kg-sprint/`。

預設 `VITE_AI_ENABLED=false`，因此不需要後端也能完整使用。要測試選用 AI，先複製 `.env.example` 為 `.env.local`，填入已部署 Worker 的 HTTPS URL；瀏覽器端只能放 `VITE_AI_ENABLED` 與 `VITE_AI_API_BASE_URL`，不可放任何 provider secret。

Worker 的本機測試與部署說明位於 [`api-worker/README.md`](api-worker/README.md)：

```bash
cd api-worker
npm ci
npm run test
npm run typecheck
```

測試與建置：

```bash
npm run test
npm run build
npm run preview
```

`npm run preview` 預覽 production build 時，請開啟 `http://127.0.0.1:43871/80kg-sprint/`；這個本機預覽器會模擬 GitHub Pages 的 repository 子路徑，並避開常見開發伺服器連接埠上殘留的舊 PWA 快取。

## 部署到 GitHub Pages

預設 repository 名稱是 `80kg-sprint`，因此網站網址是：

```text
https://<USERNAME>.github.io/80kg-sprint/
```

1. 登入 GitHub，建立新的 repository，名稱填入 `80kg-sprint`。不要勾選自動加入 README、`.gitignore` 或授權檔，以免首次 push 衝突。
2. 在本專案根目錄初始化並推送：

   ```bash
   git init
   git branch -M main
   git add .
   git commit -m "Build 80KG Sprint PWA"
   git remote add origin https://github.com/<USERNAME>/80kg-sprint.git
   git push -u origin main
   ```

3. 開啟 GitHub repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 的 **Source** 選擇 **GitHub Actions**。
5. 開啟 **Actions** 頁面，等待 `Deploy 80KG Sprint to GitHub Pages` 顯示成功。工作流程也可由 **Run workflow** 手動執行。
6. 開啟 `https://<USERNAME>.github.io/80kg-sprint/`。首次部署有時需要幾分鐘生效。

`.github/workflows/deploy.yml` 會在 push 到 `main` 後自動執行前端與 Worker 測試、Worker typecheck 及 production build，再使用 GitHub 官方 Pages Actions 上傳並部署 `dist`。Worker 是獨立服務，不會由 Pages workflow 自動部署；必須先依 `api-worker/README.md` 設定 secrets 並部署，確認 `/v1/health` 後，才在 GitHub Actions repository variables 設定 `VITE_AI_ENABLED=true` 與 `VITE_AI_API_BASE_URL`。

## 加入 iPhone 主畫面

1. 在 iPhone 上用 Safari 開啟部署網址。
2. 點 Safari 的「分享」按鈕。
3. 選擇「加入主畫面」。
4. 確認名稱後按「加入」。

安裝後可離線查看與輸入。本地規劃、記錄、手動食物與已確認候選不需要同步；AI 與外部食物搜尋只有在使用者主動要求且有網路時才會連線。

## Repository 名稱不是 `80kg-sprint` 時

部署前修改 `vite.config.ts` 的 `productionBase`。例如 repository 改名為 `my-sprint`：

```ts
const productionBase = '/my-sprint/'
```

改名或切換網域會改變網站 origin／路徑，Safari 可能把它視為另一個網站，因此務必先在舊網址的設定頁匯出 JSON 備份，再於新網址匯入。

## 資料安全與限制

- 核心本地功能不需要登入、後端、API key 或雲端資料庫；選用 AI／外部食物搜尋需要已部署的 API Worker。
- 不使用廣告、追蹤或分析 SDK。
- PWA 無法直接讀取 Apple Health／HealthKit；Apple Watch 數值由使用者手動輸入，且消耗結果標示為估算。
- Apple Watch「活動能量」是截至輸入當下的全日累積快照。白天可反覆更新；個別運動預設只作明細、不重複加總。只有確定未反映在 Watch 摘要時，才能從進階選項手動加入。
- 匯入 JSON 前會先下載目前資料的自動備份；格式驗證失敗不會覆蓋現有資料。
- `7700 kcal/kg` 只用於「脂肪等值估算」，不代表精確脂肪減少量。
- 體重預測不是保證，並標示約 `±0.5 kg` 的水分波動區間。
- 請勿在 repository 放入 API key、密碼、個人健康紀錄或測試用真實資料。
- `store: false` 表示不要求 OpenAI 將回應保存為模型回應紀錄，但不等於所有網路服務都保證絕對零留存；啟用前的同意畫面會再次說明。
- 外部食物來源可能包含各自的授權與 attribution；BLS gateway 的資料授權由部署者確認，USDA FoodData Central 與 Open Food Facts 的使用方式詳見 Worker 文件。
