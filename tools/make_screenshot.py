#!/usr/bin/env python3
"""tools/make_screenshot.py - rendert tools/map.json als PNG (1200x630, OG-tauglich)
nach screenshot.png. Reines Pillow, gezeichnete Tiles (keine gescannten FFG-Bilder)."""
import json, math, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
data = json.load(open(os.path.join(HERE, "map.json")))

W, H = 1200, 630
HEAD = 76
img = Image.new("RGB", (W, H), (7, 7, 12))
d = ImageDraw.Draw(img)

def font(size, bold=False):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
              "/usr/share/fonts/truetype/liberation/LiberationSans%s.ttf" % ("-Bold" if bold else ""),
              "/usr/share/fonts/truetype/freefont/FreeSans%s.ttf" % ("Bold" if bold else "")]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

F_TITLE = font(26, True)
F_SUB = font(15)
F_ID = font(13)
F_SMALL = font(12)
F_MEC = font(12)
F_HOMEV = font(21, True)

d.text((28, 16), data["title"], font=F_TITLE, fill=(232, 232, 240))
d.text((29, 48), data["subtitle"], font=F_SUB, fill=(154, 154, 176))
d.line((0, HEAD - 1, W, HEAD - 1), fill=(42, 42, 61))

cells = data["cells"]; place = data["place"]; systems = data["systems"]; hv = data["homeValues"]
factions = data.get("factions", {})

def proj(c, S):
    return (math.sqrt(3) * S * (c["x"] + c["z"] / 2.0), 1.5 * S * c["z"])

xs = [proj(c, 1)[0] for c in cells]; ys = [proj(c, 1)[1] for c in cells]
spanx = max(xs) - min(xs); spany = max(ys) - min(ys)
S = min((W - 60) / (spanx + math.sqrt(3) * 2.2), (H - HEAD - 40) / (spany + 3.0))
minx, miny = min(xs) * S, min(ys) * S
offx = (W - spanx * S) / 2 - minx
offy = HEAD + (H - HEAD - 40 - spany * S) / 2 - miny + 40

def xy(c):
    p = proj(c, S)
    return (p[0] + offx, p[1] + offy)

TRAIT = {0: (192, 57, 43), 1: (39, 174, 96), 2: (41, 128, 185)}
def hexpts(cx, cy, r):
    v = [(0, -r), (0.866 * r, -0.5 * r), (0.866 * r, 0.5 * r), (0, r), (-0.866 * r, 0.5 * r), (-0.866 * r, -0.5 * r)]
    return [(cx + a, cy + b) for a, b in v]

def ctext(cx, cy, txt, f, fill):
    b = d.textbbox((0, 0), str(txt), font=f)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), str(txt), font=f, fill=fill)

# ---- Pass 1: Flaechen ----
for c in cells:
    cx, cy = xy(c); t = c["type"]; key = "%d,%d,%d" % (c["x"], c["y"], c["z"]); sys = place.get(key)
    if t == 2: fill = (31, 122, 51)
    elif t == 3: fill = (122, 97, 24)
    elif t == 4: fill = (8, 8, 13)
    elif t == 5: fill = (13, 13, 22)
    elif t == 1 and sys: fill = (87, 44, 39) if systems[str(sys)]["red"] else (31, 58, 99)
    else: fill = (20, 20, 32)
    pts = hexpts(cx, cy, S)
    d.polygon(pts, fill=fill, outline=(0, 0, 0))
    d.line(pts + [pts[0]], fill=(0, 0, 0), width=2)

# ---- Pass 2: Inhalte ----
for c in cells:
    cx, cy = xy(c); t = c["type"]; key = "%d,%d,%d" % (c["x"], c["y"], c["z"]); sys = place.get(key)
    if t == 2:
        ctext(cx, cy - 16, "HOME", F_SMALL, (223, 245, 225))
        key = "%d,%d,%d" % (c["x"], c["y"], c["z"])
        if factions.get(key):
            ctext(cx, cy - 5, factions[key], F_SMALL, (255, 233, 168))
        ctext(cx, cy + 15, hv.get(key, ""), F_HOMEV, (255, 255, 255))
    elif t == 3:
        ctext(cx, cy - 12, "MECATOL", F_MEC, (255, 233, 168))
        ctext(cx, cy + 10, "1/6", F_SMALL, (255, 255, 255))
    elif t == 5:
        ctext(cx, cy, "~", F_SUB, (90, 90, 120))
    elif t == 1 and sys:
        s = systems[str(sys)]
        ctext(cx, cy - S * 0.50, sys, F_ID, (169, 186, 214))
        ps = s["planets"]; n = len(ps)
        spacing = min(S * 0.55, (S * 1.15) / (n - 1)) if n > 1 else 0
        dr = min(8.5, spacing * 0.42) if n > 1 else 8.5
        startx = cx - (n - 1) * spacing / 2
        for i, p in enumerate(ps):
            px = startx + i * spacing; py = cy - 2
            tcol = TRAIT.get(p["traits"][0], (127, 140, 141)) if p["traits"] else (127, 140, 141)
            d.ellipse((px - dr, py - dr, px + dr, py + dr), fill=tcol, outline=(0, 0, 0), width=2)
            if p["techs"]:
                tx, ty = px + dr * 0.75, py - dr * 0.75
                d.ellipse((tx - 6.5, ty - 6.5, tx + 6.5, ty + 6.5), fill=(16, 16, 16), outline=(230, 230, 240), width=1)
                ctext(tx, ty, p["techs"][0], F_SMALL, (255, 255, 255))
            ctext(px, py + dr + 11, "%d/%d" % (p["r"], p["i"]), F_SMALL, (223, 231, 245))
        glyphs = list(s["anomalies"])
        if s["wormhole"]: glyphs.append(s["wormhole"])
        if glyphs: ctext(cx, cy + S * 0.60, " ".join(glyphs), F_SMALL, (255, 212, 121))

d.text((28, H - 22), "gezeichnete Tiles \u00b7 Fan-Projekt \u00b7 Layouts/Tile-Daten: TI4 Map Lab (CC BY-SA 4.0)",
       font=F_SMALL, fill=(110, 110, 130))

out = os.path.join(ROOT, "screenshot.png")
img.save(out)
print("screenshot.png written:", out, img.size)
