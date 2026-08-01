# 80KG Sprint

一個為 iPhone 設計的 7 天減重紀錄 PWA。使用者可以記錄晨間體重、Apple Watch 手動輸入的活動／靜態能量、運動明細、飲食與營養素、飲水、前一晚睡眠、排便與身體感受，並查看趨勢與保守的估算。

介面使用繁體中文，日期依 `Europe/Berlin` 本地日期處理。App 支援離線、iOS safe area、深／淺色模式，以及加入 iPhone 主畫面。

> [!IMPORTANT]
> GitHub 只儲存程式碼。每日健康紀錄只儲存在使用者裝置的 IndexedDB，不會上傳到 GitHub 或任何伺服器。
>
> 不可將匯出的 JSON、CSV、TXT、PNG、PDF 紀錄或任何含個人健康資料的檔案 commit 到 GitHub。更改 repository 名稱或網站網域前，必須先從設定頁匯出 JSON 備份；不同網址會使用不同的瀏覽器儲存空間。

## 功能

- 首頁集中顯示體重趨勢、熱量目標範圍、蛋白質、飲水、營養素、運動與尚未完成項目。
- 紀錄頁依晨間、活動、飲食、水分、狀態分頁，避免單頁過長。
- 睡眠歸在醒來日：例如 `8/1` 紀錄的是 `7/31 晚上 → 8/1 早上`。
- Apple Watch 每日摘要與個別運動分開；運動明細可標記「已包含於 Watch」或「尚未包含、加入目前總量」，支援白天持續更新與晚間追加運動。
- 飲食支援快速總量與詳細餐點；可記錄熱量、蛋白質、碳水、脂肪、纖維、鈉，並建立／編輯自訂食物。
- 設定頁可分享分析圖卡 PNG、A4 PDF、AI 文字摘要，也可匯出 CSV 或完整 JSON 備份。

PNG 與 PDF 都在瀏覽器記憶體中產生，不會自動上傳。若要交給 ChatGPT 分析，建議同時提供 PDF 與 CSV／AI 文字摘要，數字判讀會比只有截圖更可靠。

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
- Apple Watch「活動能量」是截至輸入當下的全日累積快照。運動明細若已包含在此快照便不重複加總；若是稍後新增、尚未反映的運動，可暫時加入目前總量，待 Watch 更新後再標記為已包含。
- 匯入 JSON 前會先下載目前資料的自動備份；格式驗證失敗不會覆蓋現有資料。
- `7700 kcal/kg` 只用於「脂肪等值估算」，不代表精確脂肪減少量。
- 體重預測不是保證，並標示約 `±0.5 kg` 的水分波動區間。
- 請勿在 repository 放入 API key、密碼、個人健康紀錄或測試用真實資料。
