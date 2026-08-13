// Generates a few sample cutout placeholders for /junk so the page isn't
// empty before the Telegram pipeline goes live. Safe to delete afterwards.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const items = [
  {
    slug: "sample-mug",
    title: "Sample mug",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="440">
      <rect x="60" y="60" width="300" height="320" rx="28" fill="#c9c2b4"/>
      <rect x="60" y="60" width="300" height="60" rx="28" fill="#b5ac9a"/>
      <path d="M360 130 h50 a70 70 0 0 1 0 150 h-50 v-44 h44 a26 26 0 0 0 0-62 h-44 z" fill="#c9c2b4"/>
    </svg>`,
  },
  {
    slug: "sample-bottle",
    title: "Sample bottle",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="640">
      <rect x="95" y="20" width="70" height="70" fill="#a8a294"/>
      <path d="M95 90 h70 v40 c40 30 60 60 60 110 v330 a30 30 0 0 1 -30 30 h-130 a30 30 0 0 1 -30 -30 v-330 c0 -50 20 -80 60 -110 z" fill="#d4cec1"/>
      <rect x="55" y="300" width="150" height="140" fill="#efece5"/>
    </svg>`,
  },
  {
    slug: "sample-radio",
    title: "Sample radio",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">
      <rect x="20" y="90" width="600" height="310" rx="24" fill="#8f887a"/>
      <rect x="60" y="140" width="280" height="210" rx="12" fill="#6e6759"/>
      <circle cx="470" cy="245" r="80" fill="#c9c2b4"/>
      <circle cx="470" cy="245" r="12" fill="#6e6759"/>
      <rect x="80" y="20" width="14" height="80" fill="#6e6759" transform="rotate(-20 87 60)"/>
    </svg>`,
  },
];

await mkdir("public/junk", { recursive: true });
await mkdir("src/content/junk", { recursive: true });

let day = 10;
for (const item of items) {
  const base = sharp(Buffer.from(item.svg)).trim();
  const { data, info } = await base
    .clone()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base
    .clone()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  await writeFile(`public/junk/${item.slug}.webp`, data);
  await writeFile(`public/junk/${item.slug}-thumb.webp`, thumb);
  await writeFile(
    `src/content/junk/${item.slug}.json`,
    JSON.stringify(
      {
        title: item.title,
        date: `2026-08-${day++}T12:00:00.000Z`,
        image: `/junk/${item.slug}.webp`,
        thumb: `/junk/${item.slug}-thumb.webp`,
        width: info.width,
        height: info.height,
      },
      null,
      2
    ) + "\n"
  );
  console.log("seeded", item.slug, info.width + "x" + info.height);
}
