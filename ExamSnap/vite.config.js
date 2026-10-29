import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { SITE_URL, BASE } from "./scripts/site.mjs";

// `base` comes from SITE_URL (scripts/site.mjs): "/" when the app is its own domain, or a
// subfolder path like "/examsnap/" when it is mounted under another site. The same origin is
// injected as __SITE_URL__ for canonicals, Open Graph tags and JSON-LD (src/lib/site.js).
export default defineConfig({
  base: BASE,
  define: { __SITE_URL__: JSON.stringify(SITE_URL) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      // Offline-first app shell so the core tool keeps working after the first visit.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
      manifest: {
        name: "ExamSnap by Quick AI",
        short_name: "ExamSnap",
        description:
          "Exam-ready photo and signature in 30 seconds. Pick your exam, upload, download a file guaranteed to fit.",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        scope: BASE,
        start_url: BASE,
        // SVG icon avoids shipping binary placeholders; for best install UX on Android,
        // generate 192/512 PNGs (e.g. `@vite-pwa/assets-generator`) and add them here.
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  // Keep the Web Worker as an ES module so it can import the shared engine modules.
  worker: { format: "es" },
  test: {
    // Pure-logic engine tests run in node; canvas/pipeline tests opt into browser mode
    // via their own `// @vitest-environment` or a separate project config (see tests/).
    environment: "node",
    include: ["src/**/*.test.{js,jsx}", "api/**/*.test.js"],
  },
});
