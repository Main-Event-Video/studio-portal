import os, glob, json
import cv2
from PIL import Image

SRC = "/mnt/user-data/uploads/Dylan Life Stills"
OUT = "/home/claude/samples"
MAXDIM = 1600

# Faked aspect ratios, cycled across the set so any run of photos is mixed.
# 16:9 and 9:16 dominate (the two Josh named); the rest keep it honest.
RATIOS = [
    ("16x9", 16/9), ("9x16", 9/16), ("4x5", 4/5), ("16x9", 16/9),
    ("1x1", 1.0),   ("9x16", 9/16), ("3x2", 3/2),  ("9x16", 9/16),
    ("16x9", 16/9), ("2x3", 2/3),   ("16x9", 16/9),("4x5", 4/5),
]

cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def face_center(path):
    """Return (cx, cy) in 0..1 of the largest detected face, or None."""
    img = cv2.imread(path)
    if img is None: return None
    h, w = img.shape[:2]
    small = cv2.resize(img, (min(900, w), int(min(900, w) * h / w)))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6, minSize=(38, 38))
    if len(faces) == 0: return None
    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    sh, sw = small.shape[:2]
    return ((fx + fw / 2) / sw, (fy + fh / 2) / sh)

def crop_to(im, target_ar, focus):
    """Center-crop to target_ar, pulling the window toward `focus` (cx,cy in 0..1).
    No face -> top-biased vertically (house rule: keep heads), centered horizontally."""
    w, h = im.size
    cur = w / h
    cx, cy = focus if focus else (0.5, 0.34)
    if cur > target_ar:          # too wide -> trim sides
        nw, nh = int(round(h * target_ar)), h
    else:                        # too tall -> trim top/bottom
        nw, nh = w, int(round(w / target_ar))
    left = int(round(cx * w - nw / 2)); left = max(0, min(w - nw, left))
    top  = int(round(cy * h - nh / 2)); top  = max(0, min(h - nh, top))
    return im.crop((left, top, left + nw, top + nh))

files = sorted(glob.glob(os.path.join(SRC, "*.png")),
               key=lambda p: int(os.path.splitext(os.path.basename(p))[0]))
manifest = []
for i, p in enumerate(files):
    stem = os.path.splitext(os.path.basename(p))[0]
    name, ar = RATIOS[i % len(RATIOS)]
    focus = face_center(p)
    im = Image.open(p).convert("RGB")
    im = crop_to(im, ar, focus)
    w, h = im.size
    s = MAXDIM / max(w, h)
    if s < 1: im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
    out = os.path.join(OUT, f"{int(stem):02d}_{name}.jpg")
    im.save(out, quality=88, optimize=True)
    manifest.append({"file": os.path.basename(out), "src": os.path.basename(p),
                     "ratio": name, "w": im.size[0], "h": im.size[1],
                     "ar": round(im.size[0] / im.size[1], 4),
                     "face": bool(focus)})
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
faces = sum(1 for m in manifest if m["face"])
print(f"{len(manifest)} images, {faces} with a detected face")
from collections import Counter
print(Counter(m["ratio"] for m in manifest))
