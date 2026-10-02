# ExamSnap by Quick AI

Exam-ready photo & signature in 30 seconds. Pick an exam, upload a phone photo, download a
file **guaranteed** to meet that exam's exact pixel size, KB range and format — all **in the
browser**. No backend, no login, and images never leave the device.

Standalone Vite app, served on the same domain as Quick AI under `/examsnap/` (see
`deploy/README-rewrites.md`).

## Scripts

```bash
npm install
npm run dev       # local dev server
npm run build     # generates sitemap + prerenders every page to static HTML (vite-react-ssg)
npm run preview   # preview the production build
npm test          # engine + specs unit tests (Vitest)
npm run lint
```

> Heavy libs are loaded via dynamic `import()` so they land in their **own chunk**, not the
> initial bundle:
> - `heic2any` (installed) — iPhone HEIC conversion; its ~1.3 MB chunk loads only when a HEIC
>   file is actually uploaded.
> - `client-zip` — Phase 2 "Download all" ZIP; install when wiring that path (`npm i client-zip`).

## Architecture

- `src/engine/` — **pure JS, framework-free**, fully unit-tested, reused by Phase 2 and future
  batch mode. Stable contracts: `loadImage → cropToCanvas → resizeToSpec → compressToRange →
  validate`, orchestrated by `process()`.
  - `compress.js` hits the KB range with a binary search over JPEG quality (and optional
    dimension step-down when a spec allows a size range), aiming *inside* the range for
    portal KB-rounding safety (spec §FR-14).
- `src/specs/` — exam specs as static JSON (schema per spec §5); `loadSpecs.js` resolves
  cm/dpi→px and is the single seam a future DB/admin source would replace.
- `src/workers/` — the pipeline runs in a Web Worker (OffscreenCanvas) with a main-thread
  fallback (`src/lib/processClient.js`).
- `src/components/`, `src/pages/` — mobile-first UI; the interactive tool is a client-only,
  lazy-loaded chunk so exam pages prerender to clean HTML.
- `src/i18n/` — tiny `t()` + locale JSON. English ships now; `locale/hi.json` is a Phase-2
  drop-in (falls back to English per missing key).

## ⚠ Exam specs must be verified

The shipped exam JSON files (`src/specs/exams/*.json`) are **templates flagged
`"verified": false`** and the UI shows a warning for them. Per the spec (§5, §FR-* , §11),
every real exam needs its **exact** dimensions/KB taken from the **official notification**,
with a real `sourceUrl` (the notification) and `lastVerified` date, then `"verified": true`.
**Do not rely on the placeholder numbers.** Custom mode works today with no preset data.

Adding a verified exam = drop in a JSON file (no code change); it is auto-added to the list,
sitemap, and prerendered pages.

## Roadmap

- **Milestone 1 (Phase 1 MVP) — done:** presets + crop + resize/compress + validate + download,
  SEO prerender, PWA, i18n scaffold, analytics.
- **Milestone 2 (Phase 2) no-ML core — done:** composable `engine/pipeline.js` + pure
  `engine/analyze/*`; checker mode (`engine/checker.js`, `/check/<exam>` pages, real-format
  detection via magic bytes, "Fix it"); signature/thumb/declaration cleanup
  (`engine/steps/signatureClean.js`); background check + no-ML brighten
  (`engine/steps/background/*`); name/date strip (`engine/steps/strip.js`); ZIP + kit progress
  with IndexedDB resume (`engine/zip.js`, `lib/kitStore.js`).
- **Image quality (pre-launch set) — done:** pica Lanczos3 resize + thresholded unsharp (replaces
  blurry `drawImage`), full-budget JPEG search (q≈0.30–1.0, highest quality under the KB cap, single
  encode from one lossless source), never-upscale warning, below-min KB padding via JPEG `COM` segments
  (`engine/encode/padJpeg.js`), and 100%/200% + before/after preview.
- **Deferred (seams in place):** image-quality **Phase-2 pass** (MozJPEG WASM encoder, per-document
  chroma/grayscale, denoise, SSIM guard + regression baseline); 2c **Tier 3** MediaPipe background
  replacement; **2f Hindi** UI + `/hi/` SEO pages (needs human-reviewed translations). Portal check
  pending: confirm COM-padded JPEGs are accepted on 2–3 real exam portals before relying on padding.
