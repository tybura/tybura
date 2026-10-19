// Browser runtime: remote control, page search, subpage rotation, live clock,
// Last.fm, photo-to-mosaic conversion and pixel-snapped screen sizing.
import { CONTENT_ROWS, COLS, mosaicRows, rowHTML, rowsHTML, type C, type Row } from "./engine";
import {
  PAGES,
  PHOTO_ROWS,
  PHOTO_SOURCES,
  fastextRow,
  headerRow,
  notFound,
  promos,
  type Ctx,
  type PageDef,
  type PhotoSource,
  type Track,
} from "./pages";

const LASTFM =
  "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=tybura&api_key=2b8dffb034a59af8058573c8e0d5b2d0&format=json&limit=10";

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

export function boot() {
  const root = document.getElementById("tt") as HTMLElement;
  const screen = root.querySelector(".screen") as HTMLElement;
  const hdrEl = screen.querySelector(".hdr") as HTMLElement;
  const bodyEl = screen.querySelector(".body") as HTMLElement;
  const promoEl = screen.querySelector(".promo") as HTMLElement;
  const fastEl = screen.querySelector(".fast") as HTMLElement;
  const remote = root.querySelector(".remote") as HTMLElement;
  const data = JSON.parse((document.getElementById("tt-data") as HTMLElement).textContent || "{}");

  const ctx: Ctx = { ...data, music: { state: "loading", tracks: [] }, photos: {} };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let page: PageDef = PAGES[100];
  let screens = page.render(ctx);
  let sub = 0;
  let pField = "100";
  let counter = 100;
  let typed = "";
  let hold = false;
  let promoIdx = 0;
  let searchTimer = 0;
  let rotateTimer = 0;
  let typeTimer = 0;
  let lastBody = "";

  // ------------------------------------------------------------ painting

  function paintHeader() {
    hdrEl.innerHTML = rowHTML(headerRow({ p: "P" + pField, counter: String(counter), date: new Date(), hold }), 0);
  }

  function paint(arrive: boolean) {
    const html = rowsHTML(screens[sub] ?? [], CONTENT_ROWS, 1);
    if (!arrive && html === lastBody) return;
    lastBody = html;
    bodyEl.innerHTML = html;
    if (arrive && !reduced && !document.hidden) rollIn();
    fastEl.innerHTML = rowHTML(fastextRow(page.fast), 24);
  }

  /** Rows arrive top to bottom, like a decoder filling its page memory. */
  let rollTimer = 0;
  function rollIn() {
    clearTimeout(rollTimer);
    const rows = Array.from(bodyEl.children) as HTMLElement[];
    rows.forEach((r) => (r.style.visibility = "hidden"));
    const t0 = performance.now();
    let i = 0;
    const tick = () => {
      const due = Math.min(rows.length, Math.floor((performance.now() - t0) / 14) + 1);
      for (; i < due; i++) rows[i].style.visibility = "";
      if (i < rows.length) rollTimer = window.setTimeout(tick, 14);
    };
    tick();
  }

  function paintPromo() {
    const list = promos(ctx);
    promoEl.innerHTML = rowHTML(list[promoIdx % list.length], 23);
  }

  function refresh() {
    screens = page.render(ctx);
    sub = Math.min(sub, screens.length - 1);
    paint(false);
  }

  // ---------------------------------------------------------- navigation

  function show(p: PageDef, s = 0) {
    page = p;
    screens = p.render(ctx);
    sub = Math.min(s, screens.length - 1);
    counter = p.num;
    pField = String(p.num);
    screen.classList.remove("reveal");
    paint(true);
    paintHeader();
    scheduleRotate();
    document.title = `${p.num} ${p.title} · TYBURATEXT`;
    if (p.num === 400) ensurePhotos();
    if (p.num === 500) fetchMusic();
  }

  /** Teletext doesn't jump: the header counter rolls until the page comes round. */
  function go(num: number) {
    clearTimeout(searchTimer);
    clearTimeout(typeTimer);
    typed = "";
    pField = String(num);
    const target = PAGES[num] ?? notFound(num);
    if (reduced) return show(target);
    const t0 = performance.now();
    const dur = 350 + Math.random() * 350;
    const tick = () => {
      if (performance.now() - t0 < dur) {
        counter = 100 + ((counter - 100 + 1 + Math.floor(Math.random() * 7)) % 800);
        paintHeader();
        searchTimer = window.setTimeout(tick, 32);
      } else show(target);
    };
    tick();
  }

  function navigate(num: number) {
    if (location.hash === "#" + num) go(num);
    else location.hash = String(num);
  }

  function step(dir: number) {
    const nums = Object.keys(PAGES).map(Number).sort((a, b) => a - b);
    const i = nums.findIndex((n) => n >= page.num);
    const at = nums[i] === page.num ? i : dir > 0 ? i - 1 : i;
    navigate(nums[(at + dir + nums.length) % nums.length]);
  }

  function flip(dir: number) {
    if (screens.length < 2) return;
    sub = (sub + dir + screens.length) % screens.length;
    paint(true);
    scheduleRotate();
  }

  function scheduleRotate() {
    clearTimeout(rotateTimer);
    if (!hold && screens.length > 1 && page.rotate) rotateTimer = window.setTimeout(() => flip(1), page.rotate * 1000);
  }

  function digit(d: number) {
    if (!typed && (d === 0 || d === 9)) return; // pages run 100-899
    typed += d;
    pField = typed.padEnd(3, "-");
    paintHeader();
    clearTimeout(typeTimer);
    if (typed.length === 3) {
      const n = +typed;
      typed = "";
      navigate(n);
    } else {
      typeTimer = window.setTimeout(() => {
        typed = "";
        pField = String(page.num);
        paintHeader();
      }, 4000);
    }
  }

  function toggleHold() {
    hold = !hold;
    root.classList.toggle("is-hold", hold);
    paintHeader();
    scheduleRotate();
  }

  function toggleCrt() {
    const on = root.classList.toggle("crt");
    store.set("tt-crt", on ? "1" : "0");
  }

  const actions: Record<string, () => void> = {
    left: () => flip(-1),
    right: () => flip(1),
    up: () => step(1),
    down: () => step(-1),
    reveal: () => screen.classList.toggle("reveal"),
    hold: toggleHold,
    index: () => navigate(100),
    crt: toggleCrt,
    red: () => navigate(page.fast[0][1]),
    green: () => navigate(page.fast[1][1]),
    yellow: () => navigate(page.fast[2][1]),
    cyan: () => navigate(page.fast[3][1]),
  };

  function press(key: string) {
    if (/^\d$/.test(key)) digit(+key);
    else actions[key]?.();
    const btn = remote.querySelector(`[data-key="${key}"]`);
    if (btn) {
      btn.classList.add("is-down");
      setTimeout(() => btn.classList.remove("is-down"), 120);
    }
  }

  const KEYS: Record<string, string> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    "?": "reveal",
    "/": "reveal",
    h: "hold",
    i: "index",
    c: "crt",
    r: "red",
    g: "green",
    y: "yellow",
    b: "cyan",
  };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = /^\d$/.test(e.key) ? e.key : KEYS[e.key] ?? KEYS[e.key.toLowerCase()] ?? (e.code === "Slash" ? "reveal" : undefined);
    if (!key) return;
    e.preventDefault();
    press(key);
  });

  remote.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-key]") as HTMLElement | null;
    if (btn) press(btn.dataset.key!);
  });

  // Swipe between subpages on touch screens.
  let touchX = 0;
  screen.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  screen.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) flip(dx < 0 ? 1 : -1);
  });

  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n >= 100 && n <= 899) go(n);
  });

  // ------------------------------------------------------------ live data

  async function fetchMusic() {
    try {
      const res = await fetch(LASTFM);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const list = json.recenttracks?.track ?? [];
      const tracks: Track[] = (Array.isArray(list) ? list : [list]).map((t: any) => ({
        name: t.name ?? "",
        artist: t.artist?.["#text"] ?? t.artist ?? "",
        album: t.album?.["#text"] ?? "",
        now: t["@attr"]?.nowplaying === "true",
        uts: t.date?.uts ? +t.date.uts : undefined,
      }));
      ctx.music = { state: "ok", tracks };
    } catch {
      if (!ctx.music.tracks.length) ctx.music = { state: "error", tracks: [] };
    }
    if (page.num === 500) refresh();
  }

  // ---------------------------------------------------------- photo mosaic

  let photoAdv = 0;
  async function ensurePhotos() {
    const adv = +(root.dataset.adv || 0.8);
    if (photoAdv === adv) return;
    photoAdv = adv;
    for (const p of PHOTO_SOURCES) {
      const img = new Image();
      img.src = p.src;
      try {
        await img.decode();
      } catch {
        continue;
      }
      ctx.photos[p.key] = photoRows(img, adv, p);
      if (page.num === 400) refresh();
    }
  }

  const PALETTE: [C, number, number, number][] = [
    ["r", 255, 0, 0],
    ["g", 0, 255, 0],
    ["y", 255, 255, 0],
    ["b", 0, 0, 255],
    ["m", 255, 0, 255],
    ["c", 0, 255, 255],
  ];

  /** Nearest teletext colour by hue; anything greyish stays white. */
  function nearest(r: number, g: number, b: number, minSat: number): C {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (!max || (max - min) / max < minSat) return "w";
    const k = 255 / max;
    let best: C = "w";
    let bestD = Infinity;
    for (const [c, pr, pg, pb] of PALETTE) {
      const d = (r * k - pr) ** 2 + (g * k - pg) ** 2 + (b * k - pb) ** 2;
      if (d < bestD) (bestD = d), (best = c);
    }
    return best;
  }

  function photoRows(img: HTMLImageElement, adv: number, p: PhotoSource): Row[] {
    const W = COLS * 2;
    const H = PHOTO_ROWS * 3;
    const aspect = (COLS * adv) / PHOTO_ROWS;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    let cw = iw;
    let ch = iw / aspect;
    if (ch > ih) (ch = ih), (cw = ih * aspect);
    cw /= p.zoom;
    ch /= p.zoom;
    const sx = Math.min(iw - cw, Math.max(0, p.focus[0] * iw - cw / 2));
    const sy = Math.min(ih - ch, Math.max(0, p.focus[1] * ih - ch / 2));
    // Downscale in two steps so fine detail averages out instead of aliasing.
    const mid = document.createElement("canvas");
    mid.width = W * 4;
    mid.height = H * 4;
    mid.getContext("2d")!.drawImage(img, sx, sy, cw, ch, 0, 0, mid.width, mid.height);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.imageSmoothingQuality = "high";
    g.drawImage(mid, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    // Local contrast (wide unsharp mask) so faces and edges survive 80 px.
    const blur = boxBlur(lum, W, H, 6);
    for (let i = 0; i < lum.length; i++) lum[i] += lum[i] - blur[i];
    // Stretch contrast between the 3rd and 97th percentile.
    const sorted = Array.from(lum).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.03)];
    const hi = sorted[Math.floor(sorted.length * 0.97)];
    for (let i = 0; i < lum.length; i++) lum[i] = Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo || 1))) ** p.gamma;

    const on = new Uint8Array(W * H);
    if (p.dither === "bayer") {
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) on[y * W + x] = lum[y * W + x] > (B[(y % 4) * 4 + (x % 4)] + 0.5) / 16 ? 1 : 0;
    } else if (p.dither === "threshold") {
      for (let i = 0; i < lum.length; i++) on[i] = lum[i] > 0.5 ? 1 : 0;
    } else {
      // Atkinson: drops a quarter of the error, which keeps blacks black.
      const spread: [number, number][] = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const n = lum[i] > 0.5 ? 1 : 0;
          on[i] = n;
          const err = (lum[i] - n) / 8;
          for (const [dx, dy] of spread) {
            const X = x + dx;
            const Y = y + dy;
            if (X >= 0 && X < W && Y < H) lum[Y * W + X] += err;
          }
        }
    }

    const colorAt = p.colour < 1
      ? (cx: number, cy: number): C => {
          let r = 0;
          let gg = 0;
          let b = 0;
          for (let k = 0; k < 6; k++) {
            const i = ((cy * 3 + (k >> 1)) * W + cx * 2 + (k & 1)) * 4;
            r += px[i];
            gg += px[i + 1];
            b += px[i + 2];
          }
          return nearest(r, gg, b, p.colour);
        }
      : undefined;
    return mosaicRows((x, y) => !!on[y * W + x], COLS, PHOTO_ROWS, { fg: "w", label: `Photo: ${p.place}`, colorAt });
  }

  function boxBlur(src: Float32Array, W: number, H: number, r: number) {
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const X = x + k;
          if (X >= 0 && X < W) (sum += src[y * W + X]), n++;
        }
        tmp[y * W + x] = sum / n;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const Y = y + k;
          if (Y >= 0 && Y < H) (sum += tmp[Y * W + x]), n++;
        }
        out[y * W + x] = sum / n;
      }
    return out;
  }

  // ------------------------------------------------------------- sizing

  // Cell widths per font file: 0.8em = 4:3 TV pixels, 0.6em = square, 0.45em = tall.
  const FONTS = [0.8, 0.6, 0.45];

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const narrow = vw < 760 || vw < vh * 1.05;
    root.dataset.mode = narrow ? "narrow" : "wide";
    const padX = narrow ? 0.5 : 1.4; // in cell heights
    const padY = narrow ? 0.5 : 0.9;
    const margin = narrow ? 10 : 28;
    const gap = narrow ? 12 : 28;
    const rr = remote.getBoundingClientRect();
    const availW = narrow ? vw - margin * 2 : vw - margin * 2 - rr.width - gap;
    const availH = narrow ? vh - margin * 2 - rr.height - gap : vh - margin * 2;

    // Biggest text wins, but prefer the wider (more authentic) pixel when
    // it costs less than 10% of size.
    const sizeFor = (adv: number) => Math.min(availW / (COLS * adv + padX * 2), availH / (25 + padY * 2));
    const options = (narrow ? FONTS.slice(1) : FONTS.slice(0, 2)).map((adv) => ({ adv, fs: sizeFor(adv) }));
    const best = Math.max(...options.map((o) => o.fs));
    const pick = options.find((o) => o.fs >= best * 0.9)!;

    // Snap so every row (and, for 0.8/0.6, every cell) edge lands on a whole
    // device pixel, which keeps mosaics free of hairline seams.
    const step = pick.adv === 0.45 ? 1 : 5;
    const dev = Math.max(10, Math.floor((pick.fs * dpr) / step) * step);
    const fs = dev / dpr;
    root.dataset.adv = String(pick.adv);
    root.style.setProperty("--adv", String(pick.adv));
    root.style.setProperty("--fs", `${fs}px`);
    root.style.setProperty("--px", `${Math.round(padX * fs * dpr) / dpr}px`);
    root.style.setProperty("--py", `${Math.round(padY * fs * dpr) / dpr}px`);
    if (page.num === 400) ensurePhotos();
    screen.style.translate = "0 0";
    requestAnimationFrame(() => {
      const r = screen.getBoundingClientRect();
      const fx = (Math.round(r.left * dpr) - r.left * dpr) / dpr;
      const fy = (Math.round(r.top * dpr) - r.top * dpr) / dpr;
      screen.style.translate = `${fx}px ${fy}px`;
    });
  }

  // ---------------------------------------------------------------- boot

  if (store.get("tt-crt") === "0") root.classList.remove("crt");
  layout();
  window.addEventListener("resize", layout);
  document.fonts?.ready.then(layout);

  const start = parseInt(location.hash.slice(1), 10);
  if (start >= 100 && start <= 899 && start !== 100) go(start);
  else {
    paint(false);
    paintHeader();
  }
  root.classList.add("is-ready");

  setInterval(() => {
    if (!searchTimer || counter === page.num) paintHeader();
  }, 1000);
  setInterval(() => {
    promoIdx++;
    paintPromo();
  }, 6000);
  fetchMusic().then(paintPromo);
  setInterval(fetchMusic, 20000);
}
