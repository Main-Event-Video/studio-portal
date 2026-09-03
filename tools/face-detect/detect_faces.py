"""Find faces in client photos so the Glass style can anchor its accent crops.

WHY THIS RUNS HERE AND NOT IN THE APP
-------------------------------------
The portal is on Vercel. A serverless function has a hard package-size ceiling
and a short wall clock, and face detection needs a real model plus a full image
decode — per photo, not per header. Running it inside a render request would
mean decoding sixty photos before Creatomate is even called. So detection is a
separate, once-per-photo job that writes its answer to the database, and the
render path just reads it. This also means the photos ALREADY in R2 — the live
client libraries — get covered, which a detect-on-upload hook would not do.

WHAT IT PRODUCES
----------------
studio_media.faces — a JSON list per photo, most confident first, normalised to
0..1 so it is independent of pixel size:

    [{"x":.., "y":.., "w":.., "h":.., "ex":.., "ey":.., "score":.., "source":..}]

`ex`/`ey` are the midpoint between the eyes. That is the anchor the renderer
uses, not the centre of the box: on a tilted or upward-looking head a box centre
slides toward the chin, and the eye midpoint does not.

An empty list is a real answer, not a failure — it means "no face here", and the
renderer turns every accent pane on that photo into plain glass. That is the
whole safety design: every uncertain case degrades to a look already signed off,
never to a crop nobody chose.

DETECTOR
--------
YuNet (OpenCV's FaceDetectorYN), with the Haar cascades as a backstop. Haar was
the first attempt and it was the wrong tool: no confidence score, over-detection
(one sample returned eleven "faces") and it missed anything turned or shadowed.
For a guard whose only job is deciding "is it safe to crop here", a detector that
cannot say how sure it is cannot be trusted. Haar is kept only for the case where
YuNet finds nothing at all, and its results are scored low so the renderer treats
them as weak.

RUNNING IT
----------
Needs, in the environment:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
(the same names the nightly backup workflow already uses)

  python detect_faces.py [--limit N] [--redo] [--client-id UUID] [--dry-run]

Safe to run repeatedly: it only looks at rows whose `faces` is still null unless
--redo is passed.
"""
import argparse
import io
import json
import os
import sys
import time

import boto3
import cv2
import numpy as np
import requests

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yunet.onnx')

# Below this we would rather show plain glass than guess. YuNet's score is
# well calibrated; 0.55 keeps turned and partly shadowed faces and drops the
# texture-on-a-cushion false positives.
MIN_SCORE = 0.55
# Smaller than this, relative to the image, is background crowd rather than a
# subject. Anchoring a large accent pane on a stranger forty feet behind the
# family would be worse than not cropping at all.
MIN_REL_SIZE = 0.04
# Decode cap. YuNet is trained around 320px and we upscale small inputs to 640;
# anything above this is pointless work on a 24-megapixel phone photo.
MAX_DECODE = 1600

HAAR_FILES = ('haarcascade_frontalface_alt2.xml', 'haarcascade_profileface.xml')


def haar_cascades():
    d = os.path.join(os.path.dirname(cv2.__file__), 'data')
    out = []
    for n in HAAR_FILES:
        c = cv2.CascadeClassifier(os.path.join(d, n))
        if not c.empty():
            out.append(c)
    return out


def yunet_faces(img, det_cache={}):
    h, w = img.shape[:2]
    scale = max(1.0, 640.0 / max(w, h))
    im = cv2.resize(img, (int(w * scale), int(h * scale))) if scale > 1.0 else img
    ih, iw = im.shape[:2]
    det = cv2.FaceDetectorYN.create(MODEL, '', (iw, ih),
                                    score_threshold=MIN_SCORE, nms_threshold=0.3, top_k=60)
    det.setInputSize((iw, ih))
    _, faces = det.detect(im)
    out = []
    for f in (faces if faces is not None else []):
        x, y, fw, fh = f[0] / iw, f[1] / ih, f[2] / iw, f[3] / ih
        # landmarks: right eye, left eye, nose, right mouth corner, left mouth corner
        rex, rey, lex, ley = f[4] / iw, f[5] / ih, f[6] / iw, f[7] / ih
        out.append({
            'x': float(max(0.0, x)), 'y': float(max(0.0, y)),
            'w': float(fw), 'h': float(fh),
            'ex': float((rex + lex) / 2), 'ey': float((rey + ley) / 2),
            'score': round(float(f[-1]), 3), 'source': 'yunet',
        })
    return out


def haar_faces(img, cascades):
    h, w = img.shape[:2]
    grey = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    minsz = max(24, int(min(w, h) * 0.06))
    out = []
    for c in cascades:
        for (x, y, fw, fh) in c.detectMultiScale(grey, 1.08, 6, minSize=(minsz, minsz)):
            out.append({
                'x': x / w, 'y': y / h, 'w': fw / w, 'h': fh / h,
                # No landmarks from Haar. Fall back to a point in the upper part
                # of the box, which is where eyes usually are.
                'ex': (x + fw / 2) / w, 'ey': (y + fh * 0.40) / h,
                'score': 0.40, 'source': 'haar',
            })
    return out


def iou(a, b):
    x1, y1 = max(a['x'], b['x']), max(a['y'], b['y'])
    x2 = min(a['x'] + a['w'], b['x'] + b['w'])
    y2 = min(a['y'] + a['h'], b['y'] + b['h'])
    if x2 <= x1 or y2 <= y1:
        return 0.0
    inter = (x2 - x1) * (y2 - y1)
    return inter / (a['w'] * a['h'] + b['w'] * b['h'] - inter)


def dedupe(cands):
    keep = []
    for f in sorted(cands, key=lambda f: -f['score']):
        if any(iou(f, k) > 0.4 for k in keep):
            continue
        keep.append(f)
    return keep


def detect(buf, cascades):
    arr = np.frombuffer(buf, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None                      # not decodable — distinct from "no faces"
    h, w = img.shape[:2]
    if max(w, h) > MAX_DECODE:
        s = MAX_DECODE / max(w, h)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    found = yunet_faces(img)
    if not found:
        found = haar_faces(img, cascades)     # a weak anchor beats no anchor
    found = [f for f in found if max(f['w'], f['h']) >= MIN_REL_SIZE]
    found = dedupe(found)
    found.sort(key=lambda f: (-f['score'], -(f['w'] * f['h'])))
    for f in found:
        for k in ('x', 'y', 'w', 'h', 'ex', 'ey'):
            f[k] = round(f[k], 4)
    return found[:8]                     # more than eight anchors helps nobody


# ---- Supabase / R2 ---------------------------------------------------------

def sb_headers(key):
    return {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}


def fetch_pending(url, key, limit, redo, client_id):
    q = [
        'select=id,r2_key,filename,client_id',
        'kind=eq.client_upload',
        'content_type=like.image*',
        f'limit={limit}',
        'order=created_at.desc',
    ]
    if not redo:
        q.append('faces=is.null')
    if client_id:
        q.append(f'client_id=eq.{client_id}')
    r = requests.get(f'{url}/rest/v1/studio_media?' + '&'.join(q), headers=sb_headers(key), timeout=60)
    r.raise_for_status()
    return r.json()


def write_faces(url, key, row_id, faces):
    body = json.dumps({'faces': faces, 'faces_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
    r = requests.patch(f'{url}/rest/v1/studio_media?id=eq.{row_id}',
                       headers={**sb_headers(key), 'Prefer': 'return=minimal'},
                       data=body, timeout=60)
    r.raise_for_status()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=400)
    ap.add_argument('--redo', action='store_true', help='re-detect photos that already have faces')
    ap.add_argument('--client-id', default=None)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    sb_url = os.environ['SUPABASE_URL'].rstrip('/')
    sb_key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    bucket = os.environ['R2_BUCKET']
    s3 = boto3.client(
        's3',
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
    )

    if not os.path.exists(MODEL):
        sys.exit(f'model missing: {MODEL}')
    cascades = haar_cascades()

    rows = fetch_pending(sb_url, sb_key, a.limit, a.redo, a.client_id)
    print(f'{len(rows)} photo(s) to look at', flush=True)
    n_face = n_none = n_bad = 0
    for i, row in enumerate(rows, 1):
        key = row.get('r2_key')
        if not key:
            continue
        try:
            buf = s3.get_object(Bucket=bucket, Key=key)['Body'].read()
        except Exception as e:                      # noqa: BLE001 — never stop the batch
            print(f'  [{i}] {key}  FETCH FAILED: {e}', flush=True)
            n_bad += 1
            continue
        faces = detect(buf, cascades)
        if faces is None:
            # Undecodable (HEIC without a codec, a truncated object). Leave the
            # row alone so a later run with a better decoder can try again —
            # writing [] here would permanently mark it "no faces".
            print(f'  [{i}] {key}  NOT DECODABLE, left pending', flush=True)
            n_bad += 1
            continue
        best = f"{faces[0]['score']:.2f} {faces[0]['source']}" if faces else 'none -> panes stay glass'
        print(f"  [{i}] {row.get('filename') or key}  {len(faces)} face(s)  {best}", flush=True)
        if faces:
            n_face += 1
        else:
            n_none += 1
        if not a.dry_run:
            write_faces(sb_url, sb_key, row['id'], faces)

    print(f'\ndone: {n_face} with faces, {n_none} with none, {n_bad} skipped', flush=True)


if __name__ == '__main__':
    main()
