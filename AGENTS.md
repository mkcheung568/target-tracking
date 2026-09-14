<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Target Tracking AI 開發指引

## 專案目的與範圍

Target Tracking 是 local-first 個人目標追蹤 Web App。使用者建立有日期和頻率的目標，針對排程日記錄 `completed`、`failed` 或 `skipped`，再透過 Dashboard、History、Analytics 和 Goal Detail 回看進度。

MVP 的非目標是後端、資料庫、登入、雲端同步、多人協作和瀏覽器關閉後的真正 Web Push。除非需求明確改變範圍，AI 不應自行加入這些功能。

## 技術與目錄責任

- `app/`：Next.js App Router 頁面、layout 和全域 CSS。
- `components/workspace.tsx`：主要 client UI、頁面視圖、表單和互動流程。
- `lib/domain.ts`：Zod schemas、日期／排程規則、check-in 計算、derived metrics 和示範資料。
- `lib/store.ts`：Zustand state、persist、localStorage adapter 和資料 actions。
- `lib/i18n.ts`：繁體中文、簡體中文、英文的翻譯 key 和文字。
- `tests/`：domain 和資料規則測試。

使用 App Router 和 TypeScript strict mode。需要瀏覽器 API 或 Zustand hook 的 component 才使用 `"use client"`。

## 資料不變量與狀態管理

- Check-ins 是唯一的行動資料 source of truth；不要持久化 Net Score、Completion Rate、Streak、Health 等 derived metrics。
- 一個 goal 在同一日期只能有一筆 check-in；修改當天結果應替換原有記錄，而不是新增重複資料。
- `No Record` 是沒有 check-in，不是 `failed`；只有明確的 `failed` 才會扣分。
- `Skipped` 計 0 分，且不列入 Completion Rate 分母。
- 所有新增或匯入資料都必須通過 Zod schema；修改 schema 時同步更新 backup、store、UI 和測試。
- 不要在 component 直接讀寫 localStorage；所有持久化資料經由 Zustand store actions。
- `backupSchema` 的版本變更必須考慮舊資料匯入和向後相容。
- 任何刪除、清除或 reset 操作都必須保留現有確認流程，避免意外破壞使用者資料。

## Coding pattern

- 優先使用現有 domain helper（例如 `metrics`、`scheduled`、`dates`、`scoreOf`），不要在 UI 重新實作計算規則。
- 表單使用 React Hook Form + `zodResolver`；不要繞過 schema 建立未驗證資料。
- UI state 由 Zustand actions 更新；不要在多個 component 建立平行資料副本。
- 所有使用者可見文字使用 `t(language, key)`；新增 key 時必須同步提供三種語言，避免中英文混用。
- 對外資料、檔案匯入和使用者輸入都採取明確型別和失敗處理。
- 使用語意化 HTML、ARIA label、keyboard focus 和可操作的按鈕，不要用不可存取的 click-only `div`。
- 改動後保持當天 check-in 可修改、同日不可重複、No Record 不扣分等既有行為。

## UI、Design pattern 與視覺風格

- 整體風格是 minimal、calm、productivity：淺色背景、白色卡片、細邊框、低陰影和清晰留白。
- 沿用 `app/globals.css` 的 token 和現有 class pattern；不要為同一種元件引入另一套色彩或 spacing 系統。
- Indigo 是主要 accent；emerald 表示正向／完成，rose 表示負向／未完成，amber 表示警示／需要調整。
- Desktop 使用固定 sidebar；窄螢幕使用 mobile bottom navigation。所有頁面必須在手機和桌面保持可用。
- MUI 用於 Button、Dialog、TextField、Select、Chip、Alert、Switch 等互動元件；自訂布局和視覺優先沿用現有 CSS。
- Recharts 用於趨勢圖和統計圖；Framer Motion 用於必要的狀態轉換和液體進度動畫。
- 動畫要服務於數據理解，並尊重 `prefers-reduced-motion`；不要加入持續閃爍或干擾閱讀的效果。
- 正負分數的 liquid bar 必須保留中央 0 軸，正分向右、負分向左，並使用語意化 meter 屬性。

## 修改流程

1. 先閱讀 `lib/domain.ts`、`lib/store.ts`、`lib/i18n.ts` 和相關頁面，確認資料流與現有文字。
2. 先決定修改屬於 domain、store、i18n、UI 或 CSS，再在正確層級實作。
3. 若新增資料欄位，更新 Zod schema、demo、store merge、backup import/export、表單和測試。
4. 若新增畫面文字，同步更新三種語言，檢查所有狀態、錯誤和空狀態。
5. 保留現有 responsive、focus、ARIA 和 reduced-motion 行為。
6. 完成後執行 `npm run lint`、`npm run type-check`、`npm run test` 和 `npm run build`。
7. 回報修改摘要、驗證結果和仍存在的限制，不要宣稱未驗證的行為。

## 不應做的事

- 不直接編輯 `node_modules`、`.next` 或 generated cache。
- 不把 derived metrics 重複寫入 localStorage。
- 不用英文 fallback 掩蓋缺少的翻譯 key。
- 不自行改變 port `3005`、資料版本或現有產品範圍。
- 不刪除使用者資料、重設 localStorage 或移除現有功能來解決測試問題。
