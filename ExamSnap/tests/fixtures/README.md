# Test fixtures (Phase 2, spec §6)

Drop **real** sample images here for the browser-mode acceptance suites. Keep them small and
**never commit photos of real people without consent**.

| Folder | Count | Must cover |
|---|---|---|
| `signatures/` | 20+ | shadows, yellow/ruled paper, faint pen, blue ink, tilted |
| `thumbs/` | 5+ | light and heavy ink |
| `declarations/` | 5+ | different handwriting, lighting |
| `backgrounds/` | 20+ | white/gray/colored wall, clutter, outdoors, white shirt |
| `checker/` | 10+ | renamed PNG, oversized, undersized, wrong dimensions, blurry |

The node unit tests (`src/**/*.test.js`) need no fixtures — they use crafted byte arrays and
synthetic `ImageData`. The browser-mode pipeline/acceptance tests read these folders; until
they're populated they are skipped.
