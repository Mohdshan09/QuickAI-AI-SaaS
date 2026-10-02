# Deploying ExamSnap under quickai.com/examsnap/ (Vercel)

ExamSnap is a **separate Vercel project** from `Frontend/` and `Backend/`. Users see one domain:
the main site proxies `/examsnap/*` to the ExamSnap deployment. This keeps ExamSnap's lightweight,
no-Clerk bundle isolated and the SEO under the main domain (subfolder, not subdomain).

## How the pieces fit

- ExamSnap builds with Vite `base: '/examsnap/'`, so every asset/route URL is `/examsnap/…`.
- `npm run build:vercel` runs the normal build **and** `scripts/nest-dist.mjs`, which moves the output
  into `dist/examsnap/`. Vercel serves `dist/` at the project root, so `/examsnap/…` URLs resolve to the
  nested files — assets, prerendered pages, `sw.js` (its scope is `/examsnap/`), sitemap, all consistent.
- `ExamSnap/vercel.json` sets `buildCommand`, `outputDirectory: dist`, and `cleanUrls` (so
  `/examsnap/ssc-cgl-photo-signature-size` serves `…/ssc-cgl-photo-signature-size.html`).

## Step 1 — Deploy the ExamSnap project

1. Create a new Vercel project with **Root Directory = `ExamSnap`**.
2. It picks up `ExamSnap/vercel.json` automatically (build `npm run build:vercel`, output `dist`).
3. Deploy. Note its production domain, e.g. `examsnap-xyz.vercel.app`. Verify
   `https://examsnap-xyz.vercel.app/examsnap/` loads and a page like
   `/examsnap/ssc-cgl-photo-signature-size` renders.

## Step 2 — Point the main site at it

In `Frontend/vercel.json`, replace `REPLACE-WITH-EXAMSNAP-DOMAIN` with the domain from step 1
(no scheme in the token — it already has `https://`). The two `/examsnap` rules sit **before** the SPA
catch-all so they win:

```json
{
  "rewrites": [
    { "source": "/examsnap", "destination": "https://examsnap-xyz.vercel.app/examsnap" },
    { "source": "/examsnap/(.*)", "destination": "https://examsnap-xyz.vercel.app/examsnap/$1" },
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

Redeploy `Frontend`. Now `https://quickai.com/examsnap/…` serves ExamSnap on the main domain.

## Build commands

| Command | Use |
|---|---|
| `npm run build` | Local/CI build (un-nested; works with `npm run preview` at `/examsnap/`) |
| `npm run build:vercel` | Production build for Vercel (nests `dist/` under `dist/examsnap/`) |

Set `SITE_URL=https://quickai.com/examsnap` in the ExamSnap project's env so `sitemap.xml` and
canonicals use the production origin (defaults to that value).

## SEO notes (subfolder)

- Canonicals and the sitemap already use `https://quickai.com/examsnap/…`.
- `robots.txt` lives at `/examsnap/robots.txt`. Search engines read `robots.txt` at the **domain root**,
  so add a `Sitemap: https://quickai.com/examsnap/sitemap.xml` line to the main site's root
  `robots.txt`, or submit the sitemap directly in Google Search Console.

## Other hosts

Not on Vercel? The same idea works with Nginx (serve `dist/examsnap/` under `location /examsnap/`) or
Netlify (`_redirects` proxy `/examsnap/* https://<examsnap-site>/examsnap/:splat 200`). Ask if you need
one of those written out.
