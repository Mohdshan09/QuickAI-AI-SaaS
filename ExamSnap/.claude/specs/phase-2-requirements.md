# ExamSnap — Phase 2 Requirements

**Product:** ExamSnap by Quick AI (served at `/examsnap/`)
**Phase:** 2 (Milestone 2)
**Status:** Draft v1
**Depends on:** Phase 1 launched with verified exam specs
**Constraints:** Fully client-side. No backend, no accounts, no payments. Images never leave the device.

---

## 1. Goal

Make ExamSnap clearly better than free resizers by fixing the problems that actually cause form rejections: wrong file format, poor signature photos, non-white backgrounds, and missing name/date strips. Tie all documents for an exam into one guided kit.

### Success metrics
- Kit completion rate (all required documents for an exam downloaded) increases vs Phase 1
- Checker "Fix it" → passing file rate: 95%+
- Signature cleanup used on 40%+ of signature uploads
- Background whitening output passes the background check: 95%+
- Hindi pages receive measurable organic traffic within 2 months of launch

### Out of scope
- Accounts, payments, premium gating (Phase 3)
- Face auto-crop and head positioning (Phase 3)
- Batch / café mode, admin spec panel (Phase 4)
- PDF tools such as images-to-PDF (possible Phase 2.5, demand-driven)

---

## 2. Milestones

| Step | Feature | Rough effort |
|---|---|---|
| 2.0 | Engine refactor into composable pipeline + `analyze/` module | 1–2 days |
| 2a | Checker mode | 2–3 days |
| 2b | Signature cleanup, thumb impression, handwritten declaration | ~1 week |
| 2c | White background (3 tiers) | 1–1.5 weeks |
| 2d | Name and date strip | 2–3 days |
| 2e | ZIP download and kit progress | 1–2 days |
| 2f | Hindi UI and Hindi SEO pages | 3–4 days |

Each step ships independently. Reorder 2b–2e based on Phase 1 analytics if needed. Hindi stays last because UI strings must be stable first.

---

## 3. Engine architecture (2.0)

Refactor the engine into a pipeline of pure steps operating on `ImageData` inside the Web Worker:

```
load → preprocess(type) → crop → background → strip → resize → compress → validate
```

- `preprocess(type)`: `photo` (no-op), `signature`, `thumb`, `declaration`
- `background`: photo only, runs only when the spec requires a white/light background or the user requests it
- `strip`: photo only, runs only when the spec defines a strip
- Each step is independently unit-testable and skippable

### New folders

```
src/engine/
  pipeline.js          # composes steps per document type
  steps/
    signatureClean.js
    background/
      check.js
      brighten.js      # Tier 2, no ML
      segment.js       # Tier 3, MediaPipe, lazy-loaded
      refineMask.js
    strip.js
  analyze/
    magicBytes.js
    blur.js
    background.js
    exposure.js
    inkRatio.js
  zip.js
```

`engine/` must stay free of React imports.

### Spec schema additions

```json
{
  "type": "photo",
  "background": "white | light | any",
  "strip": {
    "heightPx": 0,
    "lines": ["name", "date"],
    "dateFormat": "DD-MM-YYYY",
    "case": "upper"
  }
}
```

```json
{ "type": "thumb", "label": "Left thumb impression", "...": "same size fields as signature" }
{ "type": "declaration", "label": "Handwritten declaration", "...": "same size fields as signature" }
```

- `strip` is optional and only added for exams whose notification requires it, with the notification page noted in `notes`.
- Placeholder values are not real specs. Every value comes from the official notification.

---

## 4. Requirements

### 4.1 Checker mode (2a)

**Hard checks (pass/fail, from spec):**
- **P2-FR-1** Detect the real file format from file bytes (magic bytes), not the extension. A PNG renamed to `.jpg` must fail.
- **P2-FR-2** Width, height and KB range, using exactly the same logic as the Phase 1 validator.

**Soft checks (warnings, never blocking):**
- **P2-FR-3** Blur (variance of Laplacian below threshold).
- **P2-FR-4** Background not white enough (mean brightness and uniformity of border pixels), only for specs requiring white/light background.
- **P2-FR-5** Too dark or overexposed (histogram).
- **P2-FR-6** Signatures: ink ratio too low or too high, non-white paper.

**UI:**
- **P2-FR-7** Plain-language result per rule: ✅ pass, ❌ fail, ⚠️ warning.
- **P2-FR-8** "Fix it" button loads the file into the normal pipeline with the selected exam preset.
- **P2-FR-9** Separate entry point (tab) plus prerendered SEO page per verified exam, e.g. `/examsnap/check/ssc-cgl-photo`.

### 4.2 Signature cleanup (2b)

**Pipeline:**
- **P2-FR-10** Compute parameters on a downscaled working copy, apply at full resolution.
- **P2-FR-11** Grayscale.
- **P2-FR-12** Shadow flattening: estimate background with a large blur, divide the image by it.
- **P2-FR-13** Adaptive threshold (Bradley or Sauvola via integral image, linear time).
- **P2-FR-14** Soft edges: pixels near the threshold map to a gray ramp instead of pure black/white, to avoid jagged strokes after downscaling.
- **P2-FR-15** Speck removal: drop connected components below an area limit.
- **P2-FR-16** Auto-crop to the ink bounding box with padding.
- **P2-FR-17** Fit to spec aspect ratio by letterboxing with white. Never stretch.

**Controls:**
- **P2-FR-18** Before/after toggle.
- **P2-FR-19** Strength slider mapped to threshold sensitivity.
- **P2-FR-20** Ink option: keep original ink color, or pure black.
- **P2-FR-21** "Thicken" option: 1 px dilation for thin strokes that would vanish at small sizes.

**Edge cases:**
- **P2-FR-22** Faint ink: if ink ratio after threshold is very low, auto-lower the threshold and suggest retaking the photo.
- **P2-FR-23** Ruled paper: detect and remove long horizontal lines (stretch goal). Upload tips tell users to sign on plain white paper.

**Thumb impression and declaration:**
- **P2-FR-24** Thumb impression uses the same pipeline with a gentler threshold to preserve ridge detail.
- **P2-FR-25** Handwritten declaration uses an even gentler threshold, prioritizing text readability over a pure white background.

### 4.3 White background (2c)

**Tier 1: Check**
- **P2-FR-26** Reuse `analyze/background.js`. If the photo already passes, skip all processing.

**Tier 2: Brighten plain backgrounds (no ML)**
- **P2-FR-27** Flood-fill from the image borders by color similarity to find the background region; push it to pure white with a soft edge.
- **P2-FR-28** Leak detection: if the filled region covers too much of the image or reaches the face area, discard the result and offer Tier 3.

**Tier 3: Replace background (in-browser ML)**
- **P2-FR-29** MediaPipe Image Segmenter with the selfie segmentation model.
- **P2-FR-30** Lazy-load only when the user taps "Make background white". Show the combined download size (model + WASM runtime) before loading.
- **P2-FR-31** Cache model and runtime via the service worker so it works offline after first use.
- **P2-FR-32** Run in the Web Worker using the CPU delegate.

**Mask quality:**
- **P2-FR-33** Upscale the low-resolution mask smoothly to the cropped image size.
- **P2-FR-34** Refine edges against the full-resolution image (guided filter) so hair edges follow the real outline.
- **P2-FR-35** Feather the mask edge by a few pixels.
- **P2-FR-36** Remove color spill: pull edge pixel colors toward nearby foreground colors so no tint from the old background remains.
- **P2-FR-37** Composite onto pure white `#FFFFFF`.

**Order:** runs after crop (fewer pixels, face fills more of the model input, better mask).

**User protection:**
- **P2-FR-38** Change only the background. No face smoothing, brightening or retouching.
- **P2-FR-39** Warn if clothing near the shoulders is close to white (low contrast).
- **P2-FR-40** If no face or more than one person is detected, stop and ask for a different photo.
- **P2-FR-41** Upload tip: "Best results: stand in front of a plain wall in daylight."
- **P2-FR-42** Before/after toggle.

### 4.4 Name and date strip (2d)

- **P2-FR-43** Only applied when the exam spec defines `strip`.
- **P2-FR-44** Photo area shrinks so the total output dimensions stay exactly as specified.
- **P2-FR-45** Black text on white, sans-serif, auto-sized to fit. Long names shrink, then wrap to two lines.
- **P2-FR-46** Date defaults to today, editable, formatted per `dateFormat`.
- **P2-FR-47** Devanagari names supported via a lazy-loaded subset of Noto Sans Devanagari.
- **P2-FR-48** Name and date are never sent anywhere.

### 4.5 ZIP download and kit progress (2e)

- **P2-FR-49** Kit progress per exam: "2 of 4 documents ready" with a checklist.
- **P2-FR-50** "Download all" creates a ZIP using fflate in STORE mode (JPEGs are already compressed).
- **P2-FR-51** ZIP includes `checklist.txt` with each file's name, dimensions and size.
- **P2-FR-52** Processed files held in memory, or in IndexedDB if the user leaves mid-kit. Cleared when the kit is finished or explicitly reset. Privacy note updated to say so.
- **P2-FR-53** Individual downloads remain available (iOS saves ZIPs to the Files app, which confuses some users).

### 4.6 Hindi (2f)

- **P2-FR-54** All UI strings translated to Hindi with human review, not raw machine translation. Familiar terms (KB, upload, download) stay in English.
- **P2-FR-55** Language toggle, choice persisted locally.
- **P2-FR-56** Prerendered Hindi pages at `/examsnap/hi/...` for every verified exam and checker page.
- **P2-FR-57** `hreflang` tags linking English and Hindi versions; both included in the sitemap.
- **P2-FR-58** Devanagari font loaded only on Hindi pages.

---

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Privacy | Still zero network requests for image data. ML model download is the only new request, and it contains no user data. |
| Bundle | Initial JS stays under 200 KB gzipped. Segmentation model, WASM runtime, ZIP library and Devanagari font are all lazy-loaded. |
| Performance | Signature cleanup under 2 s and background replacement under 5 s on a mid-range Android phone. |
| Offline | All non-ML features work offline. ML works offline after first use. |
| Accessibility | Sliders and toggles labeled, keyboard usable on desktop. |

---

## 6. Test fixtures

Browser-mode Vitest with real images (stored in repo, no personal photos of real people without consent):

| Set | Size | Must cover |
|---|---|---|
| Signatures | 20+ | Shadows, yellow paper, ruled paper, faint pen, blue ink, tilted |
| Thumb impressions | 5+ | Light and heavy ink |
| Declarations | 5+ | Different handwriting, lighting |
| Background photos | 20+ | White wall, gray wall, colored wall, room clutter, outdoors, white shirt |
| Checker files | 10+ | Renamed PNG, oversized, undersized, wrong dimensions, blurry |

---

## 7. Acceptance criteria

**Checker (2a)**
- [ ] Renamed PNG detected as wrong format
- [ ] Hard checks match Phase 1 validator results exactly on the fixture set
- [ ] "Fix it" produces a passing file for every hard-check failure in the fixture set

**Signature, thumb, declaration (2b)**
- [ ] Background near-white and no visible shadows across the signature fixture set
- [ ] Signatures stay legible at the smallest spec dimensions
- [ ] Faint-ink case triggers auto-adjust and retake suggestion
- [ ] All outputs pass validation

**Background (2c)**
- [ ] Border regions pass the background check across the photo fixture set
- [ ] No visible halo or colored fringe around hair and shoulders
- [ ] Pixels inside the face region unchanged
- [ ] Plain-wall photos handled by Tier 2 without loading the model
- [ ] Model works offline after first download
- [ ] Initial bundle still under 200 KB gzipped

**Strip (2d)**
- [ ] Output dimensions match spec exactly with strip applied
- [ ] Text readable at the smallest spec size
- [ ] Strip appears only for exams that define it

**ZIP and kit (2e)**
- [ ] ZIP opens on Android, iOS and desktop
- [ ] Kit state survives leaving and returning mid-flow, and clears on finish/reset

**Hindi (2f)**
- [ ] No untranslated strings in Hindi mode
- [ ] Hindi pages prerendered, in sitemap, with correct `hreflang`

---

## 8. Analytics (events only, never images or names)

`checker_result` (with failing rule), `signature_clean_used` (strength value), `thicken_used`, `background_tier_used` (1/2/3), `background_model_loaded`, `strip_used`, `zip_download`, `kit_completed`, `language`

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Threshold erases faint signatures | Ink-ratio check, auto-adjust, before/after preview |
| Background mask cuts hair or leaves halo | Guided-filter refinement, feathering, spill removal, before/after preview |
| Edited photos rejected by portals | Only background changes, face untouched, tips favor good source photos |
| Model download too heavy on mobile data | Tier 2 handles common cases, size shown before download, cached after first use |
| Strip rules misread | Only enabled per exam with notification page noted |
| Hindi translation errors | Human review before publishing |
| Scope creep | New ideas go to a backlog until Phase 2 ships |

---

## 10. Phase 3 notes

- Tier 2 brightening stays free; Tier 3 ML background replacement becomes part of the paid exam kit
- Face auto-crop reuses the segmentation and face detection work from 2c
