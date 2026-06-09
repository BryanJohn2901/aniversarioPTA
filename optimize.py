#!/usr/bin/env python3
"""
Optimize images for PTA Aniversário landing page.
  - Hero WebP: resize + re-encode
  - Professor SVGs: extract embedded PNG → resize → WebP
"""
import os, re, base64, io
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))

# ── Hero images ────────────────────────────────────────────────────────────

def optimize_hero(fname, target_w, target_h, quality=82):
    p = os.path.join(ROOT, fname)
    orig = os.path.getsize(p)
    img = Image.open(p).convert('RGB')
    out = img.resize((target_w, target_h), Image.LANCZOS)
    out.save(p, 'WEBP', quality=quality, method=6)
    new = os.path.getsize(p)
    print(f"  {fname}: {img.size} → {out.size}  {orig//1024}KB → {new//1024}KB")

print("\n[optimize] Hero images")
optimize_hero('web.webp',    1440, 810)   # 1920x1080 → 1440x810
optimize_hero('MOBILE.webp', 750, 1334)  # 1080x1920 → 750x1334

# ── Professor SVGs → WebP ──────────────────────────────────────────────────

PROF_DIR = os.path.join(ROOT, 'professores')
TARGET_H = 600   # display h-[480px] + 1.25x retina headroom
QUALITY  = 83

# Matches xlink:href or href with any image MIME
B64_RE = re.compile(
    r'(?:xlink:)?href="data:img(?:e)?/(?:png|jpeg|jpg);base64,([^"]+)"',
    re.DOTALL
)

print("\n[optimize] Professor SVGs → WebP")
saved_total = 0
for i in range(4, 22):
    svg_name  = f'asset {i}.svg'
    webp_name = f'asset {i}.webp'
    svg_path  = os.path.join(PROF_DIR, svg_name)
    webp_path = os.path.join(PROF_DIR, webp_name)

    if not os.path.exists(svg_path):
        print(f"  SKIP  {svg_name} (not found)")
        continue

    with open(svg_path, 'r', encoding='utf-8', errors='replace') as f:
        svg = f.read()

    m = B64_RE.search(svg)
    if not m:
        print(f"  WARN  {svg_name}: no embedded image found")
        continue

    raw_b64 = m.group(1).replace('\n','').replace('\r','').replace(' ','')
    img_bytes = base64.b64decode(raw_b64)

    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    w, h = img.size
    target_w = round(w * TARGET_H / h)
    resized = img.resize((target_w, TARGET_H), Image.LANCZOS)
    resized.save(webp_path, 'WEBP', quality=QUALITY, method=6)

    orig_kb = os.path.getsize(svg_path) // 1024
    new_kb  = os.path.getsize(webp_path) // 1024
    saved   = orig_kb - new_kb
    saved_total += saved
    print(f"  {svg_name}: {w}x{h} → {target_w}x{TARGET_H}  {orig_kb}KB → {new_kb}KB  (saved {saved}KB)")

print(f"\n  Total saved vs SVGs: {saved_total//1024} MB")
print("\n[optimize] Done.")
