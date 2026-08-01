# 80KG Sprint

一個為 iPhone 設計的 7 天減重紀錄 PWA。使用者可以記錄晨間體重、Apple Watch 手動輸入的活動／靜態能量、運動明細、飲食與營養素、飲水、前一晚睡眠、排便與身體感受，並查看趨勢與保守的估算。

介面使用繁體中文，日期依 `Europe/Berlin` 本地日期處理。App 支援離線、iOS safe area、深／淺色模式，以及加入 iPhone 主畫面。

> [!IMPORTANT]
> GitHub 只儲存程式碼。每日健康紀錄只儲存在使用者裝置的 IndexedDB，不會上傳到 GitHub 或任何伺服器。
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

## 本機啟動

需要目前仍受支援的 Node.js LTS 與 npm。

```bash
npm ci
npm run dev
```

Vite 顯示本機網址後，以瀏覽器開啟。開發模式使用根路徑 `/`；production build 會自動使用 GitHub Pages 專案路徑 `/80kg-sprint/`。

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

`.github/workflows/deploy.yml` 會在 push 到 `main` 後自動執行 `npm ci`、單元測試與 production build，再使用 GitHub 官方 Pages Actions 上傳並部署 `dist`。

## 加入 iPhone 主畫面

1. 在 iPhone 上用 Safari 開啟部署網址。
2. 點 Safari 的「分享」按鈕。
3. 選擇「加入主畫面」。
4. 確認名稱後按「加入」。

安裝後可離線查看與輸入。網路恢復時不需要同步，因為資料始終只存本機。

## Repository 名稱不是 `80kg-sprint` 時

部署前修改 `vite.config.ts` 的 `productionBase`。例如 repository 改名為 `my-sprint`：

```ts
const productionBase = '/my-sprint/'
```

改名或切換網域會改變網站 origin／路徑，Safari 可能把它視為另一個網站，因此務必先在舊網址的設定頁匯出 JSON 備份，再於新網址匯入。

## 資料安全與限制

- 不需要登入、後端、API key 或雲端資料庫。
- 不使用廣告、追蹤或分析 SDK。
- PWA 無法直接讀取 Apple Health／HealthKit；Apple Watch 數值由使用者手動輸入，且消耗結果標示為估算。
- Apple Watch「活動能量」是截至輸入當下的全日累積快照。白天可反覆更新；個別運動預設只作明細、不重複加總。只有確定未反映在 Watch 摘要時，才能從進階選項手動加入。
- 匯入 JSON 前會先下載目前資料的自動備份；格式驗證失敗不會覆蓋現有資料。
- `7700 kcal/kg` 只用於「脂肪等值估算」，不代表精確脂肪減少量。
- 體重預測不是保證，並標示約 `±0.5 kg` 的水分波動區間。
- 請勿在 repository 放入 API key、密碼、個人健康紀錄或測試用真實資料。
