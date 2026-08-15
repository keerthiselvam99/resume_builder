# ResumeIQ — UI Fix Verification Report

Date: 2026-08-13
Scope: verification of six UI-regression fixes in the Angular frontend, plus full regression of unit + e2e suites.

## Summary

| Check | Result |
| --- | --- |
| Production build (`ng build --configuration production`) | PASS (exit 0) |
| Unit tests (`npm test`, 30 files) | PASS — 289/289 |
| E2E functional tests (Playwright, chromium + http-persistence) | PASS — 42/42 |
| E2E visual-regression baselines | 28 FAIL — expected, frozen baselines vs intentional UI changes (see Failures) |
| Fresh screenshots (8 views) | `frontend/fresh-screenshots/` with computed-style + body-text notes (`view-notes.md`) |

## The six fixes and how they were verified

1. **Dashboard tabs contrast** (`features/dashboard/dashboard.component.ts`)
   Active tab is now `--color-primary` background with white text; `:focus-visible` gets a 2px `--color-accent` outline.
   Verified: `02-dashboard` computed style — `.tabs__tab--active` `background-color: rgb(10, 28, 76)` (= `--color-primary #0a1c4c`), `color: rgb(255, 255, 255)`, `font-weight: 600`. Tab focus/hover covered by `ui-regressions.spec.ts`.

2. **Create-resume thumbnail scale** (`shared/components/preview-frame.component.ts`)
   Thumbnail now always renders the fixed 900×600 footprint at scale 0.6 (no overflow, no fit-dependent drift).
   Verified: `05-create-resume` — `iframe.preview-frame__iframe` `width: 900px; height: 600px; transform: matrix(0.6, 0, 0, 0.6, 0, 0); transform-origin: 0px 0px`. Also added `transition: none` for the thumbnail iframe so the fit→thumbnail mode flip cannot leave a mid-transition computed transform (root cause of a flaky e2e failure).

3. **Navbar Drafts item** (`shell/app-shell.component.ts`)
   Confirmed there is no Drafts item in the primary nav; Drafts exists only as a dashboard tab (`/resumes/drafts`).
   Verified: `02-dashboard` `navLinks` text = My Resumes / Templates / Job Matcher / Admin / Arun Kumar / Log out; dashboard tabs = My Resumes + Drafts.

4. **Template preview overflow / scrollbar** (`features/templates/template-preview.component.ts` + `preview-frame.component.ts`)
   Preview now uses the shared `PreviewFrameComponent` in fit mode; full A4 sheet stays contained with no horizontal scrollbar.
   Verified: `04-template-preview` iframe `transform: matrix(0.71772, …)` (fit to the 1440×900 viewport); `ui-regressions.spec.ts` asserts no scrollbar (`scrollWidth <= clientWidth`) and the sheet fully visible.

5. **Editor toolbar layout / save status / PDF-disabled** (`features/editor/resume-editor.component.ts`)
   Header restructured (`back` control + `.editor__context` + `.editor__actions`); equal-height buttons and consistent gaps; save status is a compact `.editor__status` chip (`Draft`/`Saved`), not an extra button; PDF export disabled whenever content is empty via `pdfDisabled = computed(() => !content || !templateId || isContentEmpty(content))`.
   Verified: `06-editor-draft-toolbar` — status chip `Draft`, `.editor__save-label` "Draft saved", `.editor__status` amber background `rgb(255, 251, 235)` with dark text; `07-editor-content` — status `Saved`, green text `rgb(22, 163, 74)`. Toolbar geometry asserted by `ui-regressions.spec.ts` (equal heights, gaps, back link present). PDF error path restored (Retry button).

6. **Any other regression** — covered by full suites below.

## Test counts (exact)

- `npx ng build --configuration production` → exit 0, bundle written to `dist/frontend`.
- `npm test` → Test Files 30 passed (30), Tests 289 passed (289), exit 0.
- `npx playwright test` (default = fresh servers, both projects) → **42 passed, 28 failed**, exit 1.
  - All 28 failures are `e2e/visual-regression.spec.ts` `toHaveScreenshot` assertions against frozen baselines. Every functional test (including all `http-persistence` specs: editor persistence, ATS analysis, PDF export) passed.

## Failures explained

- The 28 `visual-regression.spec.ts` failures are **expected and intentionally not "fixed"**: the pixel baselines were approved before the six UI changes, and the task requires leaving baselines untouched. They fail on pixel diff (not timeout/selector), i.e. the new screenshots render as intended but differ from the frozen images. Two approved-view baselines also changed nav/tab structure intentionally (dashboard tabs, thumbnail stage).
- An earlier e2e run surfaced two transient functional failures that were fixed and re-run to green:
  - `my-resumes.spec.ts` (3 tests) hit a Playwright strict-mode collision because the newly added dashboard "My Resumes" tab duplicated the navbar link name. Fixed by scoping the click to the primary navbar (`getByLabel('Primary')`).
  - Create-resume thumbnail assertion read a mid-transition transform value; fixed by disabling the transform transition on the thumbnail iframe.

## Screenshots

`frontend/fresh-screenshots/`
- `01-login.png`, `02-dashboard.png`, `03-template-gallery.png`, `04-template-preview.png`, `05-create-resume.png`, `06-editor-draft-toolbar.png`, `07-editor-content.png`, `08-my-resumes.png`
- `view-notes.md` — per-view body-text excerpts and computed styles (tokens verified: `--color-primary #0a1c4c`, `--color-accent #0ea5e9`).
- Captured with `e2e/capture-fresh-screenshots.ts` against the mock track (`:4200`, localStorage repos, demo login `arun@example.com` / `Password123!`).

## Caveats

- Visual-regression baselines are intentionally stale; the 28 failures are the expected cost of the UI changes. Regenerate baselines only if the new design is approved.
- E2E runs used fresh servers per run (Playwright `webServer` default); no `E2E_REUSE_SERVERS`.
- Screenshots/notes were captured with reduced motion + animations forced to near-zero duration for deterministic output.
