// All TYBURATEXT pages. Each page returns one or more subpages (screens of
// up to 22 rows); the runtime adds the header, promo bar and fastext row.
import {
  COLS,
  CONTENT_ROWS,
  type C,
  type Row,
  type Screen,
  type Seg,
  bar,
  bigText,
  blank,
  cols,
  dh,
  fill,
  fit,
  leader,
  linkRow,
  pad,
  rich,
  row,
  rowHeight,
  s,
} from "./engine";

export interface Project {
  name: string;
  type: string;
  location: string;
  year: string;
  status: string;
  url?: string;
}
export interface JunkItem {
  id: string;
  t: string;
  d: string;
  c?: string;
}
export interface Track {
  name: string;
  artist: string;
  album: string;
  now: boolean;
  uts?: number;
}
export interface Ctx {
  projects: Project[];
  junk: JunkItem[];
  junkCount: number;
  updated: string;
  music: { state: "loading" | "ok" | "error"; tracks: Track[] };
  photos: Record<string, Row[] | undefined>;
}

export interface PageDef {
  num: number;
  title: string;
  fast: [string, number][];
  rotate?: number; // seconds per subpage
  render(ctx: Ctx): Screen[];
}

// ------------------------------------------------------------------ helpers

/** Overwrites part of a row with a segment, keeping everything else. */
export function put(r: Row, col: number, seg: Seg): Row {
  const cells: { ch: string; seg: Seg }[] = [];
  for (const x of r.segs) for (const ch of x.t) cells.push({ ch, seg: x });
  while (cells.length < col) cells.push({ ch: " ", seg: s(" ") });
  [...seg.t].forEach((ch, i) => (cells[col + i] = { ch, seg }));
  const segs: Seg[] = [];
  for (const c of cells.slice(0, COLS)) {
    const last = segs[segs.length - 1];
    if (last && last.__src === c.seg) last.t += c.ch;
    else segs.push({ ...c.seg, t: c.ch, __src: c.seg } as Seg & { __src: Seg });
  }
  segs.forEach((x) => delete (x as Seg & { __src?: Seg }).__src);
  return { ...r, segs };
}

const subLabel = (i: number, n: number) => (n > 1 ? `${i + 1}/${n}` : "");

function head(word: string, fg: C, label: string, text: string, i = 0, n = 1, colors: { a?: C; b?: C } = {}): Row[] {
  return [...bigText(word, { fg }), bar(label, text, { ...colors, right: subLabel(i, n) })];
}

/**
 * Flows blocks of rows into subpages. A block that doesn't fit is split when
 * at least 3 rows are free and 2+ rows carry over, like a teletext article.
 */
function paginate(blocks: Row[][], perPage: number, gap = 1): Row[][] {
  const pages: Row[][] = [[]];
  const h = (rows: Row[]) => rows.reduce((n, r) => n + rowHeight(r), 0);
  for (const block of blocks) {
    let rows = [...block];
    while (rows.length) {
      const page = pages[pages.length - 1];
      const g = page.length ? gap : 0;
      const free = perPage - h(page) - g;
      if (h(rows) <= free) {
        for (let i = 0; i < g; i++) page.push(blank());
        page.push(...rows);
        break;
      }
      if (free >= 3 && rows.length - free >= 2) {
        for (let i = 0; i < g; i++) page.push(blank());
        page.push(...rows.slice(0, free));
        rows = rows.slice(free);
      } else if (!page.length) {
        page.push(...rows.slice(0, perPage));
        rows = rows.slice(perPage);
      }
      pages.push([]);
    }
  }
  return pages.filter((p) => p.length);
}

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export const SOCIALS: { name: string; handle: string; url: string }[] = [
  { name: "Instagram", handle: "@tybura_com", url: "https://www.instagram.com/tybura_com" },
  { name: "TikTok", handle: "@tybura.com", url: "https://www.tiktok.com/@tybura.com" },
  { name: "X", handle: "@tybura", url: "https://x.com/tybura" },
  { name: "LinkedIn", handle: "in/tybura", url: "https://www.linkedin.com/in/tybura/" },
  { name: "Are.na", handle: "emil-tybura", url: "https://www.are.na/emil-tybura/channels" },
  { name: "Last.fm", handle: "tybura", url: "https://www.last.fm/user/tybura" },
];

// -------------------------------------------------------------------- pages

const index: PageDef = {
  num: 100,
  title: "Index",
  fast: [["About", 110], ["Projects", 200], ["Contact", 300], ["Radio", 500]],
  render: () => {
    const logo = bigText("tybura", { scale: 2, bold: false, fg: "y", bg: "b", x: 2 });
    logo[0] = put(logo[0], 38, s("®", "w", "b"));
    return [
      [
        ...logo,
        bar("INDEX", "Designer, developer, storyteller"),
        blank(),
        ...rich(
          "Award-winning designer, storyteller, leader. Over 9 years of experience in transforming brands, websites and startups. Cooperated with *a16z*, *YCombinator*, *Sequoia*.",
        ),
        blank(),
        leader("About Emil Tybura", 110),
        leader("The story so far", 120),
        leader("Cooperated with", 200),
        leader("Contact & socials", 300),
        leader("Photos", 400),
        leader("Now playing", 500),
        leader("Junkyard", 700),
        leader("Horoscope 2026", 666, { fg: "m", numFg: "m" }),
      ],
    ];
  },
};

const about: PageDef = {
  num: 110,
  title: "About",
  fast: [["Index", 100], ["Story", 120], ["Projects", 200], ["Contact", 300]],
  render: () => {
    const roles = ["Art Director", "Creative Director", "Web Designer", "Brand Designer", "Design Engineer", "Lecturer", "Advisor"];
    const now: Seg[][] = [
      [s("Head of Web Design", "w")],
      [s("at "), s("tonik", "c", undefined, { href: "https://tonik.com" })],
      [],
      [s("Co-founder at", "w")],
      [s("SLINA", "c", undefined, { href: "https://www.instagram.com/slinaslinaslina" })],
      [s("Dziwne Wody", "c", undefined, { href: "https://www.dziwnewody.xyz" })],
      [],
    ];
    const links = [
      ["LinkedIn", "https://www.linkedin.com/in/tybura/"],
      ["Instagram", "https://www.instagram.com/tybura_com"],
      ["TikTok", "https://www.tiktok.com/@tybura.com"],
      ["X", "https://x.com/tybura"],
      ["Are.na", "https://www.are.na/emil-tybura/channels"],
      ["Newsletter", "/newsletter"],
      ["Last.fm", "https://www.last.fm/user/tybura"],
    ];
    const linkRows = chunk(links, 2).map(([a, b]) =>
      cols([s(" "), s(a[0] + " ↗", "c", undefined, { href: a[1] })], b ? [s(b[0] + " ↗", "c", undefined, { href: b[1] })] : [], 21),
    );
    return [
      [
        ...head("About", "c", "110", "Emil Tybura · Graphic Designer"),
        blank(),
        cols([s(" "), s(" ROLES ", "k", "y")], [s(" NOW ", "k", "c")], 21),
        ...roles.map((r, i) => cols([s(" " + r)], now[i] ?? [], 21)),
        blank(),
        row(s(" "), s(" ELSEWHERE ", "k", "g")),
        ...linkRows,
        blank(),
        leader("Read the story so far", 120),
        leader("Get in touch", 300),
      ],
    ];
  },
};

const STORY: (string | { label: string } | { fg: C; t: string })[] = [
  "Born in 1997, central Poland, Europe. I wasn't the most extroverted kid on the block. Chronically online, wasting my days in Los Santos, grinding MMORPGs.",
  "Due to my automotive bloodline - I grew up hanging around auto shops with my old man, that's where I fell in love with cars. Especially American ones.",
  "Somehow, against all odds, I stumbled into graphic design and ended up as a Bachelor of Arts. That got me into [Uniforma Studio](https://uniforma.pl). A place that taught me the craft of digital design for real. From there, I pivoted multiple times – UI design, product design, web design, no-code builds, AI-development.",
  "Eventually, I landed at [tonik.com](https://tonik.com). Started as a Webflow developer, bounced between design and code, two years later I became Head of Web Design. In almost two years I scaled the web design team from 3 to 16 talented designers and spent countless hours scoping, selling, building, designing, deploying, and strategically optimizing the whole company.",
  "99% of my work is done for US startups – the founders backed by *YCombinator*, *a16z*, *Sequoia*, *hf0* - the most demanding, challenging, rewarding, high velocity environment I've ever experienced.",
  "On the other hand, besides my commercial career - I'm really into experimental, small, weird projects, often inspired by web2.0, webrings, text based/terminal-like designs, grungy textures and messy layouts. Beauty isn't clean but crooked and fucked up.",
  "Off the clock, I collect old stuff – military and automotive memorabilia, stickers, maps, documents, lighters, old devices, books, flyers, vinyl records and all kinds of obscure [junk](700). I'm into old American cars and wrenching on them, Harley Davidsons, firearms and shooting (at the range, relax), workwear, documentaries and community radios like NTS.",
  { label: "tl;dr" },
  { fg: "y", t: "29, a fullstack design engineer & team leader, on the verge of tech and design, mentor, advisor, creative director, perfume store owner, collector, former night club owner (farewell ŚLINA)." },
  { fg: "g", t: "btw I wrote the whole text on my own, reject slopping embrace brainmaxxing" },
];

const story: PageDef = {
  num: 120,
  title: "Story",
  fast: [["Index", 100], ["About", 110], ["Projects", 200], ["Junk", 700]],
  rotate: 25,
  render: () => {
    const blocks: Row[][] = [];
    for (let i = 0; i < STORY.length; i++) {
      const p = STORY[i];
      if (typeof p === "string") blocks.push(rich(p));
      else if ("label" in p) {
        const next = STORY[++i] as { fg: C; t: string };
        blocks.push([row(s(" "), s(` ${p.label} `, "k", "y")), ...rich(next.t, { fg: next.fg })]);
      } else blocks.push(rich(p.t, { fg: p.fg }));
    }
    const pages = paginate(blocks, CONTENT_ROWS - 4 - 1);
    return pages.map((rows, i) => [...head("Story", "w", "120", "The story so far", i, pages.length), blank(), ...rows]);
  },
};

const STATUS: Record<string, [string, C, boolean]> = {
  LIVE: ["LIVE", "g", false],
  WIP: ["WIP ", "y", true],
  OFFLINE: ["OFF ", "r", false],
};

const projects: PageDef = {
  num: 200,
  title: "Projects",
  fast: [["Index", 100], ["About", 110], ["Contact", 300], ["Junk", 700]],
  rotate: 15,
  render: (ctx) => {
    const pages = chunk(ctx.projects, 14);
    return pages.map((list, i) => [
      ...head("Projects", "g", "200", `Cooperated with · ${ctx.projects.length} sites`, i, pages.length, { a: "g", b: "b" }),
      fill("b", s(" " + pad("PROJECT", 19) + pad("TYPE", 11) + pad("YEAR", 5) + "STAT", "y")),
      ...list.map((p) => {
        const [label, color, flash] = STATUS[p.status] ?? [p.status.slice(0, 4), "w", false];
        const r = row(s(" " + fit(p.name, 18) + " ", "w"), s(fit(p.type, 10) + " ", "c"), s(p.year + " ", "y"), s(label, color, undefined, { flash }));
        return p.url ? linkRow(r, p.url) : r;
      }),
      ...Array(14 - list.length).fill(0).map(blank),
      blank(),
      row(s(" "), s("LIVE", "g"), s(" opens site   "), s("WIP", "y", undefined, { flash: true }), s(" soon   "), s("OFF", "r"), s(" gone")),
    ]);
  },
};

const contact: PageDef = {
  num: 300,
  title: "Contact",
  fast: [["Index", 100], ["About", 110], ["Projects", 200], ["Radio", 500]],
  render: (ctx) => [
    [
      ...head("Contact", "y", "300", "Open for new collaborations", 0, 1, { a: "c", b: "b" }),
      blank(),
      row(s(" ALL INQUIRIES", "c")),
      linkRow(dh(row(s(" emil@tybura.com", "w"))), "mailto:emil@tybura.com"),
      blank(),
      row(s(" TELEPHONE", "c")),
      linkRow(dh(row(s(" "), s(" +48 884 826 830 ", "r", "y"))), "tel:+48884826830"),
      blank(),
      row(s(" SOCIAL", "c")),
      ...SOCIALS.map((x) => linkRow(leader(x.name, x.handle, { numFg: "c" }), x.url)),
      row(s(" Based in Poland, working worldwide.", "g")),
      row(s(" Last update: ", "w"), s(ctx.updated, "y")),
    ],
  ],
};

export interface PhotoSource {
  key: string;
  src: string;
  place: string;
  focus: [number, number]; // crop centre, 0-1
  zoom: number; // 1 = widest crop that fits
  gamma: number;
  dither: "atkinson" | "threshold" | "bayer";
  colour: number; // saturation above which a cell takes a teletext colour (1 = always white)
}

const PHOTOS: PhotoSource[] = [
  { key: "torun", src: "/images/photo-torun-40f21b.png", place: "TORUŃ, POLAND", focus: [0.45, 0.48], zoom: 1.35, gamma: 1.25, dither: "threshold", colour: 1 },
  { key: "joshua", src: "/images/photo-joshua-tree-4d7d48.png", place: "JOSHUA TREE, CA", focus: [0.64, 0.5], zoom: 1.4, gamma: 1.3, dither: "bayer", colour: 1 },
];
export const PHOTO_SOURCES = PHOTOS;
export const PHOTO_ROWS = 19;

const photos: PageDef = {
  num: 400,
  title: "Photos",
  fast: [["Index", 100], ["About", 110], ["Radio", 500], ["Junk", 700]],
  rotate: 15,
  render: (ctx) =>
    PHOTOS.map((p, i) => [
      bar("400", "Photos · press ? to reveal", { a: "w", b: "b", right: subLabel(i, PHOTOS.length) }),
      ...(ctx.photos[p.key] ?? [
        ...Array(8).fill(0).map(blank),
        row(s(pad("RECEIVING PICTURE...", COLS, "c"), "c", undefined, { flash: true })),
        ...Array(PHOTO_ROWS - 9).fill(0).map(blank),
      ]),
      blank(),
      row(s(" WHERE WAS THIS TAKEN? ", "y"), s(p.place, "w", undefined, { conceal: true })),
    ]),
};

function ago(uts?: number) {
  if (!uts) return "     ";
  const d = new Date(uts * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const radio: PageDef = {
  num: 500,
  title: "Radio",
  fast: [["Index", 100], ["About", 110], ["Contact", 300], ["Photos", 400]],
  render: (ctx) => {
    const heading = bigText("Radio", { fg: "w" });
    heading[1] = put(heading[1], 30, s(" ON AIR ", "w", "r", { flash: true }));
    const top = [...heading, bar("500", "Last.fm · scrobbling live", { a: "m", b: "b" }), blank()];
    const { state, tracks } = ctx.music;
    if (state !== "ok" || !tracks.length) {
      return [
        [
          ...top,
          ...Array(6).fill(0).map(blank),
          row(s(pad(state === "error" ? "NO SIGNAL" : "SEARCHING FOR SIGNAL...", COLS, "c"), state === "error" ? "r" : "c", undefined, { flash: true })),
        ],
      ];
    }
    const [cur, ...rest] = tracks;
    return [
      [
        ...top,
        cur.now ? row(s(" NOW PLAYING ", "k", "g", { flash: true })) : row(s(" LAST PLAYED ", "k", "c"), s(" " + ago(cur.uts), "c")),
        dh(row(s(" " + fit(cur.name, 38).trimEnd(), "y", undefined, { id: "np-track" }))),
        row(s(" " + fit(cur.artist, 38), "w")),
        row(s(" " + fit(cur.album || "", 38), "c")),
        blank(),
        fill("b", s(" RECENTLY PLAYED", "y")),
        ...rest.slice(0, 8).map((t) => row(s(" " + ago(t.uts) + " ", "c"), s(fit(`${t.artist} - ${t.name}`, 32), "w"))),
        blank(),
        linkRow(row(s(" Full history at last.fm/user/tybura ↗", "c")), "https://www.last.fm/user/tybura"),
      ],
    ];
  },
};

const junk: PageDef = {
  num: 700,
  title: "Junkyard",
  fast: [["Index", 100], ["Story", 120], ["Photos", 400], ["Radio", 500]],
  rotate: 15,
  render: (ctx) => {
    const pages = chunk(ctx.junk.slice(0, 48), 15);
    return pages.map((list, i) => [
      ...head("Junkyard", "y", "700", `Objects I own or noticed · ${ctx.junkCount}`, i, pages.length, { a: "y", b: "r" }),
      fill("b", s(" " + pad("DATE", 9) + pad("OBJECT", 20) + "CATEGORY", "y")),
      ...list.map((j) =>
        linkRow(
          row(s(" " + j.d + " ", "c"), s(fit(j.t || `Untitled #${j.id.split("-").pop()}`, 19) + " ", j.t ? "w" : "w"), s(fit(j.c ?? "", 9), "g")),
          "/junk",
        ),
      ),
      ...Array(15 - list.length).fill(0).map(blank),
      blank(),
      linkRow(row(s(" Browse the full junkyard ", "w"), s("....... ", "w"), s("/junk ↗", "c")), "/junk"),
    ]);
  },
};

const SIGNS: [string, string, string, string][] = [
  ["ARIES", "21.03-19.04", "A client asks for a bigger logo.", "Make it 4% bigger. Nobody notices."],
  ["TAURUS", "20.04-20.05", "Your Figma file hits 1,000 layers.", "All of them are named Frame."],
  ["GEMINI", "21.05-20.06", "Two founders, two opinions, one Friday.", "Ship the third option."],
  ["CANCER", "21.06-22.07", "Light mode will test your patience.", "Dark mode will heal you."],
  ["LEO", "23.07-22.08", "Your portfolio wins an award.", "Mum still asks what you do."],
  ["VIRGO", "23.08-22.09", "The kerning is off.", "You know exactly where."],
  ["LIBRA", "23.09-22.10", "Serif or sans? The stars say:", "Yes."],
  ["SCORPIO", "23.10-21.11", 'Someone says "just make it pop".', "Breathe in. Breathe out. Add grain."],
  ["SAGITTARIUS", "22.11-21.12", "A deploy on Friday afternoon.", "You will feel alive."],
  ["CAPRICORN", "22.12-19.01", "Series A. Rebrand. Series B.", "Rebrand again."],
  ["AQUARIUS", "20.01-18.02", "A stranger invites you to a webring.", "Join it. It changes everything."],
  ["PISCES", "19.02-20.03", "A message from the universe:", "Lorem ipsum dolor sit amet."],
];

const horoscope: PageDef = {
  num: 666,
  title: "Horoscope",
  fast: [["Index", 100], ["Radio", 500], ["Contact", 300], ["Junk", 700]],
  rotate: 20,
  render: () => {
    const pages = chunk(SIGNS, 6);
    return pages.map((signs, i) => [
      ...head("Horoscope", "m", "666", "For designers · ? reveals", i, pages.length, { a: "m", b: "b" }),
      ...signs.flatMap(([name, dates, a, b]) => [
        row(s(" " + pad(name, 12), "y"), s(dates, "c")),
        row(s(" " + a, "w")),
        row(s(" " + b, "g", undefined, { conceal: true })),
      ]),
    ]);
  },
};

export const PAGES: Record<number, PageDef> = Object.fromEntries(
  [index, about, story, projects, contact, photos, radio, junk, horoscope].map((p) => [p.num, p]),
);

export function notFound(num: number): PageDef {
  return {
    num,
    title: "Not found",
    fast: [["Index", 100], ["About", 110], ["Projects", 200], ["Contact", 300]],
    render: () => [
      [
        ...bigText("404", { fg: "r", scale: 2, x: 9, bold: true }),
        blank(),
        row(s(pad(`PAGE ${num} NOT IN TRANSMISSION`, COLS, "c"), "y")),
        blank(),
        row(s(pad("Even Ceefax had bad days.", COLS, "c"), "w")),
        blank(),
        blank(),
        leader("Back to the index", 100),
        leader("Horoscope instead?", 666, { fg: "m", numFg: "m" }),
      ],
    ],
  };
}

// ---------------------------------------------------------- chrome rows

export function fastextRow(items: [string, number][]): Row {
  const colors: C[] = ["r", "g", "y", "c"];
  return row(...items.map(([label, page], i) => s(pad(i === 0 ? label : " " + label, 10), colors[i], undefined, { page, id: `fast${i}` })));
}

export function promos(ctx: Ctx): Row[] {
  const np = ctx.music.tracks[0];
  const list: [string, number, C, C][] = [
    ["STARTUP FOUNDERS IN YOUR AREA!", 300, "w", "m"],
    ["HOROSCOPE 2026 FOR DESIGNERS", 666, "k", "c"],
    [`${ctx.junkCount} OBJECTS IN THE JUNKYARD`, 700, "y", "r"],
    ["LOGO NOT BIG ENOUGH? CALL NOW", 300, "b", "y"],
  ];
  if (np) list.splice(1, 0, [`${np.now ? "ON AIR" : "LAST"}: ${np.artist} - ${np.name}`.toUpperCase(), 500, "y", "b"]);
  return list.map(([text, page, fg, bg]) => {
    const n = String(page);
    const body = fit(" " + text, COLS - n.length - 3).trimEnd();
    const dots = COLS - body.length - n.length - 3;
    return linkRow(fill(bg, s(body + " " + ".".repeat(Math.max(0, dots)) + " ", fg), s(n + " ", fg)), page);
  });
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

export function headerRow(o: { p: string; counter: string; date: Date; hold?: boolean }): Row {
  const d = o.date;
  const date = `${DAYS[d.getDay()]} ${two(d.getDate())} ${MONTHS[d.getMonth()]}`;
  const time = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  return row(
    s(" " + pad(o.p, 4), "w", undefined, { id: "hp" }),
    s(o.hold ? " HOLD      " : " TYBURATEXT", o.hold ? "r" : "c", undefined, { id: "hs" }),
    s(" "),
    s(o.counter, "w", undefined, { id: "hc" }),
    s(" "),
    s(date, "w", undefined, { id: "hd" }),
    s(" "),
    s(time, "y", undefined, { id: "ht" }),
  );
}
