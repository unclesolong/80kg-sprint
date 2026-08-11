# 潤光 Lv1–Lv12 正式階段母版提示詞

模式：內建 ImageGen（參考圖生成）

用途：PWA 培育頁正式點陣美術母版

母版：`luminous-lv01-lv12-neutral-master-v1.png`

切圖腳本：`tools/slice-luminous-master.py`

參考圖：

1. `companion-ip-b-luminous-tide-v1.png`：潤光角色血統、材質與光線的主要基準。
2. `luminous-affinity-comparison-mid-final-v1.png`：只用來約束未來親和印記的輪廓語言；本母版保持中性。

```text
Use case: stylized-concept
Asset type: production game character progression master sheet for a mobile wellness PWA
Input images: Image 1 is the canonical 潤光 character lineage and material/style reference; Image 2 is a silhouette-language reference only for later affinity branches.
Primary request: create one exact twelve-cell progression sheet showing the same neutral 潤光 companion evolving through 12 visibly distinct growth nodes. Use a strict 4-column by 3-row grid of equal cells. Each column is one body family and progresses from its first node at the top to its third node at the bottom: column 1 = 光滴 nodes 1–3, column 2 = 潤團 nodes 4–6, column 3 = 流環 nodes 7–9, column 4 = 星潮 nodes 10–12. Exactly one centered character per cell, exactly 12 characters total, no overlap across cells.
Stage details: 光滴 begins as a small crystal-aqua droplet with dim off-center amber core, then brighter internal motes, then one pearl satellite and birth-mark star pattern. 潤團 introduces a larger oval translucent body and tiny symmetric soft fins, then a delicate neutral gold orbit, then richer internal constellation. 流環 introduces a taller body with three flowing neutral fins, then more pearl nodes and woven starlight, then a harmonious double-ring pattern. 星潮 introduces the large mature flowing silhouette, then a small luminous lagoon/habitat base and gentle satellites, then full but restrained final radiance and permanent star sigil. Keep all stages neutral before affinity selection: no dominant coral branches, speed spikes, purple veil, or crystal crown.
Style/medium: refined ethereal 3D fantasy character render, translucent opalescent aqua glass-gel body, warm amber luminous core, fine champagne-gold orbital lines, pearl highlights, soft aquatic life feeling; match Image 1 closely.
Composition/framing: identical front three-quarter camera, identical center anchor and light direction in every cell; generous padding; character scale grows gradually but remains fully inside each cell. Very subtle equal-cell divisions only, designed for clean deterministic cropping.
Scene/backdrop: one continuous very pale misty aqua studio background with uniform brightness, no scenery except the small habitat base only in nodes 11 and 12.
Lighting/mood: soft dawn glow, calm, caring, premium and hopeful, never childish or aggressive.
Color palette: crystal aqua and ice blue, blush-lilac iridescence, warm amber core, champagne-gold details; accent colors restrained.
Constraints: exact 4x3 grid; exact 12 characters; each cell contains one full character; visibly progressive silhouette/core/orbit changes; same species and art direction; no text, numbers, labels, icons, borders, watermark, UI chrome, people, animals, food, scales, exercise equipment, medical imagery, aggressive spikes, dark background, overexposure, or branch-specific affinity identity. This is artwork, not CSS or vector UI.
```
