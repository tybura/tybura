# PRD — tybura.com/junk

**Status:** Draft for approval
**Date:** 2026-08-12
**Owner:** tybura

---

## 1. Summary

A personal object gallery at `tybura.com/junk` — a minimal, Natural-Selection-style page showing a grid of physical objects as clean background-removed cutouts on a white canvas.

The differentiator is the publishing flow: **send a photo to a private Telegram bot and it appears on the site a couple of minutes later** — background removed, auto-cropped to the object, no manual steps.

## 2. Goals / Non-goals

**Goals**

- Zero-friction publishing: one photo message → live on the site, fully automated.
- Figma-quality background removal (clean edges, handles hair/shadows reasonably).
- Auto-trim: transparent padding around the object is cropped away, so all cutouts sit consistently in the grid.
- Visual language borrowed from naturalselection.so: white space, monospaced type, fixed left sidebar, sparse image grid.
- Fits the existing site: a new route in the current Astro project, same repo, same deploy.

**Non-goals (v1)**

- No prices, no shop, no affiliate links.
- No user accounts, comments, likes.
- No admin web UI — Telegram *is* the admin UI.
- No search/filters at launch (layout leaves room to add them later).

## 3. The reference design (naturalselection.so)

Observed and to be adapted:

- **Layout:** fixed left sidebar (~280px) + fluid content area. Sidebar holds the title, (later: search, category filter, sort). Content is a responsive grid of cutout images with lots of white space.
- **Typography:** monospaced throughout (they use something like JetBrains Mono / Martian Mono). Small sizes, generous letter-spacing, gray secondary text.
- **Color:** pure white background, near-black text, mid-gray for inactive items. The images provide all the color.
- **Images:** transparent-background PNGs/WebPs of objects, roughly uniform visual size, lazy-loaded, appearing as items scroll in.
- **Interaction (v1 scope):** hover shows the item name/date under or over the image; click opens a larger view (simple lightbox or just the full-size image). Keep it subtle.

For `/junk` the sidebar reads e.g. `Junk`, a one-line description ("things I own, apparently"), a count, and a link back to tybura.com.

## 4. Feasibility — short answer

Yes, every step of the desired flow exists as a boring, reliable building block:

| Step | Mechanism |
|---|---|
| "Send image somewhere simple" | Telegram Bot API webhook (free) |
| Remove background, Figma-quality | **BiRefNet** model via Replicate API (~$0.002/image) — state of the art, same class of model the Figma-style tools use. Alternative: remove.bg API (better known, ~$0.20/image) |
| Crop empty padding | `sharp`'s `.trim()` on the alpha channel (one line of code). (remove.bg can even do this in the same call with `crop=true`) |
| "Upload it to the website" | Commit the processed image + metadata to this GitHub repo via the GitHub Contents API → the existing auto-deploy rebuilds the static site |

No servers to maintain: one small serverless function is the whole backend.

## 5. Architecture

```
You (Telegram app)
   │  send photo (+ optional caption = item title)
   ▼
Telegram Bot ──webhook──▶ Serverless function (Vercel, Node)
                             │ 1. verify sender is YOUR telegram user id
                             │ 2. download photo from Telegram file API
                             │ 3. POST to Replicate (BiRefNet) → transparent PNG
                             │ 4. sharp: trim transparent padding, resize to max
                             │    ~1600px, encode WebP (+ small thumb)
                             │ 5. commit to GitHub:
                             │      public/junk/<slug>.webp
                             │      src/content/junk/<slug>.json  (title, date)
                             │ 6. reply in Telegram: "✅ live in ~2 min" + preview
                             ▼
GitHub push ──▶ existing CI/deploy ──▶ tybura.com/junk rebuilt (Astro static)
```

**Why commit-to-repo instead of a bucket/CDN + database?**
The site is already a static Astro build deployed from GitHub. Committing images keeps everything in one place, versioned, with zero new infrastructure, free hosting, and trivial rollback (`git revert`). At personal-gallery scale (hundreds of images, not tens of thousands) repo size is a non-issue.

### Components

1. **Astro page** (`src/pages/junk.astro` + content collection `junk` in `src/content.config.ts`)
   - Reads all `src/content/junk/*.json` entries, sorts newest first, renders the grid.
   - Own minimal layout (the /junk page has its own visual identity, separate from the homepage).
2. **Telegram bot** — created once via @BotFather (2 minutes). Webhook pointed at the function.
3. **Ingest function** — a single small Node serverless function (separate tiny Vercel project, or an API route if the site itself moves to Vercel). Holds four secrets: `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_ID`, `REPLICATE_API_TOKEN`, `GITHUB_TOKEN` (fine-grained, contents-write on this repo only).

### Bot commands (v1)

- **photo message** → publish. Caption becomes the title; no caption → untitled, dated.
- `/delete` (as a reply to the bot's confirmation) → removes that item's files via a revert commit.
- Anything from a non-allowed user id → ignored.

## 6. Image pipeline details

- **Input:** Telegram compresses photos (~1280–2560px) — fine for this use. Sending as *file* preserves full resolution if ever needed.
- **Background removal:** Replicate `birefnet` (or `men1scus/birefnet` variants). Returns PNG with alpha. Typical run: 2–5 s, ~$0.002.
- **Trim:** `sharp(png).trim({ threshold: 10 })` — crops rows/columns that are fully transparent, i.e. exactly the "remove empty paddings" step.
- **Normalize:** fit inside 1600×1600, export WebP (quality ~85) + a 480px thumbnail for the grid. Keeps repo and page weight small.
- **Naming:** `YYYYMMDD-<random4>.webp`; metadata JSON alongside it with `{ title, date, width, height }`.

**Fallback for tricky photos:** the bot replies with the processed preview; if the cutout is bad, `/delete` and re-shoot. No editing UI in v1.

## 7. Costs & limits

- Telegram bot, GitHub, static hosting: **$0**.
- Replicate: ~**$0.002/image** (a thousand items ≈ $2). No subscription.
- Vercel hobby tier covers the function ($0). Function timeout: processing takes ~5–10 s end-to-end, within limits; the webhook is acknowledged immediately and work continues in the background (or via `waitUntil`).
- Site rebuild latency: item appears **1–3 minutes** after sending (static rebuild). Acceptable per the goal; if it ever isn't, step 5 can switch to a bucket + client-side manifest fetch without touching the bot flow.

## 8. Risks / open questions

1. **Where is tybura.com deployed?** (Vercel/Netlify/CF Pages — assumed auto-deploy on push to `main`. Need to confirm so the function's commit actually triggers a rebuild.)
2. **Cutout quality on cluttered backgrounds** — BiRefNet is excellent but not magic; photographing objects against a plain-ish background gives Figma-level results.
3. **Repo growth** — WebP at 1600px ≈ 100–300 KB/item; 500 items ≈ ~100 MB. Fine. Revisit only if the collection gets huge.
4. Category filters/search (like the reference) — deferred; the caption could later encode a category (e.g. `#gear Leatherman`).

## 9. Milestones

1. **M1 — Gallery page** (½ day): `/junk` route, content collection, grid + sidebar styling per §3, seeded with 3–5 manually processed images.
2. **M2 — Pipeline** (½–1 day): bot + function: webhook → BiRefNet → trim → commit → Telegram confirmation. `/delete` command.
3. **M3 — Polish** (small): lightbox/hover states, OG tags, empty-state, lazy-load animation.

## 10. Acceptance criteria

- Sending a photo (with caption "Old camera") to the bot results, within ~3 minutes and with no other action, in a background-removed, tightly-cropped cutout titled "Old camera" at the top of tybura.com/junk.
- Photos from any other Telegram account do nothing.
- Page scores green on Lighthouse performance (static, lazy images).
- `/delete` removes the item from the site on the next deploy.
