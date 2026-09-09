'use client';
// app/admin/CropEditor.jsx — the drag-to-crop window, lifted from the client
// portal's uploader (app/p/[token]/upload/Uploader.jsx) so the admin's Edit
// Photos gets the SAME tool (Josh 9/9: "put the resize tool into admin Edit
// Photos"). Same rules as the client side: only 16:9 or 9:16 (the two shapes
// the engine shows exactly as framed), the original is never touched — the
// crop is written to a sibling file and can be undone any time.
//
// Props: photo { url, originalUrl?, filename, cropRect? }  — cropRect = the
//        saved box {x,y,w,h,ratio} in fractions of the ORIGINAL
//        onSave(rect, ratio)  onClear()  onClose()  busy
import { useRef, useState } from 'react';

export default function CropEditor({ photo, onSave, onClear, onClose, busy = false }) {
  const saved = photo.cropRect && Number.isFinite(Number(photo.cropRect.w)) ? photo.cropRect : null;
  const [ratio, setRatio] = useState(saved && saved.ratio === '9:16' ? 9 / 16 : 16 / 9);
  const [box, setBox] = useState(saved ? { x: Number(saved.x), y: Number(saved.y), w: Number(saved.w), h: Number(saved.h) } : { x: 0, y: 0, w: 1, h: 1 });
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  // The photo is DISPLAYED at its own aspect, so a shape in fractions of the
  // display is not that shape in pixels — every conversion divides through by
  // the image aspect, or a "16:9" crop comes out 16:9 of the wrong thing.
  const aspect = () => { const el = imgRef.current; return el && el.naturalWidth && el.naturalHeight ? el.naturalWidth / el.naturalHeight : 1; };
  const fit = (r) => {
    const a = aspect();
    let w = 1, h = a / r;
    if (h > 1) { h = 1; w = r / a; }
    setBox({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };
  const point = (ev, el) => {
    const rc = el.getBoundingClientRect();
    const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    return { x: (t.clientX - rc.left) / rc.width, y: (t.clientY - rc.top) / rc.height };
  };
  const down = (ev, mode) => {
    ev.preventDefault(); ev.stopPropagation();
    const stage = ev.currentTarget.closest('[data-cropstage]');
    if (!stage) return;
    dragRef.current = { mode, start: point(ev, stage), from: { ...box }, stage };
  };
  const move = (ev) => {
    const d = dragRef.current;
    if (!d) return;
    ev.preventDefault();
    const a = aspect();
    const p = point(ev, d.stage);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    const o = d.from;
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const MIN = 0.1;
    let b;
    if (d.mode === 'move') {
      b = { ...o, x: cl(o.x + dx, 0, 1 - o.w), y: cl(o.y + dy, 0, 1 - o.h) };
    } else {
      let l = o.x, t = o.y, r = o.x + o.w, bt = o.y + o.h;
      if (d.mode.includes('w')) l = cl(o.x + dx, 0, r - MIN);
      if (d.mode.includes('e')) r = cl(o.x + o.w + dx, l + MIN, 1);
      if (d.mode.includes('n')) t = cl(o.y + dy, 0, bt - MIN);
      if (d.mode.includes('s')) bt = cl(o.y + o.h + dy, t + MIN, 1);
      b = { x: l, y: t, w: r - l, h: bt - t };
      if (d.mode.includes('e') || d.mode.includes('w')) b.h = b.w * a / ratio;
      else b.w = b.h * ratio / a;
      if (b.w > 1) { b.w = 1; b.h = b.w * a / ratio; }
      if (b.h > 1) { b.h = 1; b.w = b.h * ratio / a; }
      b.x = cl(b.x, 0, 1 - b.w);
      b.y = cl(b.y, 0, 1 - b.h);
    }
    setBox(b);
  };
  const up = () => { dragRef.current = null; };
  const pill = (on, txt, fn) => (
    <button type="button" onClick={fn} className={on ? 'btn-primary' : 'btn-ghost'} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>{txt}</button>
  );

  return (
    <div onClick={() => { if (!busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(6,8,12,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#11151c', color: '#e6e9ef', borderRadius: 14, padding: 16, maxWidth: 760, width: '100%' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Crop this photo</div>
        <div style={{ fontSize: 12.5, color: '#8b94a3', marginBottom: 12 }}>
          Drag the middle to move it, drag a corner to resize. The original is kept — this can be undone any time.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {pill(ratio >= 1, '16 : 9 wide', () => { setRatio(16 / 9); fit(16 / 9); })}
          {pill(ratio < 1, '9 : 16 tall', () => { setRatio(9 / 16); fit(9 / 16); })}
        </div>
        <div data-cropstage="1" onMouseMove={move} onMouseUp={up} onMouseLeave={up} onTouchMove={move} onTouchEnd={up}
          style={{ position: 'relative', width: '100%', maxHeight: '54vh', display: 'flex', justifyContent: 'center', userSelect: 'none', touchAction: 'none' }}>
          <div style={{ position: 'relative', maxHeight: '54vh' }}>
            <img ref={imgRef} src={photo.originalUrl || photo.url} alt={photo.filename || ''} draggable={false}
              onLoad={() => { if (!saved) fit(ratio); }}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '54vh', borderRadius: 8 }} />
            <div onMouseDown={(e) => down(e, 'move')} onTouchStart={(e) => down(e, 'move')}
              style={{ position: 'absolute', left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`,
                boxSizing: 'border-box', border: '2px solid #fff', boxShadow: '0 0 0 9999px rgba(6,8,12,.62)', cursor: 'move' }}>
              {['nw', 'ne', 'sw', 'se'].map((h) => (
                <span key={h} onMouseDown={(e) => down(e, h)} onTouchStart={(e) => down(e, h)}
                  style={{ position: 'absolute', width: 18, height: 18, background: '#fff', borderRadius: 4,
                    [h[0] === 'n' ? 'top' : 'bottom']: -9, [h[1] === 'w' ? 'left' : 'right']: -9,
                    cursor: (h === 'nw' || h === 'se') ? 'nwse-resize' : 'nesw-resize' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" disabled={busy} onClick={() => onSave(box, ratio < 1 ? '9:16' : '16:9')} className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, fontWeight: 800 }}>
            {busy ? 'Saving…' : 'Save crop'}
          </button>
          {saved && (
            <button type="button" disabled={busy} onClick={onClear} className="btn-ghost" style={{ padding: '9px 14px', fontSize: 13 }}>
              Back to the whole photo
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose} className="linklike" style={{ fontSize: 13, color: '#93a3b6' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
