#!/usr/bin/env python3
"""Compile config.json -> config.js (window.CONFIG) and create local
placeholder images at the asset paths referenced in config.json.
Run from the template folder:  python3 build_config.py
"""
import json, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(HERE, "config.json")))

brand = cfg["brand"]
biz = cfg["business"]
addr = biz["address"]

# Weekday index map (Mon=0 .. Sun=6) derived from the FR labels of each
# hours group so the JS only deals with plain day indices.
DAY_IDX = {"Lundi": [0], "Mardi": [1], "Mercredi": [2], "Jeudi": [3],
           "Vendredi": [4], "Samedi": [5], "Dimanche": [6]}

hours = []
for g in biz["hours"]:
    fr = g["days"]["fr"]
    days = []
    for part in [p.strip() for p in fr.split("–")]:
        days += DAY_IDX[part]
    lo, hi = days[0], days[-1]
    days = list(range(lo, hi + 1))
    hours.append({
        "days": days,
        # localized range labels reused verbatim by the hours list
        "label": {l: g["days"][l].replace(" – ", "–") for l in ("fr", "en", "ar")},
        "open": g["open"],
        "close": g["close"],
    })

out = {
    "name": brand["name"],
    "phone": biz["phone"],
    "email": biz["email"],
    "whatsapp": biz.get("whatsapp") or biz.get("whatsapp_digits") or biz.get("whatsapp_spaced"),
    "address": {
        "street": addr["street"], "district": addr["district"],
        "city": addr["city"], "postalCode": addr["postalCode"],
        "country": addr["country"], "mapsQuery": addr["mapsUrl"].split("q=")[-1],
    },
    "social": biz.get("social", {}),
    "reservation": biz.get("reservation", {}),
    "hours": hours,
    "seo": cfg.get("seo", {}),
    "images": cfg.get("images", {}),
    "theme": cfg.get("theme", {}),
    "rating": cfg.get("rating", {}),
    # fabricated testimonials must never ship silently — flag drives the
    # visible "sample reviews" disclaimer in script.js (renderReviews)
    "reviewsSample": cfg.get("reviewsSample", False),
}
# point image paths at real local files (placeholders generated below)
imgs = out["images"]

# per-dish photo map: match each menu item name to a gallery image by keyword
# dish photos come from the downloaded Maps photos (manifest order)
_MANIFEST = json.load(open(os.path.join(HERE, "assets", "img", "manifest.json")))
def _mp(i):
    return _MANIFEST[i % len(_MANIFEST)].lstrip("/")
KEYWORDS = [
    ("tagine", 0), ("tajine", 0), ("tanjia", 0),
    ("pastilla", 1), ("couscous", 2), ("tea", 3), ("the", 3),
    ("salad", 4), ("harira", 4), ("soup", 4), ("bissara", 4),
]
_DEFAULT_DISH = 5
def dish_photo(name):
    n = name.lower()
    for kw, idx in KEYWORDS:
        if kw in n:
            return _mp(idx)
    return _mp(_DEFAULT_DISH)

def localize(p):
    """keep the real extension; just strip leading slash"""
    return p.lstrip("/")

imgs["hero"] = localize(imgs["hero"])
imgs["gallery"] = [localize(p) for p in imgs.get("gallery", [])]

# build dishes list by reading the EN locale menu (names are shared keys across locales)
try:
    menu_items = json.load(open(os.path.join(HERE, "locales", "en.json")))["menu"]["items"]
except Exception:
    menu_items = []
dishes = []
for it in menu_items:
    src = dish_photo(it["name"])
    if src and not any(d["name"] == it["name"] for d in dishes):
        dishes.append({"name": it["name"], "src": src})
if dishes:
    imgs["dishes"] = dishes

with open(os.path.join(HERE, "config.js"), "w") as f:
    f.write("/* AUTO-GENERATED from config.json by build_config.py — do not edit by hand */\n")
    f.write("window.CONFIG = ")
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write(";\n")

# ---- placeholder images -------------------------------------------------
PALETTES = [
    ("#8B2F1F", "#C89B3C"), ("#1E4B3A", "#C89B3C"), ("#5A2A12", "#D98E4A"),
    ("#3A2438", "#B8544A"), ("#204048", "#7FB0A0"), ("#6B3A1F", "#E0B15E"),
]
def svg(w, h, c1, c2, label):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/>
</linearGradient></defs>
<rect width="{w}" height="{h}" fill="url(#g)"/>
<g fill="#ffffff" opacity=".35">
<circle cx="{w*0.72:.0f}" cy="{h*0.28:.0f}" r="{min(w,h)*0.18:.0f}"/>
<circle cx="{w*0.25:.0f}" cy="{h*0.7:.0f}" r="{min(w,h)*0.26:.0f}"/>
</g>
<text x="50%" y="52%" text-anchor="middle" font-family="sans-serif"
 font-size="{min(w,h)*0.09:.0f}" fill="#ffffff" opacity=".9">{label}</text>
</svg>"""

targets = [out["images"]["hero"]] if out["images"].get("hero") else []
for d in imgs.get("dishes", []):
    if d["src"] not in targets:
        targets.append(d["src"])
for p in out["images"]["gallery"]:
    if p not in targets:
        targets.append(p)
# only generate placeholders for paths that don't exist as real images
made = 0
for i, rel in enumerate(targets):
    path = os.path.join(HERE, rel)
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        continue   # real photo already there — never overwrite
    os.makedirs(os.path.dirname(path), exist_ok=True)
    c1, c2 = PALETTES[i % len(PALETTES)]
    w, h = (1600, 1000) if i == 0 else (900, 700)
    open(path, "w").write(svg(w, h, c1, c2, brand["name"]))
    made += 1
print("wrote config.js and", made, "placeholder images")
