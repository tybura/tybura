// Teletext page model + renderer. Pure functions only, so the same code runs
// at build time (first paint) and in the browser (navigation, live data).
import glyphs from "./glyphs.json";

export const COLS = 40;
export const CONTENT_ROWS = 22; // rows 1-22; 23 = promo bar, 24 = fastext

// The eight teletext colours: blacK Red Green Yellow Blue Magenta Cyan White
export type C = "k" | "r" | "g" | "y" | "b" | "m" | "c" | "w";

export interface Seg {
  t: string;
  fg?: C;
  bg?: C;
  page?: number; // internal link (teletext page)
  href?: string; // external link
  flash?: boolean;
  conceal?: boolean; // hidden until REVEAL
  id?: string; // live-updated by the client
}

export interface Row {
  segs: Seg[];
  bg?: C;
  dh?: boolean; // double height: occupies two rows
  mosaic?: boolean;
  label?: string; // accessible text for a mosaic block (first row only)
  page?: number; // whole row links to a page
  href?: string; // whole row links out
}

export type Screen = Row[];

// ---------------------------------------------------------------- builders

export const s = (t: string, fg: C = "w", bg?: C, x: Partial<Seg> = {}): Seg => ({ t, fg, bg, ...x });
export const row = (...segs: Seg[]): Row => ({ segs });
export const blank = (): Row => ({ segs: [] });
export const fill = (bg: C, ...segs: Seg[]): Row => ({ segs, bg });
export const dh = (r: Row): Row => ({ ...r, dh: true });
export const linkRow = (r: Row, target: number | string): Row =>
  typeof target === "number" ? { ...r, page: target } : { ...r, href: target };

export const segLen = (segs: Seg[]) => segs.reduce((n, x) => n + x.t.length, 0);
export const rowHeight = (r: Row) => (r.dh ? 2 : 1);

export function pad(t: string, n: number, align: "l" | "r" | "c" = "l") {
  if (t.length >= n) return t.slice(0, n);
  const gap = n - t.length;
  if (align === "r") return " ".repeat(gap) + t;
  if (align === "c") return " ".repeat(gap >> 1) + t + " ".repeat(gap - (gap >> 1));
  return t + " ".repeat(gap);
}

/** Truncate with a trailing dot, the way teletext editors squeezed names in. */
export const fit = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "." : pad(t, n));

/** " Label ........... 123" — the classic index line. */
export function leader(label: string, num: number | string, o: { fg?: C; numFg?: C; bg?: C; indent?: number } = {}): Row {
  const { fg = "w", numFg = "y", bg, indent = 1 } = o;
  const n = String(num);
  const head = " ".repeat(indent) + label + " ";
  const dots = Math.max(1, COLS - head.length - n.length - 2);
  const r = fill(bg ?? "k", s(head, fg), s(".".repeat(dots) + " ", fg), s(n, numFg));
  if (!bg) delete r.bg;
  return typeof num === "number" ? linkRow(r, num) : r;
}

/** Two-tone section bar, as on TVP Telegazeta: [ LABEL ][ text ........ ] */
export function bar(label: string, text: string, o: { a?: C; b?: C; right?: string } = {}): Row {
  const { a = "y", b = "b", right = "" } = o;
  const l = ` ${label} `;
  const restW = COLS - l.length;
  const tail = right ? right + " " : "";
  const body = pad(" " + text, restW - tail.length) + tail;
  return row(s(l, b, a), s(body, a, b));
}

/** Two columns split at `at`. */
export function cols(left: Seg[], right: Seg[], at = 20): Row {
  const w = segLen(left);
  return row(...left, s(" ".repeat(Math.max(0, at - w))), ...right);
}

// ------------------------------------------------------------- rich text

type Run = { t: string; fg: C; href?: string; page?: number };

function parseRich(src: string, fg: C, hi: C): Run[] {
  const runs: Run[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) runs.push({ t: src.slice(last, m.index), fg });
    if (m[1]) {
      runs.push(/^\d{3}$/.test(m[2]) ? { t: m[1], fg: "c", page: +m[2] } : { t: m[1], fg: "c", href: m[2] });
    } else runs.push({ t: m[3], fg: hi });
    last = re.lastIndex;
  }
  if (last < src.length) runs.push({ t: src.slice(last), fg });
  return runs;
}

/**
 * Word-wraps a paragraph to teletext rows. Supports [link](url|123) and
 * *highlight*. Every row gets `indent` leading spaces.
 */
export function rich(src: string, o: { width?: number; fg?: C; hi?: C; indent?: number } = {}): Row[] {
  const { indent = 1, width = COLS - indent - 1, fg = "w", hi = "y" } = o;
  const runs = parseRich(src, fg, hi);
  type Ch = { ch: string; r: number };
  const chars: Ch[] = [];
  runs.forEach((run, i) => {
    for (const ch of run.t) chars.push({ ch, r: i });
  });
  const words: Ch[][] = [];
  let cur: Ch[] = [];
  for (const c of chars) {
    if (c.ch === " " || c.ch === "\n") {
      if (cur.length) words.push(cur);
      cur = [];
    } else cur.push(c);
  }
  if (cur.length) words.push(cur);

  const lines: Ch[][] = [];
  let line: Ch[] = [];
  for (let w of words) {
    while (w.length > width) {
      if (line.length) lines.push(line), (line = []);
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!w.length) continue;
    if (line.length && line.length + 1 + w.length > width) lines.push(line), (line = []);
    if (line.length) {
      const prev = line[line.length - 1].r;
      line.push({ ch: " ", r: prev === w[0].r ? prev : -1 });
    }
    line.push(...w);
  }
  if (line.length) lines.push(line);

  return lines.map((l) => {
    const segs: Seg[] = indent ? [s(" ".repeat(indent), fg)] : [];
    let i = 0;
    while (i < l.length) {
      const r = l[i].r;
      let t = "";
      while (i < l.length && l[i].r === r) t += l[i++].ch;
      const run = r >= 0 ? runs[r] : { t, fg };
      segs.push(s(t, run.fg, undefined, { href: (run as Run).href, page: (run as Run).page }));
    }
    return row(...segs);
  });
}

// ----------------------------------------------------------------- mosaics

/** Sextant code point: contiguous at U+E000, separated at U+E040. */
export const sextant = (mask: number, separated = false) => String.fromCharCode((separated ? 0xe040 : 0xe000) + mask);

/** Turns a pixel predicate (2 px per column, 3 px per row) into mosaic rows. */
export function mosaicRows(
  px: (x: number, y: number) => boolean,
  w: number,
  h: number,
  o: { fg?: C; bg?: C; separated?: boolean; label?: string; colorAt?: (cx: number, cy: number) => C } = {},
): Row[] {
  const { fg = "w", bg, separated = false, label, colorAt } = o;
  const rows: Row[] = [];
  for (let cy = 0; cy < h; cy++) {
    const segs: Seg[] = [];
    for (let cx = 0; cx < w; cx++) {
      let mask = 0;
      for (let b = 0; b < 6; b++) if (px(cx * 2 + (b & 1), cy * 3 + (b >> 1))) mask |= 1 << b;
      const color = colorAt ? colorAt(cx, cy) : fg;
      const last = segs[segs.length - 1];
      if (last && last.fg === color) last.t += sextant(mask, separated);
      else segs.push(s(sextant(mask, separated), color, bg));
    }
    const r: Row = { segs, mosaic: true };
    if (bg) r.bg = bg;
    if (cy === 0 && label) r.label = label;
    rows.push(r);
  }
  return rows;
}

const G = glyphs as Record<string, number[]>;

/** Big mosaic lettering drawn from the same 5x9 glyphs as the font. */
export function bigText(
  text: string,
  o: { fg?: C; bg?: C; scale?: number; bold?: boolean; top?: number; bottom?: number; x?: number; width?: number } = {},
): Row[] {
  const { fg = "y", bg, scale = 1, bold = true, top = 1, bottom = 9, x = 1, width = COLS } = o;
  const adv = bold ? 7 : 6;
  const pixels: boolean[][] = [];
  const hPx = (bottom - top + 1) * scale;
  const rowsN = Math.ceil(hPx / 3);
  for (let y = 0; y < rowsN * 3; y++) pixels.push(new Array(width * 2).fill(false));
  const offY = Math.floor((rowsN * 3 - hPx) / 2);
  [...text].forEach((ch, i) => {
    const bm = G[ch];
    if (!bm) return;
    for (let gy = top; gy <= bottom; gy++) {
      let bits = bm[gy];
      if (bold) bits = bits | (bits >> 1);
      for (let gx = 0; gx < (bold ? 7 : 6); gx++) {
        const on = gx < 6 ? (bits >> (5 - gx)) & 1 : bm[gy] & 1;
        if (!on) continue;
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++) {
            const X = x * 2 + (i * adv + gx) * scale + sx;
            const Y = offY + (gy - top) * scale + sy;
            if (X < width * 2 && Y < pixels.length) pixels[Y][X] = true;
          }
      }
    }
  });
  return mosaicRows((px, py) => pixels[py]?.[px] ?? false, width, rowsN, { fg, bg, label: text });
}

/** Measures how many columns bigText() needs. */
export const bigTextCols = (text: string, scale = 1, bold = true) => Math.ceil(([...text].length * (bold ? 7 : 6) * scale) / 2);

// ---------------------------------------------------------------- render

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function segHTML(x: Seg, inLink: boolean): string {
  const cls = [`f${x.fg ?? "w"}`];
  if (x.bg) cls.push(`b${x.bg}`);
  if (x.flash) cls.push("fl");
  if (x.conceal) cls.push("cc");
  const id = x.id ? ` data-id="${x.id}"` : "";
  const c = ` class="${cls.join(" ")}"${id}`;
  if (!inLink && x.page != null) return `<a href="#${x.page}" data-page="${x.page}"${c}>${esc(x.t)}</a>`;
  if (!inLink && x.href) return `<a href="${esc(x.href)}"${ext(x.href)}${c}>${esc(x.t)}</a>`;
  return `<span${c}>${esc(x.t)}</span>`;
}

const ext = (href: string) => (/^https?:/.test(href) ? ` target="_blank" rel="noopener"` : "");

export function rowHTML(r: Row, i = 0): string {
  if (import.meta.env?.DEV && segLen(r.segs) > COLS) console.warn(`[teletext] row ${i} is ${segLen(r.segs)} cols:`, r.segs.map((x) => x.t).join(""));
  const cls = ["r"];
  if (r.dh) cls.push("dh");
  if (r.bg) cls.push(`b${r.bg}`);
  let aria = "";
  if (r.mosaic) aria = r.label ? ` role="img" aria-label="${esc(r.label)}"` : ` aria-hidden="true"`;
  const inLink = r.page != null || !!r.href;
  let inner = r.segs.map((x) => segHTML(x, inLink)).join("");
  if (r.dh) inner = `<span class="dhi">${inner}</span>`;
  const style = ` style="--i:${i}"`;
  if (r.page != null) return `<a href="#${r.page}" data-page="${r.page}" class="${cls.join(" ")}"${style}>${inner}</a>`;
  if (r.href) return `<a href="${esc(r.href)}"${ext(r.href)} class="${cls.join(" ")}"${style}>${inner}</a>`;
  return `<div class="${cls.join(" ")}"${style}${aria}>${inner}</div>`;
}

/** Renders rows, clipping to `max` rows and padding the rest with blanks. */
export function rowsHTML(rows: Row[], max: number, start = 0): string {
  let used = 0;
  const out: string[] = [];
  for (const r of rows) {
    const h = rowHeight(r);
    if (used + h > max) break;
    out.push(rowHTML(r, start + used));
    used += h;
  }
  while (used < max) out.push(rowHTML(blank(), start + used++));
  return out.join("");
}
