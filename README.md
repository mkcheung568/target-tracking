# Target Tracking

[![CI](https://github.com/mkcheung568/target-tracking/actions/workflows/ci.yml/badge.svg)](https://github.com/mkcheung568/target-tracking/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)

一個 local-first 的個人目標追蹤工具，幫助你把「想完成的事」變成每天可以記錄、回看和調整的行動。

Target Tracking is a local-first personal goal tracker for turning intentions into daily actions you can record, review, and adjust.

## 這個項目是什麼？ / What is it?

Target Tracking 將目標週期、排程、每日打卡、進度指標、趨勢和獎勵放在同一個工作空間。你可以建立一個有開始／結束日期和頻率的目標，然後每天標記「完成」、「未完成」或「略過」。Dashboard 會把最近的行動整理成可以立即理解的訊號：淨分數、完成率、時間進度、連續完成和進度健康度。

Target Tracking brings goal periods, schedules, daily check-ins, metrics, trends, and rewards into one calm workspace. Create a goal with dates and a frequency, then record each scheduled day as completed, failed, or skipped. The dashboard turns those actions into clear signals: net score, completion rate, time progress, streaks, and health.

## 為什麼會有這個項目？ / Why does it exist?

很多目標停留在待辦清單或一句口號，問題通常不是不知道想要什麼，而是缺少一個低摩擦的每日回顧方式：

- 只有目標名稱，沒有清楚的開始、結束和執行頻率。
- 做到和做不到沒有持續記錄，過了一週便只能靠印象回想。
- 完成率、累積分數和時間進度容易被混成一個不準確的百分比。
- 「今天沒有記錄」和「今天明確失敗」被誤當成同一件事。
- 發現落後時，沒有足夠的歷史資料幫助自己調整目標。

Many goals remain as a task-list item or a good intention. The missing piece is often a low-friction daily review: clear dates and frequency, an honest record of what happened, and enough history to decide what to change. A missed record should not silently become a failure, and one progress number should not hide the difference between effort, results, and elapsed time.

## 對使用者有什麼幫助？ / How it helps

- 把模糊目標轉成有日期、頻率和成功條件的可執行目標。
- 每天用一次點擊記錄完成、未完成或略過，並可修改當天結果。
- 同時查看淨分數和完成率，避免只看一個數字作出錯誤判斷。
- 用 Streak、Best Streak 和 7／30 日趨勢看見自己的節奏。
- 透過 Ahead、On Track、Slightly Behind 和 At Risk 快速判斷是否需要調整。
- 以獎勵的 locked、unlocked 和 redeemed 狀態保留動機與完成記錄。
- 用 JSON Export／Import 備份資料，資料由使用者自己掌握。

It helps you make goals measurable, record the truth of each scheduled day, understand momentum over time, spot risk early, and adjust the plan before a goal quietly disappears.

## 主要畫面 / Main views

### Today / Dashboard

一眼查看今天排定的目標、快速打卡、整體完成數、淨分數、最佳連續和最近 7 天趨勢。

See today’s scheduled goals, quick check-ins, completion summary, net score, best streak, and the recent seven-day trend at a glance.

![Today Dashboard](docs/screenshots/dashboard.png)

*Desktop Today Dashboard — 今日 Dashboard（示範資料 / demo data）*

![Today Dashboard on mobile](docs/screenshots/dashboard-mobile.png)

*Mobile Today view — 手機版 Today 與底部導覽（示範資料 / demo data）*

### Goals / Goal Detail

集中管理目標，支援建立、編輯、暫停、刪除和狀態管理。Goal Detail 會顯示 overview、7／30／all trends、簡易 heatmap、備註、歷史和獎勵。

Manage goals with create, edit, pause, delete, and lifecycle states. Goal Detail includes overview, seven/30-day/all-time trends, a simple heatmap, notes, history, and reward status.

![Goal Detail](docs/screenshots/goal-detail.png)

*Goal Detail — 目標詳情、趨勢、日曆和歷史（示範資料 / demo data）*

### History / Analytics

History 以桌面表格和手機卡片顯示所有打卡；Analytics 提供最近 7／30 日的完成、未完成、略過統計和趨勢圖。

History provides a desktop table and mobile cards for every check-in. Analytics summarizes completed, failed, and skipped results with seven/30-day trends.

### Settings

設定繁體中文、簡體中文或英文，匯出／匯入 JSON，重設示範資料，並設定瀏覽器打卡提醒時間。

Choose Traditional Chinese, Simplified Chinese, or English; export/import JSON; reset demo data; and configure browser check-in reminder time.

![Settings and notifications](docs/screenshots/settings-notifications.png)

*Settings — 語言、備份和提醒設定（示範資料 / demo data）*

## 核心規則 / Core rules

- `Completed` 會加 `+1`，`Failed` 會減 `-1`，`Skipped` 為 `0`。
- 沒有打卡的日期是 `No Record`，不會自動被計為失敗。
- 同一個目標同一天只能有一筆 check-in，但當天結果可以修改。
- Completion Rate = 完成次數 ÷（完成次數 + 未完成次數）；略過和未記錄不列入分母。
- Check-ins 是資料 source of truth；Net Score、Completion Rate、Streak 等都是即時計算的 derived metrics。

`Completed` adds `+1`, `Failed` subtracts `-1`, and `Skipped` contributes `0`. A missing check-in remains `No Record`, so it is not silently treated as a failure. One goal can have only one check-in per date, while today’s result remains editable.

## 技術棧 / Tech stack

- Next.js App Router + TypeScript
- Tailwind CSS + MUI
- Zustand with `persist` and browser localStorage
- Recharts for trends and summaries
- Framer Motion for the liquid progress animation
- date-fns for date calculations
- Zod + React Hook Form for validation and forms

### 專案結構 / Project structure

```text
app/                 App Router pages, layout, global styles
components/          Client UI and shared workspace views
lib/domain.ts        Schemas, check-in rules, metrics, demo data
lib/store.ts         Zustand state, persistence, import/export actions
lib/i18n.ts          Traditional Chinese, Simplified Chinese, English copy
tests/               Domain and behavior tests
docs/screenshots/    README product screenshots
```

## 安裝與開發 / Install and develop

需求：Node.js 22 LTS 或更新版本，以及 npm。專案已提交 `package-lock.json`，開發時建議使用 `npm ci` 取得可重現的依賴版本。

Prerequisites: Node.js 22 LTS or newer and npm. The committed `package-lock.json` makes `npm ci` the recommended reproducible install command.

```bash
git clone https://github.com/mkcheung568/target-tracking.git
cd target-tracking
npm ci
npm run dev
```

開啟 <http://localhost:3005>。如果 `3005` 已被使用，可在啟動正式伺服器時指定其他 `PORT`；開發腳本預設固定使用 `3005`。

Open <http://localhost:3005>. If another service uses port `3005`, set a different `PORT` when starting the production server. The development script intentionally defaults to `3005`.

## 正式運行 / Run in production locally

```bash
npm ci
npm run build
PORT=3005 npm run start
```

Next.js 會在本機 production server 提供網站。部署到一般 Node.js 主機時，請使用 Node.js 22 LTS、HTTPS 和一個反向代理（例如 Nginx），並把 `PORT` 指向主機提供的服務埠。

Next.js serves the production build through its Node server. On a regular Node.js host, use Node.js 22 LTS, HTTPS, and a reverse proxy such as Nginx; set `PORT` to the port provided by your host.

## Vercel 部署 / Deploy to Vercel

1. 把這個 repository 匯入 Vercel。
2. Framework Preset 選擇 Next.js。
3. Install command 使用 `npm ci`，Build command 使用 `npm run build`。
4. 目前不需要設定環境變數。
5. 完成部署後，在瀏覽器開啟 Vercel URL。

1. Import this repository into Vercel.
2. Select Next.js as the framework preset.
3. Use `npm ci` for install and `npm run build` for the build command.
4. No environment variables are required at this stage.
5. Open the Vercel URL after deployment completes.

## 資料、通知與注意事項 / Data, notifications, and limitations

- 資料只儲存在目前瀏覽器的 localStorage，不會自動上傳到伺服器。
- 清除網站資料、使用無痕模式或更換瀏覽器／裝置，都可能看不到原有記錄。
- 請定期在 Settings 匯出 JSON；匯入會取代目前資料，匯入前應先備份。
- 目前沒有後端、資料庫、登入、雲端同步或多人協作。
- 瀏覽器提醒只會在 App 開啟時檢查；瀏覽器完全關閉時的真正 Web Push 需要後端服務。
- 不要把真實密碼、API key 或其他敏感資料放進目標描述、備註或 issue。

Data stays in the current browser’s localStorage and is not uploaded automatically. Clearing site data, using private browsing, or switching devices can hide existing records. Export JSON regularly. Import replaces the current dataset, so export first. The MVP has no backend, database, login, cloud sync, or collaboration. Browser reminders are checked while the app is open; true Web Push while the browser is closed requires a backend service.

## 開源貢獻 / Open-source contribution

請先閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)。提交 Pull Request 前，請通過 lint、type-check、test 和 build；功能修改應包含相應的 domain 或 UI 驗證。Bug 和功能建議可以使用 GitHub Issues。

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Run lint, type-check, test, and build locally; feature changes should include the relevant domain or UI verification. Use GitHub Issues for bugs and feature ideas.

安全問題請參考 [SECURITY.md](SECURITY.md)，行為準則請參考 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

For security concerns, read [SECURITY.md](SECURITY.md). Community expectations are documented in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

This project is released under the [MIT License](LICENSE).
