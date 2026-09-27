# 05 — Professional headshot

**Premium only.** Reuses the existing background removal (`removeImageBG` in `Backend/controllers/AIcontroller.js`).

## User story
I upload a normal photo of myself (a selfie or a cropped holiday photo). I get back a clean headshot: background removed, a plain studio background in a colour I choose, face centred, cropped square for LinkedIn. I download it.

## How it works (all Cloudinary, no new service)
1. Upload the photo once with the background removed: `cloudinary.uploader.upload(path, { effect: "background_removal" })`. This is the same call the existing tool makes, and it's the only step that costs a background-removal credit.
2. Generate each variant as a **URL transformation** on the uploaded image. These are free to create and cached by Cloudinary:
   - Background colour: `background: "rgb:<hex>"` (flattens the transparent area onto the colour).
   - Face crop: `crop: "thumb", gravity: "face", width: 800, height: 800, zoom: 0.75`.
   - Lighting touch-up: `effect: "improve"`.
   - Output: `fetch_format: "auto", quality: "auto"`.
3. Background presets: Light grey `F3F4F6`, Soft blue `DBEAFE`, Warm beige `F5EBDD`, Dark `1F2937`, and White `FFFFFF`.

Choosing a different background or crop **doesn't re-upload** or use another credit; only the URL changes.

## API
`POST /api/career/headshots`: multipart with an `image` field.
Middleware: `aiRateLimit`, `auth`, `planLimit("headshot", 0)` (premium only; with a limit of 0 no count is needed), `uploadImage.single("image")`. The premium check runs before the upload, so free users' files never reach the disk.

Steps:
1. Check the file is an image of at most 5MB (already done by `config/multer.js`).
2. Upload with background removal, as above.
3. Check a face was found: request the face-crop variant; if Cloudinary's face detection finds none, respond 400 "We couldn't find a face in this photo. Try a clear, front-facing photo."
4. Save to the existing `creations` table with `content_type = 'headshot'` and `content` set to the Cloudinary `public_id`, so it also appears on the dashboard.
5. Respond `{ success: true, publicId, variants: { "<preset>": "<url>" } }`.

URLs are built on the server with `cloudinary.url(publicId, {...})`, so the frontend never needs Cloudinary credentials.

## UI — `Frontend/src/pages/career/Headshot.jsx` → `/ai/headshot`
- Drop zone with tips: "Face the camera, good light, nothing covering your face."
- After processing: a large preview, colour swatches below it (switching is instant because it's just a different URL), and a **Download** button (Cloudinary `flags: "attachment"` URL).
- A "Why this matters" note: profiles with a photo get more recruiter views.
- Add `headshot` to `CATEGORIES` in `Frontend/src/pages/Dashboard.jsx` so it gets its own dashboard section.

## How to verify
- [ ] A normal selfie gives a centred square headshot on every preset background.
- [ ] Switching background doesn't upload again (check the network tab: no new API call, only a new image URL).
- [ ] A photo with no face gives the clear 400 message.
- [ ] The download saves a file instead of opening a tab.
- [ ] A free user sees the upgrade message; the API returns 403.
- [ ] The headshot appears in its own section on the dashboard.
