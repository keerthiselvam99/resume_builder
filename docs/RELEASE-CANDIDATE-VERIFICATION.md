# ResumeIQ — Release-candidate verification

## 1. Date and environment

- **Date:** 2026-08-14
- **OS:** Windows (win32)
- **Node:** v24.19.0 · **npm:** 11.17.0 · **Playwright:** 1.62.1 (chromium)
- **Frontend:** Angular 22.x build (application builder), Vitest 4.1.10 unit runner
- **Backend:** Node 24 + tsc (TypeScript strict), Vitest 4.1.10
- **Mode:** all gates run in normal mode (no `--update-snapshots`, no retries, no server reuse)

## 2. Exact files changed

This closure changed **only** the 28 approved visual baselines plus this report.
No product source file changed during snapshot generation or any gate (verified by a
pre/post SHA-256 manifest of `frontend/src`, `frontend/e2e`, `frontend/playwright.config.ts`,
`backend/src`, `backend/test`: zero diffs outside the 28 snapshot files).

- `frontend/e2e/visual-regression.spec.ts-snapshots/` — 28 baseline PNGs updated (list below).
- `docs/RELEASE-CANDIDATE-VERIFICATION.md` — this report (new).

Pre-existing reliability/test-infrastructure changes (unchanged and preserved exactly in
this closure):

- `frontend/e2e/support/preview-ready.ts` — `waitForPreviewReady()` helper.
- `frontend/e2e/preview-controls.spec.ts` — gates preview assertions on the helper.
- `frontend/e2e/pdf-export.spec.ts` — `/pdfz` readiness gate + explicit timeouts.
- `frontend/playwright.config.ts` — `PDF_WARMUP=true` for the backend webServer;
  `http-persistence` project pinned to `workers: 1`.
- `backend/src/services/pdf/pdf-export.service.ts` — `prepare()` + passive `browserReady()`.
- `backend/src/controllers/health.controller.ts`, `backend/src/server.ts` — `GET /pdfz`
  probe and `PDF_WARMUP` boot warm-up (non-fatal, lazy-launch fallback preserved).
- `backend/test/health.api.test.ts` — `/pdfz` 503 test.
- `frontend/e2e/visual-regression.spec.ts` — journey test timeout raised and two stale
  assertions on a deliberately-removed editor template label removed (test-only).

## 3. The 28 updated baseline filenames

25 Navy template-family previews:

```
preview-classic-ats-navy-chromium-win32.png
preview-compact-ats-navy-chromium-win32.png
preview-corporate-standard-navy-chromium-win32.png
preview-academic-cv-navy-chromium-win32.png
preview-legal-formal-navy-chromium-win32.png
preview-premium-sidebar-navy-chromium-win32.png
preview-modern-split-navy-chromium-win32.png
preview-centered-header-navy-chromium-win32.png
preview-accent-timeline-navy-chromium-win32.png
preview-clean-cards-navy-chromium-win32.png
preview-developer-console-navy-chromium-win32.png
preview-product-engineer-navy-chromium-win32.png
preview-data-analyst-navy-chromium-win32.png
preview-cloud-architect-navy-chromium-win32.png
preview-cybersecurity-navy-chromium-win32.png
preview-executive-banner-navy-chromium-win32.png
preview-leadership-profile-navy-chromium-win32.png
preview-boardroom-navy-chromium-win32.png
preview-strategy-consultant-navy-chromium-win32.png
preview-finance-professional-navy-chromium-win32.png
preview-swiss-minimal-navy-chromium-win32.png
preview-editorial-navy-chromium-win32.png
preview-geometric-accent-navy-chromium-win32.png
preview-soft-neutral-navy-chromium-win32.png
preview-creative-portfolio-navy-chromium-win32.png
```

3 approved-flow views:

```
3-template-preview-burgundy-chromium-win32.png
4-create-resume-chromium-win32.png
6-editor-after-template-change-chromium-win32.png
```

## 4. Before/after hashes for those baselines

Each was regenerated from the exact approved visual-regression test (scoped `-g` run,
fresh servers, `workers: 1`, retries 0), then re-verified in normal mode.

| snapshot file | after sha256 | before sha256 |
| --- | --- | --- |
| 3-template-preview-burgundy-chromium-win32.png | ce8fb99f7bcb68ad0de14a71357525caf531472e8ffe0829f95d04b8b73fec0c | ba1ac6bd357ea730aeabaaaa93ad417e46b436fa69c28a5ccbf9a39285234b28 |
| 4-create-resume-chromium-win32.png | 374c6d2e077cfd78fed1bada452ffd5a2054dd03dad702ed645dd1398e0e02aa | fa7df5677f0bf77c1c378c332e49def1b8e63a360bf29687231edb4b1437f075 |
| 6-editor-after-template-change-chromium-win32.png | ddff9f93a1eed92de596feb78f7ccb1e57b41b33a43fbe60bab18bee55477c4f | 34c7bd9de7279e48a7acbc11f117f90d2ff0eee8c80993cda733ef943f8edebf |
| preview-academic-cv-navy-chromium-win32.png | cb897128ed98ff87b00958109f39204f582bb9d637136837e47a4f94b44960f9 | c65d9fd7e6d64c4da51bc15800b1286b517a6aca1c4cd32566077c0f47707882 |
| preview-accent-timeline-navy-chromium-win32.png | 7abdab81fb5cd02d1d83a61d221cfccec4d336341af508a76e48b62786324d72 | 7d3ca358f482c40223262c09e9c7d21bf8c7e41e9b373f6c7d1b46e06c1222ee |
| preview-boardroom-navy-chromium-win32.png | dea521deab222d62b8755b1676bd8f4053b73403df511df3da5a69877c347ff0 | 6115f0d0acbc4b1c607c69772d9036d5c9ccc800742c9b12933caae3ecf5fdd3 |
| preview-centered-header-navy-chromium-win32.png | d7a039e140e64ca2834c714f4dbd3582e59b0e27d9a2e8adadbe8b811c9b9708 | 2734654576c4e8c900b8b3b56c1f92a3b8fb9189a6eb65c2c0df5b4b0d23fefb |
| preview-classic-ats-navy-chromium-win32.png | 5a7ee1da3bab00f9ee8950be1d89dd8f0dd7178a1195f6ede7dedfa4fbd653e3 | c2616e2c6c89ef74fcda20f6e9fe778c8eb087f1efcd08a509d0423ce2e67a91 |
| preview-clean-cards-navy-chromium-win32.png | 87342c47e7d72d36f936b8f019bf4c73224debff02062df8e440be6aa6740c26 | d0d31c45c3ad1616ddae596adc62548db044492a067149c377fc71382034e1c6 |
| preview-cloud-architect-navy-chromium-win32.png | 44597b8729f65262adfc1a0a89b737ce01e0230c3644711537f52bda178ed675 | d52b6ca1870f396a0f2b53040c4ae09c728bfcca00d8c627681afcfe98ebb4e6 |
| preview-compact-ats-navy-chromium-win32.png | 42422db51170fad4bfcf0200f19bf1158f76aa7d4d80205e3b933ef6a8e7fb78 | 9ab701e2339f8bdd08231a174de75f76fa8b1c82ff843283d835e4f7d14cd098 |
| preview-corporate-standard-navy-chromium-win32.png | ce934bbdb4478885295c946c9c2176c5d4695583a59c9cda6c3785595561acb1 | 84933de17369ceab0f60da2dd28454be3fd3ec23b5645a3b3e0266331883aae0 |
| preview-creative-portfolio-navy-chromium-win32.png | f99b4bc93e3d03abd7f20ef4b1c14175f9edd9dbd93b334594939164afff5408 | d5a7c4bc85803bd704d2c15514578e19ddc4fcdca4181bcc884656379499b792 |
| preview-cybersecurity-navy-chromium-win32.png | 11437133d4ede40dc3ce7b466949e0a7a5693cecbdbef3ef09064ea249b04d6a | 8c346afd2286639fa084dfe60ef3f39191e7d3fdb729a6e146e784e5ecd56a41 |
| preview-data-analyst-navy-chromium-win32.png | 3a048411c0d026032230d46434858c1ad13823714e6f86eae978e1c26fbe0e92 | f6288a7ca15769713b0240f39fd0ced95d28542784a13eddb9a35168e094bdeb |
| preview-developer-console-navy-chromium-win32.png | a0505c1657941b0fad6d7fcd7834ab77b033a627720122e80cf883f76c65bcb6 | 85d69888d2d42633251f69935e4f21efec6655b77534026a969c79ac80829c95 |
| preview-editorial-navy-chromium-win32.png | 5308fce1232f8f0c6203beeca4e341d0faf9c5b99ef611650b37fe776b3f291d | 22a3e2524660126b4d563aae4c73b38290b0a1061a40aed3863c6d4b887d719e |
| preview-executive-banner-navy-chromium-win32.png | 6967597649c1c6cfb45a5444585259854e80674b427dc537935a0d32a2f5ece0 | 5f0b8bf704476028b87c537c3dd49afb1e2972e6c6b75404685f42307f49d6c7 |
| preview-finance-professional-navy-chromium-win32.png | 4a9194c148039647988b5ccda421afc6b742a24de7c9a2f3c22a3a16cfa77ff6 | b9df54bab4da9a906e4d0dde122d662a3ce58c3b2b99d5682cee93203a6c5aed |
| preview-geometric-accent-navy-chromium-win32.png | 91aa37ab8aadc3a648fbaaa20bdd69ca96fb119b46db8d46eb62adcca648652b | 53702c7ef8ebb928d880c013549233e1bb466f2fa09042c2d6c7bf7e94e501c7 |
| preview-leadership-profile-navy-chromium-win32.png | 70d57e42444f7155f499a673046173f9e4e1d4dc71f1c8db61ec2434ba38dad0 | 81fc77ff2f86e93336a1621ce46721dcfba500ee11f74b7cfc23912a87499f59 |
| preview-legal-formal-navy-chromium-win32.png | 54c0fd6338307bbc04cb59c673dcd14f17b8e9b847924d76fb57e2d9df073376 | 7f72d5a7ce2b69c5c2e773128c7fcde6f58d2d3365bead70988642564f905a99 |
| preview-modern-split-navy-chromium-win32.png | 24a73a85e847fcdfa2f35ff14cdf5df7b7d6f810bff8ed3cd140d11a3a3e4d36 | ed1ae4e87d28617f8ea6d04f3ab989237276bcd51626a67ddd60809a65240caf |
| preview-premium-sidebar-navy-chromium-win32.png | 941123b4553bb6a77e3228129a5e81d68d1880a01ba62682efc10efed37d6283 | 3809fff2b671b9998898b60529784d4cdd3151d146bd9d08c7b1629a8629d9d8 |
| preview-product-engineer-navy-chromium-win32.png | ffc3bc2ce991bb0b58803fac1cfd8da18a7d456d796c8b5305cb391d517b4831 | d0bdae3f1e629275b258b4428b206648733f612d3d22a2071590eea657be6beb |
| preview-soft-neutral-navy-chromium-win32.png | 0723dac17734ed09e8054fc8aa72101fad70d225f1c12f103099b97581d962ec | cc93744a9297e0caf5766b21faa92093e01b020a6fb36dd89e53796baae69e48 |
| preview-strategy-consultant-navy-chromium-win32.png | 1d953ca43113dcf3e44402435128cdf43cd5db026d6699b1eefb3050e883ba8c | 84f070ba473a75794e324a33a487cdd2c06ac5d184028ce8af1017b4c104dcd7 |
| preview-swiss-minimal-navy-chromium-win32.png | 12b82ec2eb62850da24716807a5a225216e67981dbeb6534c1f2d03b92e95095 | 647ec6567eb525d78d491e3fd5bc018b55b8837f5fbb1ec9dd1be0c9e8e71788 |

## 5. Confirmation that no other baseline changed

Pre/post SHA-256 inventory of `frontend/e2e/visual-regression.spec.ts-snapshots`
(31 files before → 31 files after, identical filenames, nothing added/deleted):

- Exactly **28** files changed — the set above.
- The remaining 3 (`1-gallery-chromium-win32.png`, `5-editor-empty-state-chromium-win32.png`,
  `7-my-resumes-chromium-win32.png`) are byte-identical.
- The separate `e2e/pagination-baselines.spec.ts-snapshots/` set was not touched.
- A SHA-256 manifest of all product/test source under `frontend/src`, `frontend/e2e`,
  `frontend/playwright.config.ts`, `backend/src`, `backend/test` before vs after snapshot
  generation shows **zero** non-snapshot changes.

## 6. Frontend verification (normal mode)

| Command | Result |
| --- | --- |
| `npm run format:check` | PASS — "All matched files use Prettier code style!" |
| `npm run lint` | PASS — 0 problems |
| `npm run build` (production) | PASS — "Application bundle generation complete" |
| `npm test` (Vitest via `ng test`) | PASS — 31 test files, **307 passed / 0 failed** |
| `npm run catalogue:check` (backend script vs frontend catalogue) | PASS — "OK: checked-in file matches the frontend catalogue (100 profiles)" |
| `npx playwright test` (complete suite, fresh servers, `--retries=0`) | PASS — **77 passed / 0 failed / 0 skipped**, exit 0 |
| visual-regression normal-mode re-run | PASS — **31 passed / 0 failed** |

## 7. Backend verification (normal mode)

| Command | Result |
| --- | --- |
| `npm run format:check` | PASS |
| `npm run lint` | PASS |
| `npm run build` (`tsc -p tsconfig.json`) | PASS |
| `npm run catalogue:check` | PASS — "OK: checked-in file matches the frontend catalogue (100 profiles)" |
| `npm test` (Vitest) | PASS — 17 files passed / 1 skipped (Oracle e2e), **166 passed / 1 skipped** |

## 8. Full Playwright normal-mode result

**77 passed · 0 failed · 0 skipped · exit code 0** (chromium + http-persistence projects).
This matches the projected inventory: 49 functional + 31 visual − 3 already-passing
previously counted among the 49 → 77 total.

## 9. Zero failures, zero retries, zero timeouts

The full-suite run used `--retries=0`, fresh servers (`reuseExistingServer: false`),
normal mode (no `--update-snapshots`). The JSON run report confirms:
0 failed, 0 timeout failures, 0 visual mismatches, no test "passed only in isolation",
no reruns required.

## 10. Create Resume and Template Preview content parity

`e2e/preview-content-match.spec.ts` (part of the 77 green tests) verifies:
- byte-identical resume HTML on the Template Preview and Create Resume pages;
- normalized body HTML, section order and visible text match on both pages;
- template CSS, A4 page frame and Fit behavior match on both pages;
- Template Preview vs Create Resume pagination parity inside the shared frame.

## 11. Create Resume right-side design unchanged

No product code, HTML, CSS or content changed during this closure. The Create Resume
baseline (`4-create-resume`) was regenerated only because the shared A4 frame/projected
render shifted the canvas; the right-side form design is unchanged and the
`preview-content-match` "Create Resume right side is unchanged vs the recorded baseline"
assertion passes.

## 12. Reliability fixes remain active

No reliability fix was modified in this closure:
- PDF: `GET /pdfz` readiness probe, `PDF_WARMUP=true` boot warm-up, lazy-launch fallback
  (`preview` unchanged) — exercised by the passing `pdf-export.spec.ts`.
- Preview readiness: `waitForPreviewReady()` gates both template-preview tests in
  `preview-controls.spec.ts` — exercised by the passing suite.

## 13. Known deferred production items

- **Live Oracle seven-step verification: BLOCKED / NOT VERIFIED.** The
  `oracle-persistence.e2e.test.ts` suite remains skipped until WSL2/Docker (Oracle
  instance) is available. This milestone is NOT complete.
- Production deployment, monitoring and backup setup are separate, deferred workstreams.
- Unfinished Job Matcher / Admin features must remain hidden or be explicitly marked out
  of MVP scope.

## Status

ResumeIQ demo/MVP is **release-candidate complete** in the scope above: every normal-mode
gate passes with zero failures, zero timeouts, zero retries. The **Oracle production
milestone is NOT complete** and remains deferred.