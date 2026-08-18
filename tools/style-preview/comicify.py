"""Turn a photo into comic-book art.

Creatomate CANNOT do this: its color_filter is only brighten/contrast/invert/
grayscale/sepia (confirmed from the official SDK's ColorFilterType). So a comic
look has to be produced as a SECOND IMAGE before the render. The portal already
depends on `sharp`, so the same pipeline can run server-side at render-prep time
and be cached in R2 next to the original.

Pipeline: edge-preserving colour flattening -> palette quantisation -> ink lines
from an adaptive threshold -> multiply the ink over the flats -> saturation lift.
"""
import cv2, numpy as np, sys, os, glob, json

def cartoonify(path, colours=9, line_strength=1.0, sat=1.35):
    img = cv2.imread(path)
    if img is None: return None
    h, w = img.shape[:2]

    # 1. FLATTEN: edge-preserving smoothing keeps outlines crisp while killing
    #    texture/noise, which is what makes the flats read as "drawn".
    small = cv2.resize(img, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    for _ in range(3):
        small = cv2.bilateralFilter(small, 9, 60, 9)
    flat = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)

    # 2. QUANTISE to a small palette (k-means in Lab so the clusters are
    #    perceptual rather than RGB-cube-shaped).
    lab = cv2.cvtColor(flat, cv2.COLOR_BGR2LAB).reshape((-1, 3)).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 12, 1.0)
    _, labels, centres = cv2.kmeans(lab, colours, None, crit, 2, cv2.KMEANS_PP_CENTERS)
    quant = centres[labels.flatten()].reshape(flat.shape).astype(np.uint8)
    quant = cv2.cvtColor(quant, cv2.COLOR_LAB2BGR)

    # 3. INK: adaptive threshold on a median-blurred grey gives comic linework
    #    that follows local contrast instead of a global edge threshold.
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    grey = cv2.medianBlur(grey, 5)
    edges = cv2.adaptiveThreshold(grey, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                  cv2.THRESH_BINARY, blockSize=9, C=6)
    if line_strength > 1.0:
        edges = cv2.erode(edges, np.ones((2, 2), np.uint8), iterations=1)
    edges = cv2.medianBlur(edges, 3)

    # 4. MULTIPLY ink over flats
    out = cv2.bitwise_and(quant, quant, mask=edges)
    out[edges == 0] = (18, 16, 20)          # ink colour (near-black, slightly warm)

    # 5. Punch the colour up — comics are saturated
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * 1.06, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    n = 0
    for f in sorted(glob.glob(os.path.join(src, '*.jpg'))):
        out = cartoonify(f)
        if out is None: continue
        cv2.imwrite(os.path.join(dst, os.path.basename(f)), out, [cv2.IMWRITE_JPEG_QUALITY, 90])
        n += 1
    print(f'comicified {n} images -> {dst}')
