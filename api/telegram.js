// Telegram → tybura.com/junk ingest pipeline.
//
// Flow: photo message → background removal (Replicate) → trim transparent
// padding + resize (sharp) → single git commit (image, thumb, metadata)
// → Vercel redeploys the static site.
//
// Required env vars (see docs/SETUP-junk.md):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ALLOWED_TELEGRAM_USER_ID,
//   REPLICATE_API_TOKEN, GITHUB_TOKEN
// Optional:
//   REPLICATE_MODEL (default "851-labs/background-remover")
//   GITHUB_REPO (default "tybura/tybura"), GITHUB_BRANCH (default "main")

import sharp from "sharp";

const TG = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const REPO = process.env.GITHUB_REPO || "tybura/tybura";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const MODEL = process.env.REPLICATE_MODEL || "851-labs/background-remover";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    req.headers["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return res.status(401).end();
  }

  const msg = req.body?.message;
  // Always ack with 200 so Telegram doesn't retry; report problems via chat.
  if (!msg) return res.status(200).json({ ok: true });
  if (String(msg.from?.id) !== String(process.env.ALLOWED_TELEGRAM_USER_ID)) {
    return res.status(200).json({ ok: true });
  }

  try {
    if (msg.text?.startsWith("/delete")) {
      await handleDelete(msg);
    } else if (msg.photo?.length || msg.document?.mime_type?.startsWith("image/")) {
      await handlePhoto(msg);
    } else if (msg.text?.startsWith("/start")) {
      await reply(msg, "Send me a photo of an object. Caption = title. Reply /delete to a confirmation to remove an item.");
    }
  } catch (err) {
    console.error(err);
    await reply(msg, `⚠️ Failed: ${err.message}`).catch(() => {});
  }
  return res.status(200).json({ ok: true });
}

async function handlePhoto(msg) {
  const fileId = msg.photo?.length
    ? msg.photo[msg.photo.length - 1].file_id // largest size
    : msg.document.file_id;

  const original = await downloadTelegramFile(fileId);
  const cutout = await removeBackground(original);

  // Trim transparent padding, normalize size, encode WebP.
  const trimmed = sharp(cutout).trim({ threshold: 10 });
  const { data: image, info } = await trimmed
    .clone()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await trimmed
    .clone()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const now = new Date();
  const slug = `${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const title = (msg.caption || "").trim();

  const meta = {
    title,
    date: now.toISOString(),
    image: `/junk/${slug}.webp`,
    thumb: `/junk/${slug}-thumb.webp`,
    width: info.width,
    height: info.height,
  };

  await commit(
    `junk: add ${title || slug}`,
    [
      { path: `public/junk/${slug}.webp`, content: image },
      { path: `public/junk/${slug}-thumb.webp`, content: thumb },
      { path: `src/content/junk/${slug}.json`, content: Buffer.from(JSON.stringify(meta, null, 2) + "\n") },
    ]
  );

  await sendPhoto(
    msg.chat.id,
    thumb,
    `✅ ${title || "Untitled"}\nslug: ${slug}\nLive in ~2 min → https://tybura.com/junk\n(reply /delete to this message to remove)`
  );
}

async function handleDelete(msg) {
  const source = msg.reply_to_message?.caption || msg.reply_to_message?.text || msg.text;
  const slug = source?.match(/slug: ([\w-]+)/)?.[1] || msg.text.match(/\/delete\s+([\w-]+)/)?.[1];
  if (!slug) {
    return reply(msg, "Reply /delete to a ✅ confirmation, or use: /delete <slug>");
  }
  await commit(`junk: remove ${slug}`, [
    { path: `public/junk/${slug}.webp`, delete: true },
    { path: `public/junk/${slug}-thumb.webp`, delete: true },
    { path: `src/content/junk/${slug}.json`, delete: true },
  ]);
  await reply(msg, `🗑 Removed ${slug}. Gone after the next deploy.`);
}

// --- Telegram helpers ---

async function downloadTelegramFile(fileId) {
  const info = await tgJson(`${TG()}/getFile?file_id=${fileId}`);
  const resp = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
  if (!resp.ok) throw new Error(`Telegram file download failed (${resp.status})`);
  return Buffer.from(await resp.arrayBuffer());
}

async function reply(msg, text) {
  await tgJson(`${TG()}/sendMessage`, { chat_id: msg.chat.id, text, disable_web_page_preview: true });
}

async function sendPhoto(chatId, buffer, caption) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("photo", new Blob([buffer], { type: "image/webp" }), "preview.webp");
  const resp = await fetch(`${TG()}/sendPhoto`, { method: "POST", body: form });
  if (!resp.ok) throw new Error(`sendPhoto failed (${resp.status})`);
}

async function tgJson(url, body) {
  const resp = await fetch(url, body
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const json = await resp.json();
  if (!json.ok) throw new Error(`Telegram API error: ${json.description}`);
  return json;
}

// --- Replicate ---

async function removeBackground(buffer) {
  const dataUri = `data:image/jpeg;base64,${buffer.toString("base64")}`;
  const resp = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      "content-type": "application/json",
      Prefer: "wait=55",
    },
    body: JSON.stringify({ input: { image: dataUri, format: "png" } }),
  });
  let prediction = await resp.json();
  if (resp.status >= 400) throw new Error(`Replicate error: ${prediction.detail || resp.status}`);

  // In case "wait" returned before completion, poll briefly.
  for (let i = 0; i < 30 && ["starting", "processing"].includes(prediction.status); i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    prediction = await poll.json();
  }
  if (prediction.status !== "succeeded") {
    throw new Error(`Background removal ${prediction.status}: ${prediction.error || "timed out"}`);
  }

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const out = await fetch(url);
  if (!out.ok) throw new Error(`Cutout download failed (${out.status})`);
  return Buffer.from(await out.arrayBuffer());
}

// --- GitHub: one atomic commit via the Git Data API ---

async function gh(path, options = {}) {
  const resp = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...options.headers,
    },
  });
  const json = await resp.json();
  if (resp.status >= 400) throw new Error(`GitHub ${path}: ${json.message || resp.status}`);
  return json;
}

async function commit(message, files) {
  const ref = await gh(`/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const headCommit = await gh(`/git/commits/${headSha}`);

  const tree = await Promise.all(
    files.map(async (f) => {
      if (f.delete) return { path: f.path, mode: "100644", type: "blob", sha: null };
      const blob = await gh(`/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content.toString("base64"), encoding: "base64" }),
      });
      return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
    })
  );

  const newTree = await gh(`/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });
  const newCommit = await gh(`/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });
  await gh(`/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha }),
  });
}
