# tybura.com/junk — how it works & setup

Live since 2026-08-13. Send a photo to **@tyburajunkbot** on Telegram → it's on [tybura.com/junk](https://www.tybura.com/junk) ~2 minutes later, background removed, cropped, categorized.

## Daily use

- **Publish**: send a photo (caption = title). Sending as *File* instead of Photo skips Telegram's compression and keeps full quality.
- **Delete**: reply `/delete` to the bot's ✅ confirmation, or `/delete <slug>`.
- **Stats**: `/stats` — item count, category breakdown, estimated processing cost.
- The ✅ confirmation shows the auto-detected category; if it's wrong, delete and resend (or just live with it — it only affects the dropdown filter).

## Pipeline (api/telegram.js, Vercel function)

1. Telegram webhook (`https://www.tybura.com/api/telegram` — must be the **www** domain; the bare domain redirects and Telegram won't follow).
2. Background removal: `851-labs/background-remover` on Replicate (~$0.0005/image).
3. Auto-category: `anthropic/claude-4.5-haiku` on Replicate classifies the cutout into sticker / sign / print / patch / vehicle / container / tool / keepsake / gear / misc (~$0.0005/image). Falls back to `misc` on any failure — publishing never blocks.
4. sharp: trim transparent padding, resize to ≤1600px WebP q85 + 480px thumb; dominant color recorded.
5. One atomic git commit to `main` (image + thumb + metadata JSON) → Vercel rebuilds the static Astro site.

Total cost ≈ **$0.001 per item**. Everything else (bot, hosting, repo) is free.

⚠️ While the Replicate account holds **less than $5 credit**, API calls are throttled (burst 1/min) — the function retries automatically, but each publish takes ~18s instead of ~7s. Topping up past $5 removes this.

## Configuration (Vercel → Settings → Environment Variables)

| Name | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `ALLOWED_TELEGRAM_USER_ID` | only this Telegram user can publish (694774480) |
| `REPLICATE_API_TOKEN` | pays for bg removal + classification |
| `GITHUB_TOKEN` | fine-grained PAT, Contents read/write on tybura/tybura only — **check expiry** |
| `TELEGRAM_WEBHOOK_SECRET` | random string; must match the secret used in setWebhook |

Optional: `REPLICATE_MODEL` (bg removal model), `GITHUB_REPO`, `GITHUB_BRANCH`.

To (re)point the webhook after changing domain or secret:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.tybura.com/api/telegram&secret_token=<SECRET>"
```

## Troubleshooting

- Bot silent → `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` shows the last delivery error; also check Vercel function logs.
- Processing errors are messaged back to you in Telegram as "⚠️ Failed: …".
- Classifier diagnostics: POST to the webhook with header `x-junk-debug: 1` echoes the last classification attempt in the response.
- Bad cutouts → shoot against a plain, contrasting background in decent light.
