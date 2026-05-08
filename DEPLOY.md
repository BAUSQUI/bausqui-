# Deploying to Vercel

## TL;DR
1. Compress / move videos so `public/` is under ~250 MB
2. Push the repo to GitHub
3. Import the repo in Vercel — it will auto-detect Vite

The project is already configured for Vercel via `vercel.json`. No further code changes needed.

---

## Step 1 — Shrink `public/`

Vercel limits:
- **Hobby (free):** 100 MB per file, ~250 MB total deploy
- **Pro:** 300 MB per file

Current state of `public/videos/`:

| File | Size |
| --- | --- |
| `PortfolioVideo.mp4` | 1.27 GB |
| `poseido.mp4` | 1.21 GB |
| `TAHADIS.mp4` | 798 MB |
| `Arena.mp4` | 289 MB |
| `SOMA.mp4` | 187 MB |
| `mutante.mp4`, `ghost.mp4` | ~100 MB each |
| `papotta.mp4`, `tiempo_real.mp4` | <100 MB |

### Option A — Compress in place

Recompress each video for the web. Web-friendly target: **10–25 MB per video, 1080p, H.264**:

```
ffmpeg -i input.mp4 -vcodec libx264 -crf 26 -preset slow -movflags +faststart -vf "scale='min(1920,iw)':-2" -c:a aac -b:a 128k output.mp4
```

Run for every file in `public/videos/`. After this, most should fit on Hobby. If `PortfolioVideo`, `poseido`, or `TAHADIS` are still too large, drop bitrate harder (`-crf 30`) or scale to 720p (`scale='min(1280,iw)':-2`).

### Option B — Host the big ones externally

Cheap external CDN options:

- **Cloudflare R2** — free 10 GB egress/month, S3-compatible. Public bucket → URLs like `https://pub-XXXX.r2.dev/Arena.mp4`
- **Bunny.net Stream** — purpose-built for video, ~$1/mo for low traffic, has adaptive streaming
- **Vercel Blob** — same dashboard, $0.15/GB stored

After uploading, change the URLs in two places:

```js
// src/main.js — proyectos[].video / video360
video: 'https://pub-XXXX.r2.dev/Arena.mp4'
```

```html
<!-- index.html — card data-video for hover previews -->
<article ... data-video="https://pub-XXXX.r2.dev/Arena.mp4">
```

Add CORS on the bucket so the videos can be fetched cross-origin (R2 → Settings → CORS Policy):

```json
[{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"] }]
```

### Option C — Hybrid (recommended)

1. Compress everything with the ffmpeg command above
2. Anything still > 50 MB → upload to R2 / Bunny
3. Update those URLs only

---

## Step 2 — Push to Git

```bash
cd mi-portfolio
git init                       # if not already a repo
git add .
git commit -m "Prepare for Vercel deploy"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.gitignore` already excludes `node_modules` and `dist`. Be aware: if the videos are still in `public/videos/` they will be in the commit and will get pushed to GitHub. GitHub limits files to **100 MB** — push will fail on the bigger ones. So the compression / external-hosting step needs to happen before the push.

---

## Step 3 — Import on Vercel

1. Go to https://vercel.com/new
2. Pick your GitHub repo
3. Vercel will auto-detect Vite. The settings should already match `vercel.json`:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Click **Deploy**.

First build takes ~1–2 minutes. Subsequent pushes auto-deploy.

---

## Custom domain — bausqui.com

1. **Vercel dashboard → Project → Settings → Domains**
2. Add `bausqui.com` *and* `www.bausqui.com`
3. Vercel will show you the DNS records to add. There are two normal patterns:

   **Option A — point your domain's DNS at Vercel directly** (simplest):

   At your domain registrar (where you bought bausqui.com), go to DNS settings and add these records:

   | Type | Name | Value | TTL |
   | --- | --- | --- | --- |
   | A | `@` | `76.76.21.21` | Auto |
   | CNAME | `www` | `cname.vercel-dns.com` | Auto |

   Vercel always uses `76.76.21.21` for apex (root) domains.

   **Option B — change nameservers** (only if you want Vercel to manage all DNS):

   At your registrar, change nameservers to:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```

4. Pick which version is canonical — go back to **Vercel → Domains** and choose either `bausqui.com` or `www.bausqui.com` as the primary. Vercel will auto-redirect the other one.

5. SSL certificates are issued automatically — usually within 5–15 minutes after DNS propagates. You can refresh the Domains page to watch it go from "Invalid Configuration" → "Valid Configuration".

DNS propagation can take 1–24 hours but is usually under an hour. Test with `nslookup bausqui.com` from a terminal — when it returns Vercel's IP, you're live.

---

## Things to verify after first deploy

- [ ] Music plays (browser may require a click first — already handled)
- [ ] All project videos load on hover and on click
- [ ] About section background `.webm` plays with transparency
- [ ] Manuals (`pdf/<project>/01.png`...) load
- [ ] ARENA YouTube embed plays
- [ ] TAHADIS 360° viewer renders (depends on TAHADIS.mp4 size)
- [ ] Loader hits 100% and fades out
- [ ] Favicon shows the new icon

---

## What's already configured

- **`vercel.json`** — long-term immutable cache for media + fonts, no-cache on `index.html` so updates ship instantly
- **`package.json`** — fixed: `three` was missing, now declared
- **`vite build`** outputs to `dist/`, which Vercel serves
- **`public/`** — anything in here is copied verbatim into the deploy and served from `/`
