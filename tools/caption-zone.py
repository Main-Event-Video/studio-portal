# Caption Zone — drag a box around the captions; writes ZONE_* into settings.txt.
# Opens the newest clip in ~/Desktop/Caption Remove/In. Slider scrubs frames.
#   drag a box on the picture, then press ENTER (or SPACE) to save
#   press C to clear and redraw, ESC / Q to quit without saving
import cv2, os, sys, glob, re

HOME = os.path.expanduser('~')
IN = os.path.join(HOME, 'Desktop', 'Caption Remove', 'In')
SETTINGS = os.path.join(HOME, 'Desktop', 'Caption Remove', 'settings.txt')

clips = [p for ext in ('mp4', 'mov', 'm4v', 'MP4', 'MOV', 'M4V') for p in glob.glob(os.path.join(IN, f'*.{ext}'))]
if not clips:
    print(f'No clips in {IN}'); sys.exit(1)
clip = max(clips, key=os.path.getmtime)
cap = cv2.VideoCapture(clip)
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
scale = min(1.0, 900 / H, 1400 / W)  # fit on screen
dw, dh = int(W * scale), int(H * scale)
win = 'Caption Zone — drag a box, ENTER saves, C clears, ESC quits'
print(f'Clip: {os.path.basename(clip)}  ({W}x{H}, {n} frames)')

state = {'frame': None, 'idx': 0, 'p0': None, 'p1': None, 'drag': False}

def load(i):
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, min(n - 1, i)))
    ok, f = cap.read()
    if ok: state['frame'] = cv2.resize(f, (dw, dh)); state['idx'] = i

def draw():
    img = state['frame'].copy()
    if state['p0'] and state['p1']:
        cv2.rectangle(img, state['p0'], state['p1'], (0, 255, 255), 2)
    cv2.putText(img, f'frame {state["idx"]}/{n-1}   drag box - ENTER save - C clear - ESC quit', (10, 24),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.imshow(win, img)

def on_mouse(ev, x, y, flags, _):
    if ev == cv2.EVENT_LBUTTONDOWN: state['p0'] = (x, y); state['p1'] = (x, y); state['drag'] = True
    elif ev == cv2.EVENT_MOUSEMOVE and state['drag']: state['p1'] = (x, y)
    elif ev == cv2.EVENT_LBUTTONUP: state['p1'] = (x, y); state['drag'] = False
    draw()

def on_scrub(v): load(v); draw()

cv2.namedWindow(win, cv2.WINDOW_AUTOSIZE)
cv2.setMouseCallback(win, on_mouse)
cv2.createTrackbar('scrub', win, 0, max(1, n - 1), on_scrub)
load(min(n - 1, 30)); cv2.setTrackbarPos('scrub', win, state['idx']); draw()

while True:
    k = cv2.waitKey(30) & 0xFF
    if k in (27, ord('q')): print('No box drawn — using the zone already in settings.txt.'); break
    if k == ord('c'): state['p0'] = state['p1'] = None; draw()
    if k in (13, 32) and state['p0'] and state['p1']:
        (x0, y0), (x1, y1) = state['p0'], state['p1']
        top, bot = sorted((y0, y1)); left, right = sorted((x0, x1))
        pad = 6  # a little breathing room so outlines/shadows are inside the box
        zt = max(0, top - pad) / dh; zb = min(dh, bot + pad) / dh; zl = max(0, left - pad) / dw; zr = min(dw, right + pad) / dw
        vals = {'ZONE_TOP': zt, 'ZONE_BOTTOM': zb, 'ZONE_LEFT': zl, 'ZONE_RIGHT': zr}
        txt = open(SETTINGS).read() if os.path.exists(SETTINGS) else 'MODE=sttn-det\n'
        for key, v in vals.items():
            line = f'{key}={v:.3f}'
            txt, c = re.subn(rf'^{key}=.*$', line, txt, flags=re.M)
            if not c: txt += ('\n' if not txt.endswith('\n') else '') + line + '\n'
        open(SETTINGS, 'w').write(txt)
        print('Saved to settings.txt:'); [print(f'  {k}={v:.3f}') for k, v in vals.items()]
        break
cv2.destroyAllWindows()
