'use client';
// app/admin/NeonControls.jsx — the neon dials, shared by the style-card
// settings (page.js neonPanel) and the MEvid Stills panel's "Neon" border.
// One component so the two places can never drift: intensity, thickness, the
// alternating colours, the EXTRAS switch (Josh 9/9: "a button to turn the
// extra lines/squiggles on/off"), and the green-screen ceiling note.
//
// Segment fields: neonI, neonT, neonColors (+ neonColor = first), neonExtras
// (true/undefined = the frame, bars, squiggles and echoes join in from 150%;
// false = only the tracing light, however high the intensity).
export const NEON_SWATCHES = ['#00E5FF', '#FF2D95', '#7CFF3D', '#FFD23A', '#B14DFF', '#FF6A3D'];

export default function NeonControls({ seg, set, compact = false }) {
  const I = parseInt(seg.neonI ?? 100, 10);
  const T = parseInt(seg.neonT ?? 100, 10);
  const colors = Array.isArray(seg.neonColors) && seg.neonColors.length ? seg.neonColors : ['#00E5FF'];
  const extras = seg.neonExtras !== false;
  const over = I >= 200;
  const row = { display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, fontSize: 11.5, color: 'var(--muted)' };
  const pill = (on, txt, fn) => (
    <button type="button" className={on ? 'btn-primary' : 'btn-ghost'} style={{ padding: '3px 10px', fontSize: 11 }} onClick={fn}>{txt}</button>
  );
  return (
    <>
      <div style={row}>
        <span style={{ minWidth: 66 }}>Intensity</span>
        <input type="range" min="0" max="300" step="10" value={I} style={{ flex: 1, minWidth: 0 }}
          onChange={(ev) => set({ neonI: Number(ev.target.value) })} />
        <span style={{ minWidth: 34, textAlign: 'right' }}>{I}%</span>
      </div>
      <div style={row}>
        <span style={{ minWidth: 66 }}>Thickness</span>
        <input type="range" min="50" max="300" step="10" value={T} style={{ flex: 1, minWidth: 0 }}
          onChange={(ev) => set({ neonT: Number(ev.target.value) })} />
        <span style={{ minWidth: 34, textAlign: 'right' }}>{T}%</span>
      </div>
      <div style={{ ...row, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 66 }}>Colours</span>
        {NEON_SWATCHES.map((sw) => {
          const picked = colors.includes(sw);
          const last = picked && colors.length <= 1;
          return (
            <button key={sw} type="button" disabled={last}
              title={last ? 'At least one colour has to stay picked' : (picked ? `Remove ${sw}` : `Add ${sw}`)}
              onClick={() => {
                const next = colors.includes(sw) ? colors.filter((c) => c !== sw) : [...colors, sw];
                set({ neonColors: next.length ? next : colors, neonColor: (next[0] || sw) });
              }}
              style={{ width: 20, height: 20, borderRadius: 5, cursor: last ? 'default' : 'pointer', padding: 0,
                border: picked ? '2px solid #38b6ff' : '1px solid var(--line)', background: sw, opacity: picked ? 1 : 0.42 }} />
          );
        })}
        <span style={{ fontSize: 10.5 }}>{colors.length > 1 ? `${colors.length} colours, alternating` : 'one colour'}</span>
      </div>
      <div style={{ ...row, marginTop: 9, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 66 }}>Extras</span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {pill(!extras, 'Off', () => set({ neonExtras: false }))}
          {pill(extras, 'On', () => set({ neonExtras: true }))}
        </span>
        <span style={{ fontSize: 10.5, flex: '1 1 220px' }}>
          {extras
            ? 'The standing two-colour frame, the flashing bars and the squiggles that join in from 150%.'
            : 'Only the tracing light, however high the intensity.'}
        </span>
      </div>
      <div style={{
        marginTop: 9, padding: '7px 9px', borderRadius: 8, fontSize: 10.5, lineHeight: 1.45,
        border: `1px solid ${over ? 'rgba(245,166,35,0.55)' : 'var(--line)'}`,
        background: over ? 'rgba(245,166,35,0.10)' : 'transparent',
        color: over ? '#f5a623' : 'var(--muted)',
      }}>
        <strong>Green screen: keep it at 150% or below.</strong>{' '}
        Everything up to 150% is drawn <em>on</em> the photograph, so it survives the key. The echo
        frames from 200% stand <em>outside</em> the photo — and outside the photo is your key colour,
        so they key away with it.
        {over && <> <br />You are at {I}%. On a keyed montage the echoes will not make it through; everything else still will.</>}
      </div>
      {!compact && (
        <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.45 }}>A light runs the edge of each photograph, travelling with it.
          <br />
          <strong>100% is the look you have already seen.</strong> Above it the tube thickens, more lights
          join (each its own colour from those below) and they run faster.
          <br />
          <strong>150%</strong> keeps the tracing light and lights a standing two-colour frame underneath it,
          so the highlight sweeps round a tube that is already burning. Short bars strike on and off around
          the picture, and loose squiggles are drawn on between shots.
          <br />
          <strong>200% and up</strong> adds echo frames standing off outside the photograph.</p>
      )}
    </>
  );
}
