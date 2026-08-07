# Phase 5 原創圖資規格

這組圖資於 2026-08-07 為 80KG Sprint 產生，統一採柔和紙雕／黏土質感。配色以暖白、鼠尾草綠、低彩度天藍為主，只用少量琥珀黃點綴。畫面不含人物、身形比較、文字、數字、品牌標誌、羞辱語意或「前後對照」。

## 共用生成方向

> Original premium paper-cut and soft clay illustration for a calm long-term health planning PWA. Warm off-white background, sage green and muted sky blue palette, one restrained amber accent, soft studio shadows, generous negative space, rounded friendly forms, 3:2 landscape composition. No people, no bodies, no text, no letters, no numbers, no logos, no medical claims, no shame, no before-and-after imagery.

## 檔案與構圖

| 檔案 | 專屬構圖提示 | 建議用途 |
| --- | --- | --- |
| `public/art/planner-hero.webp` | A gently winding path on the right, with small symbols for sleep, balanced food, water, walking, and safety; keep the left half quiet for UI copy. | 計畫首頁 Hero 的裝飾背景；文字與主要操作需由 HTML 呈現。 |
| `public/art/empty-trends.webp` | A friendly chart board with a soft dotted trend line, an analog scale, two small calendars, and leaves; centered, calm, and sparse. | 僅在沒有任何體重量測時顯示的趨勢空狀態。 |
| `public/art/weekly-review.webp` | Layered weekly report cards with a small line chart, a protective shield, leaves, and one positive sparkle; keep the left half quiet. | 每週回顧頁的裝飾圖；不得取代資料摘要或安全提示。 |

目前交付格式皆為 960 × 640 WebP。應透過 `${import.meta.env.BASE_URL}` 組合 URL，確保本機與 GitHub Pages 的 `/80kg-sprint/` base 都能正確載入。

## 使用與無障礙規則

- 圖片只做裝飾時使用空 `alt`，鄰近區域必須有真正的標題、說明與操作按鈕。
- 趨勢圖仍需保留文字摘要與資料表；插圖不能成為傳達數值或狀態的唯一方式。
- 容器應保留 3:2 `aspect-ratio`、固定背景色或漸層作為圖片載入失敗時的 CSS fallback，並避免造成版面位移。
- 深色模式可降低亮度與飽和度，但不要反相圖片；淺色模式維持原始暖白背景。
- WebP 必須列入 PWA precache；若日後替換，仍維持檔名或同步更新元件與快取清單。
- 請勿在這三張原圖上疊入個人健康數值，以免截圖或分享時把資料固化進圖像。
