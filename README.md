# 排球防守站位

給剛開始打排球的人：把對方打過來的球拖到我們的場地，看誰去接、為什麼是她，接著一步一步看「接起來 → 送到目標區 → 舉球・保護 → 回防」。

- **學習模式**：拖對方攻擊手改變攻擊位置，拖（或點）球到場上任何地方。
- **自己擺**：6 個人都能拖，每個人的防守範圍是一樣大的圈，擺好後一樣可以拖球測試。
- **情境**：心跟進、邊跟進、心後、舉球留網前；雙人攔、單人攔、只有攔中、沒攔網；舉球員在前排或後排；自由守 5 或 6 號位；圈圈大小；播放速度。
- **防守觀念**：App 用的規則和根據，附資料來源。

純網頁，不用安裝任何套件，也沒有帳號和線上資料庫。

## 放到 GitHub Pages

1. 在 GitHub 建一個新的 repository（例如 `volleyball-defense`），設成 Public。
2. 把這個資料夾裡的所有檔案上傳到 repository 的最上層（`index.html` 要在最上層）。`tools/` 可以一起上傳，不影響網頁。
3. 到 repository 的 **Settings → Pages**，Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/ (root)`，按 Save。
4. 等幾分鐘，網址會是 `https://你的帳號.github.io/volleyball-defense/`。
5. 拿到網址後，把 `index.html` 裡 `og:image` 的 `icons/og-image.png` 改成完整網址（例如 `https://你的帳號.github.io/volleyball-defense/icons/og-image.png`），貼到 LINE 時預覽圖才會出現。

## 更新版本

1. 改 `js/app.js` 最上面的 `APP_VERSION`、`BUILD_DATE`，和 `sw.js` 的 `VERSION`（兩個版本號要一樣，手機才會換成新版）。
2. 畫面有改的話，重產使用說明截圖：
   ```
   python3 -m http.server 8765
   python3 tools/make-help-shots.py
   ```
3. 上傳後，打開 App 看首頁下方的版本號有沒有變。GitHub Pages 更新可能要等幾分鐘。

## 退回舊版

上傳新版前，先在 GitHub 把目前版本另存一個分支（例如 `backup-v1.0.0`）。新版有問題時，把那個分支的檔案再上傳回 `main`，並把 `sw.js` 的 `VERSION` 改成新的號碼，手機才會丟掉有問題的快取。

## 資料存在哪裡

只存在使用者自己的瀏覽器（localStorage），不會上傳：

| key | 內容 |
|---|---|
| `vbdef.settings.v1` | 情境設定、攻擊手位置 |
| `vbdef.custom.v1` | 「自己擺」的站位 |
| `vbdef.hint.drag.v1` | 看過拖球提示了沒 |

清除瀏覽資料、換手機或從 LINE 內建瀏覽器打開時，這些設定會是預設值；站位資料只是練習用，不影響使用。

## 工具

- `tools/make-icons.py`：產生 App 圖示和分享預覽圖。
- `tools/make-help-shots.py`：產生使用說明的截圖。
- `tools/check-layout.py`：在手機、平板、筆電、桌電等尺寸量有沒有超出畫面、按鈕被蓋住、按鈕太小、字太小。

## 根據與參考資料

App 裡「誰接哪一球」的規則來自教練常用的分工（不是比賽規則），詳細說明在 App 的「防守觀念」頁。主要參考：

- Coaching Volleyball：Whose ball? Seam responsibilities
- Coaches Insider / Human Kinetics：Positioning defensively as a team、Digging tactics、Effectively using the libero
- Coaching Volleyball：Hitter coverage strategy
- Volleyball Vault：Base positions
- 2025～2028 新增、修訂中文排球規則（7.4、7.4.4）
- Sitti & Rangubhet（2025），Frontiers in Sports and Active Living：2024 世界女排聯賽扣球類型分析

## 版權

© 2026 陳則翰。供排球教學與練習使用。
