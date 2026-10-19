#!/usr/bin/env python3
"""Builds the Android launcher icons + splash from the exact Tuika logo (brand/logo.png).

Usage: python3 scripts/make_android_icons.py [android_res_dir] [--preview out_dir]
Run in CI after `npx cap add android`. Needs Pillow.
"""
import os
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw

LOGO = Path(__file__).resolve().parent.parent / "brand" / "logo.png"
BG = (0, 0, 0, 255)
# ring of the logo inside the 1254px PNG: x 216..1033, y 184..1011
RING_CX, RING_CY, RING_D = 624.5, 597.5, 818.0


def load():
    return Image.open(LOGO).convert("RGBA")


def ring_canvas(size, ring_frac, round_mask=False, corner=0.0):
    """Square canvas, black, with the logo placed so the ring is `ring_frac` of the canvas wide."""
    src = load()
    scale = (size * ring_frac) / RING_D
    w = max(1, round(src.width * scale))
    img = src.resize((w, w), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), BG)
    canvas.alpha_composite(img, (round(size / 2 - RING_CX * scale), round(size / 2 - RING_CY * scale)))
    if round_mask or corner:
        ss = 4
        m = Image.new("L", (size * ss, size * ss), 0)
        d = ImageDraw.Draw(m)
        if round_mask:
            d.ellipse([0, 0, size * ss - 1, size * ss - 1], fill=255)
        else:
            d.rounded_rectangle([0, 0, size * ss - 1, size * ss - 1], radius=int(size * ss * corner), fill=255)
        m = m.resize((size, size), Image.LANCZOS)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(canvas, (0, 0), m)
        return out
    return canvas


def splash(w, h):
    src = load()
    side = round(min(w, h) * 0.5)
    sp = Image.new("RGBA", (w, h), BG)
    sp.alpha_composite(src.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
    return sp.convert("RGB")


def patch_launch_theme(res):
    """Splash: black status/navigation bar (instead of the default gray) and black splash background."""
    p = os.path.join(res, "values", "styles.xml")
    if not os.path.exists(p):
        return False
    s = open(p, encoding="utf-8").read()
    m = re.search(r'(<style\s+name="AppTheme\.NoActionBarLaunch"[^>]*>)(.*?)(</style>)', s, re.S)
    if not m:
        return False
    body = m.group(2)
    wanted = [
        ("android:statusBarColor", "#000000"),
        ("android:navigationBarColor", "#000000"),
        ("android:windowLightStatusBar", "false"),
        ("android:windowLightNavigationBar", "false"),
        ("windowSplashScreenBackground", "#000000"),
    ]
    for name, val in wanted:
        pat = r'<item\s+name="%s">.*?</item>' % re.escape(name)
        item = '<item name="%s">%s</item>' % (name, val)
        if re.search(pat, body):
            body = re.sub(pat, item, body)
        else:
            body = body.rstrip() + "\n        " + item + "\n    "
    s = s[: m.start()] + m.group(1) + body + m.group(3) + s[m.end():]
    open(p, "w", encoding="utf-8").write(s)
    return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    preview = None
    if "--preview" in sys.argv:
        preview = sys.argv[sys.argv.index("--preview") + 1]
        args = [a for a in args if a != preview]
    res = args[0] if args else "android/app/src/main/res"
    if preview:
        os.makedirs(preview, exist_ok=True)
        ring_canvas(512, 0.86, corner=0.22).save(os.path.join(preview, "icon.png"))
        ring_canvas(192, 0.9, round_mask=True).save(os.path.join(preview, "round.png"))
        ring_canvas(432, 0.56).save(os.path.join(preview, "foreground.png"))
        splash(540, 960).save(os.path.join(preview, "splash.png"))
        return
    if not os.path.isdir(res):
        sys.exit(f"res dir not found: {res}")

    dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    done = 0
    for name, m in dens.items():
        folder = os.path.join(res, f"mipmap-{name}")
        os.makedirs(folder, exist_ok=True)
        legacy = round(48 * m)
        ring_canvas(legacy, 0.86, corner=0.22).save(os.path.join(folder, "ic_launcher.png"))
        ring_canvas(legacy, 0.9, round_mask=True).save(os.path.join(folder, "ic_launcher_round.png"))
        # adaptive icon foreground: 108dp canvas, whole ring kept inside the 66dp safe zone
        ring_canvas(round(108 * m), 0.56).save(os.path.join(folder, "ic_launcher_foreground.png"))
        done += 3

    values = os.path.join(res, "values")
    os.makedirs(values, exist_ok=True)
    with open(os.path.join(values, "ic_launcher_background.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n')

    # splash: keep every existing splash file's size, replace the picture
    for root, _dirs, files in os.walk(res):
        for fn in files:
            if fn == "splash.png":
                path = os.path.join(root, fn)
                w, h = Image.open(path).size
                splash(w, h).save(path)
                done += 1
    print("launch theme patched:", patch_launch_theme(res))
    print(f"wrote {done} Tuika icon/splash files into {res}")


if __name__ == "__main__":
    main()
