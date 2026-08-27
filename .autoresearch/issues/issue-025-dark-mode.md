# 深色模式开关与全局深色主题

## Description
新增深色配色的设计 token，并把 #21 新建的"深色模式"开关接入：开启后全应用（首页/角色/模型/设置/聊天）切换为深色配色，重启后保持。

## Acceptance Criteria
- [x] 设计 token 层（`src/styles/tokens.css`）新增深色配色变量（背景/表面/文字/边框/语义色等），覆盖首页、角色页、模型页、设置页、聊天页全部已有组件 — 新增 `:root[data-theme='dark']` 覆盖块；另在实现前审计出一批组件里直接硬编码（未走 token）的浅色文字/边框/背景值，补齐为新 token 并在深色块里给出对应深色取值（详见 Implementation Notes）
- [x] 开关默认关闭（浅色模式，与当前唯一支持的外观一致）— 沿用 #21 schema.ts 播种的默认值 `dark_mode = 0`
- [x] 开启后应用整体（含已打开的其他页面）立即切换为深色配色，无需重启 — `data-theme` 属性直接设在 `document.documentElement` 上（新增 `src/lib/applyDarkMode.ts`），不依赖任何单个屏幕的 React 树，`SettingsScreen` 切换开关时立即调用；验证过切换后导航回首页无需刷新即保持深色
- [x] 重启应用后保持上次选择的模式 — `App.tsx` 启动时读取 `appPreference.get()` 并在挂载时应用一次
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill)，需截图确认至少首页、聊天页在深色模式下的可读性（文字对比度、边框可见）— 见 Implementation Notes，实际截图覆盖了首页/角色页/模型页/设置页/聊天页全部五个页面

## Implementation Notes
- **Mechanism**: opt-in only via the "深色模式" toggle — no `prefers-color-scheme` media query at all, per the PRD's explicit "no follow-system third state" decision. `applyDarkModeAttribute()` sets/removes `data-theme="dark"` on `<html>`; `tokens.css` hooks into it via `:root[data-theme='dark']`, which naturally wins on specificity over the base `:root` block regardless of source order. Applied in two places: `App.tsx` once at boot (fetches the preference before any screen-specific code runs), and `SettingsScreen.tsx`'s toggle handler for the live, no-reload switch (with rollback to the previous theme if the persist call fails, mirroring the existing optimistic-update-with-rollback pattern already used for all four toggles since #21).
- **Pre-existing hardcoded-color audit**: before adding the dark override block, grepped every `.module.css` file for color literals not routed through `var(--...)` — tokens.css's own header comment says "do not hardcode raw color values," but a couple dozen instances had drifted in anyway across nine files (mostly tiny near-duplicate variants of the same "light lavender hover border" and "light pastel hover background" idea, plus a few standalone cases). Left three categories of hardcoded literal alone, on purpose:
  1. **White text on saturated fills** (`color: #fff` on accent/danger buttons, avatar initials, message-bubble-me) — correct in both themes since the fill itself doesn't need to change.
  2. **Accent-hue-locked shadows/focus-rings** (Button's primary shadow, Input/Select focus rings, ToneChip's active shadow, ChatScreen's textarea focus ring) — all reference the exact same oklch hue/chroma as `--accent`, and since `--accent` itself is intentionally left unchanged across themes (see below), these need no dark equivalent either.
  3. **Toast and Overlay's own dark literals** — already dark/semi-transparent by design regardless of page theme (a toast "snackbar" and a modal scrim both conventionally stay dark on both light and dark pages), so nothing to fix there.
  
  The remaining ~18 instances (light hover/dashed borders, light pastel hover/badge backgrounds, the "them" message bubble's near-white fill, the danger icon-wrap tint, and the annotation tag chip) were genuinely dark-mode-breaking — left unchanged they'd render as glaring near-white shapes on a dark surface. Consolidated these into 6 new tokens (`--border-accent`, `--accent-subtle-hover`, `--danger-tint`, `--bubble-them-bg`, `--bubble-them-fg`, `--annotation-tag-fg`/`--annotation-tag-bg`) plus one exact match to an *existing* token (ConfirmDialog's warning icon background was byte-for-byte identical to `--warning-light`, just never referenced it). Several of the "light border" values across files were tiny drifted variants of each other (72–80% lightness, 0.1–0.12 chroma, same hue) — unified into one `--border-accent` value rather than preserving each pixel-imperceptible variant as its own token, a deliberate simplification disclosed here rather than silently.
- **Why `--accent`/`--accent-hover`/`--accent-fg` and the semantic base colors (`--danger`/`--warning`/`--success`) are NOT overridden in dark mode**: they're mid-lightness hues that already read acceptably on both light and dark surfaces, and — per the audit above — several components reference their exact values as raw literals rather than `var()`. Changing the base tokens without also migrating every such literal would make brand-new dark-mode UI subtly mismatch its own shadows/rings. Only the "light wash" variants meant to sit *on* a light surface got real dark equivalents (surfaces, text, borders, and every `-subtle`/`-light`/`-tint`/`-border` semantic tint).
- **Shadows**: light mode's shadow formula (a tinted-neutral color at low opacity) barely registers on a dark background where there's little ambient contrast to work with, so dark mode's `--shadow-sm/md/lg` switch to plain black at meaningfully higher opacity instead.
- **Verified in a browser**: `ELECTRON_STARTUP_PREVENT=1 npm run dev` + Playwright/headless-Chromium (same sandbox limitation as every prior issue — confirmed still identical by rerunning `npx playwright test`, both e2e specs still hit "Process failed to launch!" and nothing new). Two full page-by-page passes (light and dark) through all five screens — home, roles, models, settings, chat (with a populated thread: a "them" bubble with its translation note, a "me" bubble, and an annotation note, plus a live "生成回复" result) — via a stateful mocked `window.api`, screenshotting every screen in both themes. Also a dedicated "live toggle" pass: start light, flip the switch on the Settings screen, confirm `data-theme` flips to `dark` immediately (before any navigation), confirm it's *still* dark after navigating back to Home with no reload (proving the theme lives outside any one screen's mount lifecycle), then flip back off and confirm it clears. 6/6 mechanism checks passed, zero console errors across all runs. Screenshots visually confirm: solid, evenly-dark surfaces with no near-white residue anywhere (the two components most at risk — the chat bubble and the annotation tag — specifically checked and confirmed properly re-themed); toggle switches show clear on/off contrast; the accent purple remains vivid and legible against the dark background exactly as expected from the deliberate choice not to touch it.
- Also reran `npm run build` (clean) given the number of CSS files touched.

## Dependencies
Issue #21

## Type
fullstack

## Priority
medium

## Design Reference
无深色版设计稿，需在 `src/styles/tokens.css` 现有浅色配色的语义分层（accent/surface/text/border/semantic）基础上自行设计一套深色取值

## PRD Reference
`tasks/prd-general-settings-and-model-page.md` — US-006
