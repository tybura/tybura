# Build-an-auto-publishing-collection-site — instructions for Claude

> **How to use this document:** paste it into Claude Code (or Claude) at the start of a session. Claude: this document is your build guide. The user wants a website mechanically identical to tybura.com/junk — a personal collection page where **publishing = sending one photo to a private Telegram bot**, with everything else fully automated. The *content/theme* of their site will differ; adapt names, copy, and categories to their purpose, keep the mechanics. Work in phases (below), verify each phase end-to-end before the next, and speak the user's language. The user may be non-technical: when a step happens outside code (BotFather, Vercel dashboard, tokens), give exact click-by-click steps and wait for them to confirm. NEVER ask the user to paste secrets into chat if avoidable; have them put tokens directly into Vercel env vars.

## What gets built

A static gallery site where the owner publishes items by sending a photo (with optional caption = title) to their own Telegram bot. A serverless function then, with zero human steps:

1. removes the photo's background (Figma-quality cutout),
2. crops away the transparent padding,
3. resizes/compresses (WebP, full + thumbnail),
4. auto-classifies the object into a category (vision model),
5. reads EXIF GPS if present and reverse-geocodes it to a text label,
6. commits image + thumbnail + a metadata JSON **into the site's git repo** in one atomic commit,
7. which triggers the host's auto-deploy — the item is live ~2 minutes after sending.

The bot replies with the processed cutout + detected category. Replying `/delete` removes an item (a delete commit). `/stats` reports collection stats and cost. Total running cost: **~$0.001 per published item**; hosting/bot/repo are free.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Site | **Astro** (fully static output) | fast, zero-JS by default, content collections give typed metadata |
| Hosting | **Vercel** (free hobby) | auto-deploys on push to `main`; also hosts the serverless function in the same repo (`/api` folder at repo root works alongside Astro) |
| Inbox | **Telegram bot** (free, via @BotFather) | the "absurdly simple" upload UI — it's just a chat |
| Background removal | **Replicate** model `851-labs/background-remover` (~$0.0005/img) | excellent quality, pay-per-use, no subscription |
| Categorization | **Replicate** model `anthropic/claude-4.5-haiku` with `image` input (~$0.0005/img) | same API token as above; classifies into a fixed category list |
| Image processing | **sharp** (npm) in the function | `.trim()` = crop transparent padding; resize; WebP encode; `.stats().dominant` = dominant color; `.metadata().exif` for GPS |
| EXIF | **exif-reader** (npm) | parse GPS from `sharp().metadata().exif` |
| Geocoding | **Nominatim** (OpenStreetMap, free) | reverse lat/lng → "Street, City" label; needs a User-Agent header |
| Storage/DB | **none — the git repo is the database** | images in `public/<collection>/`, one JSON per item in `src/content/<collection>/`; versioned, free, trivial rollback |

Why commit-to-repo instead of S3 + database: the site is already a static build deployed from GitHub, so committing files adds zero infrastructure, and at personal scale (hundreds of items, 100–300 KB each) repo size is a non-issue.

## Architecture

```
Owner (Telegram app)
   │  photo (+ caption = title); "send as File" preserves EXIF/GPS
   ▼
Telegram Bot ──webhook──▶ /api/telegram.js  (Vercel serverless function)
                             │ 0. check x-telegram-bot-api-secret-token header
                             │ 1. sender id must equal ALLOWED_TELEGRAM_USER_ID
                             │ 2. download photo via Telegram file API
                             │ 3. EXIF GPS? → Nominatim → location label
                             │ 4. Replicate background-remover → transparent PNG
                             │ 5. sharp: trim → ≤1600px WebP q85 + 480px thumb q80
                             │ 6. sharp stats → dominant color
                             │ 7. Replicate claude-4.5-haiku → category word
                             │ 8. ONE git commit via GitHub Git Data API:
                             │      public/<coll>/<slug>.webp, <slug>-thumb.webp,
                             │      src/content/<coll>/<slug>.json
                             │ 9. sendPhoto confirmation (cutout + category + slug)
                             ▼
push to main ──▶ Vercel rebuild ──▶ site updated (~2 min)
```

Metadata JSON per item:

```json
{
  "title": "Parking sign",
  "date": "2026-08-13T05:35:50.000Z",
  "image": "/junk/20260813-7cl3.webp",
  "thumb": "/junk/20260813-7cl3-thumb.webp",
  "width": 573, "height": 627,
  "color": "#680808",
  "category": "sign",
  "location": "Grove Street, San Francisco", "lat": 37.775, "lng": -122.4458
}
```

## Build order (verify each phase before the next)

### Phase 1 — the gallery page (no pipeline yet)

1. In the user's Astro project (or `npm create astro@latest`), define a content collection with the schema above (`location/lat/lng/color/category` optional; use `glob({ pattern: "*.json", base: "./src/content/<coll>" })`).
2. Build the page: responsive grid (e.g. 5/3/2 columns), each cell a fixed square frame with the cutout `position:absolute` inside (don't rely on `aspect-ratio` alone — intrinsic tall images stretch the box), caption = title + date, lazy-loaded images with a fade-in IntersectionObserver.
3. Lightbox: a native `<dialog>`; ←/→ keys + Prev/Next buttons navigate without closing; show the clicked item's *thumbnail instantly* and swap in the full image when loaded (otherwise the previous item lingers visibly); preload neighbors. `dialog { margin:auto }` if you use a global `margin:0` reset. On `close`, blur the active element (Chrome restores focus with an ugly ring); suppress `:focus:not(:focus-visible)` outlines.
4. Category dropdown: don't use a native `<select>` (ugly) — a button + absolutely-positioned option list styled like the site; filtering toggles `display` and updates the count and the lightbox's item order.
5. Seed 2–3 placeholder items by hand so the page renders; delete them once real items flow.

### Phase 2 — the pipeline

1. **Bot**: @BotFather → `/newbot` → save the token. Get the owner's numeric id from @userinfobot.
2. **Replicate**: create account, API token, **add ≥$5 credit** (below $5 the API is throttled to burst-1/min, which breaks back-to-back calls — code must retry 429s after ~11s anyway).
3. **GitHub token**: fine-grained PAT, ONLY the site repo, permission Contents: Read & write.
4. **Function** `api/telegram.js` at repo root (Vercel picks it up next to Astro; add `vercel.json` with `{"functions":{"api/telegram.js":{"maxDuration":60,"memory":1024}}}`; `sharp` + `exif-reader` in dependencies).
   Key implementation facts learned the hard way:
   - Always answer the webhook 200 (even on errors) or Telegram re-delivers; report failures by messaging the owner instead.
   - Community Replicate models 404 on the model-named predictions endpoint → resolve `latest_version.id` via `GET /v1/models/<owner>/<name>` then `POST /v1/predictions` with `{version, input}`. Official models (like `anthropic/*`) work with `POST /v1/models/<owner>/<name>/predictions`. Use header `Prefer: wait=55`, and still poll `prediction.urls.get` if status isn't terminal.
   - Anthropic models on Replicate require **`max_tokens ≥ 1024`** (422 otherwise) and return output as an array of string chunks — join them. Prompt: "Classify the object in this photo into exactly one of: <list>. Reply with only the single category word." Validate the word against the list; fall back to `"misc"`. Classification must NEVER block publishing — wrap in try/catch.
   - Retry Replicate 429s (sleep ~11s, up to 3×).
   - One atomic commit via the **Git Data API** (get ref → get commit → create blobs (base64) → create tree with `base_tree` → create commit → PATCH ref). For deletes, tree entries with `sha: null`. Contents API would make one commit (and one deploy) per file.
   - `sendPhoto` with multipart FormData/Blob (Node 18+ globals) to return the processed preview.
   - Slug: `YYYYMMDD-<4 random chars>`; confirmation message must contain `slug: <slug>` so `/delete` (as a reply) can parse it.
   - Sanitize env vars (strip non-digits from the allowed-user id — people paste "ID: 123456").
   - Telegram strips EXIF from compressed *photos*; GPS only survives *File* sends. Handle `message.document` with image mime type as well as `message.photo`.
5. **Env vars in Vercel** (Production): `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_ID`, `REPLICATE_API_TOKEN`, `GITHUB_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (random hex). Redeploy after adding.
6. **Webhook**: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PRODUCTION-DOMAIN>/api/telegram&secret_token=<SECRET>"`.
   ⚠️ **Use the exact production domain.** If the apex redirects to `www.` (Vercel often 307s), point the webhook at the `www` domain — **Telegram does not follow redirects**. Diagnose with `getWebhookInfo` (shows `last_error_message`).
7. **Test the loop**: send a photo → expect ✅ reply with cutout → new commit on `main` → item live after rebuild. Then reply `/delete` and confirm removal. Debugging without dashboard access: `getWebhookInfo`; make the function's error message (`⚠️ Failed: <err>`) reach the owner's chat; a response-time heuristic helps (instant 200 = rejected sender; ~1–2s = failed at first external call; 5–20s = full pipeline ran).

### Phase 3 — polish (all optional, all zero-workflow)

- Nav link with a tiny superscript item counter (count computed at build time).
- `/stats` bot command (list the JSON dir via GitHub API, aggregate; cost ≈ items × $0.001).
- Location label in the lightbox (already captured in phase 2).
- A hidden `/print` route: A1 poster catalog via `@page { size: A1 portrait; margin: 0 }`, numbered chronological grid, on-screen preview scaled with `zoom`.
- Footer "Last update" = build date (`new Date()` in a component frontmatter) — refreshes with every auto-deploy.

## Costs & limits summary

- Per item: ~$0.001 (two Replicate calls). 1000 items ≈ $1.
- Everything else $0 (Vercel hobby, Telegram, GitHub, Nominatim — keep its use light and set a User-Agent).
- Publish latency: ~7s processing (+11s while Replicate credit < $5) + ~2 min static rebuild.
- Image quality: Telegram compresses "photo" sends (~1280–2560px JPEG). "Send as File" preserves the original AND its EXIF/GPS. Pipeline caps at 1600px WebP q85 — raise if the purpose needs more.

## Security rules baked into the design

- Only the owner's Telegram user id is accepted; everyone else gets a silent 200.
- Webhook requests must carry the `x-telegram-bot-api-secret-token` header matching the secret.
- The GitHub token is scoped to the one repo, contents-only. The bot can only ever add/remove files in it.
- No tokens in the repo — env vars only. If a token ever leaks into chat, regenerate it (@BotFather `/revoke`, etc.).

---

*Provenance: this is the as-built documentation of tybura.com/junk (August 2026), including every real failure hit during its construction (redirect-eaten webhook, Replicate 404/422/429/E004, EXIF stripping, dialog focus rings). Follow the phases in order and it comes together in an afternoon.*
