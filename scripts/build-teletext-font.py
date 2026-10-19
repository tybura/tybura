#!/usr/bin/env python3
"""
Builds the TybText teletext webfonts used by the teletext prototype.

Glyphs are drawn on the classic SAA5050 6x10 cell (5x9 glyph, 1 blank column
on the left and 1 blank row on top), then upscaled 2x with the SAA5050
"character rounding" rule, so diagonals get the half-step smoothing you see
on real TV sets. Sextant mosaics (2x3 blocks) live in the Private Use Area:
U+E000 + mask (contiguous) and U+E040 + mask (separated), where the mask bits
are 1=TL 2=TR 4=ML 8=MR 16=BL 32=BR. Unicode sextants (U+1FB00..) and the
full/half blocks map onto the same glyphs.

Three widths are emitted, all 1em tall (ascent 800, descent 200):
  tybtext-wide.woff2    advance 0.8em   (4:3 TV pixels, landscape screens)
  tybtext.woff2         advance 0.6em   (square pixels, portrait tablets)
  tybtext-narrow.woff2  advance 0.45em  (tall pixels, phones held upright)

Also writes src/teletext/glyphs.json with the 1x bitmaps, which the page uses
to draw big mosaic headlines out of the very same letters.

Usage: python3 scripts/build-teletext-font.py   (needs fonttools + brotli)
"""
import json
import os

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FONTS = os.path.join(ROOT, "public", "fonts", "teletext")
OUT_JSON = os.path.join(ROOT, "src", "teletext", "glyphs.json")

G = {}


def g(chars, start, rows):
    for ch in chars:
        G[ch] = (start, rows.split())


# ---- digits ---------------------------------------------------------------
g("0", 1, "..#.. .#.#. #...# #...# #...# .#.#. ..#..")
g("1", 1, "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.")
g("2", 1, ".###. #...# ....# ..##. .#... #.... #####")
g("3", 1, "##### ....# ...#. ..##. ....# #...# .###.")
g("4", 1, "...#. ..##. .#.#. #..#. ##### ...#. ...#.")
g("5", 1, "##### #.... ####. ....# ....# #...# .###.")
g("6", 1, "..##. .#... #.... ####. #...# #...# .###.")
g("7", 1, "##### ....# ...#. ..#.. .#... .#... .#...")
g("8", 1, ".###. #...# #...# .###. #...# #...# .###.")
g("9", 1, ".###. #...# #...# .#### ....# ...#. .##..")

# ---- capitals -------------------------------------------------------------
g("A", 1, "..#.. .#.#. #...# #...# ##### #...# #...#")
g("B", 1, "####. #...# #...# ####. #...# #...# ####.")
g("C", 1, ".###. #...# #.... #.... #.... #...# .###.")
g("D", 1, "####. #...# #...# #...# #...# #...# ####.")
g("E", 1, "##### #.... #.... ####. #.... #.... #####")
g("F", 1, "##### #.... #.... ####. #.... #.... #....")
g("G", 1, ".###. #...# #.... #.... #..## #...# .####")
g("H", 1, "#...# #...# #...# ##### #...# #...# #...#")
g("I", 1, ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.")
g("J", 1, "....# ....# ....# ....# ....# #...# .###.")
g("K", 1, "#...# #..#. #.#.. ##... #.#.. #..#. #...#")
g("L", 1, "#.... #.... #.... #.... #.... #.... #####")
g("M", 1, "#...# ##.## #.#.# #.#.# #...# #...# #...#")
g("N", 1, "#...# #...# ##..# #.#.# #..## #...# #...#")
g("O", 1, ".###. #...# #...# #...# #...# #...# .###.")
g("P", 1, "####. #...# #...# ####. #.... #.... #....")
g("Q", 1, ".###. #...# #...# #...# #.#.# #..#. .##.#")
g("R", 1, "####. #...# #...# ####. #.#.. #..#. #...#")
g("S", 1, ".###. #...# #.... .###. ....# #...# .###.")
g("T", 1, "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..")
g("U", 1, "#...# #...# #...# #...# #...# #...# .###.")
g("V", 1, "#...# #...# #...# .#.#. .#.#. ..#.. ..#..")
g("W", 1, "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.")
g("X", 1, "#...# #...# .#.#. ..#.. .#.#. #...# #...#")
g("Y", 1, "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..")
g("Z", 1, "##### ....# ...#. ..#.. .#... #.... #####")

# ---- lowercase ------------------------------------------------------------
g("a", 3, ".###. ....# .#### #...# .####")
g("b", 1, "#.... #.... #.##. ##..# #...# #...# ####.")
g("c", 3, ".#### #.... #.... #.... .####")
g("d", 1, "....# ....# .##.# #..## #...# #...# .####")
g("e", 3, ".###. #...# ##### #.... .###.")
g("f", 1, "..##. .#... .#... ####. .#... .#... .#...")
g("g", 3, ".#### #...# #...# #...# .#### ....# .###.")
g("h", 1, "#.... #.... #.##. ##..# #...# #...# #...#")
g("i", 1, "..#.. ..... .##.. ..#.. ..#.. ..#.. .###.")
g("j", 1, "...#. ..... ..##. ...#. ...#. ...#. ...#. ...#. .##..")
g("k", 1, ".#... .#... .#..# .#.#. .##.. .#.#. .#..#")
g("l", 1, ".##.. ..#.. ..#.. ..#.. ..#.. ..#.. .###.")
g("m", 3, "##.#. #.#.# #.#.# #.#.# #.#.#")
g("n", 3, "#.##. ##..# #...# #...# #...#")
g("o", 3, ".###. #...# #...# #...# .###.")
g("p", 3, "####. #...# #...# #...# ####. #.... #....")
g("q", 3, ".#### #...# #...# #...# .#### ....# ....#")
g("r", 3, "#.### ##... #.... #.... #....")
g("s", 3, ".#### #.... .###. ....# ####.")
g("t", 2, ".#... ####. .#... .#... .#... ..##.")
g("u", 3, "#...# #...# #...# #..## .##.#")
g("v", 3, "#...# #...# .#.#. .#.#. ..#..")
g("w", 3, "#...# #...# #.#.# #.#.# .#.#.")
g("x", 3, "#...# .#.#. ..#.. .#.#. #...#")
g("y", 3, "#...# #...# #...# #...# .#### ....# .###.")
g("z", 3, "##### ...#. ..#.. .#... #####")

# ---- Polish (national option set) ----------------------------------------
g("ą", 3, ".###. ....# .#### #...# .#### ...#. ...##")
g("ć", 0, "...#. ..#.. ..... .#### #.... #.... #.... .####")
g("ę", 3, ".###. #...# ##### #.... .###. ..#.. ..##.")
g("ł", 1, ".##.. ..#.. ..##. .##.. ..#.. ..#.. .###.")
g("ń", 0, "...#. ..#.. ..... #.##. ##..# #...# #...# #...#")
g("ó", 0, "...#. ..#.. ..... .###. #...# #...# #...# .###.")
g("ś", 0, "...#. ..#.. ..... .#### #.... .###. ....# ####.")
g("ź", 0, "...#. ..#.. ..... ##### ...#. ..#.. .#... #####")
g("ż", 1, "..#.. ..... ##### ...#. ..#.. .#... #####")
g("Ą", 1, "..#.. .#.#. #...# #...# ##### #...# #...# ...#. ...##")
g("Ć", 0, "...#. ..... .###. #...# #.... #.... #...# .###.")
g("Ę", 1, "##### #.... #.... ####. #.... #.... ##### ...#. ...##")
g("Ł", 1, ".#... .#... .#.#. .##.. ##... .#... .####")
g("Ń", 0, "...#. ..... #...# ##..# #.#.# #..## #...# #...#")
g("Ó", 0, "...#. ..... .###. #...# #...# #...# #...# .###.")
g("Ś", 0, "...#. ..... .#### #.... .###. ....# ....# ####.")
g("Ź", 0, "...#. ..... ##### ...#. ..#.. .#... #.... #####")
g("Ż", 0, "..#.. ..... ##### ...#. ..#.. .#... #.... #####")
g("é", 0, "...#. ..#.. ..... .###. #...# ##### #.... .###.")
g("ü", 1, ".#.#. ..... #...# #...# #...# #..## .##.#")
g("ö", 1, ".#.#. ..... .###. #...# #...# #...# .###.")

# ---- punctuation ----------------------------------------------------------
g("!", 1, "..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..")
g('"“”', 1, ".#.#. .#.#. .#.#.")
g("#", 1, ".#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.")
g("$", 1, ".###. #.#.# #.#.. .###. ..#.# #.#.# .###.")
g("%", 1, "##... ##..# ...#. ..#.. .#... #..## ...##")
g("&", 1, ".#... #.#.. #.#.. .#... #.#.# #..#. .##.#")
g("'’‘", 1, "..#.. ..#.. .#...")
g("(", 1, "...#. ..#.. .#... .#... .#... ..#.. ...#.")
g(")", 1, ".#... ..#.. ...#. ...#. ...#. ..#.. .#...")
g("*", 2, "..#.. #.#.# .###. #.#.# ..#..")
g("+", 2, "..#.. ..#.. ##### ..#.. ..#..")
g(",", 7, "..#.. ..#.. .#...")
g("-", 4, ".###.")
g(".", 7, "..#..")
g("/", 2, "....# ...#. ..#.. .#... #....")
g(":", 3, "..#.. ..... ..... ..... ..#..")
g(";", 3, "..#.. ..... ..... ..... ..#.. ..#.. .#...")
g("<", 1, "...#. ..#.. .#... #.... .#... ..#.. ...#.")
g("=", 3, "##### ..... #####")
g(">", 1, ".#... ..#.. ...#. ....# ...#. ..#.. .#...")
g("?", 1, ".###. #...# ...#. ..#.. ..#.. ..... ..#..")
g("@", 1, ".###. #...# #.### #.#.# #.### #.... .###.")
g("[", 1, ".###. .#... .#... .#... .#... .#... .###.")
g("\\", 2, "#.... .#... ..#.. ...#. ....#")
g("]", 1, ".###. ...#. ...#. ...#. ...#. ...#. .###.")
g("^", 1, "..#.. .#.#. #...#")
g("_", 9, "######")
g("`", 1, ".#... ..#..")
g("{", 1, "...## ..#.. ..#.. ##... ..#.. ..#.. ...##")
g("|", 1, "..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..")
g("}", 1, "##... ..#.. ..#.. ...## ..#.. ..#.. ##...")
g("~", 3, ".#... #.#.# ...#.")

# ---- symbols --------------------------------------------------------------
g("•", 3, ".###. .###. .###.")
g("·", 4, "..#..")
g("…", 7, "#.#.#")
g("–", 4, "#####")
g("—", 4, "######")
g("→", 2, "..#.. ...#. ##### ...#. ..#..")
g("←", 2, "..#.. .#... ##### .#... ..#..")
g("↑", 1, "..#.. .###. #.#.# ..#.. ..#.. ..#.. ..#..")
g("↓", 1, "..#.. ..#.. ..#.. ..#.. #.#.# .###. ..#..")
g("↗", 2, "..### ...## ..#.# .#... #....")
g("▶", 1, "#.... ##... ###.. ####. ###.. ##... #....")
g("◀", 1, "....# ...## ..### .#### ..### ...## ....#")
g("°", 1, ".##.. #..#. .##..")
g("®", 1, "##... #.#.. ##... #.#..")
g("×", 2, "#...# .#.#. ..#.. .#.#. #...#")
g("£", 1, "..##. .#..# .#... ###.. .#... .#... #####")
g("♪", 1, "..#.. ..##. ..#.# ..#.. .##.. ###.. .#...")

CELL_W, CELL_H = 6, 10


def bitmap(start, rows):
    bm = [[0] * CELL_W for _ in range(CELL_H)]
    for i, r in enumerate(rows):
        if len(r) == 5:
            r = "." + r
        assert len(r) == CELL_W, r
        for x, c in enumerate(r):
            if c == "#":
                bm[start + i][x] = 1
    return bm


def round2x(bm):
    """SAA5050 character rounding: double the matrix and fill the inner
    corners of every diagonal step with half-dots."""
    H, W = len(bm), len(bm[0])
    U = [[0] * (W * 2) for _ in range(H * 2)]
    for y in range(H):
        for x in range(W):
            if bm[y][x]:
                for dy in (0, 1):
                    for dx in (0, 1):
                        U[2 * y + dy][2 * x + dx] = 1
    for y in range(H - 1):
        for x in range(W - 1):
            a, b = bm[y][x], bm[y][x + 1]
            c, d = bm[y + 1][x], bm[y + 1][x + 1]
            if a and d and not b and not c:
                U[2 * y + 1][2 * x + 2] = 1
                U[2 * y + 2][2 * x + 1] = 1
            if b and c and not a and not d:
                U[2 * y + 1][2 * x + 1] = 1
                U[2 * y + 2][2 * x + 2] = 1
    return U


def mosaic(mask, separated):
    """Sextant on the 12x20 doubled grid: columns 6/6, rows 6/8/6."""
    U = [[0] * 12 for _ in range(20)]
    cols = [(0, 6), (6, 12)]
    rows = [(0, 6), (6, 14), (14, 20)]
    for bit in range(6):
        if not mask & (1 << bit):
            continue
        x0, x1 = cols[bit % 2]
        y0, y1 = rows[bit // 2]
        if separated:
            x0 += 2
            y1 -= 2
        for y in range(y0, y1):
            for x in range(x0, x1):
                U[y][x] = 1
    return U


def rects(U):
    """Horizontal runs, merged vertically where runs line up."""
    out = []
    open_runs = {}
    for y, row in enumerate(U + [[0] * len(U[0])]):
        runs = []
        x = 0
        while x < len(row):
            if row[x]:
                x0 = x
                while x < len(row) and row[x]:
                    x += 1
                runs.append((x0, x))
            else:
                x += 1
        nxt = {}
        for run in runs:
            if run in open_runs:
                nxt[run] = open_runs.pop(run)
            else:
                nxt[run] = y
        for (x0, x1), y0 in open_runs.items():
            out.append((x0, y0, x1, y))
        open_runs = nxt
    return out


def glyph_from(U, adv):
    pen = TTGlyphPen(None)
    xmin = None
    for x0, y0, x1, y1 in rects(U):
        X0, X1 = round(x0 * adv / 12), round(x1 * adv / 12)
        Ytop, Ybot = 800 - y0 * 50, 800 - y1 * 50
        pen.moveTo((X0, Ybot))
        pen.lineTo((X0, Ytop))
        pen.lineTo((X1, Ytop))
        pen.lineTo((X1, Ybot))
        pen.closePath()
        xmin = X0 if xmin is None else min(xmin, X0)
    return pen.glyph(), (xmin or 0)


def sextant_codepoints():
    """mask -> Unicode codepoint for the 'Symbols for Legacy Computing' sextants."""
    cps = {0: 0x20, 21: 0x258C, 42: 0x2590, 63: 0x2588}
    i = 0
    for mask in range(1, 63):
        if mask in (21, 42):
            continue
        cps[mask] = 0x1FB00 + i
        i += 1
    return cps


def build(adv, family, filename):
    order = [".notdef", "space"]
    cmap = {0x20: "space", 0xA0: "space"}
    glyphs, metrics = {}, {}

    pen = TTGlyphPen(None)
    for x0, y0, x1, y1 in [(50, -150, adv - 50, -100), (50, 700, adv - 50, 750),
                           (50, -100, 100, 700), (adv - 100, -100, adv - 50, 700)]:
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    glyphs[".notdef"] = pen.glyph()
    metrics[".notdef"] = (adv, 50)
    glyphs["space"] = TTGlyphPen(None).glyph()
    metrics["space"] = (adv, 0)

    for ch, (start, rows) in G.items():
        name = "u%04X" % ord(ch)
        gl, lsb = glyph_from(round2x(bitmap(start, rows)), adv)
        order.append(name)
        glyphs[name] = gl
        metrics[name] = (adv, lsb)
        cmap[ord(ch)] = name

    uni = sextant_codepoints()
    for sep in (0, 1):
        for mask in range(64):
            name = ("sep%02d" if sep else "mos%02d") % mask
            gl, lsb = glyph_from(mosaic(mask, sep), adv)
            order.append(name)
            glyphs[name] = gl
            metrics[name] = (adv, lsb)
            cmap[(0xE040 if sep else 0xE000) + mask] = name
            if not sep and mask != 0:
                cmap[uni[mask]] = name

    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=800, descent=-200, lineGap=0)
    fb.setupNameTable({
        "familyName": family,
        "styleName": "Regular",
        "copyright": "Drawn for tybura.com after the Mullard SAA5050 character set",
    })
    fb.setupOS2(
        sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=0,
        usWinAscent=800, usWinDescent=200,
        sxHeight=500, sCapHeight=700, xAvgCharWidth=adv,
        fsSelection=0x40 | 0x80, achVendID="TYBR", version=4,
    )
    fb.setupPost(isFixedPitch=1)
    os.makedirs(OUT_FONTS, exist_ok=True)
    ttf = os.path.join(OUT_FONTS, filename + ".ttf")
    fb.save(ttf)
    f = TTFont(ttf)
    f.flavor = "woff2"
    f.save(os.path.join(OUT_FONTS, filename + ".woff2"))
    os.remove(ttf)


build(600, "TybText", "tybtext")
build(800, "TybText Wide", "tybtext-wide")
build(450, "TybText Narrow", "tybtext-narrow")

# 1x bitmaps for mosaic headlines: each row is a 6-bit int, MSB = leftmost column.
data = {}
for ch, (start, rows) in G.items():
    bm = bitmap(start, rows)
    data[ch] = [int("".join(str(v) for v in r), 2) for r in bm]
os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
with open(OUT_JSON, "w") as fh:
    json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

print("glyphs:", len(G), "->", OUT_FONTS, OUT_JSON)
