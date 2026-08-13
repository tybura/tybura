// One-off: add a dominant `color` to junk items that predate color capture.
import sharp from "sharp";
import { readdir, readFile, writeFile } from "node:fs/promises";

const dir = "src/content/junk";
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
  const path = `${dir}/${file}`;
  const meta = JSON.parse(await readFile(path, "utf8"));
  if (meta.color) continue;
  const { dominant } = await sharp(`public${meta.image}`).stats();
  meta.color = `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  await writeFile(path, JSON.stringify(meta, null, 2) + "\n");
  console.log(file, meta.color);
}
