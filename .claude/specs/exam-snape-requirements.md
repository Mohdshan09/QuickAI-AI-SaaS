# ExamSnap — Feature Requirements

**Working name:** ExamSnape
**Tagline:** Exam-ready photo and signature in 30 seconds
**Status:** Draft v1

---

## 1. Problem

Government exam application forms (SSC, IBPS, SBI, RRB, UPSC, state PSCs) require the photo, signature and other documents in exact formats: pixel dimensions, file size ranges (e.g. 20–50 KB), JPEG format, white background, and sometimes name and date printed on the photo.

Candidates spend a long time resizing, compressing and re-uploading files, often on a phone, and forms get rejected for wrong files. Existing free resizers are generic: the user has to know the specs, and the tools don't guarantee the output passes.

## 2. Goal

The user picks an exam, uploads a phone photo, and downloads a file that is **guaranteed to meet that exam's requirements**, without knowing any specs.

### Success metrics
- Time from landing to first valid download: under 60 seconds
- Valid output rate (passes validator): 99%+
- Repeat usage: users return for a second exam
- Phase 3: free-to-paid conversion of 2%+

### Non-goals (for now)
- Filling or submitting application forms
- Storing user photos on any server
- Exam tracking or alerts (separate future product)

## 3. Target users

| User | Need |
|---|---|
| Government job aspirants (primary) | Correct files fast, mostly on low-end Android phones |
| Cyber café / CSC operators | Process many customers' documents daily (Phase 4) |

---

## 4. Phases

| Phase | Scope | Goal |
|---|---|---|
| **1. MVP** | Exam presets, crop, resize, compress, validate, download, SEO pages | Launch and get search traffic |
| **2. Quality** | Checker mode, signature cleanup, name/date strip | Beat free tools without ML |
| **3. AI + Payments** | Face auto-crop, background whitening, extra documents, accounts, Razorpay | Paid exam kits |
| **4. Business** | Batch mode, café plan, admin spec panel | Recurring B2B revenue |

---

## 5. Exam spec data

All exam requirements live as data, never hard-coded in components. Phase 1–3: static JSON in the repo. Phase 4: NeonDB table editable from admin.

### Spec format

```json
{
  "id": "ssc-cgl-2026",
  "name": "SSC CGL",
  "organization": "SSC",
  "year": 2026,
  "sourceUrl": "https://link-to-official-notification.pdf",
  "lastVerified": "2026-10-01",
  "documents": [
    {
      "type": "photo",
      "label": "Photograph",
      "format": "jpeg",
      "width": { "px": 0 },
      "height": { "px": 0 },
      "sizeKb": { "min": 0, "max": 0 },
      "aspectRatio": "w:h",
      "background": "white | light | any",
      "nameDateStrip": false,
      "notes": "Any extra rule from the notification"
    },
    {
      "type": "signature",
      "label": "Signature",
      "format": "jpeg",
      "width": { "px": 0 },
      "height": { "px": 0 },
      "sizeKb": { "min": 0, "max": 0 }
    }
  ]
}
```

- Dimensions may be given in **px** or in **cm + dpi**. Convert with `px = round(cm / 2.54 * dpi)`.
- Every value must come from the official notification. **Placeholder values above are not real specs.**
- `sourceUrl` and `lastVerified` are required for every exam and shown to the user.

### Initial exam list (Phase 1)
10–15 high-traffic exams: SSC (CGL, CHSL, MTS, GD), IBPS (PO, Clerk), SBI (PO, Clerk), RRB (NTPC, Group D), UPSC (CSE), plus 1–2 state PSCs. Also a **Custom** option where the user enters width, height and KB range manually.

---

## 6. Functional requirements

### 6.1 Exam selection (P1)
- **FR-1** Searchable exam list with popular exams on top.
- **FR-2** After selecting, show the list of required documents with their key specs in plain language ("Photo: 20–50 KB, white background").
- **FR-3** Show the official notification link and last-verified date.
- **FR-4** Custom option for unlisted exams.

### 6.2 Image input (P1)
- **FR-5** Upload from gallery or open the camera directly (`<input type="file" accept="image/*" capture>`).
- **FR-6** Support JPEG, PNG, WebP and HEIC (convert HEIC in the browser).
- **FR-7** Read EXIF orientation and auto-rotate so phone photos are upright.
- **FR-8** Downscale very large inputs (e.g. over 4000 px) before processing to keep low-end phones responsive.

### 6.3 Crop (P1)
- **FR-9** Crop UI with aspect ratio locked to the exam spec (e.g. `react-easy-crop`).
- **FR-10** Pinch-zoom, drag and rotate (90° steps plus fine rotation).
- **FR-11** For photos, show a face-position guide overlay (oval) to help framing.

### 6.4 Resize and compress (P1)
- **FR-12** Resize the cropped area to the exact pixel dimensions in the spec.
- **FR-13** Output JPEG with a white fill behind any transparency.
- **FR-14** Hit the KB range with this algorithm:
  1. Binary-search JPEG quality between 0.10 and 0.95 (max ~8 iterations) for the largest file that is ≤ `max`.
  2. If even the lowest quality is above `max`, reduce dimensions in small steps (only if the spec allows a range) and repeat.
  3. If the file is below `min` even at quality 0.95–1.0, step quality to 1.0; if still below, report it clearly (rare, happens with very plain images).
  4. Aim slightly inside the range (e.g. `min + 2 KB` to `max − 2 KB`) because some portals count KB differently (1000 vs 1024 bytes). Treat 1 KB = 1024 bytes by default and keep a safety margin.
- **FR-15** Processing must run fully in the browser (Canvas / OffscreenCanvas, Web Worker where possible).

### 6.5 Validation (P1)
- **FR-16** Validate every output against the spec: format, width, height, file size range.
- **FR-17** Show a clear checklist with ✅ / ❌ per rule before download.
- **FR-18** Download is allowed only when all checks pass (Custom mode can override with a warning).

### 6.6 Download (P1)
- **FR-19** File names like `ssc-cgl_photo.jpg`, `ssc-cgl_signature.jpg`.
- **FR-20** Show final size in KB and dimensions next to the download button.
- **FR-21** After download, prompt for the next required document of the same exam.
- **FR-22** "Download all" as a ZIP when multiple documents are done (Phase 2).

### 6.7 SEO pages (P1)
- **FR-23** One static page per exam, e.g. `/ssc-cgl-photo-signature-size`, with requirements in a table, the official link, and the tool embedded.
- **FR-24** Pre-render pages (static generation or prerender plugin) so search engines can index them. A plain client-only React SPA will not rank well.

### 6.8 Checker mode (P2)
- **FR-25** Upload an existing file and get pass/fail for each rule of the selected exam.
- **FR-26** If it fails, one tap to fix it with the normal pipeline.

### 6.9 Signature cleanup (P2)
- **FR-27** Grayscale, then adaptive threshold to get dark ink on pure white.
- **FR-28** Remove shadows and paper texture.
- **FR-29** Auto-crop to the ink bounding box with small padding, then fit to the spec.
- **FR-30** Before/after preview with a manual strength slider.

### 6.10 Name and date strip (P2)
- **FR-31** For exams that need it, add a white strip below the photo with the name and date in the required format, within the final dimensions.

### 6.11 AI features (P3, premium)
- **FR-32** Face auto-crop: detect the face (MediaPipe Face Detection in browser) and position it per spec (head size and top margin).
- **FR-33** Background whitening: segment the person and replace the background with white.
- **FR-34** Load ML models only when the user taps the feature; show model download size.
- **FR-35** Extra documents: left thumb impression and handwritten declaration, using the signature cleanup pipeline with their own specs.

### 6.12 Accounts and payments (P3)
- **FR-36** Login (phone OTP or Google).
- **FR-37** Razorpay checkout (UPI first). Verify payment via webhook on the Express backend before unlocking.
- **FR-38** Products: per-exam kit (₹19–29) unlocking AI features and ZIP download for that exam.
- **FR-39** Store only users, purchases and usage counts in NeonDB. **Never upload or store images.**

### 6.13 Business plan (P4)
- **FR-40** Batch mode: process multiple people's documents in a queue.
- **FR-41** Monthly café/CSC subscription with unlimited processing.
- **FR-42** Admin panel to add and edit exam specs in NeonDB, with `sourceUrl` and `lastVerified` required.

---

## 7. User flow (Phase 1)

```
Landing / exam SEO page
  → Select exam
  → See required documents
  → Photo: upload → crop → auto resize + compress → validation ✅ → download
  → Signature: upload → crop → auto resize + compress → validation ✅ → download
  → "Done! Need another exam?"
```

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Privacy | Images never leave the device. State this clearly on the page. |
| Performance | Process a 12 MP photo in under 3 s on a mid-range Android phone. Initial JS bundle under ~200 KB gzipped (ML models lazy-loaded). |
| Mobile first | Designed for 360 px wide screens, large touch targets, works one-handed. |
| Offline | PWA: installable, core tool works offline after first visit. |
| Browsers | Chrome Android (primary), Samsung Internet, Safari iOS, desktop Chrome/Edge. |
| Language | English and Hindi UI from Phase 1 (i18n-ready strings). |
| Accessibility | Labels on all inputs, sufficient contrast, keyboard usable on desktop. |
| Reliability | Unit tests for the image engine with a set of real phone photos and signatures. |

---

## 9. Code structure

```
src/
  engine/            # pure JS, no React, fully unit-tested
    loadImage.js     # file → bitmap, EXIF fix, HEIC convert
    crop.js
    resize.js
    compress.js      # KB-range binary search
    validate.js
    signature.js     # P2 cleanup
  specs/
    exams.json       # exam specs (P1–P3)
  components/        # React UI
  pages/             # exam SEO pages
  workers/           # Web Workers for heavy processing
```

Keep `engine/` independent of the UI so it can be tested alone and reused later in batch mode.

---

## 10. Analytics (privacy-safe)

Track events only, never images:
- `exam_selected`, `upload_started`, `crop_done`, `validation_passed`, `validation_failed` (with failing rule), `download`, `checker_used`
- Phase 3: `kit_viewed`, `payment_started`, `payment_success`

Use these to decide which exams to add and which features to build next.

---

## 11. Acceptance criteria (Phase 1)

- [ ] 10+ exams with verified specs, each with an official source link
- [ ] Rotated phone photos come out upright
- [ ] HEIC from iPhone works
- [ ] Output always matches exact pixel dimensions
- [ ] Output always lands inside the KB range for a test set of 30+ real photos and signatures
- [ ] Validation checklist shown before every download
- [ ] Nothing is uploaded to any server (verified in browser network tab)
- [ ] Works on a low-end Android phone
- [ ] Exam SEO pages are pre-rendered and indexable

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Wrong or outdated spec causes rejection | Source link + last-verified date per exam; re-verify when a new notification releases |
| Portals measure KB differently | Safety margin inside the range (FR-14) |
| Free competitors | Exam presets, guaranteed validation, signature cleanup, Hindi UI |
| Premium gating bypassable (client-side) | Accept it at ₹19–29 price point; value is convenience |
| ML models too heavy on mobile data | Lazy-load, show size, keep non-AI flow fully usable |

---

## 13. Open questions

- Final product name and domain availability
- Hindi from day one, or English first with Hindi in Phase 2?
- Standalone site, or a section inside another product later?
- Which state PSCs to cover first?
