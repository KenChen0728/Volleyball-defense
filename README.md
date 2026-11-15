# 排球站位教室

給剛開始打排球的人：照「1 輪轉 → 2 接發球 → 3 防扣球 → 4 防吊球」的順序，看每一輪誰站哪裡、誰接發球、對方攻擊時誰接、為什麼是她、大家怎麼跑。

網址：<https://kenchen0728.github.io/Volleyball-defense/>

- **1 輪轉站位**：選單舉（5-1）、雙輔舉（6-2）、雙舉（4-2），按 ↻ 看大家順時針轉一格；按 ▶ 看我們發球時大家怎麼換到防守位置。
- **隊上的站法**：教練畫的單舉六輪（接發球大多四個人接、我們發球怎麼換位、舉球員一律守 2 號位），是單舉的預設；也可以換成五人 W、四人、三人。
- **2 接發球**：五人 W、四人、三人接；發球那一刻的站位規則（虛線連起來的兩個人不能前後或左右交換）自動檢查，拖球看誰接發球、哪隻腳在前、怎麼接，接著傳到舉球員、舉球・保護、換到防守位置。
- **3 防扣球、4 防吊球**：紅色是扣球打得到的地方，橘色斜線是只能吊球的地方（攔網陰影和網前），拖對方攻擊手、拖球看誰接、誰補位。可以切到「自己擺」拖 6 個人。
- **立體畫面**：用 WebGL 畫的人形球員（會蹲低準備、跑、攔網跳起來、雙手接球），預設慢動作；可以用接球的人的眼睛（第一人稱）看扣球慢慢飛過來、接進自己的雙手。不需要網路或外部套件；手機不支援 WebGL 時改用簡單的畫法。
- **站位圖解**：號位和站位規則、接發球隊形、單舉六輪、雙輔舉、雙舉、防守隊形、保護和補位、準備姿勢和步法。
- **觀念和規則**：App 用的規則和根據，附資料來源。

純網頁，不用安裝任何套件，也沒有帳號和線上資料庫。

## 放到 GitHub Pages

1. repository 的 **Settings → Pages**，Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/ (root)`，按 Save。
2. 等幾分鐘，網址是 `https://kenchen0728.github.io/Volleyball-defense/`。`index.html` 的 `og:image` 已經寫成這個網址底下的完整位置，貼到 LINE 會有預覽圖。

## 更新版本

1. 改 `js/app.js` 最上面的 `APP_VERSION`、`BUILD_DATE`，和 `sw.js` 的 `VERSION`（兩個版本號要一樣，手機才會換成新版）。新增 js 檔要一起加進 `sw.js` 的 `ASSETS`。
2. 畫面有改的話，重產使用說明截圖，再跑版面檢查：
   ```
   python3 -m http.server 8765
   python3 tools/make-help-shots.py
   python3 tools/check-layout.py
   ```
3. 上傳後，打開 App 看首頁下方的版本號有沒有變。GitHub Pages 更新可能要等幾分鐘。

## 退回舊版

每次改版前都會先把目前的 `main` 另存成備份分支（例如 `backup-v1.1.0`、`backup-v2.0.0`）。新版有問題時：

1. 在 GitHub 打開備份分支，把檔案放回 `main`（或在電腦上 `git checkout backup-v1.1.0 -- .` 再推上去）。
2. 把 `sw.js` 的 `VERSION` 改成一個新的號碼（例如 `1.1.1`），手機才會丟掉有問題的快取。

## 資料存在哪裡

只存在使用者自己的瀏覽器（localStorage），不會上傳：

| key | 內容 |
|---|---|
| `vbdef.settings.v1` | 設定（進攻系統、輪次、接發球隊形、有沒有自由、防守隊形、誰會攔網…）、學到第幾課、攻擊手和發球員的位置、平面或立體；`sv` 是設定的版本 |
| `vbdef.custom.v1` | 「自己擺」的站位 |
| `vbdef.hint.drag.v1`、`vbdef.hint.v2` | 看過操作提示了沒 |

舊版的設定會自動轉換：v1 的「舉球員在前排」會換成舉球員在 2 號位的那一輪；v2.0 的預設（五人 W、心跟進）會換成隊上的站法和舉球留網前。清除瀏覽資料、換手機或從 LINE 內建瀏覽器打開時，設定會是預設值；這些只是練習用的設定，不影響使用。

## 程式檔案

- `js/rotation.js`：輪轉（單舉、雙輔舉、雙舉）、接發球站位，和發球那一刻的站位規則檢查。
- `js/gl3d.js`：立體畫面（WebGL2，人形球員、場地、網子、球）。
- `js/render3d.js`：手機不支援 WebGL 時的簡單立體畫法。
- `js/diagrams.js`：站位圖解的示意圖。
- `js/app.js`：畫面、誰接哪一球、一球的過程。

## 工具

- `tools/make-icons.py`：產生 App 圖示和分享預覽圖。
- `tools/make-help-shots.py`：產生使用說明的截圖。
- `tools/check-layout.py`：在手機、平板、筆電、桌電等尺寸量有沒有超出畫面、按鈕被蓋住、按鈕太小、字太小。

## 根據與參考資料

App 裡「誰接哪一球」的規則來自教練常用的分工（不是比賽規則），詳細說明和連結在 App 的「觀念和規則」頁。主要參考：

- 2025～2028 新增、修訂中文排球規則（7.4、7.4.4 站位）
- USA Volleyball（Human Kinetics）：Five-player serve-receive；Hoopsking、Sportplan：serve receive formations
- Gold Medal Squared：Passing targets；Coaching Volleyball：Setter start position and the passing target、Passing body and foot positioning
- Volleyball Canada：Basic passing、Basic defense；Volleyball Ireland：Pass card、Defence card
- Coaching Volleyball：Whose ball? Seam responsibilities、Hitter coverage strategy
- Coaches Insider / Human Kinetics：Positioning defensively as a team、Digging tactics、Effectively using the libero
- Volleyball Vault：Base positions
- Sitti & Rangubhet（2025），Frontiers in Sports and Active Living：2024 世界女排聯賽扣球類型分析

## 版權與使用範圍

© 2026 Ken Chen。目前只提供 Ken Chen 帶的球隊練習使用；其他用途請先聯絡作者。
