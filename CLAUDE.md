@AGENTS.md

# Claude 專案執行規範

`AGENTS.md` 是 Target Tracking 的完整工程規範；每次修改前必須先閱讀並遵守它。以下是 Claude coding 時的最重要執行順序：

1. 先確認需求涉及 `domain`、`store`、`i18n`、component 或 CSS 哪一層，再開始修改。
2. 先閱讀現有 schema、store actions、翻譯 key 和 design tokens；優先重用現有模式。
3. 不在 component 內自行重算核心指標，也不直接讀寫 localStorage。
4. 每一個使用者可見文字都要經過 `t(language, key)`，並同步完成繁體中文、簡體中文和英文。
5. 新增或修改資料欄位時，必須同步處理 Zod validation、demo data、persist merge、JSON backup、表單和測試。
6. 保持 check-in 的同日唯一性、可修改性、No Record 與 Failed 的區別，以及 derived metrics 不持久化。
7. 沿用 minimal、calm、productivity 視覺：indigo accent、emerald positive、rose negative、amber warning、白卡和清晰留白。
8. 保持 desktop sidebar、mobile bottom nav、keyboard focus、ARIA 和 reduced-motion 支援。
9. 不加入未授權的後端、資料庫、登入、雲端同步或真正 Web Push。
10. 完成後執行 lint、type-check、test、build，並在回覆中列出實際結果和任何限制。
