#!/usr/bin/env python3
"""Erzeugt screenshot.png (1200x630) aus dem realistischen SVG-Preview.

Der Screenshot wird mit Google Chrome headless gerastert, damit Verlaeufe,
Filter und Planetenkugeln exakt wie in der Web-App aussehen.

Aufruf:
    node tools/preview_themes.js      # erzeugt previews/theme-realistic.svg
    python3 tools/make_og.py          # erzeugt screenshot.png
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, "previews", "theme-realistic.svg")
LOGO = os.path.join(ROOT, "logo.svg")
HTML = os.path.join(ROOT, "tools", "og.html")
OUT = os.path.join(ROOT, "screenshot.png")
CHROME = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium")


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def fit_svg(svg):
    """SVG fuellt den Kartenrahmen, Seitenverhaeltnis bleibt erhalten."""
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    svg = re.sub(r"<svg([^>]*?)\swidth=\"[^\"]*\"", r"<svg\1", svg, count=1)
    svg = re.sub(r"<svg([^>]*?)\sheight=\"[^\"]*\"", r"<svg\1", svg, count=1)
    svg = svg.replace(
        "<svg",
        '<svg preserveAspectRatio="xMidYMid meet" width="100%" height="100%"',
        1,
    )
    return svg


def main():
    if not os.path.exists(SVG):
        sys.exit("previews/theme-realistic.svg fehlt - zuerst `node tools/preview_themes.js` ausfuehren.")
    if not CHROME:
        sys.exit("Google Chrome / Chromium nicht gefunden.")

    map_svg = fit_svg(read(SVG))
    logo_svg = read(LOGO)
    logo_svg = re.sub(r"\swidth=\"64\"\s+height=\"64\"", "", logo_svg, count=1)

    html = f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>TI4 Balanced Map Generator - by Barci + AI</title>
<style>
  *{{box-sizing:border-box;}}
  html,body{{margin:0;width:1200px;height:630px;overflow:hidden;
    background:radial-gradient(ellipse at 32% 34%,#0d1b30 0%,#060b15 56%,#02040a 100%);
    color:#e6eefb;font-family:system-ui,"DejaVu Sans",sans-serif;}}
  .wrap{{display:flex;align-items:center;gap:26px;height:100%;padding:34px 40px 44px;box-sizing:border-box;}}
  .left{{width:428px;flex:0 0 428px;}}
  .brand{{display:flex;align-items:center;gap:14px;margin-bottom:20px;}}
  .brand svg{{width:60px;height:60px;filter:drop-shadow(0 0 16px rgba(80,150,230,.5));}}
  .eyebrow{{font-size:12px;letter-spacing:2.4px;text-transform:uppercase;color:#7fa8d8;font-weight:700;}}
  h1{{margin:4px 0 0;font-size:41px;line-height:1.04;letter-spacing:.2px;}}
  .byline{{margin-top:10px;font-size:21px;font-weight:700;color:#9cc2ee;letter-spacing:.4px;}}
  .tag{{margin-top:18px;font-size:16px;line-height:1.5;color:#b8c9e2;}}
  ul{{margin:24px 0 0;padding:0;list-style:none;}}
  li{{display:flex;gap:9px;align-items:flex-start;margin:0 0 12px;font-size:15px;line-height:1.35;color:#cfe0f5;}}
  li b{{color:#ffffff;}}
  .ck{{color:#5fd08a;font-weight:800;}}
  .map{{flex:1;height:100%;display:flex;align-items:center;justify-content:center;}}
  .panel{{position:relative;width:100%;height:100%;border:1px solid #1d2c42;border-radius:18px;
    background:rgba(6,12,22,.55);overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 0 70px rgba(30,80,150,.22) inset,0 12px 44px rgba(0,0,0,.5);}}
  .mapwrap{{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;padding:10px 10px 0;}}
  .mapwrap > svg{{width:100%;height:100%;}}
  .legend{{width:100%;display:flex;flex-wrap:wrap;gap:3px 13px;padding:8px 14px 12px;
    font-size:10.5px;line-height:1.5;color:#a9bdd6;background:linear-gradient(to top,rgba(4,8,14,.95),rgba(4,8,14,.55));
    border-top:1px solid #16233a;}}
  .legend b{{color:#e6eefb;}}
  .dot{{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:middle;
    border:1px solid rgba(0,0,0,.45);}}
  .glyph{{color:#ffd479;font-weight:700;}}
  .credit{{position:absolute;left:40px;bottom:18px;font-size:11px;color:#7689a4;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="left">
    <div class="brand">{logo_svg}<div>
      <div class="eyebrow">3&ndash;6 Spieler &middot; Fan-Projekt</div>
      <h1>TI4 Balanced<br>Map Generator</h1>
    </div></div>
    <div class="byline">by Barci + AI</div>
    <p class="tag">Ausgeglichene Karten f&uuml;r 3&ndash;6 Spieler &ndash; automatisch
      &uuml;ber f&uuml;nf Balance-Bewertungen optimiert.</p>
    <ul>
      <li><span class="ck">&#10003;</span><span><b>5 Evaluatoren:</b> Simple Slice, Joebrew,
        Resource-, Influence- &amp; Tech-Access</span></li>
      <li><span class="ck">&#10003;</span><span><b>Wormholes paarweise</b> &ndash; nie am Heimsystem</span></li>
      <li><span class="ck">&#10003;</span><span><b>Faktions-Merkmale</b> in Reichweite
        (Muaat, Saar, Empyrean, Vuil'raith, Creuss)</span></li>
      <li><span class="ck">&#10003;</span><span><b>Map-String</b> plus PNG- &amp; SVG-Export</span></li>
      <li><span class="ck">&#10003;</span><span>Grundspiel, Prophecy of Kings &amp; Thunder's Edge</span></li>
    </ul>
  </div>
  <div class="map"><div class="panel">
    <div class="mapwrap">{map_svg}</div>
    <div class="legend">
      <span><i class="dot" style="background:#2f5486"></i><b>blau</b> besiedelbar</span>
      <span><i class="dot" style="background:#6e3a32"></i><b>rot</b> leer/Anomalie</span>
      <span><i class="dot" style="background:#39a05c"></i><b>HOME</b></span>
      <span><i class="dot" style="background:#9b7f2e"></i><b>Mecatol Rex</b></span>
      <span><span class="glyph">SN</span> Supernova</span>
      <span><span class="glyph">NEB</span> Nebel</span>
      <span><span class="glyph">AST</span> Asteroiden</span>
      <span><span class="glyph">GR</span> Riss</span>
      <span><span class="glyph">&#945; &#946;</span> Wormhole</span>
      <span><span class="glyph">&#9733;</span> legend&auml;r</span>
      <span><span class="glyph">&#8962;</span> Station</span>
    </div>
  </div></div>
</div>
<div class="credit">Nicht-kommerzielles Fan-Projekt &middot; Layouts &amp; Tile-Daten:
  TI4 Map Lab (CC BY-SA 4.0) &middot; Twilight Imperium &copy; FFG / Asmodee</div>
</body>
</html>
"""
    with open(HTML, "w", encoding="utf-8") as fh:
        fh.write(html)

    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1200,630",
        "--screenshot=" + OUT,
        "file://" + HTML,
    ]
    print("running:", " ".join(cmd))
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("wrote:", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
