#!/usr/bin/env python3
"""Convert all PNG/JPG manuals in public/pdf/ to WebP at high quality."""
import os, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent / "public" / "pdf"
QUALITY = 85
EXTS = {".png", ".jpg", ".jpeg"}

if not ROOT.exists():
    print(f"Folder not found: {ROOT}")
    sys.exit(1)

total_in = 0
total_out = 0
converted = 0
errors = []

for path in sorted(ROOT.rglob("*")):
    if not path.is_file() or path.suffix.lower() not in EXTS:
        continue
    out = path.with_suffix(".webp")
    in_size = path.stat().st_size
    total_in += in_size
    try:
        with Image.open(path) as im:
            # Convert palettized PNGs to RGB before saving as WebP
            if im.mode == "P":
                im = im.convert("RGBA" if "transparency" in im.info else "RGB")
            elif im.mode == "CMYK":
                im = im.convert("RGB")
            im.save(out, "WEBP", quality=QUALITY, method=6)
        out_size = out.stat().st_size
        total_out += out_size
        converted += 1
        ratio = (1 - out_size / in_size) * 100
        print(f"OK  {path.relative_to(ROOT)}  {in_size//1024}KB -> {out_size//1024}KB  (-{ratio:.1f}%)")
        # Delete the original
        path.unlink()
    except Exception as e:
        errors.append((path, str(e)))
        print(f"ERR {path.relative_to(ROOT)}  {e}")

print()
print(f"Converted: {converted} files")
print(f"Total before: {total_in/1024/1024:.1f} MB")
print(f"Total after:  {total_out/1024/1024:.1f} MB")
if total_in:
    print(f"Saved:        {(1 - total_out/total_in)*100:.1f}%")
if errors:
    print(f"\nErrors: {len(errors)}")
    for p, e in errors:
        print(f"  {p}: {e}")
