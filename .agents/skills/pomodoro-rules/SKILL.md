---
name: pomodoro-rules
description: >-
  Enforces development rules and constraints for the Pomodoro application:
  no external libraries or CDNs, all localStorage keys must be prefixed with
  "pomodoro:", and all UI text must be in Traditional Chinese (繁體中文).
  Use this skill whenever creating, modifying, refactoring, or reviewing HTML,
  CSS, or JavaScript code in this workspace.
---

# Pomodoro 專案開發規範 (Pomodoro Workspace Skill)

在開發、修改或審查本專案的程式碼時，必須嚴格遵守以下三條核心規則：

## 核心規則

1. **不引入外部函式庫或 CDN。**
   - 僅使用原生 HTML、CSS 與 Vanilla JavaScript 實作所有功能。
   - 禁止在 HTML 中透過 `<script src="...">` 或 `<link href="...">` 引入任何外部套件、框架或 CDN 資源（例如外部字體、圖示庫、UI 框架等）。
   - 禁止在 JavaScript / CSS 中透過 `import` 或 `@import` 載入外部遠端資源。

2. **localStorage 的 key 一律加上 pomodoro: 前綴。**
   - 所有讀寫 `localStorage`（如 `localStorage.getItem`、`localStorage.setItem`、`localStorage.removeItem`）的 key 名稱，皆須以 `pomodoro:` 開頭（例如：`pomodoro:settings`、`pomodoro:tasks`、`pomodoro:stats`）。

3. **畫面上的文字一律使用繁體中文。**
   - 所有使用者介面（UI）可見文字，包含標題、按鈕、導覽列、提示訊息（placeholder、aria-label、title）、狀態標籤與通知訊息，一律使用繁體中文（Traditional Chinese）。

## 檢查與驗證步驟 (Validation Steps)

完成程式碼撰寫或修改後，請依序執行以下檢查：

1. **檢查外部依賴與 CDN**：
   - 檢視 `index.html`、`style.css` 與 `app.js`，確認無任何 `http://` 或 `https://` 的外部資源引用。
2. **檢查 `localStorage` Key 前綴**：
   - 搜尋程式碼中所有的 `localStorage.` 呼叫，確認所有 key 字串皆以 `pomodoro:` 為前綴。
3. **檢查介面文字語系**：
   - 檢視 HTML 靜態文字與 JavaScript 動態渲染的介面字串，確認畫面上顯示的所有文字皆為繁體中文。
