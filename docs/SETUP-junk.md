# Setup — tybura.com/junk pipeline

One-time setup, ~10 minutes. After this: send a photo to your bot → it's live on /junk in ~2 minutes.

## 1. Create the Telegram bot

1. Open Telegram, talk to **@BotFather** → `/newbot` → pick a name (e.g. `tybura junk`) and a username (e.g. `tybura_junk_bot`).
2. Save the **bot token** it gives you → `TELEGRAM_BOT_TOKEN`.
3. Get your own numeric Telegram user id: message **@userinfobot** and copy the `Id` → `ALLOWED_TELEGRAM_USER_ID`. (The bot ignores everyone else.)

## 2. Replicate (background removal)

1. Sign up at [replicate.com](https://replicate.com), add a payment method (pay-as-you-go, ~$0.002/image).
2. Create an API token at replicate.com/account/api-tokens → `REPLICATE_API_TOKEN`.

## 3. GitHub token (lets the bot commit images)

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token.
2. Repository access: **only `tybura/tybura`**. Permissions: **Contents → Read and write**. Expiration: your call (set a calendar reminder if it expires).
3. Copy it → `GITHUB_TOKEN`.

## 4. Vercel environment variables

In the Vercel project for tybura.com → Settings → Environment Variables, add (Production):

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | from step 1 |
| `ALLOWED_TELEGRAM_USER_ID` | from step 1 |
| `REPLICATE_API_TOKEN` | from step 2 |
| `GITHUB_TOKEN` | from step 3 |
| `TELEGRAM_WEBHOOK_SECRET` | any random string, e.g. output of `openssl rand -hex 16` |

Optional overrides: `REPLICATE_MODEL` (default `851-labs/background-remover`), `GITHUB_REPO` (default `tybura/tybura`), `GITHUB_BRANCH` (default `main`).

Redeploy after adding the variables so the function picks them up.

## 5. Point Telegram at the function

Run (fill in both values):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://tybura.com/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Expected reply: `{"ok":true,...,"description":"Webhook was set"}`.

## 6. Try it

- Send your bot a photo of an object (caption becomes the title).
- It replies with the processed cutout + a ✅; the item is live after the ~2 min rebuild.
- Bad cutout or regret? **Reply `/delete` to that ✅ message** (or `/delete <slug>`).

## Housekeeping

- The three `sample-*` items were seeded so the page isn't empty — delete them once real items exist: remove `public/junk/sample-*` and `src/content/junk/sample-*.json` (or `/delete sample-mug` etc. from Telegram once the bot is live).
- `scripts/seed-junk.mjs` can be deleted at the same time.

## Troubleshooting

- Bot silent? Check the function logs in Vercel (Deployments → Functions → `api/telegram`). The bot also messages you the error for processing failures.
- `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` shows pending updates and the last webhook error.
- Cutout quality is best with the object on a plain, contrasting background in decent light.
