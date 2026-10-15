#!/usr/bin/env python3
"""Laedt die offiziellen Map-Lab-Daten und baut daraus eine einzige data.js
(globale Konstanten, damit die App auch per file:// laeuft)."""
import json, urllib.request

BASE = "https://raw.githubusercontent.com/joepinion/ti4-map-lab/master/src/data/"

def get(name):
    with urllib.request.urlopen(BASE + name, timeout=25) as r:
        return r.read().decode("utf-8")

tiles = get("tile_data.js")
tiles = tiles.replace("export let ", "const ").replace("export const ", "const ")
layouts = get("default_layouts.json")
order = get("map_string_order.json")
evaluators = get("default_evaluators.json")

out = "// Auto-generated from joepinion/ti4-map-lab (CC BY-SA 4.0).\n"
out += "// Fan project - Twilight Imperium is (c) Fantasy Flight Games / Asmodee.\n"
out += tiles + "\n"
out += "const default_layouts = " + layouts + ";\n"
out += "const map_string_order_src = " + order + ";\n"
out += "const default_evaluators = " + evaluators + ";\n"

with open("data.js", "w") as f:
    f.write(out)
print("data.js written:", len(out), "bytes")
