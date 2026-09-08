// Builds the Creatomate source JSON for a Studio montage.
// Three styles for v1 — every construct is copied from MEvid's WORKING render
// code (lib/render-script.js / lib/opening-card.js) and its verified
// constraints: same-track siblings auto-sequence; a transition is an animation
// on the SECOND element with transition:true (types verified: fade, slide,
// circular-wipe, scale); motion = keyframes on x_scale/y_scale/x/y/opacity
// (never z_rotation); easing on the FIRST keyframe; explicit tracks.

export const STYLES = {
  hollywood: {
    label: 'Hollywood (gold on black, slow + cinematic)',
    greenDefault: true,   // default background is keyable green (plain-colour style)
    bg: '#0A0708',
    text: '#E8CC8A',
    dim: '#C4A460',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 3.5,
    fadeS: 1.0,
    transitions: ['fade'],
    zoom: ['100%', '112%'],
    holdFade: true,   // pure-fade style → cast-free cross-dissolve (no green bleed)
  },
  timeless: {
    label: 'Timeless (ivory, elegant, gentle)',
    greenDefault: true,
    bg: '#F5F1E8',
    text: '#4A3F30',
    dim: '#7A6A54',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 4.0,
    fadeS: 1.4,
    transitions: ['fade'],
    zoom: ['100%', '108%'],
    holdFade: true,   // pure-fade style → cast-free cross-dissolve (no green bleed)
  },
  party: {
    label: 'Party (fast, punchy, high energy)',
    greenDefault: true,
    bg: '#140A22',
    text: '#FFFFFF',
    dim: '#7ED8FF',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 2.0,
    fadeS: 0.4,
    // 'scale' USED TO BE IN HERE AND HAD TO GO. See the note on transitionIn:
    // cover mode is what stops the green backdrop bleeding through a movement
    // transition, and Creatomate's scale animation is the one movement that
    // CANNOT be covered — its properties are scope/axis/startScale/endScale/
    // anchors/fade and nothing that holds the outgoing photo still. So a scale
    // transition uncovers the frame every time, whatever coverTransitions says.
    // Party kept its cover flag but still bled on one transition in four until
    // this list changed.
    transitions: ['slide', 'circular-wipe', 'fade'],
    zoom: ['100%', '116%'],
    // 2026-09-03: green was still bleeding through Party's movement
    // transitions on a real export. A plain slide or wipe animates BOTH
    // photographs, so mid-transition the frame is briefly uncovered, the green
    // backdrop shows through and tints the blend — and that cast survives
    // keying. Cover mode holds the outgoing photo still while the incoming one
    // moves over it: frame stays covered, movement is kept.
    //
    // Proven in render 013 (Party 3), which is this exact setting and which
    // Josh signed off.
    coverTransitions: true,
  },
  party2: {
    // Party 2 and Party 3 are now BOTH clean of green bleed, and the only thing
    // separating them is this transition list: Party 2 rotates slide /
    // circular-wipe / fade, Party 3 adds a straight wipe to the rotation. Keep
    // that difference in both labels — it is the whole reason both exist.
    label: 'Party 2 (energetic — drift; slide + circular-wipe + fade)',
    greenDefault: true,
    bg: '#140A22',
    text: '#FFFFFF',
    dim: '#FF6EB4',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 2.5,          // sensible middle default; overridable by the pace control
    fadeS: 0.5,
    // 'scale' removed 2026-09-08, same reason as Party's: Creatomate's scale
    // animation has no fixed/clip property, so it cannot be covered and always
    // uncovers the frame for the green to bleed through. It is NOT replaced by
    // 'wipe' on purpose — that would make this style byte-for-byte identical to
    // Party 3, and Josh asked to keep them both.
    transitions: ['slide', 'circular-wipe', 'fade'],
    zoom: ['100%', '118%'],
    pan: true,            // gentle diagonal drift on each photo (see buildMontageSource)
    // Turned on 2026-09-08 at Josh's instruction ("the party transitions all
    // bleed green through - I want to make sure they have all been updated").
    // This visibly changes how a transition reads on a style that was already
    // signed off and in client use, so: any montage previously saved as party2
    // will re-export with cover transitions, not the ones it was made with.
    coverTransitions: true,
  },
  duotone: {
    label: 'Duotone Split (dual-tint background, true-colour hero)',
    bg: '#07070C',
    text: '#FFFFFF',
    dim: '#FF4D88',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 3.0,
    fadeS: 0.7,
    transitions: ['slide', 'circular-wipe', 'scale', 'fade'],
    zoom: ['100%', '108%'],
    duotone: true,
    // [highlight, shadow] colour pairs; each shot uses two different pairs L/R
    pairs: [['#FF4D88', '#2A0A4A'], ['#38E1FF', '#04223F'], ['#FF7B3A', '#3A0630'],
            ['#A6FF4D', '#052E2A'], ['#C07BFF', '#0A0640'], ['#FFD23A', '#40060F']],
  },
  duotone_pastel: {
    // Same Duotone Split look + motion as `duotone`, but the background halves use a
    // soft PASTEL rainbow (Josh's palette) instead of the bold neon pairs. The
    // true-colour hero is unchanged. [highlight, shadow] per pair; cycles all colours.
    label: 'Duotone Split — Pastel (soft rainbow background, true-colour hero)',
    bg: '#0B0A10',
    text: '#FFFFFF',
    dim: '#F869A7',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 3.0,
    fadeS: 0.7,
    transitions: ['slide', 'circular-wipe', 'scale', 'fade'],
    zoom: ['100%', '108%'],
    duotone: true,
    pairs: [['#FCC5C6', '#F869A7'], ['#FCD675', '#FB936F'], ['#B780D3', '#8755B4'],
            ['#91C5ED', '#7A93DE'], ['#96D4AC', '#6FCCB9'], ['#FCC5C6', '#DA75BC'],
            ['#C1DB9E', '#6FCCB9'], ['#84ABE5', '#8755B4'], ['#FB98A0', '#F869A7'],
            ['#DDD88B', '#FB936F'], ['#91C5ED', '#84ABE5'], ['#FC9598', '#DA75BC']],
  },
  duotone2: {
    label: 'Duotone Split 2 (frantic — bg & hero transition separately)',
    bg: '#07070C',
    text: '#FFFFFF',
    dim: '#38E1FF',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 3.0,
    fadeS: 0.7,
    transitions: ['slide', 'circular-wipe', 'scale', 'fade'],
    zoom: ['100%', '108%'],
    duotone: true,
    frantic: true,   // bg + hero get DIFFERENT transitions each move (duotone2Source)
    pairs: [['#FF4D88', '#2A0A4A'], ['#38E1FF', '#04223F'], ['#FF7B3A', '#3A0630'],
            ['#A6FF4D', '#052E2A'], ['#C07BFF', '#0A0640'], ['#FFD23A', '#40060F']],
  },
  polaroid: {
    label: 'Polaroid Drop (square print, thick white bottom)',
    bg: '#141018',
    text: '#FFFFFF',
    dim: '#C9B6E0',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 2.0,
    fadeS: 0.8,
    transitions: ['scale', 'fade', 'slide', 'fade'],
    zoom: ['100%', '104%'],
    polaroid: true,
  },
  photo_drop: {
    // Same drop/pile motion as Polaroid Drop, but the WHOLE photo shows (nothing
    // cropped) inside a card matched to the photo's aspect + an EVEN white border
    // (bottom = top = sides). wholePhoto flag switches the print geometry.
    label: 'Photo Drop (whole photo, even white border)',
    bg: '#141018',
    text: '#FFFFFF',
    dim: '#C9B6E0',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 2.0,
    fadeS: 0.8,
    transitions: ['scale', 'fade', 'slide', 'fade'],
    zoom: ['100%', '104%'],
    polaroid: true,
    wholePhoto: true,
  },
  story_builder: {
    // Continuous story wall: one photo at a time lands center + pauses (a cut
    // point for editing), then joins a centered aspect-aware fan; completed rows
    // shift to alternating sides and shrink. Keyable green-screen default.
    label: 'Story Builder (one at a time, builds a story wall)',
    bg: '#00B140',
    text: '#FFFFFF',
    dim: '#CFF7DD',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 2.6,
    fadeS: 0.4,
    transitions: ['fade'],
    zoom: ['100%', '100%'],
    story: true,
  },
  // ---- Collage Wall (rebuilt from the approved mocks; see MONTAGES-MASTER.md) --
  // A wall of ALL the photos in a grid; a "camera" (the wall composition's x/y/
  // scale) glides across it, resting on featured tiles with neighbours visible,
  // over a warm grade. Classic = uniform grid; Featured = some 2×2 hero tiles.
  // NOT yet render-verified — the camera path/grade need first-render tuning.
  collage_classic: {
    label: 'Collage Wall — Classic (uniform grid, camera glides across)',
    bg: '#0E0C0A', text: '#FFFFFF', dim: '#E9D9B8', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.6, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    collage: true, variant: 'classic', cols: 6, cellHoldS: 2.6, moveS: 1.2,
    warm: '#3A2A12', warmOpacity: '20%',   // warm multiply grade over the wall
  },
  collage_featured: {
    label: 'Collage Wall — Featured (big hero photos + smaller tiles)',
    bg: '#0E0C0A', text: '#FFFFFF', dim: '#E9D9B8', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.8, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    collage: true, variant: 'featured', cols: 5, cellHoldS: 2.8, moveS: 1.3,
    warm: '#3A2A12', warmOpacity: '20%',
  },
  // Gallery 150 (Envato "150 Photo Gallery" ref): a wall of SCATTERED, TILTED,
  // white-bordered prints; camera flies over and features one print at a time.
  // Same camera engine as Collage, cells become tilted print-cards over a dark
  // surface. NO template text.
  gallery150: {
    label: 'Gallery 150 (scattered tilted prints, camera flies over)',
    bg: '#0E0C0A', text: '#FFFFFF', dim: '#E9D9B8', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.6, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    collage: true, variant: 'gallery150', scatter: true, cols: 6, cellHoldS: 2.4, moveS: 1.1,
    warm: '#2A2620', warmOpacity: '12%',
  },
  // Epic Vintage (Envato "Epic Vintage" ref): ONE large tilted print in sharp
  // focus at a time, floating over a heavily-blurred, warm-graded bokeh field of
  // the same photo; a slow push on the hero; big warm light-leak flashes mask
  // each long crossfade. Faded, low-contrast vintage grade throughout. NO
  // template text. (epicVintageSource.)
  epic_vintage: {
    label: 'Epic Vintage (one hero print, blurred bokeh, heavy light leaks)',
    bg: '#171008', text: '#FFF3E0', dim: '#E8C79A', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 1.9, fadeS: 1.1, transitions: ['fade'], zoom: ['100%', '100%'],
    epic: true,
    warm: '#C98A5A', warmOpacity: '26%',   // warm multiply grade
    haze: '#F0E2C8', hazeOpacity: '4%',    // very slight cream lift (render over-brightens screens — keep tiny)
  },
  // Trendy Photo Wall (Envato "Trendy Photo Montage" ref): a grid of white-MATTED
  // prints on a cream wall, viewed at a 3D PERSPECTIVE angle (Creatomate
  // perspective + x_rotation/y_rotation), with the camera drifting slowly across
  // and the wall rotating gently toward the lens. Soft dreamy grade + light
  // leaks. NO template text. (trendyWallSource.)
  trendy: {
    label: 'Trendy Photo Wall (3D angled grid of matte prints)',
    bg: '#ECE5D6', text: '#3A3226', dim: '#8A7C63', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.4, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    trendy: true,
    wall: '#EFE9DC',                       // cream wall behind the prints
    warm: '#C9A46A', warmOpacity: '10%',   // soft warm grade
  },
  multi_page: {
    // Green-screen collage: 3–4 photos per page in one of four aspect-adaptive
    // layouts that repeat; each photo pivots ON individually, one at a time.
    label: 'Multi Page (green screen · images pop on one by one)',
    bg: '#00B140', text: '#FFFFFF', dim: '#CFF7DD', font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.0, fadeS: 0.5, transitions: ['fade'], zoom: ['100%', '100%'],
    multipage: true, perImage: true,
  },
  multi_page_record: {
    // Same collage, but the whole PAGE pivots off around the bottom-left hub
    // (record turn), then the next page's photos reveal one at a time.
    label: 'Multi Page Record (green screen · page pivots, then reveals)',
    bg: '#00B140', text: '#FFFFFF', dim: '#CFF7DD', font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.0, fadeS: 0.5, transitions: ['fade'], zoom: ['100%', '100%'],
    multipage: true, perImage: false,
  },
  two_panel: {
    // Green-screen: exactly TWO photos per card, side by side (odd tail = 1). They
    // pop on one at a time (Multi Page motion), entering from the outer edges and
    // alternating which side leads each card. Dissolve is available too.
    label: 'Two Panel (green screen · 2 photos per card, sides alternate)',
    bg: '#00B140', text: '#FFFFFF', dim: '#CFF7DD', font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.0, fadeS: 0.5, transitions: ['fade'], zoom: ['100%', '100%'],
    multipage: true, perImage: true, twoPanel: true,
  },
  // ---- Aspect-aware slide family (see the builders lower down) --------------
  // Every card is cut to the PHOTO's own shape, and the move is chosen from the
  // shape of the photo arriving next. Keyable green by default.
  photo_slide: {
    // INTERPRETATION, not a port: Josh's Creatomate "Polaroid Photos" template
    // source JSON was never available. Border proportions + travel are the first
    // things to correct once it is.
    label: 'Photo Slide (bordered prints slide across, each cut to its own shape)',
    greenDefault: true,
    bg: '#141018', text: '#FFFFFF', dim: '#C9B6E0', font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.4, fadeS: 0.5,
    transitions: ['fade'], zoom: ['100%', '100%'],
    slideRail: true,
  },
  glass: {
    // Built with Josh over frames 10/17/19/23/24. See glassSource() for the two
    // ideas that carry it and for the crop-safety rule.
    label: 'Glass (lit panes in a bright room; the room reflows to each photo\u2019s shape)',
    greenDefault: false,
    bg: '#DCE2EA',            // a LIGHT GREY room, deliberately not white: white
                              // edges and white beams need somewhere to be
                              // brighter than, and on a white wall they vanish.
    text: '#1A1F27', dim: '#5B6470', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO',
    // 4.6s, not the 3.4 this shipped with. A shot now has three jobs — dissolve
    // in (0.9s), be a room, then hand the photograph 1.5s alone. At 3.4s that
    // leaves the room about a quarter of a second, which is not a room, it is a
    // flicker. Length mode and the per-photo control still override this.
    photoS: 4.6, fadeS: 1.25,   // the prototype's TRANS is 1.15s; 0.9 measured 0.40-0.57s on render 018, about half the reference's 0.83-1.00s
    transitions: ['fade'], zoom: ['100%', '100%'],
    glass: true,
  },
  sliding_images: {
    // INTERPRETATION, not a port: Josh's Creatomate "Sliding Images" template
    // source JSON was never available.
    label: 'Sliding Images (native-shape photos push in; the next photo sets the direction)',
    greenDefault: true,
    bg: '#0B0B0E', text: '#FFFFFF', dim: '#CFE3FF', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.2, fadeS: 0.45,
    transitions: ['fade'], zoom: ['100%', '100%'],
    slidePush: true,
  },
  framed_box: {
    label: 'Framed Box — a white-framed sharp print over a blurred blow-up of the same photo, drifting; dust and light leaks',
    kicker: 'MEMORIES', bg: '#0C0C10', text: '#FFFFFF', dim: '#D7D7DE', font: 'Montserrat',
    photoS: 3.4, fadeS: 0.5,
    transitions: ['fade'], zoom: ['100%', '100%'],
    framedBox: true,
  },
  basic_cut: {
    // BASIC CUT — the plainest thing this engine can do, and deliberately so.
    // Josh's brief, in full: "simple, no movement, just cut to cut on green
    // screen. entire image in frame. no crop. default 2.5 seconds each image."
    //
    // So every expressive thing the other styles do is switched OFF here, and
    // that is the feature. No push, no drift, no transition, no shadow, no
    // border, no card, no tint. A photograph appears whole on a keyable green
    // field, sits there for 2.5 seconds, and is replaced by the next one on a
    // hard cut. Nothing overlaps, so nothing can bleed into the key.
    //
    // NO CROP IS THE POINT. Every other style cover-fits its photographs, which
    // fills the frame and loses the edges. This one contains them: the whole
    // picture is in frame at its own aspect ratio, with green around it. That
    // means a portrait photo leaves green down both sides — correct, not a bug,
    // because the green is what the editor keys.
    label: 'Basic cut (green screen · whole photo, hard cuts, no movement)',
    greenDefault: true,
    // The literal, not CHROMA_GREEN: this table is evaluated before that const
    // exists, and referencing it here throws at module load — which takes down
    // EVERY style, not just this one. Keep them in step by hand.
    bg: '#00B140', text: '#FFFFFF', dim: '#CFE3FF', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.5, fadeS: 0,
    transitions: ['cut'], zoom: ['100%', '100%'],
    basicCut: true,
  },
  multi_slide: {
    label: 'Multi Slide (several photos at once; one swaps at a time, left to right)',
    greenDefault: true,
    bg: '#0B0B0E', text: '#FFFFFF', dim: '#CFE3FF', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 1.9, fadeS: 0.45,
    transitions: ['fade'], zoom: ['100%', '100%'],
    multiSlide: true,
  },
  party3: {
    // Party 2's exact look and pacing. It STARTED as the proving ground for
    // cover transitions while Party 2 was left alone; Party 2 now has the fix
    // too, so the difference has moved: this one carries a straight 'wipe' in
    // its rotation that Party 2 does not. Same pace, one more kind of move.
    label: 'Party 3 (energetic — drift; slide + circular-wipe + WIPE + fade)',
    greenDefault: true,
    bg: '#140A22', text: '#FFFFFF', dim: '#FF6EB4', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS', photoS: 2.5, fadeS: 0.5,
    transitions: ['slide', 'circular-wipe', 'wipe', 'fade'],
    zoom: ['100%', '118%'],
    pan: true,
    coverTransitions: true,
  },
  comic_book: {
    label: 'Comic Book (moves happen in comic, the real photo is the reveal)',
    greenDefault: true,
    bg: '#0E0B14', text: '#FFFFFF', dim: '#FFD23A', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 3.0, fadeS: 0.5,
    transitions: ['slide', 'wipe', 'slide', 'circular-wipe'],
    zoom: ['100%', '100%'],
    comic: true,
    coverTransitions: true,
  },
  neon_frame: {
    label: 'Neon Frame (a light runs around each photo\u2019s own edge \u2014 dark backdrop)',
    bg: '#05050A', text: '#FFFFFF', dim: '#7CFF3D', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.6, fadeS: 0.5,
    transitions: ['fade'], zoom: ['100%', '100%'],
    neon: true,
  },
  photo_ribbon: {
    label: 'Photo Ribbon (one long strip of native-shape photos — you see the next one coming)',
    greenDefault: true,
    bg: '#0E0C0A', text: '#FFFFFF', dim: '#E9D9B8', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.2, fadeS: 0.45,
    transitions: ['fade'], zoom: ['100%', '100%'],
    ribbon: true,
  },
};

const CARD_S = 4;

// Green-screen placeholder for a client video the editor will key in manually.
// Broadcast chroma green — keys cleanly in any NLE. The clip name shows ONLY
// while the green fully covers the frame (never during the dissolves), so the
// transitions into/out of the gap stay perfectly keyable.
const CHROMA_GREEN = '#00B140';

// ---------------------------------------------------------------------------
// THE KEY COLOUR, AND WHY IT IS SWAPPABLE
//
// The backdrop exists to be keyed out in Premiere. Chroma green is the usual
// choice because h.264 gives green the most luma resolution, so its edges
// survive compression best. But a key cannot tell BACKDROP green from GREEN
// INSIDE A PHOTOGRAPH — and Josh hit exactly that on a Photo Slide render: a
// frame full of trees and a hedge came back with ZERO pixels where green
// dominates. The key had eaten the foliage and left it grey.
//
// Styles that show the backdrop INSIDE the frame are the exposed ones (the
// slide family, Basic cut, anything native-aspect), because there the key has
// to reach in past the photo's own edge. There is no render-side fix:
// Creatomate's output formats are jpg | png | gif | mp4 — checked in its own
// SDK type definitions — so no ProRes 4444 or alpha WebM exists that would skip
// keying altogether.
//
// So the colour itself becomes the setting. Magenta is the standard escape
// hatch: full-saturation #FF00FF essentially never occurs in a family
// photograph. It costs slightly softer key edges, because 4:2:0 chroma
// subsampling treats magenta worse than green.
//
// IT IS APPLIED AS A POST-PASS, NOT THREADED THROUGH. The literal sits in
// eleven places across the engine plus five STYLES.bg entries that CANNOT
// reference this const (the table is evaluated before it exists), and every new
// builder adds more. Threading a parameter through all of them would miss one
// silently, and a missed one is a hole in the key. Rewriting the finished JSON
// cannot miss any.
// ---------------------------------------------------------------------------
export const KEY_COLORS = [
  { value: '#00B140', label: 'Green', note: 'Cleanest key. Wrong when the photos contain foliage, grass or green clothing.' },
  { value: '#FF00FF', label: 'Magenta', note: 'Use when the photos contain green. Almost never occurs in a real photograph; edges key a little softer.' },
  { value: '#0047BB', label: 'Blue', note: 'The classic alternative — but sky, water, denim and eyes are blue, so it trades one collision for another.' },
];
export function normalizeKeyColor(v) {
  if (typeof v !== 'string') return CHROMA_GREEN;
  const hex = v.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : CHROMA_GREEN;
}
export function keyAssetFor(hex) {
  const h = normalizeKeyColor(hex);
  return h === CHROMA_GREEN ? '/green.png' : `/key-${h.slice(1).toLowerCase()}.png`;
}

// Rewrite every chroma-green surface in a FINISHED source to `hex`. Walks the
// whole tree: the backdrop shapes, the green wipes, the video-gap slots, and the
// solid green.png the route hands in as a bookend "photo". No-op when the colour
// is green, so the default path is byte-for-byte unchanged.
export function applyKeyColor(source, keyColor) {
  const hex = normalizeKeyColor(keyColor);
  if (!source || hex === CHROMA_GREEN) return source;
  const isGreen = (v) => typeof v === 'string' && v.trim().toUpperCase() === CHROMA_GREEN;
  const seen = new Set();
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { node.forEach(walk); return; }
    // ONLY these carry the backdrop colour. Deliberately not a blanket
    // search-and-replace across every string: a style's text colour or a
    // photo's own treatment must never be caught by this.
    if (isGreen(node.fill_color)) node.fill_color = hex;
    if (isGreen(node.stroke_color)) node.stroke_color = hex;
    if (isGreen(node.background_color)) node.background_color = hex;
    // The bookends and video gaps are IMAGE elements pointing at a solid green
    // PNG, so recolouring a property does nothing — the asset has to change with
    // them. Sibling files, same size, same encoder.
    if (typeof node.source === 'string' && /\/green\.png(\?|$)/.test(node.source)) {
      node.source = node.source.replace(/\/green\.png/, keyAssetFor(hex));
    }
    Object.values(node).forEach(walk);
  };
  walk(source.elements);
  return source;
}

// Shared "Add background" importer. Returns the background layer element(s) for a
// full-frame backdrop, honouring the per-render `background` control:
//   • { green:true }          → a keyable chroma-green backdrop (the DEFAULT the
//                               UI offers, so Josh can key it in Premiere)
//   • { url, tint, opacity, blur } → the imported image (cover, optional blur)
//                               over the style colour, with an optional colour tint
//   • null / {}               → the style's own bg colour (unchanged look)
// track/duration are supplied by the caller so it can drop these behind everything.
// The per-shot list bgLayers needs for the blurred-blow-up bed. Green slots are
// skipped — a green bookend has no picture to blow up, and its beat is folded
// into the neighbouring bed so the sequence stays continuous with the cut.
// `lead` is whatever plays before the first photo (the opening card).
function bedShotsFor(items, { step, lead = 0 }) {
  const out = [];
  let carry = lead;
  for (const it of items) {
    const d = Number(step) || 0;
    if (!it || it.green || !it.url) {
      // A green slot has no picture to blow up. Its beat is NOT dropped — it is
      // folded into the neighbour, or the sequence would run a whole beat short
      // and every bed after it would land off the cut. Before the first photo it
      // joins the lead; after one, it extends that bed.
      if (out.length) out[out.length - 1].dur += d; else carry += d;
      continue;
    }
    if (out.length === 0) out.lead = carry;
    out.push({ url: it.url, dur: d });
  }
  if (out.length && out.lead === undefined) out.lead = carry;
  return out.length ? out : null;
}

function bgLayers(background, S, { track = 1, time = 0, duration, shots = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const b = background || {};
  // NOTE ON STRUCTURE — this used to return the fill, the backdrop and the tint as
  // THREE SEPARATE ELEMENTS ALL ON THE SAME TRACK, each pinned to time 0 for the
  // whole montage. A track is a lane: two clips sharing one and overlapping in
  // time is not a valid timeline, and Creatomate resolved the conflict by
  // dropping the backdrop partway through — the imported image showed on the
  // first shot and then the style's own colour took over for the rest.
  //
  // It went unnoticed for months because the green and style-default cases return
  // a SINGLE element and so were never in conflict, and those were the only ones
  // anybody had rendered. The first real imported image exposed it immediately.
  //
  // Now the layers are children of ONE composition that occupies the caller's
  // track. Children carry no `track`, so Creatomate gives each its own and they
  // STACK — the same construction polaroidStackSource uses for its prints
  // (paper shape + photo), which is confirmed rendering correctly in production.
  const fill = (c) => ({ type: 'shape', path: rect, width: '100%', height: '100%', fill_color: c });
  const tintLayer = (dflt) => (b.tint
    ? [{ name: 'BgTint', type: 'shape', path: rect, width: '100%', height: '100%', fill_color: b.tint, opacity: b.opacity || dflt }]
    : []);
  const wrap = (elements) => ([{
    name: 'Background', type: 'composition', track, time, duration,
    width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    elements,
  }]);

  // BLURRED BLOW-UP OF EACH PHOTO — the Framed Box bed, offered to every style
  // that can show a backdrop. Josh 2026-09-08: "framed box has a background of
  // the image blown up and blurred. Can that be an option for all?"
  //
  // It is NOT a backdrop in the sense every other option here is. The rest are
  // ONE layer for the whole montage; this one CHANGES WITH EVERY SHOT, so it is
  // a sequence. `shots` carries the per-shot durations in play order and the
  // caller supplies them, because each builder paces itself differently and
  // guessing the beats would put the bed off the cut.
  //
  // The construction is the one already proven by the looping video backdrop
  // directly below: copies on ONE explicit inner track, each with an explicit
  // duration, each after the first carrying a `transition` fade. Same-track
  // siblings AUTO-SEQUENCE, so no absolute times are needed and the overlap
  // cannot drift — and a same-track overlap is the one legal kind, which is why
  // the transition actually fires here (it did not in Neon Frame, where the
  // shots alternate lanes).
  //
  // Each bed is a shot's duration PLUS the seam, because the seam is consumed
  // by the overlap: bed i then advances by exactly its own shot. The first also
  // carries the opening card, the last the closing one, so the montage never
  // shows bare style colour at either end.
  if (b.photoBlur && Array.isArray(shots) && shots.length) {
    const seam = Math.min(0.5, Math.max(0.12, (shots[0].dur || 2) * 0.22));
    const lead = Math.max(0, Number(shots.lead) || 0);
    const body = shots.reduce((m, sh) => m + (Number(sh.dur) || 0), 0);
    const trail = Math.max(0, duration - lead - body);
    // Output is always 1920x1080 (the route never passes dimensions), so a
    // pixel radius is stable. b.blur overrides for a softer or harder bed.
    const radius = (Number.isFinite(Number(b.blur)) && Number(b.blur) > 0) ? Math.round(Number(b.blur)) : 32;
    const beds = shots.map((sh, i) => {
      const first = i === 0, last = i === shots.length - 1;
      const dur = (Number(sh.dur) || 0) + (first ? lead : 0) + (last ? trail : seam);
      return {
        name: i === 0 ? 'Backdrop' : `Backdrop-${i + 1}`,
        type: 'image', source: sh.url, track: 2,
        x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
        fit: 'cover',
        // Blown up so the blur's soft edge stays outside the frame. A stack blur
        // has nothing to sample past its element's bounds, so a bed sized exactly
        // to the frame feathers at the boundary — the same reason Framed Box
        // oversizes its own bed picture.
        x_scale: '118%', y_scale: '118%',
        blur_radius: radius, blur_mode: 'stack',
        duration: Number(Math.max(0.1, dur).toFixed(3)),
        ...(first ? {} : { animations: [{ time: 'start', duration: Number(seam.toFixed(3)), transition: true, type: 'fade' }] }),
      };
    });
    return wrap([
      { ...fill(S && S.greenDefault ? CHROMA_GREEN : ((S && S.bg) || '#000000')), track: 1 },
      ...beds,
      ...tintLayer('35%').map((t) => ({ ...t, track: 3 })),
    ]);
  }

  if (b.green) return wrap([fill(CHROMA_GREEN)]);

  // Built-in TEXTURE background (soft-focus / linen / gradient). Optionally drifts
  // + slow-zooms (Ken Burns) when animated. Starts at 106% so the drift never
  // reveals an edge.
  if (b.textureUrl) {
    const el = { name: 'Backdrop', type: 'image', source: b.textureUrl, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' };
    if (b.animated) {
      el.x_scale = [{ time: 0, value: '106%', easing: 'linear' }, { time: duration, value: '116%' }];
      el.y_scale = [{ time: 0, value: '106%', easing: 'linear' }, { time: duration, value: '116%' }];
      el.x = [{ time: 0, value: '47%', easing: 'linear' }, { time: duration, value: '53%' }];
      el.y = [{ time: 0, value: '51%', easing: 'linear' }, { time: duration, value: '48%' }];
    } else { el.x_scale = '104%'; el.y_scale = '104%'; }
    return wrap([fill('#0b0b0e'), el, ...tintLayer('35%')]);
  }

  // IMPORTED VIDEO backdrop (the studio background library). Checked BEFORE
  // b.url so a library video always wins over a stray url on the same control.
  //   • loop      — the montage is nearly always longer than the clip, and a
  //                 backdrop that freezes on its last frame looks broken.
  //   • volume 0% — montages are silent by design (Josh finishes them in
  //                 Premiere); a backdrop must never bring its own audio in.
  //   • fit cover — fills the frame at any clip aspect, same as the image path.
  // Creatomate's video element supports all three (see VideoProperties in the
  // official SDK: loop, volume, fit, trim_start, trim_duration).
  if (b.videoUrl) {
    // LOOPING A CLIP THAT WAS NEVER MADE TO LOOP (Josh 8/18: "they aren't made
    // to loop"). `loop: true` wraps HARD — the last frame is followed by the
    // first, and on anything but a purpose-built seamless loop that reads as a
    // jump every few seconds.
    //
    // A single element cannot cross-dissolve with itself, so when we know how
    // long the clip is we lay COPIES end to end on one track, each overlapping
    // the last by the crossfade. Same-track siblings auto-sequence, and a
    // `transition` animation makes the incoming one dissolve over the outgoing
    // — so every wrap becomes a soft blend instead of a cut. Only two clips are
    // ever decoding at once (during the overlap itself).
    //
    // Without a known clip length we cannot place the seams, so it falls back to
    // the plain hard-wrapping loop rather than guessing.
    // 20 frames unless told otherwise. Guard the null case explicitly:
    // Number(null) is 0, which would silently mean "no crossfade".
    const seamFrames = (b.loopCrossfadeFrames == null || !Number.isFinite(Number(b.loopCrossfadeFrames)))
      ? 20 : Math.max(0, Number(b.loopCrossfadeFrames));
    const seam = seamFrames / 30;
    const clipS = Number(b.clipS) > 0 ? Number(b.clipS) : 0;
    const trimStart = (Number.isFinite(Number(b.trimStart)) && Number(b.trimStart) > 0) ? Number(b.trimStart) : 0;
    const usable = clipS > 0 ? Math.max(0, clipS - trimStart) : 0;
    const base = {
      type: 'video', source: b.videoUrl, track: 2,
      x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      fit: 'cover', volume: '0%',
      ...(trimStart > 0 ? { trim_start: trimStart } : {}),
      ...(b.blur ? { blur_radius: Number(b.blur) || 18, blur_mode: 'stack' } : {}),
    };
    let videoLayers;
    // The seam must be shorter than the clip or the copies would overlap end to
    // end; and a very short clip under a long montage would need a silly number
    // of copies, so cap it and take the hard loop instead.
    const advance = usable - seam;
    const needed = (usable > 0 && seam > 0 && advance > 0.2) ? Math.ceil((duration - seam) / advance) : 0;
    if (needed > 1 && needed <= 40) {
      videoLayers = Array.from({ length: needed }, (_, i) => ({
        ...base,
        name: i === 0 ? 'Backdrop' : `Backdrop-${i + 1}`,
        // EXPLICIT duration: a video without one runs for its media length, which
        // is what stopped the backdrop dead partway through the montage before.
        duration: Number(Math.min(usable, duration - i * advance).toFixed(3)),
        ...(i > 0 ? { animations: [{ time: 'start', duration: Number(seam.toFixed(3)), transition: true, type: 'fade' }] } : {}),
      }));
    } else {
      videoLayers = [{ ...base, name: 'Backdrop', duration, loop: true }];
    }
    return wrap([
      { ...fill('#000000'), track: 1 },
      ...videoLayers,
      ...tintLayer('50%').map((t) => ({ ...t, track: 3 })),
    ]);
  }
  if (b.url) {
    return wrap([
      fill(S.bg),
      {
        name: 'Backdrop', type: 'image', source: b.url,
        x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
        fit: 'cover',
        ...(b.blur ? { blur_radius: Number(b.blur) || 18, blur_mode: 'stack' } : {}),
      },
      ...tintLayer('50%'),
    ]);
  }

  // No background chosen → the style's own palette, EXCEPT the plain-colour styles
  // now default to keyable green (Josh). Styles whose look IS their background
  // (Epic, walls, Story, Duotone) keep S.bg.
  return wrap([fill(S.greenDefault ? CHROMA_GREEN : S.bg)]);
}
const PLACEHOLDER_S = 3; // fixed 3s gap; the editor trims to their real clip

// WALL/PILE styles only (Epic Vintage, Trendy, collage, polaroid, duotone2).
// These show many photos at once, so a single full-frame "green photo" can't sit
// in the grid the way it does in a slideshow. Instead we add a green FRAME at the
// head and tail: it WIPES in across the frame (the picture-like movement Josh
// wants — not a flat fade), holds a clean full-frame chroma-green key window he
// cuts his footage into, then — at the head — wipes off to reveal the wall; at
// the tail it holds to the closing card. On track 100 so it fully covers the
// wall while present. (The slideshow styles instead inject green as a real
// first/last PHOTO slot — see gseq in buildMontageSource.)
const GREEN_IN = 0.5;    // directional wipe-in (decelerates onto the frame)
const GREEN_HOLD = 2.2;  // a full green FRAME the editor keys into (not a flash)
const GREEN_OUT = 0.5;   // head only: wipe back off into the montage
const GREEN_OFF_L = '-72%'; // 120%-wide shape parked fully off the left edge
const GREEN_ON = '50%';     // centered → fully covers the frame
const GREEN_OFF_R = '172%'; // parked fully off the right edge
function greenWipe({ name, time, duration, xk }) {
  // 120% over-sized so the frame is never uncovered at the covered position and
  // no style background peeks past the edges during the slide.
  return {
    name, type: 'shape', track: 100, time, duration,
    path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
    width: '120%', height: '120%', x_anchor: '50%', y_anchor: '50%', y: '50%',
    fill_color: CHROMA_GREEN, x: xk,
  };
}
function addGreenBookends(source, includeCards) {
  if (!source || !Array.isArray(source.elements)) return source;
  const bgEl = source.elements.find((e) => e.name === 'Background');
  const total = bgEl && bgEl.duration
    ? bgEl.duration
    : source.elements.reduce((m, e) => Math.max(m, (e.time || 0) + (e.duration || 0)), 0);
  const cardS = includeCards ? CARD_S : 0;
  // HEAD — after the opening card: green slides in from the left, holds clean,
  // then slides off to the right, revealing shot 1 (a real wipe transition).
  const headDur = GREEN_IN + GREEN_HOLD + GREEN_OUT;
  source.elements.push(greenWipe({
    name: 'GreenStart', time: cardS, duration: headDur,
    xk: [
      { time: 0, value: GREEN_OFF_L, easing: 'quadratic-out' },
      { time: GREEN_IN, value: GREEN_ON },
      { time: GREEN_IN + GREEN_HOLD, value: GREEN_ON, easing: 'quadratic-in' },
      { time: headDur, value: GREEN_OFF_R },
    ],
  }));
  // TAIL — before the closing card: the last shot wipes to green from the right,
  // which then holds clean to the end (mirror of the head).
  const tailDur = GREEN_IN + GREEN_HOLD;
  const tailStart = Math.max(cardS, (total - cardS) - tailDur);
  source.elements.push(greenWipe({
    name: 'GreenEnd', time: tailStart, duration: tailDur,
    xk: [
      { time: 0, value: GREEN_OFF_R, easing: 'quadratic-out' },
      { time: GREEN_IN, value: GREEN_ON },
      { time: tailDur, value: GREEN_ON },
    ],
  }));
  return source;
}

// Polaroid stacking pile (approved mock): new print every HOLD, drop-in over
// MOVE, keep KEEP visible, oldest fades over FADE.
const POL = { HOLD: 2.0, MOVE: 1.6, KEEP: 4, FADE: 0.65 }; // HOLD = default 2s beat (overridden by the per-photo / length control); MOVE = floaty toss that eases to rest
// Deterministic pseudo-random from an int seed, so re-renders are identical.
function pol_rand(n) { const x = Math.sin((n + 1) * 12.9898) * 43758.5453; return x - Math.floor(x); }

// Apply a photo's per-image colour edit. Creatomate applies ONE color_filter
// per image, so these are MUTUALLY EXCLUSIVE (see MONTAGE-EDITS-NOTES.md).
// Priority: B&W / Sepia > explicit Contrast > auto-colour. SATURATION is not
// emitted — there is no confirmed Creatomate 'saturate' filter and it could not
// co-exist with another color_filter anyway; it stays editor-preview-only until
// a Creatomate capability is confirmed. Contrast's value mapping is a first
// guess (signed delta from the neutral 100) — CALIBRATE on the first render.
function applyPhotoColor(el, it) {
  if (!it) return el;
  if (it.mode === 'bw') { el.color_filter = 'grayscale'; el.color_filter_value = '100%'; }
  else if (it.mode === 'sepia') { el.color_filter = 'sepia'; el.color_filter_value = '80%'; }
  else {
    const c = Number(it.contrast);
    if (Number.isFinite(c) && c !== 100) { el.color_filter = 'contrast'; el.color_filter_value = `${Math.round(c - 100)}%`; }
    // Auto color = one-tap enhance. Creatomate applies ONE color_filter per image,
    // so the render can't stack brightness+contrast+saturation like the editor
    // preview does — it uses the single most-visible lift (a contrast pop). The
    // editor preview shows the fuller enhance; use it as the starting point and the
    // sliders for precise control. (Was a barely-visible 6% brighten.) CALIBRATE
    // the strength on a test render.
    else if (it.colorCorrect) { el.color_filter = 'contrast'; el.color_filter_value = '15%'; }
  }
  return el;
}

// ---- PHOTO BORDERS ---------------------------------------------------------
// A border is a stroked rectangle drawn at the edge of the photo's VISIBLE rect.
//
// WHY A SHAPE AND NOT THE IMAGE'S OWN STROKE. Creatomate image and composition
// elements both accept stroke_color/stroke_width, which looks like the obvious
// route — but in this engine the photo element is almost never the same rect as
// the picture you see. coverBox() deliberately sizes the image LARGER than its
// slot (to its true aspect) and lets a clipping composition crop it, so a stroke
// on the image would be drawn out in the cropped-away region and never appear.
// And where the photo sits in a comp that Ken-Burns-scales, a stroke on that comp
// scales with it — the border would visibly thicken through the shot. A separate,
// un-animated shape at the slot edge avoids both traps.
//
// WHY PIXELS AND NOT vmin. vmin is a percentage of the frame's short side, but
// it is not established whether Creatomate resolves it against the ROOT frame or
// the containing composition — and this engine nests photos several comps deep.
// Guessing wrong would make borders wildly inconsistent between a full-frame
// style and a tiled cell. The thickness is therefore converted to pixels here,
// against the real output height, so one slider value means one weight
// everywhere regardless of nesting. UNVERIFIED BY RENDER — the conversion is
// arithmetic, but stroke alignment (centred on the path vs inside it) is not
// confirmed; see the inset note below.
const BORDER_RECT = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';

// Thickness in px for a border on a frame whose short side is `frameMin` px.
function borderPx(it, frameMin) {
  const b = it && it.border;
  if (!b || !b.on) return 0;
  const w = Number(b.w);
  if (!Number.isFinite(w) || w <= 0) return 0;
  return Math.max(1, Math.round((w / 100) * (frameMin || 1080)));
}

// A border frame for a box of boxWpx x boxHpx, as an element to drop in beside
// the photo inside its clipping composition.
//
// The rect is INSET by half the stroke. Creatomate centres a stroke on its path,
// so a rect at the exact box edge would have half its weight outside the box and
// clipped away — the border would render at half the chosen thickness on every
// clipped photo, and at full thickness on unclipped ones. Insetting puts the
// whole line inside the picture, which is both consistent and what a border on a
// photo should look like.
function borderFrame(it, boxWpx, boxHpx, frameMin) {
  const px = borderPx(it, frameMin);
  if (!px || !(boxWpx > 0) || !(boxHpx > 0)) return null;
  const insetW = (px / 2) / boxWpx * 100;
  const insetH = (px / 2) / boxHpx * 100;
  // A border thicker than the box it frames would invert the rect; clamp so a
  // heavy border on a small tiled cell degrades to a filled block instead.
  const W = Math.max(1, 100 - 2 * insetW);
  const H = Math.max(1, 100 - 2 * insetH);
  return {
    name: 'PhotoBorder',
    type: 'shape',
    path: BORDER_RECT,
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    width: `${W.toFixed(3)}%`, height: `${H.toFixed(3)}%`,
    fill_color: 'rgba(0,0,0,0)',
    stroke_color: (it.border && it.border.color) || '#FFFFFF',
    stroke_width: `${px} px`,
  };
}

// Append a border frame to a composition's element list, if the photo has one.
// Untracked siblings each get their OWN track in Creatomate, so the border
// stacks above the photo rather than competing with it for a lane.
function withBorder(elements, it, boxWpx, boxHpx, frameMin) {
  const f = borderFrame(it, boxWpx, boxHpx, frameMin);
  return f ? elements.concat([f]) : elements;
}

// Give an ALREADY-POSITIONED photo element a border, by taking over its geometry
// with a clipping composition of the same rect and putting the photo and the
// border inside it together. Used by the card and cell styles, where the photo is
// placed at an arbitrary spot inside its parent rather than filling it.
//
// When the photo is shown WHOLE (fit: contain) the picture is smaller than the
// box it was given, so the frame is shrunk onto the picture — Josh's "hug the
// actual photo edge". Without probed dimensions the picture's rect is unknowable
// and the box is framed instead.
function boxedWithBorder(imgEl, it, boxWpx, boxHpx, frameMin) {
  if (!borderPx(it, frameMin)) return imgEl;
  const pct = (v, d) => {
    const n = parseFloat(String(v === undefined || v === null ? d : v));
    return Number.isFinite(n) ? n : d;
  };
  let outW = pct(imgEl.width, 100), outH = pct(imgEl.height, 100);
  let bw = boxWpx, bh = boxHpx;
  if (imgEl.fit === 'contain') {
    const r = containRectPct(it, boxWpx, boxHpx);
    if (r) {
      outW = outW * (r.W / 100); outH = outH * (r.H / 100);
      bw = boxWpx * (r.W / 100); bh = boxHpx * (r.H / 100);
    }
  }
  const f = borderFrame(it, bw, bh, frameMin);
  if (!f) return imgEl;
  return {
    type: 'composition', clip: true,
    x: imgEl.x, y: imgEl.y,
    x_anchor: imgEl.x_anchor, y_anchor: imgEl.y_anchor,
    width: `${outW.toFixed(3)}%`, height: `${outH.toFixed(3)}%`,
    elements: [
      // The photo keeps its fit, but now fills the box that was its rect, so the
      // border drawn at that box's edge lands exactly on the picture's edge.
      { ...imgEl, x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', width: '100%', height: '100%' },
      f,
    ],
  };
}

// The photo's VISIBLE rect inside a box when it is shown WHOLE (Fit/contain), as
// percentages of that box. Josh chose "hug the actual photo edge": a 9x16 in a
// 16x9 slot gets a tall narrow border with background either side, not a wide
// border around empty letterbox. Needs probed dims — returns null without them,
// and the caller falls back to framing the slot.
function containRectPct(it, boxWpx, boxHpx) {
  const ar = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 0;
  if (!ar || !(boxWpx > 0) || !(boxHpx > 0)) return null;
  const boxAR = boxWpx / boxHpx;
  return ar >= boxAR
    ? { W: 100, H: (boxAR / ar) * 100 }   // letterboxed top and bottom
    : { W: (ar / boxAR) * 100, H: 100 };  // pillarboxed left and right
}

// Rounded-rectangle SVG path in the element's local 0..100 space. rx/ry are the
// corner radii (different because the card isn't square, so corners look even).
function roundedRect(rx, ry) {
  const x2 = (100 - rx).toFixed(2), y2 = (100 - ry).toFixed(2);
  return `M ${rx} 0 L ${x2} 0 Q 100 0 100 ${ry} L 100 ${y2} Q 100 100 ${x2} 100 L ${rx} 100 Q 0 100 0 ${y2} L 0 ${ry} Q 0 0 ${rx} 0 Z`;
}
// A SQUIGGLE. A sine wave sampled into a polyline across the element's own
// 0-100 box, so it stretches to whatever it is given. Deliberately a plain
// polyline rather than curves: stroke trimming (stroke_start/stroke_end) is
// measured along the path, and a dense polyline gives an even, predictable
// length to trim, which beziers of varying curvature do not.
function squigglePath(waves, amp, phase) {
  const N = 96;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = t * 100;
    const y = 50 + Math.sin((t * waves * 2 * Math.PI) + phase) * amp;
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M ${pts[0]} ` + pts.slice(1).map((p) => `L ${p}`).join(' ');
}

// Polaroid card ~42%×58% of a 16:9 frame → ~14px even corners.
const POLAROID_CARD_PATH = roundedRect(1.8, 2.4);

// Where the photo sits inside the print window so heads stay in. Default TOP
// (top-anchored cover shows the top of the source, crops the bottom).
function printFraming(it) {
  const f = it && ['top', 'center', 'bottom'].includes(it.framing) ? it.framing : 'top';
  if (f === 'center') return { x: '50%', y: '43%', y_anchor: '50%' };
  if (f === 'bottom') return { x: '50%', y: '82%', y_anchor: '100%' };
  return { x: '50%', y: '4%', y_anchor: '0%' }; // top — keeps heads
}

// Parse a photos expression like "1-10, 15, 108, 11-51" into an ordered list of
// 1-based photo positions. TYPED ORDER is preserved (so "10, 3" plays 10 then
// 3); a photo that appears twice keeps its FIRST occurrence; numbers outside
// 1..count are dropped. A descending range like "10-1" counts down. Blank or
// missing spec means "all photos in order". Positions map to the same 1..N
// numbering the admin photo strip shows.
export function parsePhotoSpec(spec, count) {
  const n = Math.max(0, Number(count) || 0);
  const all = [];
  for (let i = 1; i <= n; i++) all.push(i);
  if (spec == null || !String(spec).trim()) return all;

  const out = [];
  const seen = new Set();
  const add = (k) => {
    if (Number.isInteger(k) && k >= 1 && k <= n && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };
  for (const raw of String(spec).split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*[-–—]\s*(\d+)$/); // hyphen / en / em dash
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      const step = a <= b ? 1 : -1;
      for (let k = a; step > 0 ? k <= b : k >= b; k += step) add(k);
    } else if (/^\d+$/.test(token)) {
      add(parseInt(token, 10));
    }
    // anything else (stray text) is ignored rather than throwing
  }
  return out;
}

// Title cards HARD CUT to/from the photos (Josh: he usually replaces the
// cards in the edit, so nothing may dissolve across those boundaries).
// Only photo→photo boundaries overlap: (n-1) transitions.
export function montageDuration(n, styleKey = 'hollywood') {
  const s = STYLES[styleKey] || STYLES.hollywood;
  return CARD_S + n * s.photoS + CARD_S - Math.max(0, n - 1) * s.fadeS;
}

function transitionIn(S, i) {
  const type = S.transitions[i % S.transitions.length];
  const a = { time: 'start', duration: S.fadeS, transition: true, type };
  if (!S.coverTransitions) return [a];
  // ---- COVER MODE: the fix for green bleed on MOVEMENT transitions ----------
  // A plain slide/wipe animates BOTH photos, so mid-transition the frame is
  // briefly uncovered, the green backdrop shows through and tints the blend — a
  // cast that survives chroma keying. holdFade cured that by replacing the move
  // with a dissolve, which is why it can't be used on movement styles (it
  // flattens them; Josh reverted that once already).
  //
  // Creatomate's own SDK type definitions expose the option their public docs
  // never showed: `slide` takes fixed: 'none' | 'first-only' | 'second-only',
  // and `wipe` / `circular-wipe` take clip: 'both' | 'first-only' |
  // 'second-only'. Holding the FIRST (outgoing) photo still while the second
  // moves over it keeps the frame covered for the whole transition AND keeps the
  // movement — which is exactly what holdFade could not do.
  //
  // UNVERIFIED BY A RENDER. Read from node_modules/creatomate/src/animations,
  // which is authoritative for property NAMES and proves nothing about output.
  // Prove it on one cheap draft before flipping this on for Party/Party 2/Duotone.
  if (type === 'slide') a.fixed = 'first-only';
  else if (type === 'wipe' || type === 'circular-wipe') a.clip = 'second-only';
  return [a];
}

function text(track, str, { size, weight = '700', y, color, spacing, font }) {
  const el = {
    type: 'text',
    track,
    text: str,
    font_family: font,
    font_weight: weight,
    font_size: `${size} px`,
    fill_color: color,
    x: '50%',
    y,
    width: '90%',
    x_anchor: '50%',
    y_anchor: '50%',
    x_alignment: '50%',
  };
  if (spacing) el.letter_spacing = spacing;
  return el;
}

function card(S, { kicker, title, subtitle, height }) {
  const elements = [
    { type: 'shape', track: 1, path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', width: '100%', height: '100%', fill_color: S.bg },
  ];
  if (kicker) elements.push(text(2, kicker, { size: Math.round(height * 0.032), weight: '600', y: '30%', color: S.dim, spacing: '18%', font: S.font }));
  if (title) {
    elements.push({
      ...text(3, title, { size: Math.round(height * 0.17), y: '48%', color: S.text, font: S.font }),
      x_scale: [{ time: 0, value: '112%', easing: 'quadratic-out' }, { time: 1.2, value: '100%' }],
      y_scale: [{ time: 0, value: '112%', easing: 'quadratic-out' }, { time: 1.2, value: '100%' }],
      opacity: [{ time: 0, value: '0%' }, { time: 0.6, value: '100%' }],
    });
  }
  if (subtitle) elements.push(text(4, subtitle, { size: Math.round(height * 0.036), weight: '400', y: '66%', color: S.dim, spacing: '14%', font: S.font }));
  return elements;
}

// photos: [{ url }] in final order.
// photoSeconds: optional 1–10 override for how long each photo holds
// (style default when omitted). Transitions clamp to 40% of the hold so a
// fast pace never drowns in a long dissolve.
// includeCards: opening + closing title cards (default true). When false the
// segment renders as bare photos — no cards to trim around when it's dropped in
// the middle of an edit. Either way the FIRST photo hard-cuts in (no dissolve
// on the opening frame) and cards never dissolve across a photo boundary.
// Duotone Split style: the same photo duplicated side by side, each half a
// different duotone (grayscale image + multiply-highlight + screen-shadow, the
// Creatomate equivalent of the CSS mock), with a true-colour hero centred on top
// that slowly pushes forward. One composition per photo.
// ---- Shared per-image framing (used by every cover-cropped style so the admin
// Fix-framing slider drives them all the same way the preview shows) -----------
// A framing value is a NUMBER 0..100 (slider: 0 top … 100 bottom) OR a preset
// string (top/center/bottom/left/right). Default = TOP (keep heads).
// A framing value is one of:
//   • an OBJECT { y, x, z }   — y/x are 0..100 (crop position), z is zoom % (100 = fit)
//   • a NUMBER 0..100         — vertical position only (legacy slider)
//   • a preset string         — top/center/bottom/left/right
// Returns bias { v, h, z }: v/h in 0..1 (0=top/left, 1=bottom/right), z ≥ 1 zoom.
// Default = TOP, centred horizontally, no zoom (keep heads).
function photoFramingBias(it) {
  const fr = it && it.framing;
  let v = 0, h = 0.5, z = 1;
  if (fr && typeof fr === 'object') {
    if (isFinite(fr.y)) v = Math.min(1, Math.max(0, fr.y / 100));
    if (isFinite(fr.x)) h = Math.min(1, Math.max(0, fr.x / 100));
    if (isFinite(fr.z)) z = Math.min(3, Math.max(0.4, fr.z / 100)); // 0.4 = wide out, 3 = zoom in
  } else if (typeof fr === 'number' && isFinite(fr)) v = Math.min(1, Math.max(0, fr / 100));
  else if (fr === 'center') v = 0.5;
  else if (fr === 'bottom') v = 1;
  else if (fr === 'top') v = 0;
  else if (fr === 'left') h = 0;
  else if (fr === 'right') h = 1;
  return { v, h, z };
}
// Position an image to COVER a box while cropping by the framing bias. Creatomate
// 'cover' ignores anchors (always centre-crops), so we size the image to the
// photo's TRUE aspect — 'cover' then has nothing to re-crop — and slide it; the
// CALLER must wrap it in a CLIPPED composition of the box size. boxWpx/boxHpx set
// only the box ASPECT, so any resolution works. Zoom (z) scales the fill up so it
// crops in on both axes, biased by x/y. Needs it.w/it.h (probed dims); falls back
// to landscape if missing.
function coverBox(it, boxWpx, boxHpx) {
  const ar = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 1.5;
  const boxAspect = boxHpx > 0 ? boxWpx / boxHpx : 1.5;
  const { v, h, z } = photoFramingBias(it);
  // Base cover: fill the box on its constrained axis (100%), overflow the other.
  let W, H;
  if (ar <= boxAspect) { W = 100; H = (boxWpx / ar) / boxHpx * 100; }   // fill width
  else { H = 100; W = (boxHpx * ar) / boxWpx * 100; }                   // fill height
  W = Math.max(20, W * z); H = Math.max(20, H * z);                    // z>1 crops in; z<1 shrinks the image inside its frame (wide out)
  const x = 50 + ((W - 100) / 2) * (1 - 2 * h);                        // slide within the overflow
  const y = 50 + ((H - 100) / 2) * (1 - 2 * v);
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%', width: `${W.toFixed(1)}%`, height: `${H.toFixed(1)}%`, fit: 'cover' };
}
// Head-safe full-frame motion for the one-at-a-time FILL styles. Plain cover-fill
// CENTRE-crops (so "Head" does nothing and faces get chopped); instead we size the
// image to its TRUE aspect inside a clip:true full-frame comp (coverBox → nothing
// left to re-crop, slid by the Fix-framing bias), and put the push/pull zoom + drift
// on the COMP, TOP-anchored so the zoom grows DOWNWARD and heads stay pinned to the
// top edge. Needs it.w/it.h (probed dims); per-photo colour is applied to the inner
// image. `drift` (a photo index) adds Party-2 horizontal energy when finite.
function fullFrameMotion(S, it, { zoomIn, sizePct, amp, drift, frameW, frameH }) {
  const lo = sizePct, hi = sizePct + amp;
  const from = `${(zoomIn ? lo : hi).toFixed(1)}%`, to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
  const img = applyPhotoColor({ type: 'image', source: it.url, ...coverBox(it, 1920, 1080) }, it);
  const comp = {
    type: 'composition', width: '100%', height: '100%', clip: true,
    x: '50%', y: '0%', x_anchor: '50%', y_anchor: '0%', // top-anchored: zoom grows downward, heads pinned
    x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
    y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
    elements: [img],
  };
  if (Number.isFinite(drift)) {
    const DX = ['48%', '52%', '51%', '49%'];
    comp.x = [{ time: 0, value: '50%', easing: 'linear' }, { time: S.photoS, value: DX[Math.abs(drift) % DX.length] }];
  }
  // A border belongs to the FRAME, not to the moving picture inside it. This comp
  // scales (that IS the push/pull) and drifts sideways, so a stroke placed on it
  // would thicken and slide off with the movement. Lift the border into a still
  // wrapper above it instead, so the picture moves behind a fixed frame.
  const W = frameW || 1920, H = frameH || 1080;
  const f = borderFrame(it, W, H, Math.min(W, H));
  if (!f) return comp;
  return {
    type: 'composition', width: '100%', height: '100%',
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    elements: [comp, f],
  };
}
// ---- Duotone background colour --------------------------------------------
// The two Duotone styles tint the background halves with a [highlight, shadow]
// pair. Those pairs used to be baked into each style, which is why getting a
// softer look meant shipping a whole extra style (duotone_pastel). These are the
// same values lifted out as PICKABLE palettes, so the colour is a setting on the
// render rather than a fork of the style.
export const DUO_PALETTES = {
  neon: {
    label: 'Neon (default)',
    pairs: [['#FF4D88', '#2A0A4A'], ['#38E1FF', '#04223F'], ['#FF7B3A', '#3A0630'],
            ['#A6FF4D', '#052E2A'], ['#C07BFF', '#0A0640'], ['#FFD23A', '#40060F']],
  },
  pastel: {
    label: 'Pastel rainbow',
    pairs: [['#FCC5C6', '#F869A7'], ['#FCD675', '#FB936F'], ['#B780D3', '#8755B4'],
            ['#91C5ED', '#7A93DE'], ['#96D4AC', '#6FCCB9'], ['#FCC5C6', '#DA75BC'],
            ['#C1DB9E', '#6FCCB9'], ['#84ABE5', '#8755B4'], ['#FB98A0', '#F869A7'],
            ['#DDD88B', '#FB936F'], ['#91C5ED', '#84ABE5'], ['#FC9598', '#DA75BC']],
  },
  sunset: {
    label: 'Sunset (warm)',
    pairs: [['#FF9E3D', '#4A1020'], ['#FF5F6D', '#2E0A2A'], ['#FFC24B', '#3B1305'],
            ['#FF7E5F', '#33091C'], ['#FFB88C', '#4A1526'], ['#F76B1C', '#2A0714']],
  },
  ocean: {
    label: 'Ocean (cool)',
    pairs: [['#4FD1E8', '#062B45'], ['#5AA9FF', '#04203C'], ['#7BE8C8', '#053630'],
            ['#3FA7FF', '#031A33'], ['#9AD9FF', '#08304F'], ['#43E0D8', '#04302E']],
  },
  gold: {
    label: 'Gold & ink (formal)',
    pairs: [['#E8C87A', '#1A1408'], ['#D8B56B', '#241A0A'], ['#F0DCA6', '#12100A'],
            ['#C9A24E', '#1E1608'], ['#EBD9A8', '#1A1206'], ['#D6BE84', '#221A0C']],
  },
  mono: {
    label: 'Silver (near-monochrome)',
    pairs: [['#E6E6EA', '#14141A'], ['#CFCFD8', '#0E0E14'], ['#F2F2F5', '#1A1A22'],
            ['#BFBFCC', '#101018'], ['#DEDEE6', '#16161E'], ['#C8C8D4', '#0C0C12']],
  },
};

// What the background PHOTO itself looks like under the tint. The duotone effect
// works by tinting a flat greyscale base, so full colour is offered with the tint
// pulled back — laying a full-strength multiply over an already-coloured photo
// turns it to mud, which is a real limitation of the technique rather than a
// setting worth exposing at full strength.
export const DUO_TREATMENTS = {
  bw: { label: 'Black & white (default)', filter: { color_filter: 'grayscale', color_filter_value: '100%' }, mul: null, scr: '55%' },
  sepia: { label: 'Sepia', filter: { color_filter: 'sepia', color_filter_value: '80%' }, mul: null, scr: '52%' },
  color: { label: 'Full colour (softer tint)', filter: {}, mul: '55%', scr: '34%' },
};

function duoTreatment(S) {
  return DUO_TREATMENTS[S && S.duoTreatment] || DUO_TREATMENTS.bw;
}

// The Duotone hero box, as a fraction of the frame — shared by the render and the
// admin framer so the preview matches.
//
// 68% x 90%, up from 58% x 84%. Josh's standing note for this pass: "the main
// image needs to be large." The hero sits on a duotoned copy of the same
// photograph, so the background still reads clearly at this size — there is no
// competing content for it to crowd, only its own tinted echo.
const DUO_HERO = { w: 0.68, h: 0.90 };

function duotoneShot(S, it, photoCount) {
  const url = it.url;
  const pa = S.pairs[photoCount % S.pairs.length];
  const pb = S.pairs[(photoCount + 2) % S.pairs.length];
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const tr = duoTreatment(S);
  const half = (xc, pair) => ([
    { type: 'image', source: url, x: xc, y: '50%', width: '50%', height: '100%',
      x_anchor: '50%', y_anchor: '50%', fit: 'cover', ...tr.filter },
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      path: rect, fill_color: pair[0], blend_mode: 'multiply', ...(tr.mul ? { opacity: tr.mul } : {}) },
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      path: rect, fill_color: pair[1], blend_mode: 'screen', opacity: tr.scr },
  ]);
  const els = half('25%', pa).concat(half('75%', pb));
  // HERO — true-colour focal image, framed per the photo's Fix-framing setting.
  // Clipped box so the cover-crop can be biased (top keeps heads); the box itself
  // still pushes forward ~8% and keeps its drop shadow.
  els.push({
    type: 'composition', width: `${(DUO_HERO.w * 100).toFixed(0)}%`, height: `${(DUO_HERO.h * 100).toFixed(0)}%`,
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', clip: true,
    shadow_color: '#000000', shadow_blur: '6vmin', shadow_x: '0vmin', shadow_y: '3vmin',
    x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
    y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
    // The hero box IS the visible picture (the tinted halves behind it are the
    // background), so the border frames the hero rather than the whole frame.
    elements: withBorder(
      [{ type: 'image', source: url, ...coverBox(it, DUO_HERO.w * 1920, DUO_HERO.h * 1080) }],
      it, DUO_HERO.w * 1920, DUO_HERO.h * 1080, 1080,
    ),
  });
  return els;
}

// Duotone Split BG panels (static) and the true-colour HERO (pushes forward),
// returned separately so Duotone 2 can transition them independently.
function duotoneParts(S, it, i) {
  const url = it.url;
  const pa = S.pairs[i % S.pairs.length];
  const pb = S.pairs[(i + 2) % S.pairs.length];
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const tr = duoTreatment(S);
  const half = (xc, pair) => ([
    applyPhotoColor({ type: 'image', source: url, x: xc, y: '50%', width: '50%', height: '100%',
      x_anchor: '50%', y_anchor: '50%', fit: 'cover', ...tr.filter }, null),
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: pair[0], blend_mode: 'multiply', ...(tr.mul ? { opacity: tr.mul } : {}) },
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: pair[1], blend_mode: 'screen', opacity: tr.scr },
  ]);
  const bg = half('25%', pa).concat(half('75%', pb));
  const heroImg = applyPhotoColor({ type: 'image', source: url, ...coverBox(it, DUO_HERO.w * 1920, DUO_HERO.h * 1080) }, it);
  const hero = {
    type: 'composition', width: `${(DUO_HERO.w * 100).toFixed(0)}%`, height: `${(DUO_HERO.h * 100).toFixed(0)}%`,
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', clip: true,
    shadow_color: '#000000', shadow_blur: '6vmin', shadow_x: '0vmin', shadow_y: '3vmin',
    x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
    y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
    elements: withBorder([heroImg], it, DUO_HERO.w * 1920, DUO_HERO.h * 1080, 1080),
  };
  return { bg, hero };
}

// ---- Duotone Split 2 — FRANTIC: the background (as one unit) and the hero get
// DIFFERENT transitions on every move (bg might wipe while the hero slides), and
// the type changes each cut so no two moves match. Bg on track 2, hero on track 3,
// aligned by explicit time; cards on track 4 so they hard-cut over the top.
function duotone2Source({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((it) => it.type !== 'placeholder');
  const n = Math.max(1, photos.length);
  const photoS = S.photoS, fade = S.fadeS;
  const step = photoS - fade;                          // consecutive overlap = fade
  const stackStart = includeCards ? CARD_S : 0;
  const contentDur = (n - 1) * step + photoS;
  const total = stackStart + contentDur + (includeCards ? CARD_S : 0);
  // Two never-matching transition wheels; index by move so every cut differs.
  const BG = ['slide', 'circular-wipe', 'scale', 'fade'];
  const HERO = ['scale', 'fade', 'slide', 'circular-wipe'];
  const tr = (type) => [{ time: 'start', duration: fade, transition: true, type }];

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg });
  photos.forEach((it, i) => {
    const t = +(stackStart + i * step).toFixed(2);
    if (it.green) {
      // Green frame → pure full-frame green (keyable), not the duotone tint.
      elements.push({ name: `DuoGreen-${i + 1}`, type: 'composition', track: 2, time: t, duration: photoS,
        ...(i > 0 ? { animations: tr(BG[i % BG.length]) } : {}),
        elements: [{ type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: CHROMA_GREEN }] });
      return;
    }
    const { bg, hero } = duotoneParts(S, it, i);
    elements.push({ name: `DuoBg-${i + 1}`, type: 'composition', track: 2, time: t, duration: photoS,
      ...(i > 0 ? { animations: tr(BG[i % BG.length]) } : {}), elements: bg });
    elements.push({ name: `DuoHero-${i + 1}`, type: 'composition', track: 3, time: t, duration: photoS,
      ...(i > 0 ? { animations: tr(HERO[i % HERO.length]) } : {}), elements: [hero] });
  });
  if (includeCards) {
    elements.push({ name: 'Opening', type: 'composition', track: 4, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height }) });
    elements.push({ name: 'Closing', type: 'composition', track: 4, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }) });
  }
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}


// ---- Polaroid: a GROWING STACKED PILE (not a slideshow) ----
// Prints drop in from above every HOLD seconds and land fanned/scattered; up to
// KEEP are visible at once; the oldest fades as new ones land on top. Mirrors
// the approved mock (polaroid_MOCK_perfected.html / polaroid_reference.mp4).
function polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photosOnly = seq.filter((it) => it.type !== 'placeholder'); // green-screen gaps aren't prints
  const n = photosOnly.length;

  // A print drops every HOLD seconds. HOLD honours the per-photo / length control
  // (S.photoS carries the effective seconds-per-photo — the editor's setting, or
  // the length-mode value, or the style default of 2s). The floaty toss (MOVE)
  // takes most of the beat so the landing stays gentle, but never exceeds it.
  const HOLD = Math.max(0.5, perPhoto != null ? perPhoto : (Number(S.photoS) || POL.HOLD));
  // The DROP takes a slice of the beat so each print visibly falls, slows, and
  // gently STOPS with a rest before the next drops. A single long ease-out (below)
  // keeps the landing soft, not abrupt.
  const MOVE = Math.min(1.4, HOLD * 0.7);
  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const stackDur = n > 0 ? (n - 1) * HOLD + MOVE + HOLD : 0;
  const total = cardsTime + stackDur;
  const stackStart = includeCards ? CARD_S : 0;
  // Changeable-background control (image + tint + opacity). Defaults: no custom
  // image (use the blurred current-photo backdrop) + the deep-violet wash.
  // GREEN-SCREEN control → a clean keyable chroma-green fill with NO vignette/tint
  // over it (any wash would shift the green and break the key); the prints still
  // pile on top, so the editor keys the green around them.
  const bg = background || {};
  const isGreen = !!bg.green;
  const bgUrl = isGreen ? null : (bg.url || S.bgImageUrl || null);
  // An imported VIDEO backdrop from the library. Polaroid builds its backdrop by
  // hand rather than through bgLayers (the pile needs the wash + dust + flare
  // stack sitting above it), so the video case has to be handled here too.
  const bgVideoUrl = isGreen ? null : (bg.videoUrl || null);
  const TINT = bg.tint || S.tint || '#241033';
  const TINT_OP = bg.opacity || S.tintOpacity || '52%';

  const elements = [];

  // Whole-piece backdrop: keyable chroma-green when chosen, else the style wash.
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total,
    path: rect, width: '100%', height: '100%', fill_color: isGreen ? CHROMA_GREEN : S.bg });

  // Opening card (hard cut).
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0,
    duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height }) });

  // STABLE background (Josh: it must NOT change with each photo). Default is a
  // fixed deep-violet wash; a custom background image (from the Change-background
  // control) replaces it, still static. The old per-photo blurred backdrop —
  // which changed on every drop — is gone. On GREEN-SCREEN, none of these layers
  // are drawn — the bare chroma-green Background stays clean so it keys.
  if (!isGreen) {
    // Backdrop + vignette + tint go in ONE composition on track 2. They used to be
    // separate elements with Backdrop and Vignette BOTH on track 2 for the same
    // time range — a same-track overlap, which is not a valid timeline and let
    // Creatomate drop one of them. Untracked children of a composition each get
    // their own track and stack properly. (Same fix as bgLayers; see the note there.)
    const backdropLayers = [];
    if (bgVideoUrl) {
      // duration is explicit for the same reason as bgLayers: without it a video
      // runs for its media length and `loop` never engages.
      backdropLayers.push({ name: 'Backdrop', type: 'video', source: bgVideoUrl, duration: stackDur,
        x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
        fit: 'cover', loop: true, volume: '0%', blur_radius: 18, blur_mode: 'stack' });
    } else if (bgUrl) {
      backdropLayers.push({ name: 'Backdrop', type: 'image', source: bgUrl,
        x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
        fit: 'cover', blur_radius: 18, blur_mode: 'stack' });
    }
    // A soft radial-ish depth: a darker vignette wash at the edges over the solid
    // Background, then the violet tint — all static, so the backdrop never shifts.
    backdropLayers.push({ name: 'Vignette', type: 'shape',
      path: rect, width: '150%', height: '150%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      fill_color: '#000000', opacity: '22%', blend_mode: 'multiply', blur_radius: 60, blur_mode: 'stack' });
    backdropLayers.push({ name: 'Tint', type: 'shape',
      path: rect, width: '100%', height: '100%', fill_color: TINT, opacity: TINT_OP });
    elements.push({ name: 'Backdrop', type: 'composition', track: 2, time: stackStart, duration: stackDur,
      width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      elements: backdropLayers });
  }

  // The prints. Each drops from above and stays (higher track = on top), then
  // fades once KEEP newer prints have landed over it.
  photosOnly.forEach((it, k) => {
    const t = stackStart + k * HOLD;
    // Haphazard scatter with a dominant front print \u2014 a wider, more natural
    // spread than the tight cluster it had drifted to (matches the reference pile).
    const rTilt = (pol_rand(k) * 2 - 1) * 15;              // \u00B115\u00B0 tilt
    const ox = (pol_rand(k + 100) * 2 - 1) * 17;           // \u00B117% horizontal
    const drop = pol_rand(k + 200) < 0.5;
    const oy = (drop ? 6 : -6) + (pol_rand(k + 300) * 2 - 1) * 4;  // ~\u00B110% vertical
    const settleX = 50 + ox, settleY = 50 + oy;
    const startX = settleX + (pol_rand(k + 400) * 2 - 1) * 10;
    // Josh: prints should PILE UP and stay — no fading away in the back. Each
    // print lives from the moment it lands to the end of the stack.
    const life = Math.max(MOVE + HOLD, stackDur - k * HOLD);

    // Print geometry differs by variant:
    //  \u2022 Polaroid Drop (default): fixed near-square card, photo COVER-crops the
    //    square window with a thin even top/sides and a THICK white bottom strip.
    //  \u2022 Photo Drop (wholePhoto): card matches the photo's native aspect + an EVEN
    //    absolute white margin all around, whole photo shown (nothing cropped).
    let cardW, cardH, cardEls;
    if (S.wholePhoto) {
      const A = (it.w > 0 && it.h > 0) ? it.w / it.h : 1;          // photo pixel aspect
      let phH = 50, phW = phH * A * (height / width);             // photo display size, frame %
      if (phW > 58) { phW = 58; phH = phW * (width / height) / A; }
      if (phH > 64) { phH = 64; phW = phH * A * (height / width); }
      // EVEN white border in PIXELS (bottom = top = sides). A frame-% margin
      // renders unequal because the frame is wider than tall, so the horizontal
      // margin-% is scaled by height/width to match the vertical margin in pixels.
      const My = 1.7, Mx = My * (height / width);   // even white border (half the old 3.4 — Josh: thinner frame)
      cardW = phW + 2 * Mx; cardH = phH + 2 * My;
      cardEls = [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: roundedRect(100 * 1.4 / cardW, 100 * 1.4 / cardH), fill_color: '#FDFDFA' },
        // card matches the photo aspect, so 'fill' places the whole photo with an
        // exact even border \u2014 nothing cropped.
        boxedWithBorder(applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '50%', width: `${(phW / cardW * 100).toFixed(1)}%`, height: `${(phH / cardH * 100).toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%', fit: 'fill' }, it), it, (phW / 100) * width, (phH / 100) * height, Math.min(width, height)),
      ];
    } else {
      // Polaroid Drop — matches the APPROVED real-polaroid preview: a SQUARE photo
      // with a thin even top/sides border (~1.4% of card width) and a moderate
      // bottom strip (~8.2%), on a card ~30% of the frame width (was 40% — too
      // big). Photo cover-crops the square window, top-biased to keep heads.
      // Real-polaroid proportions: SQUARE photo, thin even top/sides, and a THICK
      // white bottom strip (Josh: it lost the polaroid look when the bottom got
      // thin). Card taller (×1.183) so the bottom band is ~5× the top; the photo
      // stays square at any frame aspect (see width/height derivation).
      cardW = 30; cardH = cardW * (width / height) * 1.183;
      cardEls = [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: roundedRect(2.3, 1.8), fill_color: '#FCFBF7' },
        boxedWithBorder(applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '2.0%', width: '97.0%', height: '82.0%', x_anchor: '50%', y_anchor: '0%', fit: 'cover' }, it), it, 0.97 * (cardW / 100) * width, 0.82 * (cardH / 100) * height, Math.min(width, height)),
      ];
    }
    const print = {
      name: `Print-${k + 1}`, type: 'composition', track: 4 + k, time: t,
      duration: life,
      // Drop: falls STRAIGHT DOWN (no sideways drift/bounce \u2014 Josh), decelerating on
      // a long ease-out so it lands SOFTLY. The delicate part is the TWIST: it enters
      // over-tilted (same direction) and untwists into its resting tilt, with the
      // last few degrees finishing just AFTER it lands (rotation runs to MOVE\u00D71.22),
      // so the settle reads as a gentle twist-into-place. No horizontal drift.
      x: `${settleX.toFixed(1)}%`,
      y: [{ time: 0, value: '-120%', easing: 'ease-out' }, { time: MOVE, value: `${settleY.toFixed(1)}%` }],
      x_scale: [{ time: 0, value: '106%', easing: 'ease-out' }, { time: MOVE, value: '100%' }],
      y_scale: [{ time: 0, value: '106%', easing: 'ease-out' }, { time: MOVE, value: '100%' }],
      x_anchor: '50%', y_anchor: '50%', width: `${cardW.toFixed(1)}%`, height: `${cardH.toFixed(1)}%`,
      z_rotation: [{ time: 0, value: `${(rTilt + (rTilt >= 0 ? 11 : -11)).toFixed(1)}\u00B0`, easing: 'ease-out' }, { time: MOVE * 1.22, value: `${rTilt.toFixed(1)}\u00B0` }],
      // Soft, larger drop shadow so the print doesn't read as a hard cut-out.
      shadow_color: '#000000', shadow_blur: '8vmin', shadow_x: '0vmin', shadow_y: '3vmin',
      elements: cardEls,
    };
    elements.push(print);
  });

  // Closing card + watermark (watermark on a very high track so it's always on top).
  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S,
    duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0,
    duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });

  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}

// ---- Collage Wall (Classic / Featured) — faithful port of the approved mocks
// (collage_classic.html / collage_featured.html). A grid of photo cells lives in
// a "Wall" composition bigger than the frame; a camera (the Wall's x/y +
// x_scale/y_scale keyframes) WHIPS onto a focal cell, then slowly PUSHES in
// (dwell), visiting focal cells in a haphazard order, alternating a full-frame
// fill with a pulled-back "wall visible" rest — the mock's tf()/whip/dwell model.
// Warm grade on top. Target is "same to the eye", not pixel-exact. RENDER-TEST
// items: (1) that Creatomate scales a composition's contents via x_scale (the
// camera zoom) — the crux; (2) light-leaks / dust / grain / vignette, which are
// browser/canvas effects approximated here by the warm grade (add overlay assets
// later for the full finish).
function collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, assetBase, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((it) => it.type !== 'placeholder');
  const n = Math.max(1, photos.length);
  const featured = S.variant === 'featured';
  const scatter = !!S.scatter;                     // gallery150: tilted print-cards
  const fast = featured || scatter;                // faster whips than Classic
  const pk = (i) => photos[i % n];

  // seeded RNG so re-renders are identical (varies with the photo set)
  let _s = 12345 + n * 97 + (featured ? 7 : 0) + (scatter ? 19 : 0);
  const rnd = (a, b) => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return a + (_s / 0x7fffffff) * (b - a); };

  const gap = 8;
  let wallWpx = 0, wallHpx = 0;
  const cells = [];          // { x,y,w,h,it }  (px in wall space)
  const focal = [];          // { cx,cy,w,h }   (camera targets)

  // NATIVE SHAPE — two wall layouts:
  //  • Collage (classic / featured) → JUSTIFIED ROWS (tidy grid, uniform row height).
  //  • Gallery 150 (scatter) → a haphazard OVERLAPPING PILE of tilted prints (its
  //    reference clip), each native-aspect, camera flying in to feature one.
  // Photos are PLACED in a shuffled order so resting on them 1..N still whips the
  // camera around; every photo keeps its own focused rest.
  const aspOf = (it) => { const a = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 16 / 9; return Math.max(0.42, Math.min(3.2, a)); };
  const place = [...Array(n).keys()];
  for (let i = place.length - 1; i > 0; i--) { const j = Math.floor(rnd(0, i + 1)); [place[i], place[j]] = [place[j], place[i]]; }
  const cellOfPhoto = new Array(n).fill(-1);
  if (scatter) {
    const COLS = S.cols || 6;
    const ROWS = Math.max(3, Math.ceil(n / COLS));
    const BH = 300;                              // base card height (varies a little)
    const slotW = 380, slotH = 320, pad = 260;   // slot < card ⇒ prints overlap
    let pi = 0;
    for (let r = 0; r < ROWS && pi < n; r++) for (let c = 0; c < COLS && pi < n; c++) {
      const it = photos[place[pi]]; const a = aspOf(it);
      const h = BH * (0.86 + rnd(0, 0.32)); const w = h * a;
      const cx = pad + (c + 0.5) * slotW + rnd(-slotW * 0.26, slotW * 0.26);
      const cy = pad + (r + 0.5) * slotH + rnd(-slotH * 0.26, slotH * 0.26);
      cellOfPhoto[place[pi]] = cells.length;
      cells.push({ x: cx - w / 2, y: cy - h / 2, w, h, it, tilt: +rnd(-13, 13).toFixed(1) });
      pi++;
    }
    wallWpx = pad * 2 + COLS * slotW; wallHpx = pad * 2 + ROWS * slotH;
  } else {
    // G is the gutter between cells — the white line you see between photos,
    // which is the wall showing through, not a drawn border. Josh: "can you make
    // the white borderf 1/2 as thick throughout". 22 -> 11.
    const ROWH = featured ? 460 : 300, TARGETW = featured ? 2400 : 2600, G = 11;
    const rows = []; let cur = [], sumA = 0;
    place.forEach((pIdx) => { const it = photos[pIdx]; const a = aspOf(it); cur.push({ pIdx, it, a }); sumA += a; if (sumA * ROWH + G * (cur.length - 1) >= TARGETW) { rows.push(cur); cur = []; sumA = 0; } });
    if (cur.length) rows.push(cur);
    let wy = G, maxRight = 0;
    rows.forEach((row, ri) => {
      const aSum = row.reduce((s, c) => s + c.a, 0);
      let h = (TARGETW - G * (row.length - 1)) / aSum;
      const isLast = ri === rows.length - 1;
      if (isLast && (row.length <= 1 || h > ROWH * 1.5)) h = ROWH;
      h = Math.max(ROWH * 0.7, Math.min(h, ROWH * 1.6));
      let x = G;
      row.forEach((c) => { const w = h * c.a; cellOfPhoto[c.pIdx] = cells.length; cells.push({ x, y: wy, w, h, it: c.it }); x += w + G; });
      maxRight = Math.max(maxRight, x); wy += h + G;
    });
    wallWpx = Math.max(TARGETW + G, maxRight); wallHpx = wy;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // FILL, BUT NEVER PAST THE HEADS. Josh on a Collage Classic render: "many of
  // the images 'Hero' shots are cutting off the heads. I assume it's the 9x16
  // that arent frameing correctly." Correct on both counts.
  //
  // fillScale made the CELL fill the 16:9 frame, which for a tall cell means
  // zooming until its WIDTH fills 1920 — and then almost none of its height is
  // on screen. Measured, against the frame:
  //     16:9 cell   1.02x contain   shows 98% of the cell's height
  //     4:5  cell   2.27x contain   shows 44%
  //     9:16 cell   3.22x contain   shows 31%
  // and the window was centred on the cell, so on a 9:16 portrait the camera
  // framed the middle third of a standing figure. The head was never in it.
  //
  // Two changes. The zoom is capped at COLLAGE_MAX_FILL x the contain scale, so
  // a tall cell cannot be blown up past recognition (that is also why those
  // frames looked soft — a 9:16 cell was being magnified over three times more
  // than a landscape one). And the visible window is no longer the cell's
  // centre: see focusPoint, which places it by the photo's own Fix-framing.
  //
  // TRADE-OFF, stated plainly: a tall photo no longer fills the frame edge to
  // edge on its fill-rests — the wall shows at the sides. That is the price of
  // keeping the head, and Josh's rule on that has been consistent.
  const COLLAGE_MAX_FILL = 1.7;
  //
  // The cap needs a FLOOR as well, which the first version of this did not have
  // and a preview caught immediately: pulling back far enough to keep a tall
  // photo's head can pull back past the WALL's own edges, and tfPct then clamps
  // the pan and leaves bare background down one side. So the scale can never go
  // below what it takes for the wall to cover the frame.
  const coverWall = () => Math.max(W / Math.max(1, wallWpx), H / Math.max(1, wallHpx));
  const fillScale = (f) => Math.max(
    coverWall(),
    Math.min(
      Math.max(W / f.w, H / f.h) * 1.02,
      Math.min(W / f.w, H / f.h) * COLLAGE_MAX_FILL,
    ),
  );

  // Where inside a cell the camera looks when the cell is bigger than the
  // window. Vertically this follows the photo's Fix-framing bias, which
  // defaults to 0 = TOP — the engine's house head-safe rule — so a standing
  // figure is framed from the head down rather than through the middle.
  //
  // FACES, when we have them. Josh: "there are however a few 9x16 that are
  // getting framed odly. leaving way too much head room. are we able to look for
  // multiple faces and center them in the event the entire pic is not shown on
  // screen?" Yes, and that is exactly the missing input.
  //
  // Biasing to the TOP of the cell is head-SAFE but not head-CENTRED: on a 9:16
  // where the people stand low in the frame, the top of the cell is sky. So when
  // studio_media has face boxes, the window is placed on the union of ALL of
  // them — the whole group, not the biggest face — which is what keeps a family
  // together in shot rather than framing one person and cutting the rest.
  //
  // The union's centre is placed a little ABOVE the middle of the window
  // (GROUP_Q = 0.44), because a face dead-centre reads as badly framed; the eye
  // expects some headroom, just not half a frame of it.
  //
  // These cells are NATIVE ASPECT (w = h * the photo's aspect), so the photo
  // maps onto the cell 1:1 and a face's normalised coordinates can be used
  // directly. If that ever stops being true this mapping needs the crop offset.
  const GROUP_Q = 0.44;
  const faceFocus = (it) => {
    const fs = Array.isArray(it && it.faces) ? it.faces.filter((f) => f && f.w > 0 && f.h > 0) : null;
    if (!fs || !fs.length) return null;
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const f of fs) {
      x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y);
      x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h);
    }
    return { fx: (x0 + x1) / 2, fy: (y0 + y1) / 2 };
  };
  const focusPoint = (c, s) => {
    const { v, h } = photoFramingBias(c.it || {});
    const visW = W / s, visH = H / s;
    const ff = faceFocus(c.it);
    // Window top/left that puts a point at fraction q of the window, kept inside
    // the cell.
    const win = (cellStart, cellSize, vis, point, q) =>
      clamp(cellStart + point * cellSize - q * vis, cellStart, cellStart + cellSize - vis) + vis / 2;
    return {
      cx: c.w <= visW ? c.x + c.w / 2
        : (ff ? win(c.x, c.w, visW, ff.fx, 0.5) : c.x + visW / 2 + h * (c.w - visW)),
      cy: c.h <= visH ? c.y + c.h / 2
        : (ff ? win(c.y, c.h, visH, ff.fy, GROUP_Q) : c.y + visH / 2 + v * (c.h - visH)),
    };
  };
  const partialScale = (f) => Math.max(coverWall(), Math.min(W * 0.68 / f.w, H * 0.78 / f.h) * rnd(0.92, 1.05));
  const tfPct = (cx, cy, s) => {
    let tx = W / 2 - cx * s, ty = H / 2 - cy * s;
    tx = clamp(tx, W - wallWpx * s, 0); ty = clamp(ty, H - wallHpx * s, 0);
    return { x: `${(tx / W * 100).toFixed(2)}%`, y: `${(ty / H * 100).toFixed(2)}%`, s: `${(s * 100).toFixed(2)}%` };
  };

  // Rest on every photo in CHRONOLOGICAL order; because placement was shuffled,
  // consecutive numbers sit in scattered cells so the camera whips around.
  const visitCells = [];
  for (let p = 0; p < n; p++) { if (cellOfPhoto[p] >= 0) visitCells.push(cellOfPhoto[p]); }
  // Cap light-leak overlays (one every few moves) so a large set doesn't stack
  // dozens of screen layers and balloon the render.
  const leakEvery = Math.max(1, Math.round(visitCells.length / 12));

  const xK = [], yK = [], sxK = [], syK = [];
  const leakTimes = [];
  let t = 0;
  visitCells.forEach((ci, i) => {
    const c = cells[ci];
    const f = { cx: c.x + c.w / 2, cy: c.y + c.h / 2, w: c.w, h: c.h };
    // scatter (Gallery 150) always keeps surrounding prints visible (partial);
    // Classic/Featured alternate a full-frame fill with a pulled-back rest.
    const s = (!scatter && rnd(0, 1) < 0.5) ? fillScale(f) : partialScale(f);
    const fpR = focusPoint(c, s), fpP = focusPoint(c, s * 1.05);
    const rest = tfPct(fpR.cx, fpR.cy, s), push = tfPct(fpP.cx, fpP.cy, s * 1.05);
    // Length mode: whip + dwell together fill exactly the per-photo budget so the
    // whole set cycles in the target time; otherwise keep the natural random pace.
    const whipS = perPhoto != null ? Math.max(0.16, perPhoto * 0.32) : (fast ? rnd(0.52, 0.72) : rnd(0.95, 1.25));
    const dwellS = perPhoto != null ? Math.max(0.14, perPhoto * 0.68) : (fast ? rnd(1.75, 2.15) : rnd(1.5, 1.9));
    const moveStart = t;
    if (i === 0) {
      xK.push({ time: 0, value: rest.x, easing: 'linear' }); yK.push({ time: 0, value: rest.y, easing: 'linear' });
      sxK.push({ time: 0, value: rest.s, easing: 'linear' }); syK.push({ time: 0, value: rest.s, easing: 'linear' });
    } else {
      const tw = +(t + whipS).toFixed(2);
      xK.push({ time: tw, value: rest.x, easing: 'quadratic-out' }); yK.push({ time: tw, value: rest.y, easing: 'quadratic-out' });
      sxK.push({ time: tw, value: rest.s, easing: 'quadratic-out' }); syK.push({ time: tw, value: rest.s, easing: 'quadratic-out' });
      t = tw;
    }
    const td = +(t + dwellS).toFixed(2);
    xK.push({ time: td, value: push.x }); yK.push({ time: td, value: push.y });
    sxK.push({ time: td, value: push.s }); syK.push({ time: td, value: push.s });
    // leak flows through the whip and lingers into the dwell (mock: leakFlow)
    if (i % leakEvery === 0) leakTimes.push({ start: +moveStart.toFixed(2), dur: +((td - moveStart) * 1.0).toFixed(2), v: Math.floor(rnd(0, 3)), peak: Math.round(rnd(42, 66)), from: +rnd(42, 48).toFixed(1), to: +rnd(52, 58).toFixed(1) });
    t = td;
  });
  const wallDur = t || 6;
  const stackStart = includeCards ? CARD_S : 0;
  const total = (includeCards ? 2 * CARD_S : 0) + wallDur;

  const cellEls = cells.map((c) => {
    const cx = `${((c.x + c.w / 2) / wallWpx * 100).toFixed(3)}%`, cy = `${((c.y + c.h / 2) / wallHpx * 100).toFixed(3)}%`;
    const cw = `${(c.w / wallWpx * 100).toFixed(3)}%`, ch = `${(c.h / wallHpx * 100).toFixed(3)}%`;
    if (scatter) {
      // a tilted white-bordered print: white card + photo inset, with a soft
      // shadow for depth, rotated by the cell's tilt.
      return {
        type: 'composition', x: cx, y: cy, width: cw, height: ch, x_anchor: '50%', y_anchor: '50%',
        z_rotation: `${(c.tilt || 0).toFixed(1)}°`,
        shadow_color: '#000000', shadow_blur: '2.5vmin', shadow_x: '0vmin', shadow_y: '1vmin',
        elements: [
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#FBFAF7' },
          // Card matches the photo's aspect, so a uniform inset + contain shows the
          // WHOLE photo (no crop) with an even print border.
          boxedWithBorder(applyPhotoColor({ type: 'image', source: c.it.url, x: '50%', y: '50%', width: '92%', height: '92%', x_anchor: '50%', y_anchor: '50%', fit: 'contain' }, c.it), c.it, 0.92 * W, 0.92 * H, Math.min(W, H)),
        ],
      };
    }
    return boxedWithBorder(applyPhotoColor({ type: 'image', source: c.it.url, x: cx, y: `${(c.y / wallHpx * 100).toFixed(3)}%`, width: cw, height: ch, x_anchor: '50%', y_anchor: '0%', fit: 'cover' }, c.it), c.it, (parseFloat(cw) / 100) * W, (parseFloat(ch) / 100) * H, Math.min(W, H)); // top-anchored — crops the bottom, keeps heads
  });
  const wallBacking = scatter ? '#141210' : '#F4F1EA';   // dark surface for prints; cream for grid

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg || '#0E0C0A' });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });
  elements.push({
    name: 'Wall', type: 'composition', track: 2, time: stackStart, duration: wallDur,
    x_anchor: '0%', y_anchor: '0%', width: `${(wallWpx / W * 100).toFixed(2)}%`, height: `${(wallHpx / H * 100).toFixed(2)}%`,
    x: xK, y: yK, x_scale: sxK, y_scale: syK,
    elements: [{ type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: wallBacking }, ...cellEls],
  });
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: stackStart, duration: wallDur, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#3A2A12', opacity: S.warmOpacity || '18%', blend_mode: 'multiply' });
  // Flowing warm light-leaks (screen blend) — one per camera move, sweeping and
  // fading, from public/overlays/leakN.png. Needs assetBase (the site URL) so
  // Creatomate can fetch them; skipped if not provided.
  if (assetBase) {
    leakTimes.forEach((L, i) => {
      elements.push({
        name: `Leak-${i + 1}`, type: 'image', track: 9, source: `${assetBase}/overlays/leak${L.v + 1}.png`,
        time: stackStart + L.start, duration: Math.max(0.6, L.dur), fit: 'cover', x_anchor: '50%', y_anchor: '50%',
        y: '50%', width: '128%', height: '128%', blend_mode: 'screen',
        x: [{ time: 0, value: `${L.from}%`, easing: 'linear' }, { time: Math.max(0.6, L.dur), value: `${L.to}%` }],
        opacity: [{ time: 0, value: '0%' }, { time: Math.max(0.6, L.dur) * 0.28, value: `${L.peak}%` }, { time: Math.max(0.6, L.dur) * 0.55, value: `${Math.round(L.peak * 0.7)}%` }, { time: Math.max(0.6, L.dur), value: '0%' }],
      });
    });
  }
  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

// ---- Epic Vintage — faithful port of the APPROVED browser preview -----------
// (epic-preview.html, "v13", the version Josh signed off with "I love it!!!").
// One SHARP hero print rides in over a pile of BIG overlapping FADED same-photo
// prints, dwells, then the WHOLE pile (bg + hero, married) flies off — shrinking,
// spinning, drifting to a corner — while the NEXT pile hard-cuts in on top, and a
// warm light-leak BLOOM ramps up over the outgoing image and hits full-bright on
// the cut. Motion is ONE continuous curve (huge hard-cut in -> fast settle -> slow
// dwell -> accelerate off): no drop-in, no reversal, no stall. NO template text.
// Green bookends via the wrapper.
//
// The preview's exact numbers, translated to Creatomate keyframes:
//   scene scale : 230% -> 104% -> 100% -> 55% -> 30% -> 14%   (monotonic; offsets
//                 0, .175, .488, .722, .878, 1 of D)
//   hero (extra): linear 100% -> 117% + slight spin, riding on top of the scene
//   D (scene life) = BEAT * 1.4  -> consecutive piles OVERLAP by 0.4*BEAT so the
//                 frame is never empty (new pile covers the shrinking old one).
//   bloom       : peaks exactly on each cut, from a FRAME corner, cycling corners.
function epicVintageSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, assetBase, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const circle = roundedRect(50, 50);                    // full ellipse in its box
  const printPath = roundedRect(0.8, 1.1);               // barely-rounded print corners
  const photos = seq.filter((s) => s.type === 'photo');
  const n = photos.length;
  const cardS = includeCards ? CARD_S : 0;
  const stackStart = cardS;

  // BEAT = per-photo cadence; D = how long each pile lives (1.4× the beat → overlap).
  const BEAT = perPhoto != null ? Math.max(1.2, perPhoto) : (S.photoS + 1.6);
  const D = BEAT * 1.4;
  const bodyDur = (n - 1) * BEAT + D;                    // last pile runs its full life
  const total = cardS * 2 + bodyDur;
  const WH = W / H;                                      // frame pixel aspect (≈1.778)

  // Approved scene curve (offsets → scale/rot/translate). x-translate is dir-signed
  // (flies to alternating sides); y-translate is always up.
  // CONTINUOUS FLOW — no plateau anywhere. The old curve held ~100% through the
  // "view" (104→100), which at a slower pace stretched into a visible FREEZE
  // EXACT timing from the approved mockup (epic-preview.html) — "fast then slow
  // then fast": a QUICK hard-cut-in that decelerates (0→0.175), a long SLOW glide
  // to view (0.175→0.488, linear), then ACCELERATE off (0.488→1). Offsets, scales,
  // rotation and drift all copied from the mockup so the speed matches.
  const OFF   = [0, 0.175, 0.488, 0.722, 0.878, 1];
  // GLOBAL 35% BLOW-UP, as asked. SC is the whole scene's scale across the beat:
  // it flies in huge, settles at 100, then shrinks away. Everything in the pile —
  // hero print, faded background prints, bokeh — rides on it, so scaling SC is
  // the honest "global" version of this rather than resizing pieces separately
  // and drifting the composition.
  //   was  [280, 106, 100, 55, 30, 14]
  //   now  x1.35
  const SC     = [280, 106, 100, 55, 30, 14].map((v) => Math.round(v * 1.35));
  const ROT    = [-6, 0, 1, 30, 48, 64];                 // ×dir
  const TX     = [0, 0, 1, 24, 54, 78];                  // ×dir
  const TY     = [0, 0, -1, -12, -24, -34];              // fixed (up)
  const EASE   = ['quadratic-out', 'linear', 'quadratic-in', 'linear', 'linear', 'linear'];

  // Faded BIG background prints (cover the frame, show multiple edges) + 2 small.
  const SPOTS = [
    { l: -79, t: -73, w: 246, r: -8 }, { l: -27, t: -77, w: 252, r: 7 },
    { l: -77, t: -27, w: 252, r: 6 },  { l: -25, t: -29, w: 246, r: -6 },
    { l: 52,  t: -8,  w: 56,  r: 9 },  { l: -6,  t: 51,  w: 58,  r: 8 },
  ];
  // Bloom marches around the FRAME corners (not the image corners).
  const CORNERS = [{ x: 93, y: 9 }, { x: 7, y: 90 }, { x: 91, y: 88 }, { x: 9, y: 12 }];
  const RAMP = 0.82, FADE = 0.56, PK = RAMP / (RAMP + FADE);

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg || '#2a1d12' });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });

  // --- each PILE (one photo) -------------------------------------------------
  photos.forEach((it, i) => {
    const t = stackStart + i * BEAT;
    const dir = i % 2 ? 1 : -1;
    const A = (it.w > 0 && it.h > 0) ? it.w / it.h : 16 / 9;   // photo pixel aspect

    // scene transform keyframes (times = offset × D)
    const sceneScale = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${SC[k]}%`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneX = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${(50 + dir * TX[k]).toFixed(1)}%`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneY = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${(50 + TY[k]).toFixed(1)}%`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneR = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${(dir * ROT[k]).toFixed(1)}°`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneO = [{ time: 0, value: '100%' }, { time: +(0.878 * D).toFixed(3), value: '100%' }, { time: +(1 * D).toFixed(3), value: '0%' }];

    // MOCKUP background = big overlapping FADED WHITE-FRAMED prints of the same
    // photo (you can make out the frames), softly blurred + desaturated, with a
    // SOFT (not hard) drop shadow. All six spots (4 big covering + 2 small edge
    // prints) like epic-preview.html.
    const bgPrints = SPOTS.map((s) => {
      const bpH = s.w * WH / A;                              // native-aspect height (%, of frame)
      const cx = s.l + s.w / 2, cy = s.t + bpH / 2;          // center (CSS rotates about center)
      return {
        type: 'composition', x: `${cx.toFixed(1)}%`, y: `${cy.toFixed(1)}%`,
        width: `${s.w}%`, height: `${bpH.toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%',
        z_rotation: `${s.r}°`, shadow_color: '#0000003A', shadow_blur: '3.4vmin', shadow_x: '0vmin', shadow_y: '0.6vmin',
        elements: [
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#EDE6D6' },
          // faded print: desaturated + softly blurred (the mockup's grayscale .76 /
          // brightness .82 / blur look). Thin even white mat around it.
          // BACKGROUND-PRINT MAT, a quarter thinner — and only this one. The
          // cream border is the backing shape showing around the photo, so its
          // thickness per side is (100 - width) / 2: 1.3% at 97.4%. A quarter
          // off that is 0.975%, i.e. 98.05%. The hero's own mat is set
          // separately below and is deliberately left alone.
          { type: 'image', source: it.url, x: '50%', y: '50%', width: '98.05%', height: '98.05%', x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'grayscale', color_filter_value: '66%', blur_radius: 14.4, blur_mode: 'stack' },
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#241708', blend_mode: 'multiply', opacity: '20%' },
        ],
      };
    });

    // sharp HERO print — fit inside a 62%h × 66%w box at native aspect (big, like
    // the approved preview where the hero fills most of the frame).
    let printH = 62, printW = 62 * A * (H / W);
    if (printW > 66) { printW = 66; printH = 66 * (W / H) / A; }
    const heroWrap = {
      type: 'composition', width: `${printW.toFixed(1)}%`, height: `${printH.toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%', x: '50%', y: '50%',
      // Mockup hero: rides on the scene, growing 100→117 with a slight spin over
      // the whole beat so the slow "view" still breathes (matches epic-preview).
      // The hero's own push had to come down with the blow-up, or the photograph
      // would be cropped by the frame at the end of its move — and nothing in
      // this engine may cut off a photo. Arithmetic: the hero box is at most 66%
      // of frame width, so its peak on-screen width is 66 x push x scene.
      //   before   66 x 1.17 x 1.00 = 77% of the frame
      //   at 1.35  66 x 1.17 x 1.35 = 104%  — over, the sides would be cut
      //   now      66 x 1.10 x 1.35 =  98%  — fits, and 27% bigger than before
      x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: D, value: '110%' }],
      y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: D, value: '110%' }],
      z_rotation: [{ time: 0, value: '0°', easing: 'linear' }, { time: D, value: `${(dir * 5).toFixed(1)}°` }],
      // NO SHADOW ON THE WRAPPER. Josh: "Thee are some weird shadows under the
      // sides of teh Hero." The shadow was set on this COMPOSITION, so it was
      // cast by the composition's rectangular BOX — while the print itself is
      // drawn with printPath, a rounded rect inset within that box. The corners
      // and sides of a shadow that belongs to a slightly different shape then
      // show past the print, which is exactly the "weird shadow at the sides".
      // The composition also rotates and scales, and a box shadow does not
      // follow a rounded silhouette through that.
      //
      // The shadow now belongs to the print SHAPE, so it is cast by the same
      // outline the eye sees.
      elements: [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: printPath, fill_color: '#F1E8D6',
          shadow_color: '#140800', shadow_blur: '3.4vmin', shadow_x: '0vmin', shadow_y: '1.4vmin' },
        // HERO MAT UNCHANGED at 99%, i.e. 0.5% of cream per side. Josh, on the
        // border change: "is it possible to only chnage the boarders on the
        // background images and leave the hero boarder as is?" Yes — they are
        // separate numbers; only the faded background prints move.
        boxedWithBorder(applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '50%', width: '99%', height: '99%', x_anchor: '50%', y_anchor: '50%', fit: 'contain' }, it), it, 0.99 * W, 0.99 * H, Math.min(W, H)),
      ],
    };

    elements.push({
      name: `Epic-${i + 1}`, type: 'composition', track: 3 + i, time: t, duration: D,
      width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      x: sceneX, y: sceneY, z_rotation: sceneR, x_scale: sceneScale, y_scale: sceneScale, opacity: sceneO,
      elements: [
        // bokeh base — blurred same-photo fill so black NEVER shows through (kept
        // light so it doesn't flatten the faded print pile that sits on top)
        { type: 'image', source: it.url, x: '50%', y: '50%', width: '128%', height: '128%', x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'sepia', color_filter_value: '70%', blur_radius: 38.4, blur_mode: 'stack', opacity: '100%' },
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#221606', blend_mode: 'multiply', opacity: '16%' },
        ...bgPrints,
        heroWrap,
      ],
    });
  });

  // --- persistent grade (warm multiply + faint cream lift) --------------------
  // (Removed the drifting amber circle "glows" — they read as floaty orbs.)

  // EFFECT TRACKS MUST SIT ABOVE EVERY PHOTO. Josh, on a Vintage render: "at
  // 00:01:12:25 the entire pic drops out leaving only the light and dust. That
  // happens over and over between images from that point forward." Measured on
  // that file: the picture vanishes for 0.80s at 72.80s, then again at 77.40,
  // 82.00 and 86.60 - every 4.6s, one per photo, from one point on.
  //
  // Cause: each photo takes its OWN track, `3 + i`, climbing one per photo,
  // while the grade and the leaks sat on FIXED tracks 8, 9, 18, 19, 20 and 21.
  // Past five photos the climbing photo track walks straight into them. A
  // Creatomate track is a lane - two elements sharing one and overlapping in
  // time is not a valid timeline, and Creatomate resolves it by DROPPING one.
  // The one it dropped was the photograph, leaving the leak and the dust
  // playing over an empty background.
  //
  // verify.mjs has reported these exact overlaps for weeks and I have been
  // calling them pre-existing and leaving them alone in every commit message
  // since. They were not cosmetic; this is the bug Josh just found by eye.
  //
  // Second thing this fixes, which nobody had connected: track order is DRAW
  // order. Warm on track 8 sat above photos 1-5 and BELOW every photo after
  // that, so the grade only ever landed on the first five. That is a plausible
  // cause of Epic never matching the browser preview it was signed off from.
  const fxBase = 3 + photos.length + 1;

  elements.push({ name: 'Warm', type: 'shape', track: fxBase, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#C9865A', opacity: S.warmOpacity || '20%', blend_mode: 'multiply' });
  elements.push({ name: 'Lift', type: 'shape', track: fxBase, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: '#F3D9B4', opacity: '3%', blend_mode: 'screen' });

  // floating dust (existing overlay assets), screen, slow parallax drift
  if (assetBase) {
    [['dust1.png', 46, 48, 52], ['dust2.png', 36, 52, 47]].forEach(([d, op, x0, y0], k) => {
      elements.push({
        name: `Dust-${k + 1}`, type: 'image', track: fxBase + 1, source: `${assetBase}/overlays/${d}`,
        time: stackStart, duration: bodyDur, fit: 'cover', blend_mode: 'screen',
        x_anchor: '50%', y_anchor: '50%', width: '120%', height: '120%', opacity: `${op}%`,
        x: [{ time: 0, value: `${x0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - x0}%` }],
        y: [{ time: 0, value: `${y0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - y0}%` }],
      });
    });
  }

  // --- BIG BRIGHT light leak on every cut (Josh: "bring the light to a higher
  // level"). A warm RADIAL BURST (cream→amber→orange→transparent, the mockup's
  // .bloom) blows in from a FRAME CORNER at full-bright on the hard cut, plus a
  // sweeping edge-bleed, a hot streak, and a gentle full-frame warm lift. Cycles
  // corners. Bright and impressive, but radial so the hero stays visible (not a
  // flat white-out).
  for (let k = 1; k < n; k++) {
    const tc = stackStart + k * BEAT;                        // the hard cut into pile k
    const t0 = Math.max(0, tc - RAMP);
    const dur = RAMP + FADE;
    const c = CORNERS[(k - 1) % CORNERS.length];
    const d2 = k % 2 ? 1 : -1;
    const ramp = (peak) => [{ time: 0, value: '0%' }, { time: +(PK * dur).toFixed(3), value: `${peak}%`, easing: 'ease-in' }, { time: dur, value: '0%' }];
    // gentle full-frame warm lift (whole frame warms a touch — not a white flash)
    elements.push({ name: `Leak-lift-${k}`, type: 'shape', track: fxBase + 2, time: t0, duration: dur, path: rect, width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', fill_color: '#FFE0A8', blend_mode: 'screen', blur_radius: 8, blur_mode: 'stack', opacity: ramp(22) });
    if (assetBase) {
      // BRIGHT warm radial burst emanating from the corner (kept square so the
      // radial stays circular: 178% of height ≈ 100% of width in px)
      elements.push({
        name: `Leak-burst-${k}`, type: 'image', track: fxBase + 4, source: `${assetBase}/overlays/leak_burst.png`,
        time: t0, duration: dur, blend_mode: 'screen', x: `${c.x}%`, y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%',
        width: '100%', height: '178%', fit: 'cover', opacity: ramp(100),
      });
      // sweeping directional edge-bleed underneath, for organic streaking
      const EP = ['leak_epic1.png', 'leak_epic2.png', 'leak_epic3.png'];
      elements.push({
        name: `Leak-edge-${k}`, type: 'image', track: fxBase + 3, source: `${assetBase}/overlays/${EP[(k - 1) % EP.length]}`,
        time: t0, duration: dur, fit: 'cover', blend_mode: 'screen', x_anchor: '50%', y_anchor: '50%', y: '50%', width: '150%', height: '150%',
        x: [{ time: 0, value: `${(50 + d2 * 12).toFixed(1)}%`, easing: 'linear' }, { time: dur, value: `${(50 - d2 * 6).toFixed(1)}%` }],
        opacity: ramp(78),
      });
    }
    // hot light streak across the corner's row
    elements.push({ name: `Leak-streak-${k}`, type: 'shape', track: fxBase + 5, time: t0, duration: dur, path: rect, width: '150%', height: '2.4%', x: '50%', y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%', fill_color: '#FFF3D6', blend_mode: 'screen', blur_radius: 7, blur_mode: 'stack', opacity: ramp(90) });
  }

  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}


// ---- Trendy Photo Wall — a 3D-perspective grid of white-matted prints --------
// A grid of matte prints on a cream wall, viewed at an oblique 3D angle
// (Creatomate `perspective` + `x_rotation`/`y_rotation` — confirmed properties),
// with the camera drifting slowly across while the wall rotates gently toward
// the lens, so prints recede with real foreshortening. Soft warm grade + light
// leaks. NO template text. Green bookends via the wrapper. NOTE: this is the
// engine's first use of Creatomate 3D — the first render validates the look.
function trendyWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, assetBase, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((s) => s.type === 'photo');
  const cardS = includeCards ? CARD_S : 0;
  // Length mode: the drift lasts exactly the per-photo budget × photo count;
  // default keeps the gentle count-scaled drift.
  const BODY = perPhoto != null ? Math.max(4, perPhoto * photos.length) : Math.min(22, Math.max(11, 9 + photos.length * 0.5));  // slow drift, scales gently with count
  const total = cardS * 2 + BODY;

  // NATIVE SHAPE: justified rows (uniform row height, native-aspect widths) in
  // chronological order, so the 3D drift reveals the photos 1..N in order and each
  // keeps its true proportions (portrait = tall cell, landscape = wide).
  const aspOf = (it) => { const a = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 16 / 9; return Math.max(0.42, Math.min(3.2, a)); };
  const ROWH = 270, TARGETW = 2400, gap = 30, pad = 90;
  const rows = []; let cur = [], sumA = 0;
  photos.forEach((it) => {
    const a = aspOf(it); cur.push({ it, a }); sumA += a;
    if (sumA * ROWH + gap * (cur.length - 1) >= TARGETW) { rows.push(cur); cur = []; sumA = 0; }
  });
  if (cur.length) rows.push(cur);
  const laid = []; let wy = pad;
  rows.forEach((row, ri) => {
    const aSum = row.reduce((s, c) => s + c.a, 0);
    let h = (TARGETW - gap * (row.length - 1)) / aSum;
    const isLast = ri === rows.length - 1;
    if (isLast && (row.length <= 1 || h > ROWH * 1.5)) h = ROWH;
    h = Math.max(ROWH * 0.7, Math.min(h, ROWH * 1.6));
    let x = pad;
    row.forEach((c) => { const w = h * c.a; laid.push({ x, y: wy, w, h, it: c.it }); x += w + gap; });
    wy += h + gap;
  });
  const wallWpx = TARGETW + pad * 2;
  const wallHpx = (wy - gap) + pad;

  const cellEls = laid.map((cell) => ({
    type: 'composition',
    x: `${((cell.x + cell.w / 2) / wallWpx * 100).toFixed(3)}%`, y: `${((cell.y + cell.h / 2) / wallHpx * 100).toFixed(3)}%`,
    width: `${(cell.w / wallWpx * 100).toFixed(3)}%`, height: `${(cell.h / wallHpx * 100).toFixed(3)}%`,
    x_anchor: '50%', y_anchor: '50%',
    shadow_color: '#0000004D', shadow_blur: '1.6vmin', shadow_x: '0vmin', shadow_y: '0.5vmin',
    elements: [
      { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#F8F4EB' },
      // native-aspect card → contain shows the whole photo (no crop), even border.
      boxedWithBorder(applyPhotoColor({ type: 'image', source: cell.it.url, x: '50%', y: '50%', width: '92%', height: '92%', x_anchor: '50%', y_anchor: '50%', fit: 'contain' }, cell.it), cell.it, 0.92 * W, 0.92 * H, Math.min(W, H)),
    ],
  }));

  // The wall composition, rendered in 3D. Camera drift = animate the wall's
  // in-frame position + a gentle rotation/scale so it feels like moving across
  // an angled wall (perspective gives the foreshortening).
  const BASE = 1.34;                                   // wall ~1.34× frame width
  const wallWpct = (wallWpx / W * 100) * BASE;
  const wallHpct = (wallHpx / H * 100) * BASE;
  const wallEl = {
    name: 'Wall', type: 'composition', time: cardS, duration: BODY,
    width: `${wallWpct.toFixed(2)}%`, height: `${wallHpct.toFixed(2)}%`,
    x_anchor: '50%', y_anchor: '50%',
    perspective: 1500, backface_visible: false,
    // oblique angle that eases toward the lens over the drift
    x_rotation: [{ time: 0, value: '-11°', easing: 'linear' }, { time: BODY, value: '-4°' }],
    y_rotation: [{ time: 0, value: '-22°', easing: 'linear' }, { time: BODY, value: '-7°' }],
    z_rotation: [{ time: 0, value: '2°', easing: 'linear' }, { time: BODY, value: '-1°' }],
    // Camera travels from the wall's TOP-LEFT (photo 1) to its BOTTOM-RIGHT (last
    // photo) so the wall reveals the client's images in order as it drifts.
    x: [{ time: 0, value: '66%', easing: 'linear' }, { time: BODY, value: '40%' }],
    y: [{ time: 0, value: '64%', easing: 'linear' }, { time: BODY, value: '40%' }],
    scale: [{ time: 0, value: '112%', easing: 'linear' }, { time: BODY, value: '126%' }],
    elements: [
      { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: S.wall || '#EFE9DC' },
      ...cellEls,
    ],
  };

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg || '#ECE5D6' });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });
  elements.push({ ...wallEl, track: 3 });
  // soft warm grade + dreamy haze
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: cardS, duration: BODY, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#C9A46A', opacity: S.warmOpacity || '10%', blend_mode: 'multiply' });
  elements.push({ name: 'Haze', type: 'shape', track: 8, time: cardS, duration: BODY, path: rect, width: '100%', height: '100%', fill_color: '#FBF3E4', opacity: '10%', blend_mode: 'screen' });
  // gentle drifting light leaks (screen) across the drift
  if (assetBase) {
    const LK = ['leak1.png', 'leak3.png', 'leak2.png'];
    const nLeaks = 3;
    for (let i = 0; i < nLeaks; i++) {
      const t0 = cardS + (i + 0.3) * (BODY / (nLeaks + 0.6));
      const dur = BODY / (nLeaks + 0.6) * 1.4;
      const from = i % 2 ? 60 : 35, to = i % 2 ? 35 : 60;
      elements.push({
        name: `Leak-${i + 1}`, type: 'image', track: 9, source: `${assetBase}/overlays/${LK[i % LK.length]}`,
        time: t0, duration: dur, fit: 'cover', blend_mode: 'screen', x_anchor: '50%', y_anchor: '50%', y: '50%', width: '150%', height: '150%',
        x: [{ time: 0, value: `${from}%`, easing: 'linear' }, { time: dur, value: `${to}%` }],
        opacity: [{ time: 0, value: '0%' }, { time: dur * 0.4, value: '58%' }, { time: dur * 0.7, value: '40%' }, { time: dur, value: '0%' }],
      });
    }
  }
  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

// LENGTH MODE exact-fit: after a style builds (each paces to ~the target already
// via perPhoto), scale every time/duration/keyframe-time so the whole montage
// lands exactly on totalSeconds. This absorbs each style's own overhead
// (transition overlap, whip/dwell, stacking) that a simple per-photo estimate
// can't predict. Static values (percent strings) and 'start'/'end' transition
// markers are left alone; only numeric times scale.
// ---- Story Builder — continuous story wall (faithful port of the locked preview
// story-builder-APPROVED.html). Each photo LANDS center (~60%, a cut point), then
// the row RE-FANS (all its cards shrink to a centered, aspect-aware fan that fills
// the frame width — verticals hang over a landscape's right edge). When a row
// fills, it's pushed to ONE side (alternating up/down); only that side shifts and
// its outer rows shrink, so nothing ever leaves the frame. Keyable GREEN-SCREEN
// default background (+ optional Add-background image/tint). The choreography is a
// deterministic simulation of the preview's JS, recorded to keyframes.
function storyBuilderSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const cardPath = roundedRect(2.2, 2.2);
  const photos = seq.filter((s) => s.type !== 'placeholder');
  const n = photos.length;
  const cardS = includeCards ? CARD_S : 0;
  const stackStart = cardS;

  // Preview constants (ms → s). A slower pace stretches the per-photo beat.
  const paceK = perPhoto != null ? Math.max(0.5, perPhoto) / 2.59 : 1; // preview beat ≈ 2.59s
  const LAND = 1.25 * paceK, MOVE = 0.78 * paceK, HOLD = 0.56 * paceK, ROWGAP = 1.0 * paceK, RELAY = 0.95 * paceK;
  const tiltStep = 3.0, TARGET = 0.86, MAXPR = 14, SHR = 0.86;
  const sw = W, sh = H;
  const aspOf = (it) => (it.w > 0 && it.h > 0) ? it.w / it.h : 1.5;
  const isVert = (it) => aspOf(it) < 0.85;
  const landWpx = (it) => Math.min(0.672 * sh * aspOf(it), 0.72 * sw);
  const halfW = (it) => landWpx(it) * 0.25;

  // per-card record: waypoints of {t, dx, dy, sc, tl}
  const cards = photos.map((it) => ({ it, wp: [], dx: 0, dy: 0, sc: 1, tl: 0, dx0: 0, landStart: 0 }));
  const push = (c, t, dx, dy, sc, tl) => c.wp.push({ t, dx, dy, sc, tl });
  let current = [], up = [], down = [], toggle = false;

  function layoutCurrent(atT) {
    const k = current.length;
    const hw = current.map((c) => halfW(c.it));
    const cx = [0];
    for (let j = 1; j < k; j++) {
      const pv = isVert(current[j - 1].it), cv = isVert(current[j].it);
      let step;
      if (pv) step = hw[j] + 0.32 * hw[j - 1];
      else if (cv) step = hw[j - 1] + 0.25 * hw[j];
      else step = hw[j];
      cx.push(cx[j - 1] + Math.max(step, 0.42 * hw[j]));
    }
    const left = cx[0] - hw[0], right = cx[k - 1] + hw[k - 1], mid = (left + right) / 2, span = right - left;
    current.forEach((c, j) => {
      const dx = cx[j] - mid, tl = (j - (k - 1) / 2) * tiltStep;
      push(c, atT, c.dx, c.dy, c.sc, c.tl);          // hold at current state until the move starts
      push(c, atT + MOVE, dx, 0, 0.5, tl);           // move into the centered fan
      c.dx = dx; c.dy = 0; c.sc = 0.5; c.tl = tl;
    });
    return span / sw;
  }
  // BOUNDED 3-row collage (the shorter version, not the infinite scroll): a
  // completed row moves to a fixed slot — 1st → TOP, 2nd → BOTTOM, 3rd → stays
  // MIDDLE. Once 3 rows fill the frame it's a finished collage; if more photos
  // remain it holds, fades out, and a fresh 3-row page builds.
  const SLOTS = [
    { dy: -0.31 * sh, sc: 0.42 },   // 1st completed row → TOP (shrinks a touch)
    { dy: 0.31 * sh, sc: 0.42 },    // 2nd → BOTTOM
    { dy: 0, sc: 0.50 },            // 3rd → stays centred (the focal middle row)
  ];
  const PAGEHOLD = 1.2, FADE = 0.6;
  function moveRowTo(rc, atT, slot) {
    const f = slot.sc / 0.5;
    rc.forEach((c) => {
      const ndx = c.dx * f;
      push(c, atT, c.dx, c.dy, c.sc, c.tl);
      push(c, atT + RELAY, ndx, slot.dy, slot.sc, c.tl);
      c.dx = ndx; c.dy = slot.dy; c.sc = slot.sc;
    });
  }

  // ---- run the choreography, recording every waypoint ----
  let t = stackStart, idx = 0, pageRows = 0, pageCards = [];
  while (idx < n) {
    const c = cards[idx];
    c.landStart = t;
    push(c, t, 0, 0, 0.92, 0);                        // land: small→full at center
    push(c, t + 0.34 * LAND, 0, 0, 1, 0);
    current.push(c);
    const afterLandT = t + LAND;
    const frac = layoutCurrent(afterLandT);
    const decideT = afterLandT + MOVE + HOLD;
    const rowFull = frac >= TARGET || current.length >= MAXPR;
    const lastPhoto = idx === n - 1;
    if (rowFull || lastPhoto) {
      moveRowTo(current, decideT, SLOTS[Math.min(pageRows, 2)]);
      pageCards.push(...current);
      current = [];
      pageRows += 1;
      t = decideT + RELAY + ROWGAP;
      if (pageRows === 3 && !lastPhoto) {
        // finished 3-row collage — hold to view, fade out, then a fresh page
        const holdEnd = t + PAGEHOLD;
        pageCards.forEach((pc) => { pc.fadeOut = holdEnd; });
        pageCards = []; pageRows = 0;
        t = holdEnd + FADE + 0.2;
      }
    } else {
      t = decideT;
    }
    idx += 1;
  }
  const bodyEnd = cards.reduce((m, c) => Math.max(m, c.wp.length ? c.wp[c.wp.length - 1].t : 0), stackStart) + 0.6;
  const total = bodyEnd + cardS; // trailing card, if any

  const elements = [];
  // Keyable green-screen background by default; an imported image (tint/opacity)
  // replaces it. Story default = green so Josh can key it.
  const bg = (background && (background.url || background.videoUrl || background.green)) ? background : { green: true };
  bgLayers(bg, S, { track: 1, time: 0, duration: total }).forEach((el) => elements.push(el));
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });

  // one composition per card, keyframed through its recorded trajectory
  cards.forEach((c, i) => {
    const it = c.it;
    const lw = landWpx(it);
    const cardWpct = lw / sw * 100;
    const cardHpct = (lw / aspOf(it)) / sh * 100;
    const rel = (v) => +(v - c.landStart).toFixed(3);
    const xk = c.wp.map((w) => ({ time: rel(w.t), value: `${(50 + w.dx / sw * 100).toFixed(2)}%`, easing: 'quadratic-out' }));
    const yk = c.wp.map((w) => ({ time: rel(w.t), value: `${(50 + w.dy / sh * 100).toFixed(2)}%`, easing: 'quadratic-out' }));
    const sk = c.wp.map((w) => ({ time: rel(w.t), value: `${(w.sc * 100).toFixed(2)}%`, easing: 'quadratic-out' }));
    const rk = c.wp.map((w) => ({ time: rel(w.t), value: `${w.tl.toFixed(2)}°`, easing: 'quadratic-out' }));
    const op = [{ time: 0, value: '0%' }, { time: +(0.34 * LAND).toFixed(3), value: '100%' }];
    if (c.fadeOut != null) { op.push({ time: rel(c.fadeOut), value: '100%' }); op.push({ time: rel(c.fadeOut + FADE), value: '0%' }); }
    elements.push({
      name: `Story-${i + 1}`, type: 'composition', track: 10 + i, time: c.landStart, duration: +(total - c.landStart).toFixed(3),
      width: `${cardWpct.toFixed(2)}%`, height: `${cardHpct.toFixed(2)}%`, x_anchor: '50%', y_anchor: '50%',
      x: xk, y: yk, x_scale: sk, y_scale: sk, z_rotation: rk,
      opacity: op,
      shadow_color: '#00000066', shadow_blur: '2vmin', shadow_x: '0vmin', shadow_y: '0.8vmin',
      elements: [
        // NO white framing (Josh): the photo IS the card, edge-to-edge at its
        // native aspect. The card composition is already sized to the photo's real
        // aspect (from the probed w/h), so 'cover' fills it with no crop and no
        // letterbox — 9:16 verticals stay tall, landscapes stay wide.
        boxedWithBorder(applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' }, it), it, (cardWpct / 100) * W, (cardHpct / 100) * H, Math.min(W, H)),
      ],
    });
  });

  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 3, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

// Every property that can carry a keyframe array. scaleMontageToLength walks
// these to rescale keyframe TIMES when the montage is snapped to a total
// length; a keyframed property missing from this list keeps its original
// times while its element's duration changes, so the animation overruns or
// finishes early. (Neon Frame's travelling light did exactly that until the
// stroke_* entries were added — its lap ran 6.06s inside a 5.34s element.)
const KEYFRAME_PROPS = ['x', 'y', 'x_scale', 'y_scale', 'scale', 'opacity', 'z_rotation', 'x_rotation', 'y_rotation', 'width', 'height', 'blur_radius',
  'stroke_start', 'stroke_end', 'stroke_offset', 'stroke_width', 'border_radius',
  'fill_x0', 'fill_y0', 'fill_x1', 'fill_y1', 'fill_radius', 'x_skew', 'y_skew', 'perspective', 'color_filter_value'];
function scaleMontageToLength(src, target) {
  if (!src || !Array.isArray(src.elements) || !(target > 0)) return src;
  const cur = src.elements.reduce((m, e) => Math.max(m, (e.time || 0) + (e.duration || 0)), 0);
  if (!(cur > 0)) return src;
  const f = target / cur;
  const scaleEl = (el) => {
    if (!el || typeof el !== 'object') return;
    if (typeof el.time === 'number') el.time = +(el.time * f).toFixed(3);
    if (typeof el.duration === 'number') el.duration = +(el.duration * f).toFixed(3);
    for (const k of KEYFRAME_PROPS) {
      if (Array.isArray(el[k])) el[k].forEach((kf) => { if (kf && typeof kf.time === 'number') kf.time = +(kf.time * f).toFixed(3); });
    }
    if (Array.isArray(el.animations)) el.animations.forEach((a) => {
      if (a && typeof a.duration === 'number') a.duration = +(a.duration * f).toFixed(3);
      if (a && typeof a.time === 'number') a.time = +(a.time * f).toFixed(3);
    });
    if (Array.isArray(el.elements)) el.elements.forEach(scaleEl);
  };
  src.elements.forEach(scaleEl);
  return src;
}

// ============================================================================
// MULTI PAGE / MULTI PAGE RECORD
// Green-screen collage. Photos are grouped 4,3,4,3… per page; each page picks
// one of four layouts by the orientation of its photos (aspect-adaptive) and
// cover-crops each photo into its cell. Two motion variants (S.perImage):
//   • Multi Page (perImage:true):  each photo pivots ON around its own
//     bottom-left corner, one at a time (staggered). Whole page fades out.
//   • Multi Page Record (false):   photos reveal in place (scale+fade, one at a
//     time); then the WHOLE page pivots OFF around the frame's bottom-left hub
//     before the next page reveals. Only one page's photos are on screen at once.
// The green background is static (keys clean); only the photos move.
// ============================================================================
function mpTemplate(g) {
  const n = g.length;
  const nP = g.filter((x) => x.ar === 'p').length, nL = g.filter((x) => x.ar === 'l').length;
  const portrait = nP >= nL;
  if (n >= 4) return portrait
    ? { n: 4, cols: [1.35, 1], rows: [1, 1, 1], areas: [['a', 'b'], ['a', 'c'], ['a', 'd']] }   // Feature Left
    : { n: 4, cols: [1.5, 1], rows: [1, 1.5], areas: [['a', 'b'], ['c', 'd']] };                 // Uneven Quad
  if (n === 3) return portrait
    ? { n: 3, cols: [1, 1.9, 1], rows: [1], areas: [['a', 'b', 'c']] }                           // Triptych Hero
    : { n: 3, cols: [1, 1], rows: [1.5, 1], areas: [['a', 'a'], ['b', 'c']] };                   // Banner Pair
  if (n === 2) return { n: 2, cols: [1, 1], rows: [1], areas: [['a', 'b']] };
  return { n: 1, cols: [1], rows: [1], areas: [['a']] };
}
// Solve a fractional grid into cell rects (% of frame; x,y = top-left corner).
function mpCells(tpl, padX, padY, gapX, gapY) {
  const { cols, rows } = tpl;
  const cW = 100 - 2 * padX - (cols.length - 1) * gapX;
  const cH = 100 - 2 * padY - (rows.length - 1) * gapY;
  const cSum = cols.reduce((a, b) => a + b, 0), rSum = rows.reduce((a, b) => a + b, 0);
  const colW = cols.map((f) => cW * f / cSum), rowH = rows.map((f) => cH * f / rSum);
  const colX = []; { let x = padX; for (let i = 0; i < cols.length; i++) { colX.push(x); x += colW[i] + gapX; } }
  const rowY = []; { let y = padY; for (let i = 0; i < rows.length; i++) { rowY.push(y); y += rowH[i] + gapY; } }
  const span = {};
  tpl.areas.forEach((rowArr, r) => rowArr.forEach((k, c) => {
    const s = span[k] || (span[k] = { c0: c, c1: c, r0: r, r1: r });
    s.c0 = Math.min(s.c0, c); s.c1 = Math.max(s.c1, c); s.r0 = Math.min(s.r0, r); s.r1 = Math.max(s.r1, r);
  }));
  const out = {};
  for (const k in span) {
    const s = span[k];
    const x = colX[s.c0], y = rowY[s.r0];
    const w = colW.slice(s.c0, s.c1 + 1).reduce((a, b) => a + b, 0) + (s.c1 - s.c0) * gapX;
    const h = rowH.slice(s.r0, s.r1 + 1).reduce((a, b) => a + b, 0) + (s.r1 - s.r0) * gapY;
    out[k] = { x, y, w, h };
  }
  return out;
}
// Which page + cell (and the cell's real shape) each item lands in for the
// Multi-Page models — the SAME grouping (4,3,4,3), template pick and cell rects
// multiPageSource uses. Returns one entry per non-placeholder item IN PLAY ORDER
// (green bookends included, so cell offsets match the render exactly). Powers the
// admin framing adjuster so its preview boxes mirror the actual montage cells.
export function multiPageLayout({ items, width = 1920, height = 1080, twoPanel = false } = {}) {
  const AREA = ['a', 'b', 'c', 'd'];
  const photos = (items || []).filter((it) => it && it.type !== 'placeholder' && it.url);
  const withAr = photos.map((p) => {
    const A = (p.w > 0 && p.h > 0) ? p.w / p.h : 1;
    return { ar: A < 0.9 ? 'p' : A > 1.2 ? 'l' : 's' };
  });
  const pagesArr = []; const sizes = twoPanel ? [2] : [4, 3, 4, 3]; let gi = 0, si = 0;
  while (gi < withAr.length) { const w = sizes[si % sizes.length]; const g = withAr.slice(gi, gi + w); pagesArr.push({ g, start: gi }); gi += g.length; si++; }
  const padX = 2.8, padY = padX * (width / height);
  const gapX = 1.4, gapY = gapX * (width / height);
  const out = new Array(photos.length);
  pagesArr.forEach((pg, pi) => {
    const tpl = mpTemplate(pg.g);
    const cells = mpCells(tpl, padX, padY, gapX, gapY);
    const keys = AREA.slice(0, tpl.n);
    pg.g.forEach((_, idx) => {
      const c = cells[keys[idx]] || { w: 100, h: 100 };
      const cellWpx = (c.w / 100) * width, cellHpx = (c.h / 100) * height;
      out[pg.start + idx] = { page: pi + 1, cell: idx + 1, cells: pg.g.length, cellW: c.w, cellH: c.h, cellAspect: cellHpx > 0 ? cellWpx / cellHpx : 1.6 };
    });
  });
  return out;
}

// The motions Creatomate can do faithfully (2D only — no true 3D flip).
const MP_MOTIONS = ['record-fwd', 'record-back', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'dissolve'];
function mpPickMotion(transition, i) {
  if (transition === 'random') return MP_MOTIONS[(i * 2654435761 >>> 0) % MP_MOTIONS.length]; // deterministic per page
  return MP_MOTIONS.includes(transition) ? transition : 'record-fwd';
}
// Per-IMAGE entrance (Multi Page): the cell starts off-pose and animates to rest,
// staggered. Returns the composition wrapping the photo.
// `inner` may be a single element or a list (the photo plus its border frame),
// since the clipping cell built here is exactly the photo's visible rect.
function mpPhotoEnter(motion, c, st, MOVE, FADE, inner) {
  const op = [{ time: 0, value: '0%' }, { time: st, value: '0%' }, { time: st + FADE * 0.7, value: '100%' }];
  const base = { type: 'composition', clip: true, width: `${c.w.toFixed(2)}%`, height: `${c.h.toFixed(2)}%`, opacity: op, elements: Array.isArray(inner) ? inner : [inner] };
  if (motion === 'dissolve') // just fade in at rest — no movement
    return { ...base, x: `${(c.x + c.w / 2).toFixed(2)}%`, y: `${(c.y + c.h / 2).toFixed(2)}%`, x_anchor: '50%', y_anchor: '50%' };
  if (motion === 'record-fwd')
    return { ...base, x: `${c.x.toFixed(2)}%`, y: `${(c.y + c.h).toFixed(2)}%`, x_anchor: '0%', y_anchor: '100%',
      z_rotation: [{ time: 0, value: '-88°' }, { time: st, value: '-88°', easing: 'quadratic-out' }, { time: st + MOVE, value: '0°' }] };
  if (motion === 'record-back')
    return { ...base, x: `${(c.x + c.w).toFixed(2)}%`, y: `${(c.y + c.h).toFixed(2)}%`, x_anchor: '100%', y_anchor: '100%',
      z_rotation: [{ time: 0, value: '88°' }, { time: st, value: '88°', easing: 'quadratic-out' }, { time: st + MOVE, value: '0°' }] };
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const ax = (motion === 'slide-left' || motion === 'slide-right') ? 'x' : 'y';
  const rest = ax === 'x' ? cx : cy;
  const from = motion === 'slide-left' ? cx + 75 : motion === 'slide-right' ? cx - 75 : motion === 'slide-up' ? cy + 75 : cy - 75;
  const el = { ...base, x: `${cx.toFixed(2)}%`, y: `${cy.toFixed(2)}%`, x_anchor: '50%', y_anchor: '50%' };
  el[ax] = [{ time: 0, value: `${from.toFixed(2)}%` }, { time: st, value: `${from.toFixed(2)}%`, easing: 'quadratic-out' }, { time: st + MOVE, value: `${rest.toFixed(2)}%` }];
  return el;
}
// Page-level EXIT (Multi Page Record): the whole page leaves via the motion.
function mpApplyExit(pageComp, motion, exit, pageDur) {
  pageComp.opacity = [{ time: 0, value: '100%' }, { time: pageDur - 0.08, value: '100%' }, { time: pageDur, value: '0%' }];
  if (motion === 'record-fwd') { pageComp.x = '0%'; pageComp.y = '100%'; pageComp.x_anchor = '0%'; pageComp.y_anchor = '100%';
    pageComp.z_rotation = [{ time: 0, value: '0°' }, { time: exit, value: '0°', easing: 'quadratic-in' }, { time: pageDur, value: '92°' }]; return; }
  if (motion === 'record-back') { pageComp.x = '100%'; pageComp.y = '100%'; pageComp.x_anchor = '100%'; pageComp.y_anchor = '100%';
    pageComp.z_rotation = [{ time: 0, value: '0°' }, { time: exit, value: '0°', easing: 'quadratic-in' }, { time: pageDur, value: '-92°' }]; return; }
  pageComp.x = '50%'; pageComp.y = '50%'; pageComp.x_anchor = '50%'; pageComp.y_anchor = '50%';
  const ax = (motion === 'slide-left' || motion === 'slide-right') ? 'x' : 'y';
  const to = motion === 'slide-left' ? '-62%' : motion === 'slide-right' ? '162%' : motion === 'slide-up' ? '-62%' : '162%';
  pageComp[ax] = [{ time: 0, value: '50%' }, { time: exit, value: '50%', easing: 'quadratic-in' }, { time: pageDur, value: to }];
}
function multiPageSource({ S, seq, watermarkUrl, width, height, mp = {} }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const AREA = ['a', 'b', 'c', 'd'];
  const per = !!S.perImage;
  const transition = mp.transition || 'record-fwd';
  const photos = seq.filter((it) => it.type !== 'placeholder' && it.url);
  photos.forEach((p) => { const A = (p.w > 0 && p.h > 0) ? p.w / p.h : 1; p.ar = A < 0.9 ? 'p' : A > 1.2 ? 'l' : 's'; });

  // Head-safe cell fill: display the photo at (a touch over) the cell WIDTH,
  // aspect-preserved, and TOP-anchor it inside the clipping cell so any crop
  // falls off the BOTTOM (feet) — never the top (heads). Height is derived from
  // the photo's REAL aspect so 'cover' can't center-crop the head away first.
  // The cell composition is clipped (clip:true below). The trick to never cut a
  // head: size the image element to the photo's TRUE aspect so 'cover' has NOTHING
  // to center-crop (Creatomate's 'cover' center-crops any aspect mismatch, ignoring
  // the anchor — that was the old head-cutter), then let the CLIP trim the overflow.
  //   • photo taller than the cell → fill full width, TOP-anchor, clip trims the
  //     BOTTOM (feet) → heads always kept.
  //   • photo wider than the cell → fill full height, CENTER, clip trims the SIDES
  //     evenly → a face in the middle of a landscape is never cut vertically.
  // Per-image framing → a 0..1 bias on the cropped axis. Default vertical bias is
  // 0 (TOP → keep heads); the admin's Fix-framing control overrides per image.
  //   • a NUMBER (0..100, from the fine slider) → vertical position (0 top…100 bottom)
  //   • 'top'|'center'|'bottom'                 → vertical presets (0 / .5 / 1)
  //   • 'left'|'right'                          → horizontal presets for wide shots
  // Cell fill = the shared coverBox: sizes the image to its true aspect inside the
  // clipped cell and slides it by the per-image framing (vertical, horizontal AND
  // zoom from the admin Fix-framing controls). Default is TOP so heads stay in.
  const headSafe = (it, c) => coverBox(it, (c.w / 100) * width, (c.h / 100) * height);

  // group into pages: Two Panel forces pairs (2 per card; odd tail = 1), every
  // other model uses the 4,3,4,3 rhythm.
  const pagesArr = []; const sizes = S.twoPanel ? [2] : [4, 3, 4, 3]; let gi = 0, si = 0;
  while (gi < photos.length) { const w = sizes[si % sizes.length]; const g = photos.slice(gi, gi + w); pagesArr.push(g); gi += g.length; si++; }
  if (!pagesArr.length) return { output_format: 'mp4', width, height, frame_rate: 30, elements: [{ type: 'shape', track: 1, time: 0, duration: 2, path: rect, width: '100%', height: '100%', fill_color: S.bg }] };

  // even pixel padding / gaps (vertical % scaled so margins match horizontally)
  const padX = 2.8, padY = padX * (width / height);
  const gapX = 1.4, gapY = gapX * (width / height);
  // rhythm (overridable from the style options): STAG = gap between images,
  // HOLD = how long a full page sits, MOVE = per-transition duration.
  const STAG = Math.max(0.06, Number(mp.stagger) || 0.24);
  const HOLD = Math.max(0.3, Number(mp.hold) || 1.3);
  const MOVE = Math.max(0.25, Number(mp.speed) || 0.72);
  const FADE = 0.5;

  const elements = [];
  const bg = { name: 'Background', type: 'shape', track: 1, time: 0, duration: 1, path: rect, width: '100%', height: '100%', fill_color: S.bg };
  elements.push(bg);

  let t = 0, toggle = 0;
  pagesArr.forEach((group, pi) => {
    const motion = mpPickMotion(transition, pi);
    const tpl = mpTemplate(group);
    const cells = mpCells(tpl, padX, padY, gapX, gapY);
    const keys = AREA.slice(0, tpl.n);
    const n = keys.length;
    const revealDur = (n - 1) * STAG + (per ? MOVE : FADE);
    const pageDur = per ? (revealDur + HOLD + 0.3) : (revealDur + HOLD + MOVE);
    const photoEls = [];
    keys.forEach((k, idx) => {
      const it = group[idx]; if (!it) return;
      const c = cells[k]; const st = idx * STAG;
      if (per) {
        // each image transitions ON via the chosen motion, one at a time
        const inner = applyPhotoColor({ type: 'image', source: it.url, ...headSafe(it, c) }, it); // fill cell width, aspect-preserved, top-anchored → crop falls off the bottom, keeps heads
        // Two Panel: the pair enters from the outer edges (left cell from the left,
        // right cell from the right) and ALTERNATES which side leads each card —
        // unless Dissolve is chosen, which fades both in place.
        let cm = motion;
        if (S.twoPanel && n === 2) {
          if (transition === 'dissolve') cm = 'dissolve';
          else { const fromLeft = (pi % 2 === 0); cm = (idx === 0) ? (fromLeft ? 'slide-right' : 'slide-left') : (fromLeft ? 'slide-left' : 'slide-right'); }
        }
        photoEls.push(mpPhotoEnter(cm, c, st, MOVE, FADE, withBorder([inner], it, (c.w / 100) * width, (c.h / 100) * height, Math.min(width, height))));
      } else {
        // reveal in place: scale + fade, staggered (motion is applied to the page EXIT)
        // Clipping cell composition: the overscan photo inside is top-anchored so
        // 'cover' crops the BOTTOM (keeps heads); the reveal pop rides the comp.
        photoEls.push({
          type: 'composition', clip: true,
          x: `${(c.x + c.w / 2).toFixed(2)}%`, y: `${(c.y + c.h / 2).toFixed(2)}%`, width: `${c.w.toFixed(2)}%`, height: `${c.h.toFixed(2)}%`,
          x_anchor: '50%', y_anchor: '50%',
          opacity: [{ time: 0, value: '0%' }, { time: st, value: '0%' }, { time: st + FADE * 0.7, value: '100%' }],
          x_scale: [{ time: 0, value: '92%' }, { time: st, value: '92%', easing: 'quadratic-out' }, { time: st + FADE, value: '100%' }],
          y_scale: [{ time: 0, value: '92%' }, { time: st, value: '92%', easing: 'quadratic-out' }, { time: st + FADE, value: '100%' }],
          elements: withBorder([applyPhotoColor({ type: 'image', source: it.url, ...headSafe(it, c) }, it)], it, (c.w / 100) * width, (c.h / 100) * height, Math.min(width, height)),
        });
      }
    });
    const pageComp = {
      name: `Page-${pi + 1}`, type: 'composition', track: 2 + toggle, time: t, duration: pageDur,
      width: '100%', height: '100%', elements: photoEls,
    };
    if (per) {
      // whole page fades out at the very end so the next page enters clean
      pageComp.x = '50%'; pageComp.y = '50%'; pageComp.x_anchor = '50%'; pageComp.y_anchor = '50%';
      pageComp.opacity = [{ time: 0, value: '100%' }, { time: pageDur - 0.3, value: '100%' }, { time: pageDur, value: '0%' }];
      t += pageDur - 0.25;                       // slight crossfade overlap
    } else {
      // the WHOLE page leaves via the chosen motion, then the next page reveals
      mpApplyExit(pageComp, motion, revealDur + HOLD, pageDur);
      t += pageDur;                              // sequential (page exits, then next reveals)
    }
    elements.push(pageComp);
    toggle ^= 1;
  });

  const total = t + 0.3;
  bg.duration = total;
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}

// ============================================================================
// ASPECT-AWARE SLIDE FAMILY — Photo Slide · Sliding Images · Photo Ribbon
//
// The brief (Josh, 2026-08-18): "each image is numbered in an order to be
// presented. some images are 16x9 some are 9x16 - some may be other but can fit
// into one of these templates or keep it's specific dimensions. therefore each
// appearing photo could have a very different dimension than the previous, but
// the system recognizes this next image to build the reveal and movement - than
// on to the next."
//
// So: NOTHING here is a fixed box that photos are cropped into. Every card is
// built from the photo's own probed w/h, and the MOVE is chosen from the shape
// of the photo that is arriving. All three default to keyable green.
//
// Shared rules for this family:
//   • the card is the photo's native shape, so 'cover' has nothing to crop and a
//     9:16 stays tall next to a 16:9 — no pillars, no blurred fill (both were
//     rejected by Josh long ago; see MONTAGES-MASTER).
//   • a green item (it.green) renders as a FULL-FRAME chroma-green slot with no
//     card, no shadow and no motion — a pristine key window.
//   • NO drop shadow when the backdrop is green: a soft shadow over chroma green
//     is a semi-transparent grey halo that keys badly. Shadows only appear once
//     an actual background image is imported.
//   • all timing is real time/duration/keyframes so scaleMontageToLength (the
//     "Total length" pace mode) can rescale the whole montage.
// ============================================================================

// Fit a photo's NATIVE shape inside the frame. maxW/maxH are fractions of the
// frame. Returns fractions of the frame, so the card IS the photo's aspect.
function nativeBox(it, W, H, maxW, maxH) {
  const a = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 1.5; // no dims → landscape
  const A = (H > 0 ? W / H : 16 / 9);
  let w = maxH * a / A;          // height-limited
  if (w > maxW) w = maxW;        // width-limited
  return { w, h: w * A / a, a };
}
const itAspect = (it) => ((it && it.w > 0 && it.h > 0) ? it.w / it.h : 1.5);
const itIsPortrait = (it) => itAspect(it) < 0.9;

// A full-frame chroma-green beat — the keyable window Josh cuts his footage
// into. No tint, no filter, no motion (anything over the green breaks the key).
function greenSlot(name, time, duration, track) {
  return {
    name, type: 'composition', track, time: +time.toFixed(3), duration: +duration.toFixed(3),
    elements: [{
      type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%',
      x_anchor: '50%', y_anchor: '50%',
      path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', fill_color: CHROMA_GREEN,
    }],
  };
}

// True when the montage's backdrop is chroma green (so cards must cast no
// shadow). Mirrors bgLayers' own decision.
function backdropIsGreen(background, S) {
  const b = background || {};
  if (b.green) return true;
  if (b.url || b.videoUrl || b.textureUrl) return false;
  return !!S.greenDefault;
}

function slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H, shots = null }) {
  const elements = [];
  // `shots` is only needed by the blurred-blow-up bed. A caller that paces
  // irregularly passes nothing and simply does not offer that background —
  // better than a bed that changes off the cut.
  bgLayers(background, S, { track: 1, time: 0, duration: +total.toFixed(3), shots }).forEach((el) => elements.push(el));
  if (includeCards) {
    elements.push({ name: 'Opening', type: 'composition', track: 20, time: 0, duration: CARD_S,
      elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });
  }
  return elements;
}
function slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) {
  if (includeCards) {
    elements.push({ name: 'Closing', type: 'composition', track: 20, time: +(total - CARD_S).toFixed(3), duration: CARD_S,
      elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  }
  if (watermarkUrl) {
    elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0,
      duration: Math.max(1, +(total - 0.1).toFixed(3)), width: '62%', height: '6.9%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  }
  return elements;
}

// ---- BASIC CUT -------------------------------------------------------------
// The whole style is one loop. There is no shell to share because there is
// nothing to share: a green field, then one photograph at a time.
//
// WHY THE PHOTOS DO NOT TOUCH. Adjacent elements sit on ONE track, end-to-end,
// with no overlap and no transition. In Creatomate a same-track overlap is only
// legal with a transition, and a transition is exactly what Josh does not want.
// Butt-jointed on a single track gives a true hard cut on the frame boundary.
//
// WHY nativeBox AND NOT coverBox. coverBox fills the frame and crops whatever
// does not fit. nativeBox returns the largest box of the photo's OWN aspect
// ratio that fits inside the limits, so the picture is complete. The limits are
// 1.0 x 1.0 — the photo is as large as it can be without any part leaving the
// frame or being cut off.
// ============================================================================
// FRAMED BOX — one photograph at a time: a blown-up blurred copy of ITSELF
// fills the frame, and a white-outlined box sits over it holding the same
// picture sharp. The box wipes on, then box and picture push in together.
// Dust and a light leak over the top. No type, no rules, no plus marks —
// Josh was explicit about all three ("No type, no lines, no '+' signs").
//
// MEASURED FROM JOSH'S REFERENCE, not guessed. Detecting the white stroke in a
// screen recording of the Envato preview, one shot reads:
//     9.2-9.8s   the box's right edge sweeps 68.5% -> 80.1% of frame width
//                with no left edge in view — it reveals by a left-to-right wipe
//    10.0s       fully on at 80.8% x 74.7% of the frame
//    10.6s       84.0% x 77.6%
//    11.0s       87.8% x 88.0%, then past the frame
// So: wipe on over roughly a quarter of the shot, then a slow steady grow of
// about +9% in width and +13% in height, and out. Those are the numbers below.
//
// Built from parts already proven in real Creatomate renders rather than from a
// mock, which is the whole point of Josh's "every time we do a mock first it
// never works out". The blurred bed is Epic's bokeh construction; the dust and
// leak overlays are Epic's assets; the wipe is a clipping composition whose
// width animates, which is ordinary composition clipping. The one thing NOT
// carried over from anywhere: the white outline is a STROKED shape, and a
// stroked shape must never carry blur_radius — that renders as nothing (proved
// by probe, 139 against a 137 wall). It has no blur here.
// ============================================================================
// FRAMED BOX — traced from Josh's reference frame by frame.
//
// MEASURED, tracking every edge of the white frame across one shot of the
// reference at 15fps (times normalised to the shot):
//
//   u=0.00   right edge 66.6%, left edge OFF-SCREEN, top 13.1%, bottom 86.6%
//   u=0.29   left 0.3%  right 80.4%   -> w 80.1%  centre-x 40.4%  h 73.5%
//   u=0.60   left 5.3%  right 87.9%   -> w 82.6%  centre-x 46.6%  h 75.7%
//   u=1.00   spreading past every edge -> full frame, ~100% x 97.5%
//
// Read that carefully and the move is not what the first two builds assumed.
// The box does NOT open like a wipe. It holds a CONSTANT SIZE and SLIDES —
// during the first third its left edge is simply off-screen, which is why only
// one edge is visible. Then it keeps drifting sideways. Only in the last 40%
// does it expand, and it expands in all four directions to FILL THE FRAME.
//
// Josh, after the second render: "it still needs to drift to the side while
// beig revealed then move forward... its move is supposed to first be to the
// side during reveal then move to be full frame." Exactly the measurement.
//
// TRANSITIONS ARE A SLIDE OVER THE LAST IMAGE, not a dissolve — his words. So
// each shot rides on its own track ABOVE the one before it and slides in over
// it; nothing cross-fades. That means the tracks must ascend per photo, and the
// dust and leaks have to sit above ALL of them (fxBase) — the same trap that
// cost Vintage its pictures when climbing photo tracks collided with fixed
// effect tracks.
//
// A TALL PHOTOGRAPH cannot finish full-frame without being cropped, and
// nothing here may crop a photo. So it makes the same journey — slide, drift,
// then forward — but its destination is its own whole self, fitted and centred.
// Centre a cover-crop on the faces, for the blurred bed. Returns the item with
// a framing override, or the item untouched when there is no face data.
function bedShot(it, W, H) {
  const fs = Array.isArray(it && it.faces) ? it.faces.filter((f) => f && f.w > 0 && f.h > 0) : null;
  if (!fs || !fs.length) return it;
  const ar = (it.w > 0 && it.h > 0) ? it.w / it.h : 1.5;
  const boxAR = H > 0 ? W / H : 16 / 9;
  let y0 = 1, y1 = 0, x0 = 1, x1 = 0;
  for (const f of fs) {
    y0 = Math.min(y0, f.y); y1 = Math.max(y1, f.y + f.h);
    x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x + f.w);
  }
  const fy = (y0 + y1) / 2, fx = (x0 + x1) / 2;
  // How much of each axis a cover-crop actually shows. A picture TALLER than
  // its box fills the width and overflows the height, so the visible height
  // fraction is its aspect over the box's; a wider one is the reverse. My first
  // version had this inverted — it returned 1.0 where the answer was 0.316, so
  // the bias silently never applied and the bed did not move at all.
  const visH = ar <= boxAR ? ar / boxAR : 1;
  const visW = ar > boxAR ? boxAR / ar : 1;
  const bias = (f, vis) => (vis >= 0.999 ? null
    : Math.max(0, Math.min(1, (f - vis / 2) / (1 - vis))));
  const v = bias(fy, visH), h = bias(fx, visW);
  const fr = { ...(it.framing && typeof it.framing === 'object' ? it.framing : {}) };
  if (v != null) fr.y = +(v * 100).toFixed(2);
  if (h != null) fr.x = +(h * 100).toFixed(2);
  return { ...it, framing: fr };
}

function framedBoxSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, assetBase, perPhoto = null, atmosphere = true, atmoOpts = null, frameW = null, frameColor = null }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const n = Math.max(1, items.length);
  const cardS = includeCards ? CARD_S : 0;
  const step = Math.max(1.2, perPhoto != null ? perPhoto : (Number(S.photoS) || 3.4));
  const total = cardS + n * step + cardS;
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const base = assetBase || '';

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H });

  // The measured shape of the move, as fractions of the frame.
  const U = [0, 0.29, 0.60, 1];              // phase boundaries
  // These are RATIOS OF THE FINAL SIZE, not fractions of the frame — that is
  // what lets a tall photo make the identical move at its own scale. Read them
  // against Josh's description and they are the same thing: "the hero keeps its
  // size until the blurred background hits the full entirety of the screen -
  // then the Hero blows up to 100%". It sits at 80% through the slide and the
  // drift, then pushes to full over the last 40%.
  // Josh: "The hero shot is not big enough on the entrance." Raised from 0.801.
  const BW = [0.880, 0.880, 0.902, 1.00];    // box width
  // The measurement's last readable frame was 97.5% tall, but by then the box
  // was leaving the frame — the destination is the whole frame. Held at 1.0 so
  // a landscape photograph finishes uncropped rather than trimmed by 2.5%.
  const BH = [0.820, 0.820, 0.844, 1.00];    // box height
  // Centre of the box along the axis it travels, measured for a rightward move.
  // The start is pulled further out than the reference's 0.2655 so the box has a
  // real distance to cover: 42% of the frame instead of 23%. Measured on render
  // 025, the drift after the slide ran at 0.10-0.31% of frame per frame — one to
  // two PIXELS at 960 wide, which is both a crawl and, because it lands between
  // pixels, a stutter. Only the first and last of these are used (the shape
  // comes from the traced curve); the middle two are kept for reference.
  const CX = [0.08, 0.4035, 0.4660, 0.50];
  // Josh, twice: "All images need to have a thicker border", then "double the
  // size of the white frame". 0.0028 -> 0.0056 -> 0.0112, i.e. ~12px at 1080.
  //
  // Worth knowing when tuning this: the frame is a stroked rect drawn INSIDE the
  // clipping box, and Creatomate centres a stroke on its path, so the outer half
  // is clipped away and the visible line is half the number below. That is why
  // it reads thinner than the value suggests — and why doubling the value does
  // genuinely double what you see.
  // THE FRAME IS NOW A CONTROL. Josh: "can you add some frame contrils in that
  // drop down? Thickness and color?"
  //
  // Thickness is carried as a SHARE OF FRAME WIDTH, not pixels, so the same
  // setting looks identical at 1080p and 4K — a pixel value would render half
  // as thick at double the resolution. 0.696% is what I measured off the
  // reference (7px on a 1006-wide frame at the hold) and is the default.
  //
  // Doubled on the way in, because Creatomate centres a stroke on its path and
  // this one is drawn inside the clipping box, so the outer half is trimmed and
  // the VISIBLE line is half what is specified. FRAME_W is what you see.
  // Number(null) === 0 and 0 is finite, so a plain isFinite check turned the
  // DEFAULT into "no frame at all" — caught on the first test, and the same
  // null trap that ate the backdrop crossfade default. null/undefined/'' mean
  // "not set"; only a real number counts, and 0 from the slider is meaningful.
  const FRAME_W = (frameW === null || frameW === undefined || frameW === ''
    || !Number.isFinite(Number(frameW)))
    ? 0.696
    : Math.max(0, Math.min(2.4, Number(frameW)));
  const FRAME_COLOR = (typeof frameColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(frameColor)) ? frameColor : '#FFFFFF';
  // Zero is a real setting: no rule at all, just the picture over its blur.
  const STROKE = FRAME_W <= 0 ? 0 : Math.max(2, Math.round((2 * FRAME_W / 100) * W));
  // Hoisted above the per-shot loop: endBox/endW/endH are computed before the
  // rest of the FB_ constants, so leaving this inside the loop put it in its
  // own temporal dead zone. The units guard caught it on the first run.
  //
  // THE PICTURE DOES NOT STOP AT THE FRAME. I had this at 0.978 because I
  // watched the box settle at 556 of 570 px and called that its final size. It
  // was not final, it was a moment mid-growth: the box passes full frame at
  // 11.88s, its white border leaves the picture entirely by 11.93, and a
  // scale-match against frames six apart shows the photograph still pushing in
  // at 0.125%/frame afterwards, easing to nothing only as the next card
  // arrives. About 3% more after it fills the screen. Josh, watching 031: "I
  // don't want the hero to stop. keep resizing up while the transition of the
  // next shot occurs."
  // ATMOSPHERE IS MARRIED TO WHAT IT SITS ON. Josh: "I do see that the dust and
  // light on the hero shot are married to the hero shot so the resize makes the
  // dust resize with it - keeping the dust and light in the background the
  // original size."
  //
  // Checked before building it. During the reference's hold the picture is
  // slowly zooming, so splitting each frame into a low-frequency band (the
  // photograph) and a high-frequency one (the specks) and scale-matching each
  // against a frame eight later separates the two layers. They come back
  // identical — 0.9880 / 0.9880, then 0.9928 / 0.9928, then 0.9964 / 0.9964.
  // The dust is zooming with the hero, not pinned over it. And on the bed, the
  // earlier drift measurement gave the same answer from the other side: it read
  // 7/7/5/3 px per frame whether or not the frame was blurred first, so the
  // specks there travel with the bed rather than staying put.
  //
  // So there is no single overlay. Each layer carries its own, and it inherits
  // that layer's movement for free — the hero's grows with the hero, the bed's
  // stays at its own scale and drifts with the bed.
  // 36 and 46 are the measured reference figures, and 100% on every slider
  // reproduces them exactly. Josh's "option C": one master, then a trim per
  // layer, so the dust-to-leak balance stays right unless he deliberately
  // leans on one of them. Opacity cannot exceed 100%, so the sliders stop
  // biting past about 2.8x on dust and 2.2x on leaks.
  // NULL TRAP, caught on the first test and the fourth time this exact bug has
  // appeared in this file: Number(null) is 0 AND 0 is finite, so a plain
  // isFinite guard turns "not set" into "zero atmosphere" — the default came
  // back at 0% instead of the measured 36/46. Check null/undefined/'' first.
  const _ap = (v) => ((v === null || v === undefined || v === '' || !Number.isFinite(Number(v)))
    ? 100 : Math.max(0, Number(v))) / 100;
  const _am = _ap(atmoOpts && atmoOpts.intensity);
  const FX_DUST = atmosphere ? Math.round(Math.min(100, 36 * _am * _ap(atmoOpts && atmoOpts.dust))) : 0;
  const FX_LEAK = atmosphere ? Math.round(Math.min(100, 46 * _am * _ap(atmoOpts && atmoOpts.leak))) : 0;
  // Leaks used to fire once per shot for 1.9s and then stop. Measured in tenths
  // of a shot, the reference's short-term brightness change is even all the way
  // through (3.5 3.9 2.5 2.0 4.3 3.7 3.7 2.4 3.7 2.9) while render 031 was
  // front-loaded and then dead (5.7 3.9 7.6 5.5 3.4 3.1 0.6 0.6 0.7 3.1) —
  // the quietest part of the atmosphere landing on the quietest part of the
  // move. Two overlapping swells across the whole shot instead of one pulse.
  const leakCurve = (span, peak) => [
    { time: 0, value: '0%', easing: 'quadratic-out' },
    { time: +(span * 0.22).toFixed(3), value: `${peak}%`, easing: 'quadratic-in-out' },
    { time: +(span * 0.46).toFixed(3), value: `${Math.round(peak * 0.35)}%`, easing: 'quadratic-in-out' },
    { time: +(span * 0.72).toFixed(3), value: `${Math.round(peak * 0.85)}%`, easing: 'quadratic-in-out' },
    { time: span, value: '0%' },
  ];
  // Rotation per SECOND, not per montage. It used to be 6 degrees across the
  // whole film, which on a 40s montage is 0.15 deg/sec — a still transparency.
  const spin = (span, deg) => [
    { time: 0, value: '0°', easing: 'linear' },
    { time: span, value: `${(deg * span / 12).toFixed(2)}°` },
  ];
  // THE BED'S CONTENT, resolved once. Default (and null) keeps the blown-up
  // blurred copy of each shot's own photo — the style as signed off. An
  // imported image, a pasted URL or a built-in texture replaces it; green
  // screen or a tint-only choice makes it a flat colour. Video is not accepted
  // (see the note at the bed itself) and falls through to the blow-up.
  const FB_BG = background || {};
  const FB_BED_URL = (!FB_BG.videoUrl && (FB_BG.url || FB_BG.textureUrl)) || null;
  const FB_BED_FLAT = (!FB_BED_URL && FB_BG.green) ? CHROMA_GREEN : null;
  // An imported backdrop is a finished picture, so it is NOT blurred by default
  // the way the blow-up must be; `bgBlur` turns it on when he wants it soft.
  const FB_BED_BLUR = Number.isFinite(Number(FB_BG.blur)) && Number(FB_BG.blur) > 0
    ? Math.round(Number(FB_BG.blur)) : 0;
  const FB_END = 1.0;        // the size at which the hero exactly fills the frame
  const FB_OVER = 1.030;     // and it keeps going to here by the end of the shot

  items.forEach((it, i) => {
    const t0 = +(cardS + i * step).toFixed(3);
    const dur = +step.toFixed(3);
    const track = 4 + i;
    if (it.green) { elements.push(greenSlot(i === 0 ? 'GreenIn' : `Green-${i + 1}`, t0, dur, track)); return; }

    const DIRS = ['right', 'left', 'down', 'up'];
    const dir = DIRS[(i * 3) % 4];
    const horiz = dir === 'right' || dir === 'left';
    const back = dir === 'left' || dir === 'up';       // travelling toward the origin

    // A tall photo finishes as its whole self, centred, instead of full frame.
    const tall = itIsPortrait(it);
    // Josh: "I realize the verticals are not going to take up the full page, but
    // they should at leash take up the full vertical page (top to bottom)." So
    // the ceiling goes from 88% of the frame height to all of it.
    const endBox = tall ? nativeBox(it, W, H, 0.95, FB_END) : null;
    const endW = tall ? endBox.w : FB_END;
    const endH = tall ? endBox.h : FB_END;

    // ── THE MOVE ────────────────────────────────────────────────────────
    // Josh, after four rounds of me getting this wrong: "remember, the
    // background is the wipe. the foreground Hero travels with the background
    // and continues a fluid non stop / non jerking movement to be full size of
    // the frame. then the next set comes in with the background transitioning
    // over the entire last image."
    //
    // Every previous build missed the first clause. I kept treating the bed as
    // decoration behind the hero — first sliding it as a separate layer, then
    // (worse) pinning it and panning the picture inside it. It is neither. THE
    // BED IS THE TRANSITION. The shot arrives as one card: a full-frame blurred
    // plate with the framed picture already sitting on it, and that card slides
    // over the whole of the previous shot. There is no cross-fade and no second
    // motion to reconcile, because the bed and the hero are not two things
    // being kept in sync — they are one object.
    //
    // So the scene composition itself is the wipe (clip:true, full frame,
    // translating), the bed is nailed to it, and the hero is a child that
    // carries a little extra travel of its own. "Travels WITH the background
    // and CONTINUES" falls out of the structure instead of being tuned in.
    //
    // Two curves, both continuous, neither with an interior waypoint:
    //   card   1 - (1 - u/w)^2   quadratic-out, finished at u = w
    //   hero   1 - (1 - u)^p     one ease-out across the whole shot
    // The hero's on-screen path is the hero curve, full stop — its keyframes
    // are solved against the card so the composite IS that curve. Velocity
    // therefore falls monotonically from start to landing and is never
    // restarted, which is the thing that has been missing.
    // MEASURED OFF THE REFERENCE, 2026-09-07. Josh sent the Envato clip back
    // (1006x570, 60fps) and I tracked the white frame's stroke per frame across
    // one full shot: 8.70s -> 13.30s. Everything below is that trace, not a
    // guess. Fit RMS 5.9px on a 1006-wide frame.
    //
    //   shot        4.60s. Motion runs 8.70 -> 11.80 = 67% of it. THE LAST
    //               THIRD IS STATIC, full frame, waiting for the next card.
    //   travel      centre 120px -> 503px = 38.1% of frame width
    //   curve       503 - 383*(1-u)^2.64 over the motion. A PURE ease-out --
    //               it decelerates to REST and arrives.
    //   hold size   801 x 414 px = 79.6% W x 72.6% H of frame, held until the
    //               card lands, then grown to full frame
    //   card lands  ~10.25s = 34% of the shot, which is the same instant the
    //               growth starts. Josh called this in July from the stills:
    //               "the hero keeps its size until the blurred background hits
    //               the full entirety of the screen - then the Hero blows up."
    //               The measurement says he was exactly right.
    //
    // WHY THE ENTRY FELT SLOW, WHICH IS NOT WHAT I ASSUMED. My peak speed was
    // 1.40 %frame/frame against the reference's 1.46 -- near enough identical.
    // The difference is everything after the peak. The reference sheds speed on
    // a pure ease-out and is DONE at 67%, then holds; mine carried a linear
    // floor (added deliberately, to stop a pure ease-out "stalling") and spread
    // the move across the whole shot, so it never arrived and never rested. The
    // eye reads that as slow. The reference stalls too -- it just stalls at the
    // finish line, where a stall is an arrival.
    //
    // So the linear floor comes out. It was solving a problem the reference
    // solves with structure instead.
    // THE HERO'S START TIME AND ITS TRAVEL ARE THE SAME NUMBER, and I had them
    // from two different answers. Refitting with the end time pinned (11.80s,
    // where the box stops growing and the frame difference settles) the fit is
    // COMPLETELY FLAT in start time -- RMS 5.91px for every t0 from 8.40 to
    // 8.85, with the travel sliding 48.6% down to 33.4% to compensate. The
    // first 17% of the hero's move is hidden behind the card, so the trace
    // genuinely cannot separate the two. It pins the SHAPE (p=2.64) and their
    // product, nothing more.
    //
    // What DOES pin it is the ratio Josh asked for: hero speed over background
    // speed, both measured off the same frames, so no time base is involved and
    // nothing can trade off. The reference runs 2.05 / 1.89 / 1.82 / 1.71 /
    // 1.45 through the visible part of the wipe.
    //
    // I had paired travel 38.1% (which belongs to a hero starting at 8.70) with
    // a hero that starts when the card does (8.50), and the mismatch showed up
    // exactly there: 3.20 / 2.49 / 2.16 / 1.99 / 1.85, a hero lagging its own
    // background by half again too much. The consistent member of the family
    // for a hero that starts with the card is 44.9% over 71.7% of the shot,
    // which gives 2.79 / 2.15 / 1.85 / 1.69 / 1.55.
    const FB_MOTION = 0.717;   // motion occupies this much of the shot, then rest
    const FB_WIPE = 0.40;      // card has covered the frame by here
    const FB_GROW = 0.34;      // and the hero starts growing at the same instant
    const FB_TRAVEL = 44.9;    // hero's on-screen travel, % of frame
    const FB_P = 2.64;         // measured deceleration
    // THE BOX NEVER REACHES THE FRAME EDGE. Measured: it settles at 556px of
    // 570 high and ~988 of 1006 wide -- about 97.8% -- so the whole white rule
    // stays inset with a thin band of the blurred bed outside it. Mine ran to
    // exactly 100%, which pushed the border onto the frame edge and clipped it
    // away at precisely the moment the shot sits still and you look at it. All
    // four sizes below are fractions OF THE FRAME; the ratios handed to sizeSeq
    // are hold/end, since sizeSeq scales against the end size.
    const FB_HOLD_W = 0.796;   // hero size while the card is still arriving
    const FB_HOLD_H = 0.726;
    const FB_STEPS = 40;
    const heroF = (u) => (u >= FB_MOTION ? 1 : 1 - ((1 - (u / FB_MOTION)) ** FB_P));
    // THE CARD EASES IN, AND THEN CREEPS. Josh: "track the speed of the
    // background as it moves in. [i]t is not consistent." He is right, and I
    // had never measured it -- I assumed a quadratic-out because that is what a
    // slide usually is.
    //
    // Tracked per frame off the reference (step-fit on the column-wise frame
    // difference, so the edge is found where the picture stops changing), the
    // card's speed in % of frame per frame runs:
    //   1.29 1.39 1.69 1.99 2.29 2.68 3.28 3.68 4.37 4.67 4.87 4.87
    //   4.37 4.08 3.78 3.28 2.98 2.68 2.49 2.09 2.09 1.79 ... 0.89 0.80
    // It ACCELERATES for a third of a second, peaks near 27% of the wipe, then
    // creeps for twice as long again. Measured on render 030, mine did the
    // opposite: 5.77 %/frame at the first frame and monotonically down. Opening
    // at maximum speed is the lurch.
    //
    // I tried two analytic families and neither fits. 1-(1-T)^n(1+nT) puts the
    // peak in the right place but cannot also carry the tail; (1-(1-T)^b)^a
    // fits the tail and moves the peak. That is not a fitting failure to push
    // through -- the real curve has BOTH a sharp early peak and a long low
    // creep, and no two-parameter family does both. So the measured points ARE
    // the curve, resampled through a monotone cubic exactly the way the hero's
    // used to be. FB_STEPS keyframes, so what renders is what was traced.
    const FB_WIPE_KNOTS = [[0, 0], [0.070, 0.057], [0.145, 0.120], [0.215, 0.240],
      [0.285, 0.427], [0.360, 0.583], [0.430, 0.685], [0.500, 0.757],
      [0.575, 0.813], [0.645, 0.855], [0.715, 0.890], [1, 1]];
    // Fritsch-Carlson: passes through every measured point, cannot overshoot,
    // cannot reverse -- a reversing background would be a wipe that un-wipes.
    const pchip = (pts) => {
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const nn = pts.length;
      const h = [];
      const dd = [];
      for (let k = 0; k < nn - 1; k += 1) { h.push(xs[k + 1] - xs[k]); dd.push((ys[k + 1] - ys[k]) / h[k]); }
      const m = new Array(nn);
      m[0] = dd[0];
      m[nn - 1] = dd[nn - 2];
      for (let k = 1; k < nn - 1; k += 1) {
        if (dd[k - 1] * dd[k] <= 0) { m[k] = 0; continue; }
        const w1 = (2 * h[k]) + h[k - 1];
        const w2 = h[k] + (2 * h[k - 1]);
        m[k] = (w1 + w2) / ((w1 / dd[k - 1]) + (w2 / dd[k]));
      }
      return (x) => {
        let k = 0;
        while (k < nn - 2 && x > xs[k + 1]) k += 1;
        const t = (x - xs[k]) / h[k];
        const t2 = t * t;
        const t3 = t2 * t;
        return (((2 * t3) - (3 * t2) + 1) * ys[k])
          + ((t3 - (2 * t2) + t) * h[k] * m[k])
          + (((-2 * t3) + (3 * t2)) * ys[k + 1])
          + ((t3 - t2) * h[k] * m[k + 1]);
      };
    };
    const wipeCurve = pchip(FB_WIPE_KNOTS);
    const wipeF = (u) => (u >= FB_WIPE ? 1 : Math.max(0, Math.min(1, wipeCurve(u / FB_WIPE))));
    // Direction: `back` (left/up) travels toward lower coordinates.
    const d = back ? -1 : 1;
    // THE HERO TRAVELS LESS THAN THE CARD, AND THAT IS PARALLAX, NOT A BUG.
    // The card crosses a whole frame to wipe; the hero crosses 38% of one, so
    // its local keyframes run back against the card during the wipe. Measured
    // on the reference the two are 3.1:1 through the wipe. I had earlier talked
    // myself down from 2.8:1 because it "looked pinned" on a contact sheet --
    // the reference is steeper than the ratio I rejected, so that judgement was
    // wrong and the trace overrules it. What actually made it read as pinned
    // was the missing arrival, fixed above.
    const wipeFrom = 50 - (d * 100);
    const boxAt = (u) => 50 + (d * ((100 * (1 - wipeF(u))) - (FB_TRAVEL * (1 - heroF(u)))));
    // THE BED IS NOT NAILED TO THE CARD, AND THIS IS THE THING I HAD WRONG.
    // Josh, a fourth time on direction: "it seems to me that the Hero shot is
    // always moving in the same direction."
    //
    // I had assumed since the rebuild that the reference's background is a rigid
    // card sliding in -- bed and hero carried together, the card's edge being
    // the wipe. Never tested it. Matching the ALREADY-COVERED part of the bed
    // between consecutive frames (sampled in the strips above and below the
    // hero, so only bed is in the window, and re-run at three blur radii so
    // dust cannot be what the match is locking onto) the bed moves:
    //     7  7  5  3  3  2  2  px/frame
    // while the reveal edge over the same frames moves 33 px/frame. The edge
    // sweeps; the bed only drifts, about 20% of frame across the whole wipe
    // against the hero's 45%.
    //
    // So on screen the reference has everything travelling one way at similar
    // gentle speeds, the hero a bit faster than the bed. Mine had the bed
    // rocketing across at the card's speed, three to five times the hero, while
    // the hero -- being a child of that card -- ran backwards inside it to
    // compensate. The composite was right and it still read wrong, because what
    // Josh is watching is the bed and the hero against each other.
    //
    // The card still provides the wipe edge, because that part was right. The
    // bed now gets the same compensation the hero gets, so its OWN screen path
    // is the slow drift instead of the card's sweep.
    const FB_BED = 20;         // bed's on-screen travel, % of frame
    const bedAt = (u) => 50 + (d * ((100 * (1 - wipeF(u))) - (FB_BED * (1 - heroF(u)))));
    const posSeq = Array.from({ length: FB_STEPS + 1 }, (_, k) => {
      const u = k / FB_STEPS;
      return {
        time: +(u * dur).toFixed(3),
        value: `${boxAt(u).toFixed(3)}%`,
        ...(k < FB_STEPS ? { easing: 'linear' } : {}),
      };
    });
    const bedSeq = Array.from({ length: FB_STEPS + 1 }, (_, k) => {
      const u = k / FB_STEPS;
      return {
        time: +(u * dur).toFixed(3),
        value: `${bedAt(u).toFixed(3)}%`,
        ...(k < FB_STEPS ? { easing: 'linear' } : {}),
      };
    });
    // The bed picture has to keep covering its window while it slides about
    // inside it, and its own blurred edge must stay out of shot: the window
    // width, plus the drift's full swing, plus room for the blur to feather in
    // private (it is 3% of the short side).
    const BED_FILL = 100 + (2 * FB_BED) + 12;
    const wipeSeq = Array.from({ length: FB_STEPS + 1 }, (_, k) => {
      const u = k / FB_STEPS;
      return {
        time: +(u * dur).toFixed(3),
        value: `${(50 - (d * 100 * (1 - wipeF(u)))).toFixed(3)}%`,
        ...(k < FB_STEPS ? { easing: 'linear' } : {}),
      };
    });
    // Josh: "the hero keeps its size until the blurred background hits the full
    // entirety of the screen - then the Hero blows up to 100%." So it holds
    // through the wipe and grows after it, on sinusoid-in-out — the growth
    // begins from rest (the hold) and settles at rest (the landing), so neither
    // end of it steps the hero's apparent speed.
    //
    // ONE ratio on both axes. BW and BH used to differ, so the box changed
    // SHAPE as it moved and the frame could only touch the picture at the end
    // ("The frame is not married to the image edge"). A tall photo keeps its
    // native box, a landscape keeps the frame's — either way the shape is fixed
    // and the white rule sits on the picture edge for every frame.
    // THE GROWTH, TRACED. Josh, on 031: "there seems to be a dip like movement
    // that shouldn't be there." There is, and I found it in his renders before
    // changing anything -- the hero's TRAILING edge travels one way, stalls,
    // and comes back. On 030 it sits at 690px for eight frames then crawls out
    // 16px; on 031 it stalls at 692 and crawls back 14. That is the dip.
    //
    // The cause is that the growth ENDS. The trailing edge is centre plus half
    // the box, so while the centre still drifts one way and the box still grows
    // the other, the edge is the difference of two shrinking rates -- and when
    // the growth eases out to zero on a sinusoid while the travel is also
    // dying, the two cancel for a third of a second and the edge hangs.
    //
    // The reference's trailing edge reverses too, at almost the same point of
    // the shot (u=0.478 against my 0.541), and it does not read as a dip
    // because it never hangs: it turns at low speed and is immediately pulled
    // away by a growth that is still accelerating. Measured heights, as a
    // fraction of frame: 0.727 0.730 0.737 0.751 0.782 0.811 0.844 0.879 0.905
    // 0.930 0.951 0.968 0.977 0.984 -> full frame -> and on past it.
    //
    // So the growth is that measured curve, and it runs to the END of the
    // shot's life rather than stopping at FB_MOTION: slow lead-in, a brisk
    // middle that carries the edge decisively through its turn, then a long
    // creep that never reaches zero. One curve answers both of Josh's notes,
    // because they were the same fault.
    const FB_GROW_KNOTS = [[0, 0], [0.076, 0.013], [0.143, 0.036], [0.208, 0.082],
      [0.275, 0.184], [0.306, 0.280], [0.340, 0.388], [0.373, 0.503],
      [0.407, 0.589], [0.438, 0.671], [0.472, 0.740], [0.505, 0.796],
      [0.539, 0.826], [0.570, 0.849], [1, 1]];
    const growCurve = pchip(FB_GROW_KNOTS);
    // Past the shot's nominal end the element is still alive, covered by the
    // next card's wipe. Continue at the curve's terminal rate so the hero is
    // still growing while that transition happens, instead of freezing under it.
    const GROW_TAIL = (1 - 0.849) / (1 - 0.570);
    const growF = (u) => {
      if (u <= FB_GROW) return 0;
      const t = (u - FB_GROW) / (1 - FB_GROW);
      return t <= 1 ? growCurve(t) : 1 + ((t - 1) * GROW_TAIL);
    };
    // ONE ratio on both axes for a tall photo, its own for a landscape. Measured
    // the reference holds 1.95:1 inside a 1.77:1 frame and grows to fill it, so
    // the axes genuinely differ -- safe because a landscape photo COVERS its box.
    // A tall photo is contained, so its box must keep the photograph's shape or
    // the picture letterboxes and the white rule stands off the edge.
    const holdW = tall ? FB_HOLD_H : FB_HOLD_W;
    const holdH = FB_HOLD_H;
    const life = i === items.length - 1 ? dur : dur * (1 + FB_WIPE);
    const sizeSeq = (full, hold) => {
      const n = Math.round(FB_STEPS * (life / dur));
      return Array.from({ length: n + 1 }, (_, k) => {
        const u = (k / n) * (life / dur);
        const v = full * (hold + ((FB_OVER - hold) * growF(u))) * 100;
        return {
          time: +(u * dur).toFixed(3),
          value: `${v.toFixed(3)}%`,
          ...(k < n ? { easing: 'linear' } : {}),
        };
      });
    };

    const box = {
      type: 'composition', clip: true,
      width: sizeSeq(endW, holdW), height: sizeSeq(endH, holdH),
      x: horiz ? posSeq : '50%', y: horiz ? '50%' : posSeq,
      x_anchor: '50%', y_anchor: '50%',
      elements: [
        // THE PICTURE SCALES WITH THE BOX. Josh, on the reference stills: "The
        // images look to be around 60-70 % downsized (thats a guess) then it
        // grows to 100%." That is a scaled photograph, not a window cropping
        // into a big one — in the reference frames the whole eagle is inside
        // the frame, and the same eagle sits larger and blurred behind it. My
        // previous build pinned the picture at final size in PIXELS and let the
        // box crop into it, which is a different effect entirely.
        //
        // So it is 100% of the box and rides its animation. Landscape covers
        // (it ends full-frame and should fill it); a tall photo contains, so
        // all of it is on screen the whole way, just smaller at the start.
        applyPhotoColor({
          type: 'image', source: it.url,
          ...coverBox(it, W * endW, H * endH),
          width: '100%', height: '100%',
          ...(tall ? { fit: 'contain' } : {}),
          x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        }, it),
        // The hero's own atmosphere. Sized to the BOX, so it grows with the box
        // exactly as the reference's does — that is the whole point of it living
        // in here rather than over the top. Under the white rule, which stays a
        // clean line.
        ...(base && atmosphere ? [
          { name: `HeroDust-${i + 1}`, type: 'image', source: `${base}/overlays/dust1.png`,
            width: '150%', height: '150%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            blend_mode: 'screen', opacity: `${FX_DUST}%`, z_rotation: spin(life, 6) },
          { name: `HeroLeak-${i + 1}`, type: 'image', source: `${base}/overlays/leak_epic${(i % 3) + 1}.png`,
            width: '140%', height: '140%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            blend_mode: 'screen', opacity: leakCurve(life, FX_LEAK) },
        ] : []),
        ...(STROKE > 0 ? [{ type: 'shape', path: rect, width: '100%', height: '100%',
          x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          fill_color: 'rgba(0,0,0,0)', stroke_color: FRAME_COLOR, stroke_width: `${STROKE} px` }] : []),
      ],
    };

    // THE WHOLE SHOT MOVES ONE WAY. Josh: "Everything moves in one consistent
    // direction. Not down then up. not to the left then right. Its always down.
    // or always up or always to the right."
    //
    // He is right and this was reversed. The box travels toward the centre from
    // one side — for 'right' its centre runs 26.55% -> 50%, i.e. RIGHTWARD — so
    // the shot carrying it has to arrive from the LEFT and keep going right. I
    // had the scene entering from the opposite side, so the shot slid one way
    // while the box inside it slid the other: a reversal in every shot, which is
    // the third time I have got a direction sign backwards in this engine.
    //
    // `back` is true for 'left' and 'up', where the box travels toward lower
    // coordinates and the shot must therefore enter from the high side.
    //
    // THE SLIDE IS NO LONGER A WHOLE FRAME. Josh: "still don't have a good
    // flowing movement of the Hero image." Measured on render 025, the box
    // centre moved 6.35% of the frame per frame during the slide and 0.10%
    // during the drift — a 60x collapse inside the first second, which reads as
    // a lurch followed by a stall rather than as one move changing speed.
    //
    // The cause was scale, not easing: a 100%-of-frame slide in 1s composed on
    // top of a 23%-of-frame drift over 3.4s. The slide was ~15x the drift's
    // speed and then simply stopped existing.
    //
    // The bed only has to travel far enough to COVER what is behind it, and it
    // is already a full-frame layer — so an offset of 38% covers everything once
    // it has closed, at roughly a third of the old speed. With the box's own
    // travel raised to 42%, the two motions are now in the same family and the
    // shot decelerates by about 7x across its length instead of 60x. A speed
    // change, which is what was asked for, rather than a cliff.
    // THE BED MOVES, BUT IT IS NEVER TRANSLATED AS A WHOLE.
    //
    // Josh: "weird stripe on (all) the background image - filter shifr" and
    // "the movement is still not fluid". Measured on that render, a hard
    // horizontal edge spanning the full width travels across the frame for most
    // of every shot. That is the seam where the incoming scene's bed meets the
    // outgoing one — and because both beds are heavily blurred and close in
    // tone, it does not read as a new picture arriving, it reads as a band
    // where the grade changes. A stripe.
    //
    // The same slide is what has been fighting the movement. Sliding a
    // full-frame bed is necessarily a big fast motion; the box's own travel is
    // small and slow; composing them gives a lurch and then a drift no matter
    // how the two are eased. Three rounds of tuning ratios did not fix that
    // because the problem was having two motions at all.
    //
    // Then I over-corrected and stopped the bed moving at all, which Josh
    // rightly called further from the target: "the back ground doesn't move at
    // all anymore... it's obviously not moving with the background since the
    // background isn't moving at all." The bed has to travel with the hero —
    // that was the spec from the start ("the background and foreground slide in
    // together the same direction").
    //
    // The two requirements are separable, and I had been treating them as one:
    //   - the bed must MOVE  ->  its content travels with the hero
    //   - the bed must not SHOW AN EDGE  ->  so do not translate the layer
    // The bed image is already oversized — a cover-fill at 122% — so there is
    // 22% of overscan on both axes. Panning the IMAGE inside its clipped,
    // full-frame composition moves the background without ever bringing an edge
    // into shot. The composition itself never moves.
    //
    // It settles at 45% of the shot while the hero keeps going, which is the
    // order Josh described: the background completes, then the hero continues
    // and grows.
    elements.push({
      name: `Framed-${i + 1}`, type: 'composition', track,
      // A shot must OUTLIVE its own step, or there is nothing left on screen for
      // the next one to slide over — it would slide in over the background and
      // the transition Josh asked for would not exist. It stays for exactly the
      // incoming slide, then stops.
      // A shot has to outlive its own step by exactly the next card's wipe, or
      // there is nothing underneath for that card to travel over.
      time: t0, duration: +life.toFixed(3),
      // clip:true is what makes this a wipe rather than a drifting layer: the
      // composition's own edge is the hard line that crosses the frame.
      clip: true,
      width: '100%', height: '100%',
      x: horiz ? wipeSeq : '50%', y: horiz ? '50%' : wipeSeq,
      x_anchor: '50%', y_anchor: '50%',
      elements: [
        // THE BED, framed on the faces. A cover-crop into 16:9 discards most of a
        // tall photograph's height, and the default bias is the top of the
        // frame, so the people sat low. Where studio_media has face boxes the
        // crop is centred on the union of ALL of them — the whole group, not the
        // biggest face — solving for the bias that puts them mid-window.
        //   visible fraction of the image height = 100 / scaledHeight
        //   bias v such that  v * (1 - vis) + vis/2 = faceCentre
        // Without faces it behaves exactly as before.
        { type: 'composition', width: '100%', height: '100%', clip: true,
          x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          // The window is pinned to the card and sized exactly to it; the
          // PICTURE inside takes the drift, so no clip edge is ever in motion.
          //
          // The oversizing moved from the window to the picture, and that is a
          // correction, not a tidy-up. It used to be the WINDOW that was blown
          // up to 112%, to keep the blur's soft edge outside the clip — a stack
          // blur has nothing to sample past its element's bounds, so a bed sized
          // exactly to its window feathers at the boundary and the wipe line
          // reads as a smeared band rather than an edge, which is what the
          // "weird stripe / filter shift" was. Scaling the window also scales
          // everything in it, so a drift written against the window would land
          // on screen multiplied by that factor. Oversizing the PICTURE solves
          // the blur edge just as well, gives the drift its room, and leaves the
          // offsets meaning exactly what they say.
          elements: [(() => {
            const rel = (v) => bedSeq.map((k) => ({
              ...k,
              value: `${((parseFloat(v) || 50) + (parseFloat(k.value) - 50)).toFixed(3)}%`,
            }));
            // WHAT RIDES INSIDE THE CARD.
            //
            // By default it is a blown-up, blurred copy of THIS shot's own
            // photograph, which is what makes the move read as one picture
            // resolving into itself — the thing traced off the Envato reference.
            //
            // Josh 2026-09-08 asked for it to be swappable like every other
            // style's background, and it can be: THE WIPE IS THE CLIPPING CARD,
            // NOT THE PICTURE INSIDE IT. The card travels and its clip edge is
            // the hard transition line; whatever sits inside just goes along.
            // So a supplied backdrop replaces the blow-up and the motion is
            // untouched. It stops reading as the same photograph resolving —
            // that is the trade, and it is his to make per montage.
            //
            // A VIDEO backdrop is deliberately NOT accepted here. A video child
            // inside a clipped, travelling composition needs its own explicit
            // duration or it runs for its media length (the loop regression of
            // 2026-08-18), and it would be decoded once per shot. Falls back to
            // the photo blow-up rather than rendering something broken.
            if (FB_BED_URL) {
              return {
                type: 'image', source: FB_BED_URL,
                x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
                width: '100%', height: '100%', fit: 'cover',
                x_scale: `${BED_FILL}%`, y_scale: `${BED_FILL}%`,
                ...(horiz ? { x: rel('50%') } : { y: rel('50%') }),
                ...(FB_BED_BLUR > 0 ? { blur_radius: FB_BED_BLUR, blur_mode: 'stack' } : {}),
              };
            }
            if (FB_BED_FLAT) {
              return {
                type: 'shape', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
                x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
                width: `${BED_FILL}%`, height: `${BED_FILL}%`,
                fill_color: FB_BED_FLAT,
              };
            }
            const cb = coverBox(bedShot(it, W, H), W, H);
            return applyPhotoColor({
              type: 'image', source: it.url, ...cb,
              x_scale: `${BED_FILL}%`, y_scale: `${BED_FILL}%`,
              ...(horiz ? { x: rel(cb.x) } : { y: rel(cb.y) }),
              blur_radius: Math.round(Math.min(W, H) * 0.030), blur_mode: 'stack',
            }, it);
          })(),
          // The background's atmosphere, at its OWN size — not blown up with the
          // bed picture, which is why it is a sibling of that picture rather
          // than a child of it. It takes the same drift keyframes, so it travels
          // with the bed instead of with the card.
          ...(base && atmosphere ? (() => {
            const rel = (v) => bedSeq.map((k) => ({
              ...k, value: `${(v + (parseFloat(k.value) - 50)).toFixed(3)}%`,
            }));
            return [
              { name: `BedDust-${i + 1}`, type: 'image', source: `${base}/overlays/dust2.png`,
                width: '150%', height: '150%', x_anchor: '50%', y_anchor: '50%',
                ...(horiz ? { x: rel(50), y: '50%' } : { x: '50%', y: rel(50) }),
                blend_mode: 'screen', opacity: `${FX_DUST}%`, z_rotation: spin(life, -6) },
              { name: `BedLeak-${i + 1}`, type: 'image', source: `${base}/overlays/leak_epic${((i + 1) % 3) + 1}.png`,
                width: '150%', height: '150%', x_anchor: '50%', y_anchor: '50%',
                ...(horiz ? { x: rel(50), y: '50%' } : { x: '50%', y: rel(50) }),
                blend_mode: 'screen', opacity: leakCurve(life, Math.round(FX_LEAK * 0.7)) },
            ];
          })() : []),
          ] },
        // Constant now. It used to be ramped so it would not multiply over the
        // outgoing picture during the cross-fade; there is no cross-fade any
        // more, and the card clips, so it can only ever darken its own bed.
        { type: 'shape', path: rect, width: '100%', height: '100%',
          x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          fill_color: '#0B0B10', blend_mode: 'multiply', opacity: '22%' },
        box,
      ],
    });
  });

  // Atmosphere used to be three full-frame layers sitting on top of everything.
  // It is now built INSIDE each shot, next to the thing it belongs to — see the
  // ATMOSPHERE note above the shot loop for why.
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30,
    elements: slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) };
}

function basicCutSource({ S, seq, watermarkUrl, width: W, height: H, background, perPhoto = null }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const step = Math.max(0.4, perPhoto != null ? perPhoto : (Number(S.photoS) || 2.5));
  const total = Math.max(step, items.length * step);

  const elements = [];
  // The backdrop runs the whole length underneath, so a photo that does not
  // fill the frame has green behind it rather than black.
  bgLayers(background, S, { track: 1, time: 0, duration: +total.toFixed(3), shots: bedShotsFor(items, { step, lead: 0 }) }).forEach((el) => elements.push(el));

  items.forEach((it, i) => {
    const t0 = +(i * step).toFixed(3);
    if (it.green) { elements.push(greenSlot(i === 0 ? 'GreenIn' : `Green-${i + 1}`, t0, step, 4)); return; }
    const box = nativeBox(it, W, H, 1.0, 1.0);
    elements.push({
      name: `Cut-${i + 1}`, type: 'composition', track: 4,
      time: t0, duration: +step.toFixed(3),
      width: `${(box.w * 100).toFixed(3)}%`, height: `${(box.h * 100).toFixed(3)}%`,
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      // The image fills its own box exactly, so nothing is cropped and there is
      // nothing left to letterbox inside the box either.
      elements: [applyPhotoColor({
        type: 'image', source: it.url,
        width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        fit: 'contain',
      }, it)],
    });
  });

  if (watermarkUrl) {
    elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0,
      duration: Math.max(1, +(total - 0.1).toFixed(3)), width: '62%', height: '6.9%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  }

  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

// ---- SLIDING IMAGES --------------------------------------------------------
// One photo at a time at its native shape. A LANDSCAPE pushes in horizontally; a
// PORTRAIT pushes in vertically. The photo leaving does so on the axis of the
// photo ARRIVING, so a landscape→portrait change visibly turns the corner — the
// move is built from the next image, which is the whole point of the style.
function slidingImagesSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const n = items.length;
  const cardS = includeCards ? CARD_S : 0;
  const step = Math.max(0.6, perPhoto != null ? perPhoto : (Number(S.photoS) || 2.2));
  const SLIDE = Math.min(0.62, step * 0.38);
  const SETTLE = Math.min(0.18, SLIDE * 0.4);
  const start0 = cardS;
  const total = start0 + n * step + cardS;

  const plan = items.map((it, i) => ({
    it,
    axis: itIsPortrait(it) ? 'y' : 'x',
    dir: i % 2 === 0 ? 1 : -1,                       // deterministic alternation
    box: it.green ? { w: 1, h: 1 } : nativeBox(it, W, H, 0.88, 0.86),
  }));

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H, shots: bedShotsFor(items, { step, lead: start0 }) });
  const noShadow = backdropIsGreen(background, S);

  plan.forEach((p, i) => {
    const t0 = start0 + i * step;
    const track = 4 + (i % 2);                       // alternate so exits overlap entries
    if (p.it.green) { elements.push(greenSlot(i === 0 ? 'GreenIn' : `Green-${i + 1}`, t0, step, track)); return; }

    const nxt = plan[i + 1];
    const exits = !!(nxt && !nxt.it.green);
    const exitAxis = exits ? nxt.axis : p.axis;
    const exitDir = exits ? nxt.dir : p.dir;
    const dur = exits ? step + SLIDE : step;

    const axisKf = (axis) => {
      const entering = p.axis === axis && i > 0;     // the first photo hard-cuts in
      const leaving = exits && exitAxis === axis;
      if (!entering && !leaving) return null;
      const half = (axis === 'x' ? p.box.w : p.box.h) * 50;
      const off = (d) => +(50 + d * (50 + half + 3)).toFixed(2);
      const kf = [];
      if (entering) {
        kf.push({ time: 0, value: `${off(p.dir)}%`, easing: 'quadratic-out' });
        kf.push({ time: +SLIDE.toFixed(3), value: `${(50 - p.dir * 1.1).toFixed(2)}%`, easing: 'quadratic-out' });
        kf.push({ time: +(SLIDE + SETTLE).toFixed(3), value: '50%', easing: 'linear' });
      } else {
        kf.push({ time: 0, value: '50%', easing: 'linear' });
      }
      if (leaving) {
        kf.push({ time: +step.toFixed(3), value: '50%', easing: 'quadratic-in' });
        kf.push({ time: +(step + SLIDE).toFixed(3), value: `${off(-exitDir)}%` });
      }
      return kf;
    };

    const el = {
      name: `Slide-${i + 1}`, type: 'composition', track, time: +t0.toFixed(3), duration: +dur.toFixed(3),
      width: `${(p.box.w * 100).toFixed(2)}%`, height: `${(p.box.h * 100).toFixed(2)}%`,
      x_anchor: '50%', y_anchor: '50%', clip: true,
      x: axisKf('x') || '50%',
      y: axisKf('y') || '50%',
      // A slow push so the frame is never completely static going into a move
      // (Josh's standing rule: the underlayer must not freeze before a cut).
      x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: +dur.toFixed(3), value: '103.5%' }],
      y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: +dur.toFixed(3), value: '103.5%' }],
      elements: withBorder([applyPhotoColor({ type: 'image', source: p.it.url, ...coverBox(p.it, p.box.w * W, p.box.h * H) }, p.it)], p.it, p.box.w * W, p.box.h * H, Math.min(W, H)),
    };
    if (!noShadow) { el.shadow_color = '#00000055'; el.shadow_blur = '3vmin'; el.shadow_x = '0vmin'; el.shadow_y = '1vmin'; }
    elements.push(el);
  });

  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements: slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) };
}

// ---- MULTI SLIDE -----------------------------------------------------------
// Sliding Images, but with several photographs on screen at once and only ONE of
// them changing at a time. Josh: "3 across if it's 9x16, otherwise 2 across. I
// want the images to change staggered, so the transition happens 1 at a time
// left to right. the movement/transition can be from top, bottom, left side,
// right side."
//
// HOW THE ROTATION WORKS. Photo i lives in slot (i mod cols) and stays for a full
// cycle — cols beats — so at any moment you are looking at the last `cols`
// photographs. Every beat exactly one slot changes, and because the slot index
// advances by one each beat, the change walks left to right and wraps. There is
// no separate stagger parameter to tune: the rotation IS the stagger.
//
// HOW MANY ACROSS is decided once for the whole montage, from whether most of
// the photographs are portrait. Deciding it per group would mean the grid
// re-flowing mid-piece, and a layout that changes shape under you is a different
// and much louder effect than the one being asked for.
//
// NOTHING IS CROPPED. Each photo is CONTAINED in its slot at its own aspect, not
// cover-filled — Josh's standing rule for this pass ("Don't cut off any of the
// photos"). A portrait in a wide slot simply sits narrower than the slot, which
// is honest and reads fine against a background.
//
// THE SWAP IS A PUSH, INSIDE THE SLOT. The arriving photo enters from one edge of
// its own slot while the leaving one exits the opposite edge at the same speed,
// both clipped to the slot. They never overlap, so their draw order does not
// matter, and nothing ever crosses into a neighbouring slot. The edge rotates
// through right, top, left, bottom so consecutive swaps do not all move the same
// way.
const MULTI_DIRS = [{ a: 'x', d: 1 }, { a: 'y', d: -1 }, { a: 'x', d: -1 }, { a: 'y', d: 1 }];

function multiSlideSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const n = items.length;
  const cardS = includeCards ? CARD_S : 0;
  const step = Math.max(0.5, perPhoto != null ? perPhoto : (Number(S.photoS) || 1.9));
  const MOVE = Math.min(0.7, step * 0.44);
  const start0 = cardS;

  const photos = items.filter((it) => !it.green);
  const portraits = photos.filter((it) => itIsPortrait(it)).length;
  const cols = (photos.length && portraits * 2 > photos.length) ? 3 : 2;
  // THE TAIL. Every photo is on screen for a full cycle, so the last few need
  // (cols - 1) extra beats after the final one arrives or they would be cut
  // short and the grid would drain to an empty frame at the end — the last photo
  // would get a fraction of the time every other photo got.
  const total = start0 + (n + Math.max(0, cols - 1)) * step + cardS;

  const GAP = 0.022;
  const slotW = (1 - (cols + 1) * GAP) / cols;
  const slotH = 0.88;
  const slotCx = (c) => GAP + slotW * (c + 0.5) + GAP * c;

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H, shots: bedShotsFor(items, { step, lead: start0 }) });
  const noShadow = backdropIsGreen(background, S);

  items.forEach((it, i) => {
    const t0 = start0 + i * step;
    const col = i % cols;
    if (it.green) {
      // A green beat is a full-frame key window, not a cell — the whole point of
      // it is that Josh keys footage into a clean frame, so it covers the grid
      // rather than taking a slot in it. That means a track ABOVE every cell
      // track (4 .. 4 + cols*2), not one of them: verify caught it sharing T4
      // with a cell and overlapping it by 0.7s, which is an invalid timeline.
      elements.push(greenSlot(i === 0 ? 'GreenIn' : `Green-${i + 1}`, t0, step, 12 + (i % 2)));
      return;
    }

    // It holds for a full cycle, plus the move that pushes it out.
    const leaves = i + cols < items.length;
    const dur = Math.min(cols * step + (leaves ? MOVE : 0), total - t0);

    // Contain the photo inside the slot at its true aspect: no crop, ever.
    const fit = nativeBox(it, W, H, slotW, slotH);
    const inW = fit.w / slotW * 100;
    const inH = fit.h / slotH * 100;

    const enter = MULTI_DIRS[i % MULTI_DIRS.length];
    const exit = MULTI_DIRS[(i + cols) % MULTI_DIRS.length];
    // Off-slot positions, in the slot's own percentage space, with a little
    // margin so a shadow does not peek in before the photo does.
    const offIn = enter.d > 0 ? 50 + (50 + inW / 2 + 4) : 50 - (50 + inW / 2 + 4);
    const offInY = enter.d > 0 ? 50 + (50 + inH / 2 + 4) : 50 - (50 + inH / 2 + 4);
    const offOut = exit.d > 0 ? 50 - (50 + inW / 2 + 4) : 50 + (50 + inW / 2 + 4);
    const offOutY = exit.d > 0 ? 50 - (50 + inH / 2 + 4) : 50 + (50 + inH / 2 + 4);

    const kf = (axis) => {
      const entering = i >= cols && enter.a === axis;   // the first row hard-cuts in
      const leaving = leaves && exit.a === axis;
      if (!entering && !leaving) return null;
      const k = [];
      if (entering) {
        k.push({ time: 0, value: `${(axis === 'x' ? offIn : offInY).toFixed(2)}%`, easing: 'quadratic-out' });
        k.push({ time: +MOVE.toFixed(3), value: '50%', easing: 'linear' });
      } else {
        k.push({ time: 0, value: '50%', easing: 'linear' });
      }
      if (leaving) {
        k.push({ time: +(cols * step).toFixed(3), value: '50%', easing: 'quadratic-in' });
        k.push({ time: +(cols * step + MOVE).toFixed(3), value: `${(axis === 'x' ? offOut : offOutY).toFixed(2)}%` });
      }
      return k;
    };

    const img = withBorder(
      [applyPhotoColor({ type: 'image', source: it.url, ...coverBox(it, fit.w * W, fit.h * H) }, it)],
      it, fit.w * W, fit.h * H, Math.min(W, H),
    );
    const inner = {
      type: 'composition', clip: true,
      width: `${inW.toFixed(2)}%`, height: `${inH.toFixed(2)}%`,
      x_anchor: '50%', y_anchor: '50%',
      x: kf('x') || '50%', y: kf('y') || '50%',
      // The same slow push the rest of this family uses, so a held slot is never
      // completely frozen while its neighbours are moving.
      x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: +dur.toFixed(3), value: '103%' }],
      y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: +dur.toFixed(3), value: '103%' }],
      elements: img,
    };
    if (!noShadow) { inner.shadow_color = '#00000055'; inner.shadow_blur = '2.6vmin'; inner.shadow_x = '0vmin'; inner.shadow_y = '0.9vmin'; }

    elements.push({
      name: `Multi-${i + 1}`, type: 'composition', clip: true,
      // Two tracks per column, so the photo arriving in a slot and the one
      // leaving it are never asked to share a lane.
      track: 4 + (col * 2) + (Math.floor(i / cols) % 2),
      time: +t0.toFixed(3), duration: +dur.toFixed(3),
      width: `${(slotW * 100).toFixed(2)}%`, height: `${(slotH * 100).toFixed(2)}%`,
      x: `${(slotCx(col) * 100).toFixed(2)}%`, y: '50%', x_anchor: '50%', y_anchor: '50%',
      elements: [inner],
    });
  });

  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements: slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) };
}

// ---- PHOTO SLIDE -----------------------------------------------------------
// Bordered prints travel across a rail: each print enters from the right, settles
// centre with a small tilt, and is pushed off left by the next. The PRINT is cut
// to the photo's own shape — a 9:16 arrives as a tall print, a 16:9 as a wide
// one — so the rail visibly changes shape as the sequence plays.
// NOTE: an interpretation, not a port of Josh's Creatomate "Polaroid Photos"
// template (its source JSON was never available). Border proportions are the
// first thing to correct once it is.
function photoSlideSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const n = items.length;
  const cardS = includeCards ? CARD_S : 0;
  const step = Math.max(0.6, perPhoto != null ? perPhoto : (Number(S.photoS) || 2.4));
  const SLIDE = Math.min(0.7, step * 0.42);
  const SETTLE = Math.min(0.2, SLIDE * 0.38);
  const start0 = cardS;
  const total = start0 + n * step + cardS;

  // Border thickness: equal in PIXELS on every side, so it is a fraction of the
  // frame WIDTH horizontally and a (scaled) fraction of the HEIGHT vertically.
  const BW = 0.013;
  const BH = BW * (W / H);
  const BOTTOM = 1.9;               // print rail under the photo, as a multiple

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H, shots: bedShotsFor(items, { step, lead: start0 }) });
  const noShadow = backdropIsGreen(background, S);

  items.forEach((it, i) => {
    const t0 = start0 + i * step;
    const track = 4 + (i % 2);
    if (it.green) { elements.push(greenSlot(i === 0 ? 'GreenIn' : `Green-${i + 1}`, t0, step, track)); return; }

    // 0.88/0.84 rather than 0.78/0.72 — Josh wants the picture larger, and this
    // style never crops (nativeBox gives the card the photo's own aspect, so
    // coverBox has nothing left to trim). Bigger here means bigger picture, not
    // a tighter crop.
    const ph = nativeBox(it, W, H, 0.88, 0.84);
    const cw = ph.w + 2 * BW;
    const ch = ph.h + BH * (1 + BOTTOM);
    const nxt = items[i + 1];
    const exits = !!(nxt && !nxt.green);
    const dur = exits ? step + SLIDE : step;
    const half = cw * 50;
    // THE PRINTS TOUCH. Josh: "have the transition tighter so that the 2 photos
    // actually make contact when switching."
    //
    // The incoming print used to start 3% beyond the frame edge, which on a
    // typical card left a gap of about an eighth of the frame between the two —
    // they passed each other with daylight in between and it read as two
    // separate moves. It now starts exactly one card-width to the right of the
    // outgoing one, so their edges are in contact at the instant the move
    // begins, and the two travel together at the same speed for the first part
    // of the slide: the arriving print visibly PUSHES the leaving one.
    //
    // They cannot stay in contact the whole way — the outgoing has to cover half
    // a frame plus half a card to clear the edge, which is further than one card
    // width — so the leaving print accelerates away in the back half. The touch
    // is at the start, which is the moment you actually read.
    const offR = +(50 + 2 * half).toFixed(2);
    const offL = +(50 - (50 + half + 3)).toFixed(2);
    const tilt = (i % 2 === 0 ? 1 : -1) * 1.5;
    const TOUCH = 0.55;                              // how long they travel as a pair

    const xk = [];
    if (i > 0) {                                     // first print hard-cuts in
      xk.push({ time: 0, value: `${offR}%`, easing: 'linear' });
      xk.push({ time: +SLIDE.toFixed(3), value: '48.9%', easing: 'quadratic-out' });
      xk.push({ time: +(SLIDE + SETTLE).toFixed(3), value: '50%', easing: 'linear' });
    } else {
      xk.push({ time: 0, value: '50%', easing: 'linear' });
    }
    if (exits) {
      // Matched velocity while they are touching, then away.
      const together = +(50 - TOUCH * 2 * half).toFixed(2);
      xk.push({ time: +step.toFixed(3), value: '50%', easing: 'linear' });
      xk.push({ time: +(step + SLIDE * TOUCH).toFixed(3), value: `${together}%`, easing: 'quadratic-in' });
      xk.push({ time: +(step + SLIDE).toFixed(3), value: `${offL}%` });
    }

    // "Resizing larger toward us" — the print creeps toward the viewer through
    // its hold, then settles back as it leaves, so it is never quite static.
    const zk = [
      { time: +(i > 0 ? SLIDE + SETTLE : 0).toFixed(3), value: '100%', easing: GLASS_EASE },
      { time: +step.toFixed(3), value: '106.5%', easing: GLASS_EASE },
    ];
    if (exits) zk.push({ time: +(step + SLIDE).toFixed(3), value: '101%' });

    // Photo inside the print, in the card's local 0..100 space.
    const pw = ph.w / cw * 100;
    const phh = ph.h / ch * 100;
    const el = {
      name: `Print-${i + 1}`, type: 'composition', track, time: +t0.toFixed(3), duration: +dur.toFixed(3),
      width: `${(cw * 100).toFixed(2)}%`, height: `${(ch * 100).toFixed(2)}%`,
      x_anchor: '50%', y_anchor: '50%',
      x: xk.length > 1 ? xk : '50%', y: '50%',
      x_scale: zk, y_scale: zk,
      z_rotation: [
        { time: 0, value: `${(tilt * 2.2).toFixed(2)}°`, easing: 'quadratic-out' },
        { time: +(SLIDE + SETTLE).toFixed(3), value: `${tilt.toFixed(2)}°` },
      ],
      elements: [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
          path: roundedRect(1.6, 1.6 * (cw * W) / (ch * H)), fill_color: '#FAF7F0' },
        {
          type: 'composition', clip: true,
          width: `${pw.toFixed(2)}%`, height: `${phh.toFixed(2)}%`,
          x: '50%', y: `${(BH / ch * 100).toFixed(2)}%`, x_anchor: '50%', y_anchor: '0%',
          elements: withBorder([applyPhotoColor({ type: 'image', source: it.url, ...coverBox(it, ph.w * W, ph.h * H) }, it)], it, ph.w * W, ph.h * H, Math.min(W, H)),
        },
      ],
    };
    if (!noShadow) { el.shadow_color = '#00000055'; el.shadow_blur = '3.5vmin'; el.shadow_x = '0vmin'; el.shadow_y = '1.2vmin'; }
    elements.push(el);
  });

  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements: slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) };
}

// ---- PHOTO RIBBON ----------------------------------------------------------
// Every photo is laid out on one long horizontal strip at its NATIVE shape, and
// the strip slides one photo per beat. Because the cards are different widths,
// the distance the ribbon travels each beat is set by the photo arriving — and
// you can SEE the next photo waiting at the edge of frame before it arrives.
// Green beats sit outside the ribbon as clean full-frame key windows.
function photoRibbonSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null }) {
  const all = seq.filter((it) => it.type !== 'placeholder');
  const photos = all.filter((it) => !it.green);
  const headGreen = all.length > 0 && !!all[0].green;
  const tailGreen = all.length > 1 && !!all[all.length - 1].green;
  const cardS = includeCards ? CARD_S : 0;
  const step = Math.max(0.6, perPhoto != null ? perPhoto : (Number(S.photoS) || 2.2));
  const MOVE = Math.min(1.0, step * 0.46);
  const GAP = 0.045;

  // 0.64/0.82 rather than 0.60/0.78 — the hero wants to be big, and the
  // push-toward-the-viewer below takes it further still. It cannot go much wider
  // than this without pushing its neighbours off the frame, and seeing the next
  // photo waiting at the edge is the whole point of a ribbon.
  const boxes = photos.map((it) => nativeBox(it, W, H, 0.64, 0.82));
  // How far the centred card creeps toward the viewer during its hold. Josh:
  // "have the hero shot always moving. resizing larger toward the screen then
  // retreating to transition." It used to sit at a flat 100% for its whole beat,
  // which on a strip that is itself stationary between moves meant the frame was
  // completely still for most of the montage.
  const HERO_PUSH = 112;
  const cx = [];
  boxes.forEach((b, i) => { cx.push(i === 0 ? b.w / 2 : cx[i - 1] + (boxes[i - 1].w + b.w) / 2 + GAP); });

  const ribbonDur = photos.length * step;
  const headDur = headGreen ? step : 0;
  const tailDur = tailGreen ? step : 0;
  const ribbonStart = cardS + headDur;
  const total = cardS + headDur + ribbonDur + tailDur + cardS;

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H });
  const onGreen = backdropIsGreen(background, S);
  const noShadow = onGreen;
  // Green beats sit BELOW the title cards (track 20) so a boundary frame can
  // never cover the closing card.
  if (headGreen) elements.push(greenSlot('GreenIn', cardS, headDur, 5));

  if (photos.length) {
    const xk = [];
    photos.forEach((_, i) => {
      const p = 50 - cx[i] * 100;
      xk.push({ time: +(i * step).toFixed(3), value: `${p.toFixed(2)}%`, easing: 'linear' });
      xk.push({ time: +((i + 1) * step - MOVE).toFixed(3), value: `${p.toFixed(2)}%`, easing: 'quadratic-in-out' });
    });

    const cards = photos.map((it, i) => {
      const b = boxes[i];
      const sk = [];
      const ok = [];
      // OFF-CENTRE PHOTOS ARE DE-EMPHASISED BY SIZE, AND — ONLY WHEN THERE IS A
      // REAL BACKGROUND IMAGE — BY OPACITY. On chroma green a half-transparent photo
      // blends with the green and stops keying cleanly, so on green the
      // neighbours stay fully opaque and scale alone does the work.
      const DIM = onGreen ? '100%' : '52%';
      // The centred card grows toward the viewer across its whole beat and is
      // back at 100% by the moment the strip starts moving again, so the push
      // reads as the photograph coming forward and then retreating into the
      // transition rather than as a size change at the cut.
      if (i === 0) { sk.push({ time: 0, value: '100%', easing: GLASS_EASE }); ok.push({ time: 0, value: '100%', easing: 'linear' }); }
      else {
        sk.push({ time: +Math.max(0, i * step - MOVE).toFixed(3), value: '72%', easing: 'quadratic-in-out' });
        sk.push({ time: +(i * step).toFixed(3), value: '100%', easing: GLASS_EASE });
        ok.push({ time: +Math.max(0, i * step - MOVE).toFixed(3), value: DIM, easing: 'quadratic-in-out' });
        ok.push({ time: +(i * step).toFixed(3), value: '100%', easing: 'linear' });
      }
      if (i < photos.length - 1) {
        // Peak just before the strip moves, then retreat into the move itself.
        sk.push({ time: +((i + 1) * step - MOVE).toFixed(3), value: `${HERO_PUSH}%`, easing: 'quadratic-in-out' });
        sk.push({ time: +((i + 1) * step).toFixed(3), value: '72%' });
        ok.push({ time: +((i + 1) * step - MOVE).toFixed(3), value: '100%', easing: 'quadratic-in-out' });
        ok.push({ time: +((i + 1) * step).toFixed(3), value: DIM });
      } else {
        // The last photo has no move to retreat into, so it simply keeps coming.
        sk.push({ time: +(photos.length * step).toFixed(3), value: `${HERO_PUSH}%` });
      }
      const el = {
        name: `Ribbon-${i + 1}`, type: 'composition', clip: true,
        width: `${(b.w * 100).toFixed(2)}%`, height: `${(b.h * 100).toFixed(2)}%`,
        x: `${(cx[i] * 100).toFixed(2)}%`, y: '50%', x_anchor: '50%', y_anchor: '50%',
        x_scale: sk, y_scale: sk, ...(onGreen ? {} : { opacity: ok }),
        elements: withBorder([applyPhotoColor({ type: 'image', source: it.url, ...coverBox(it, b.w * W, b.h * H) }, it)], it, b.w * W, b.h * H, Math.min(W, H)),
      };
      if (!noShadow) { el.shadow_color = '#00000055'; el.shadow_blur = '3vmin'; el.shadow_x = '0vmin'; el.shadow_y = '1vmin'; }
      return el;
    });

    elements.push({
      name: 'Ribbon', type: 'composition', track: 4, time: +ribbonStart.toFixed(3), duration: +ribbonDur.toFixed(3),
      width: '100%', height: '100%', x: xk, y: '50%', x_anchor: '0%', y_anchor: '50%',
      elements: cards,
    });
  }
  if (tailGreen) elements.push(greenSlot('GreenOut', ribbonStart + ribbonDur, tailDur, 5));

  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements: slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) };
}

// ---- COMIC BOOK ------------------------------------------------------------
// Josh's idea, verbatim: "changes the photo to a comic then transitions to a new
// picture in comic that transitions to the real image then back to comic to
// transition again". So the MOVES happen in comic, and the real photograph is
// the payoff in the middle of each beat:
//
//   arrives as comic -> inks dissolve away to the real photo -> holds ->
//   re-inks to comic -> the comic panel moves off and the next arrives.
//
// HOW THE COMIC IS MADE — this is the honest part. Creatomate CANNOT posterize
// or find edges: color_filter is only brighten/contrast/invert/grayscale/sepia
// (confirmed from the official SDK's ColorFilterType). A real comic conversion
// therefore has to be a SECOND IMAGE, produced before the render. The portal
// already depends on `sharp`, so the same flatten -> quantise -> ink pipeline can
// run server-side at render-prep time and be cached in R2 beside the original.
//
// This builder takes that second image as `it.altUrl` and works properly the
// moment the pipeline supplies it. WITHOUT altUrl it degrades honestly: the
// "comic" phase becomes a hard-contrast, halftone-screened, panel-bordered
// treatment of the same photo. That reads as stylised, NOT as comic art — do not
// pretend otherwise when showing it.
//
// The halftone screen and the panel border ARE done live: `repeat: true` turns a
// small dot tile into a pattern fill (also confirmed in the SDK), so the dot
// screen costs nothing and needs no pre-processing.
// ---- COMIC BOOK, REBUILT AS A BOOK -----------------------------------------
// Josh, on render 012: "this is meant to look like an actual comic book turning
// through the pages and moving through the animated panels in the magazine."
//
// What was there was one panel at a time, centred, with the comic treatment
// switching on and off. Nothing about it was a book. This version is:
//
//   A PAGE. A sheet of comic paper with a black keyline, holding two to four
//   PANELS in a proper comic grid with gutters between them. Every photograph on
//   a page is on screen at the same time, which is what reading a comic looks
//   like — you see the whole page and your eye travels it.
//
//   PANELS THAT ARRIVE IN READING ORDER. Each panel inks on a beat after the one
//   before, left to right and top to bottom, so the eye is led across the page
//   the way a comic leads it.
//
//   A PAGE TURN. The finished page pivots on its LEFT EDGE and swings away to
//   reveal the next one underneath, using y_rotation about x_anchor 0% with
//   perspective. Both of those are proven in this engine — they are what makes
//   the Glass panes stand in a room — so this is a real turn, not a wipe
//   pretending to be one. The paper darkens as it turns away from the light.
//
// PANEL SHAPES FOLLOW THE PHOTOGRAPHS. A page of two portraits is two tall
// panels side by side; two landscapes stack; a mixed page puts the landscape
// across the top and the portraits beneath it. Nothing is cropped to fit a grid
// — each photo is CONTAINED in its panel at its own aspect, per the standing
// rule for this pass, and the panel keeps the comic paper visible around it
// where the shapes do not match, which is exactly what a real comic does.
//
// NOT RENDER-VERIFIED. The page turn's geometry is read off the same properties
// Glass uses. If y_rotation about a left anchor behaves differently from
// y_rotation about a centre anchor, the turn will look wrong and the fix is the
// anchor, not the idea.

const COMIC_PAPER = '#F6EFE0';
const COMIC_INK = '#141018';

// Lay out one page of panels. Returns boxes in fractions of the page.
//
// THE PROBLEM THIS SOLVES. Nothing may be cropped (Josh's standing rule for this
// pass), so the panels have to tile a fixed rectangle using each photograph's own
// aspect ratio — which in general is impossible, and the difference shows up as
// bare paper. The first two attempts left half the page empty: a fixed grid left
// portraits floating in wide cells, and justified ROWS left a landscape photo as
// a short wide band with big margins either side.
//
// So: try several packings and keep whichever covers the most paper. Rows and
// COLUMNS are tried for every sensible split, because in a 16:9 frame they fail
// in opposite directions — rows waste width on landscape photos, columns waste
// height on them — and one of the two is nearly always close. On the worked
// example (a landscape plus two more) rows covered 49% of the page and columns
// 69%, and the difference is the whole look of it.
//
// `pageAspect` is the page's ON-SCREEN width/height, which converts a photo's
// aspect into page-local units.
function comicPageGrid(items, pageAspect) {
  const G = 0.026;
  const AR = items.map((it) => {
    const a = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 1.5;
    return Math.min(3.2, Math.max(0.35, a));   // one freak shape must not own the page
  });
  const n = items.length;
  const avail = 1 - 2 * G;

  // Contiguous splits of n into groups of 1..3, so play order is preserved —
  // a comic is read in order and shuffling the photos would break that.
  const splits = (k) => {
    if (k <= 0) return [[]];
    const out = [];
    for (let take = 1; take <= Math.min(3, k); take++) {
      for (const rest of splits(k - take)) out.push([take, ...rest]);
    }
    return out;
  };

  // Lay out `groups` as bands. In 'row' mode a band is a row (common height,
  // widths from aspect); in 'col' mode a band is a column (common width, heights
  // from aspect). The two are the same solve with the axes swapped.
  const pack = (groups, mode) => {
    const bands = [];
    let idx = 0;
    for (const g of groups) {
      const ars = AR.slice(idx, idx + g); idx += g;
      const gut = (g - 1) * G;
      if (mode === 'row') {
        const sumA = ars.reduce((m, a) => m + a, 0);
        const h = ((avail - gut) * pageAspect) / sumA;          // full-width row
        bands.push({ h, sizes: ars.map((a) => (h * a) / pageAspect) });
      } else {
        const sumInv = ars.reduce((m, a) => m + 1 / a, 0);
        const w = (avail - gut) / (pageAspect * sumInv);        // full-height column
        bands.push({ w, sizes: ars.map((a) => (w * pageAspect) / a) });
      }
    }
    const across = bands.reduce((m, b) => m + (mode === 'row' ? b.h : b.w), 0) + (bands.length - 1) * G;
    const scale = across > avail ? avail / across : 1;
    const boxes = [];
    let cover = 0;
    const blockAcross = across * scale;
    let a0 = (1 - blockAcross) / 2;
    idx = 0;
    for (const b of bands) {
      const thick = (mode === 'row' ? b.h : b.w) * scale;
      const along = b.sizes.map((v) => v * scale);
      const runLen = along.reduce((m, v) => m + v, 0) + (along.length - 1) * G;
      let a1 = (1 - runLen) / 2;
      for (const v of along) {
        boxes.push(mode === 'row'
          ? { x: a1, y: a0, w: v, h: thick }
          : { x: a0, y: a1, w: thick, h: v });
        cover += v * thick;
        a1 += v + G;
        idx++;
      }
      a0 += thick + G;
    }
    return { boxes, cover };
  };

  // Coverage alone is not the whole story. The densest packing is often one that
  // gives a photograph a panel a sixth the size of its neighbour's — on the
  // worked example, 21% x 15% next to 71% x 84%. Comics do vary panel size, but
  // not by that much, and Josh's standing note for this pass is that the main
  // image needs to be LARGE. So the score trades a little coverage for evenness:
  // a packing whose smallest panel is a quarter of its largest is worth about
  // two thirds of the same coverage spread evenly.
  const score = (r) => {
    const areas = r.boxes.map((b) => b.w * b.h);
    const balance = Math.min(...areas) / Math.max(...areas);
    return r.cover * Math.pow(balance, 0.22);
  };
  let best = null, bestScore = -1;
  for (const g of splits(n)) {
    for (const mode of ['row', 'col']) {
      const r = pack(g, mode);
      const sc = score(r);
      if (sc > bestScore) { best = r; bestScore = sc; }
    }
  }
  return best.boxes;
}

// How many photos go on a page. Portraits pair up two or four to a page;
// landscapes read better one or two at a time so they can be big.
function comicPageSize(rest) {
  const avail = rest.length;
  if (avail <= 2) return avail;
  const p = rest.slice(0, 4).filter((it) => itIsPortrait(it)).length;
  if (p >= 3 && avail >= 4) return 4;
  if (avail >= 3) return 3;
  return 2;
}

function comicBookSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, assetBase, perPhoto = null }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const cardS = includeCards ? CARD_S : 0;
  const beat = Math.max(0.7, perPhoto != null ? perPhoto : (Number(S.photoS) || 3.0));
  const INK = Math.min(0.42, beat * 0.30);       // one panel inking on
  const TURN = Math.min(1.0, beat * 0.55);       // the page turn
  const dots = assetBase ? `${assetBase}/overlays/halftone.png` : null;
  const onGreen = backdropIsGreen(background, S);

  // Group the play sequence into pages. A green beat is never part of a page —
  // it is a full-frame key window and it gets its own slot.
  const pages = [];
  for (let i = 0; i < items.length;) {
    if (items[i].green) { pages.push({ green: true, items: [items[i]] }); i += 1; continue; }
    const run = [];
    while (i < items.length && !items[i].green && run.length < 4) run.push(items[i++]);
    let k = 0;
    while (k < run.length) {
      const size = comicPageSize(run.slice(k));
      pages.push({ green: false, items: run.slice(k, k + size) });
      k += size;
    }
  }
  if (!pages.length) pages.push({ green: false, items: [] });

  // A page is held for one beat per panel, so a four-panel page stays up twice
  // as long as a two-panel one — the reader has twice as much to look at.
  const pageDur = (pg) => (pg.green ? beat : Math.max(beat, pg.items.length * beat * 0.72));
  const starts = [];
  let t = cardS;
  for (const pg of pages) { starts.push(t); t += pageDur(pg); }
  const total = t + cardS;

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H });

  // THE PAGE IS AN OPEN SPREAD, NOT A SINGLE LEAF.
  //
  // The first build made the page a portrait comic page — the right shape for a
  // comic, and completely the wrong shape for a 16:9 frame: it came out 40% of
  // the frame wide with green either side of it, which is the opposite of "the
  // main image needs to be large". An open comic book is a landscape spread, and
  // a spread is close enough to 16:9 to fill the frame. It is also the more
  // honest picture of "turning through the pages", because turning a page is
  // something you do to a book that is open in front of you.
  const pageH = 0.94, pageW = 0.94;

  pages.forEach((pg, pi) => {
    const t0 = starts[pi];
    const dur = pageDur(pg);
    const last = pi === pages.length - 1;
    // Green beats sit ABOVE every page track (14/15), because a key window has
    // to be a clean full frame — a page turning underneath it must not show
    // through at the edges.
    if (pg.green) { elements.push(greenSlot(pi === 0 ? 'GreenIn' : `Green-${pi + 1}`, t0, dur, 17)); return; }
    const nextIsGreen = !!(pages[pi + 1] && pages[pi + 1].green);

    const grid = comicPageGrid(pg.items, (pageW * W) / (pageH * H));
    const inner = [];
    // The paper.
    inner.push({ type: 'shape', path: roundedRect(0.6, 0.6 * (pageW * W) / (pageH * H)),
      x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      fill_color: COMIC_PAPER });

    pg.items.forEach((it, k) => {
      // The box already IS the photograph's shape — comicPageGrid solved for it —
      // so the picture fills its panel exactly and nothing is cropped.
      const c = grid[k] || grid[grid.length - 1];
      const fit = { w: 1, h: 1 };
      const inkAt = k * INK * 1.35;
      const on = [
        { time: 0, value: '0%', easing: 'linear' },
        { time: +inkAt.toFixed(3), value: '0%', easing: 'quadratic-out' },
        { time: +(inkAt + INK).toFixed(3), value: '100%' },
      ];
      const panelEls = [
        // Panel ground, so an uncropped photo that does not fill its panel sits
        // on ink rather than on bare paper.
        { type: 'shape', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', x: '50%', y: '50%',
          width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', fill_color: '#E6DCC8' },
        applyPhotoColor({
          type: 'image', source: it.url,
          width: `${(fit.w * 100).toFixed(2)}%`, height: `${(fit.h * 100).toFixed(2)}%`,
          x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', fit: 'cover',
          color_filter: 'contrast', color_filter_value: 34,
        }, it),
      ];
      if (dots) {
        panelEls.push({ type: 'image', source: dots, repeat: true, x: '50%', y: '50%',
          width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
          blend_mode: 'multiply', opacity: '20%' });
      }
      // The panel keyline.
      panelEls.push({ type: 'shape', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
        x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
        fill_color: 'rgba(0,0,0,0)', stroke_color: COMIC_INK, stroke_width: '1.1vmin',
        stroke_join: 'miter' });

      // The panel INKS ON and then keeps moving. Josh: "moving through the
      // animated panels in the magazine." A page of stills that simply appears
      // is a page; a page whose panels are each drifting at their own rate is
      // one you read. Every panel pushes in slightly, and the odd ones pull the
      // other way, so no two are in step.
      const dir = k % 2 ? -1 : 1;
      const push = [
        { time: +inkAt.toFixed(3), value: '104%', easing: 'quadratic-out' },
        { time: +(inkAt + INK).toFixed(3), value: '100%', easing: 'linear' },
        // Ends a hair inside the panel's life rather than exactly on it. In
        // length mode the whole montage is rescaled and every time is rounded to
        // three places independently, and verify caught a last keyframe landing
        // 0.11s past its element's duration — at which point the animation
        // simply never arrives. A keyframe on the boundary has nothing to gain
        // and this has nothing to lose.
        // 0.92, not 0.96. At a 48s total the panel's effective duration comes
        // out at 6.272 while `dur` here is 6.556, so 0.96 landed 0.022s past the
        // end and the push never arrived. The margin has to cover the gap
        // between this `dur` and the duration the element actually inherits.
        { time: +(dur * 0.92).toFixed(3), value: `${(100 + dir * 3.2).toFixed(1)}%` },
      ];
      inner.push({
        name: `Panel-${pi + 1}-${k + 1}`, type: 'composition', clip: true,
        x: `${((c.x + c.w / 2) * 100).toFixed(2)}%`, y: `${((c.y + c.h / 2) * 100).toFixed(2)}%`,
        width: `${(c.w * 100).toFixed(2)}%`, height: `${(c.h * 100).toFixed(2)}%`,
        x_anchor: '50%', y_anchor: '50%',
        opacity: on,
        elements: panelEls.map((e, ei) => (ei === 1 ? { ...e, x_scale: push, y_scale: push } : e)),
      });
    });

    // THE PAGE TURN. The page pivots on its left edge and swings away, revealing
    // the page beneath. Anchored at 0% so the spine stays put.
    const el = {
      name: `Page-${pi + 1}`, type: 'composition',
      // Pages alternate tracks so the one turning is always ABOVE the one being
      // revealed, whichever way round they fall.
      track: 14 + (pi % 2),
      time: +t0.toFixed(3), duration: +(dur + (last || nextIsGreen ? 0 : TURN)).toFixed(3),
      width: `${(pageW * 100).toFixed(2)}%`, height: `${(pageH * 100).toFixed(2)}%`,
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      perspective: Math.round(W * 1.15),
      elements: inner,
    };
    // No point turning a page into a green key window — the green covers the
    // frame anyway, so the turn would happen behind it and simply be lost.
    if (!last && !nextIsGreen) {
      el.y_rotation = [
        { time: 0, value: '0°', easing: 'linear' },
        { time: +dur.toFixed(3), value: '0°', easing: 'quadratic-in' },
        { time: +(dur + TURN).toFixed(3), value: '-104°' },
      ];
      // The paper turns away from the light as it goes.
      el.opacity = [
        { time: 0, value: '100%', easing: 'linear' },
        { time: +(dur + TURN * 0.72).toFixed(3), value: '100%', easing: 'quadratic-in' },
        { time: +(dur + TURN).toFixed(3), value: '0%' },
      ];
    }
    if (!onGreen) { el.shadow_color = '#00000055'; el.shadow_blur = '3vmin'; el.shadow_x = '0.6vmin'; el.shadow_y = '1vmin'; }
    elements.push(el);
  });

  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements: slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) };
}

// ---- NEON FRAME ------------------------------------------------------------
// A tube of neon is drawn around each photo's own edge, and a bright light runs
// all the way round the perimeter once per photo. Because the frame is cut to
// the photo's real shape, the light traces a wide rectangle on a landscape and a
// tall one on a portrait — the frame changes shape with the picture.
//
// The travelling light is a real path trim, not a fake: Creatomate shapes take
// stroke_start / stroke_end / stroke_offset ("relative to its total length"), so
// a short arc of the perimeter stroke is drawn and its offset is keyframed from
// 0% to 100%. Three stacked strokes make the neon read: a wide blurred colour
// halo, a mid colour tube, and a thin near-white core.
//
// DEFAULTS TO A DARK BACKDROP, NOT GREEN — a glow is light spilling onto its
// surroundings, and screen-blended spill over chroma green pollutes the key. The
// background control still works if you want green; expect the halo not to key.
//
// UNVERIFIED: stroke trimming, and whether blur_radius + blend_mode 'screen' on
// a stroked shape reads as a glow in the render. Both are first-draft items.
const NEON_COLOURS = ['#00E5FF', '#FF2D95', '#7CFF3D', '#FFD23A', '#B14DFF', '#FF6A3D'];
function neonFrameSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const n = items.length;
  const cardS = includeCards ? CARD_S : 0;
  const step = Math.max(0.8, perPhoto != null ? perPhoto : (Number(S.photoS) || 2.6));
  const FADE = Math.min(0.6, step * 0.26);
  const start0 = cardS;
  const total = start0 + n * step + cardS;
  const ARC = 9;          // length of the travelling light, % of the perimeter
  const HALO = 15;        // its blurred halo is a little longer

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H, shots: bedShotsFor(items, { step, lead: start0 }) });

  items.forEach((it, i) => {
    const t0 = start0 + i * step;
    const track = 4 + (i % 2);
    if (it.green) { elements.push(greenSlot(i === 0 ? 'GreenIn' : `Green-${i + 1}`, t0, step, track)); return; }

    const box = nativeBox(it, W, H, 0.86, 0.86);
    const neon = NEON_COLOURS[i % NEON_COLOURS.length];
    const last = i === items.length - 1;
    const dur = last ? step : step + FADE;
    // THE TUBE SITS ON THE PICTURE'S EDGE. Josh on render 011: "the frame is not
    // on the edge of the pic. needs to be."
    //
    // It was drawn at 96% of the card with a 2.4-unit corner radius, so on a
    // 1500px-wide photo about thirty pixels of picture stood outside the neon on
    // every side and the rounded corners cut across the photo's square ones. It
    // read as a glowing rectangle sitting ON a photo rather than as the
    // photograph's own frame.
    //
    // Now 100% with a nearly square corner, so the tube's centre line runs along
    // the picture's actual edge and half the glow falls outside it — which is
    // what a real tube mounted round a print does.
    const ring = (extra) => ({
      type: 'shape', path: roundedRect(0.7, 0.7 * (box.w * W) / (box.h * H)),
      x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      fill_color: 'rgba(0,0,0,0)', stroke_cap: 'round', stroke_join: 'round', ...extra,
    });
    // ACCENT SPLASHES in the dead space beside the photograph. Josh: "add some
    // exterior accent neon stripes around the dead space in the image. maybe off
    // to the side but mimicking the trace of the pic. but just for splashes. A
    // line up the side. then stops then comes back for the right turn of the edge
    // and disappears."
    //
    // So they are the SAME rounded-rectangle path, drawn larger than the photo
    // and trimmed to a short run of it — a piece of the outline standing off the
    // picture. Each is a fixed segment (they do not travel; the travelling light
    // on the frame itself already does that) that fades up, holds and goes.
    // `at` and `len` are percentages around the perimeter, so a segment lands on
    // the same part of the outline whatever shape the photo is.
    //
    // WHERE THE PATH STARTS is roundedRect's business and is not something I have
    // confirmed against a render, so the two segments below are placed a quarter
    // of the perimeter apart rather than at named corners. If they come out on
    // the wrong sides, the fix is to shift `at` — the shape of the effect is
    // right either way.
    const splash = (scale, at, len, t1, t2, width) => ({
      type: 'shape', path: roundedRect(0.7, 0.7 * (box.w * W) / (box.h * H)),
      x: '50%', y: '50%', width: `${scale}%`, height: `${scale}%`,
      x_anchor: '50%', y_anchor: '50%',
      fill_color: 'rgba(0,0,0,0)', stroke_cap: 'round', stroke_join: 'round',
      stroke_color: neon, stroke_width: width, blend_mode: 'screen',
      // NOT blurred — see the note on the rim in glassPane. A stroked shape with
      // a transparent-black fill comes out of a blur grey rather than bright.
      stroke_start: `${at}%`, stroke_end: `${at + len}%`,
      opacity: [
        { time: 0, value: '0%', easing: 'linear' },
        { time: +t1.toFixed(3), value: '0%', easing: 'quadratic-out' },
        { time: +(t1 + 0.26).toFixed(3), value: '78%', easing: 'linear' },
        { time: +t2.toFixed(3), value: '78%', easing: 'quadratic-in' },
        { time: +(t2 + 0.34).toFixed(3), value: '0%' },
      ],
    });
    const travel = (off) => [
      { time: 0, value: '0%', easing: 'linear' },
      { time: +dur.toFixed(3), value: `${off}%` },
    ];

    elements.push({
      name: `Neon-${i + 1}`, type: 'composition', track, time: +t0.toFixed(3), duration: +dur.toFixed(3),
      width: `${(box.w * 100).toFixed(2)}%`, height: `${(box.h * 100).toFixed(2)}%`,
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      // WHY THIS IS AN OPACITY RAMP AND NOT A `transition: true` FADE.
      //
      // It used to be { time:'start', duration:FADE, transition:true, type:'fade' },
      // and that is why Neon Frame measured SEVEN HARD CUTS OUT OF NINE on
      // 2026-09-03 while Sliding Images measured one and Two Panel none.
      //
      // A Creatomate transition is a SAME-TRACK construct: it blends an element
      // with the element before it IN ITS OWN LANE. These shots alternate
      // between two tracks so their pictures can overlap at all, which means the
      // element a shot is meant to dissolve FROM is in the other lane. The
      // transition had no partner, so it did nothing and the shot appeared.
      //
      // Its siblings get away with no transition because their pictures MOVE —
      // a slide covers the swap by itself. Neon Frame holds still, so the blend
      // has to be explicit. This is the construction Glass was fixed to use and
      // that Hollywood's holdFade uses, both of which measurably do dissolve:
      // ramp the shot's own opacity up over the incoming overlap and down over
      // the outgoing one. Cross-track is fine for that — opacity is the
      // element's own property and needs no partner.
      opacity: [
        { time: 0, value: '0%', easing: 'quadratic-out' },
        { time: +FADE.toFixed(3), value: '100%', easing: 'linear' },
        { time: +Math.max(FADE, dur - FADE).toFixed(3), value: '100%', easing: 'quadratic-in' },
        { time: +dur.toFixed(3), value: '0%' },
      ],
      // a slow push so the frame is never dead still
      x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: +dur.toFixed(3), value: '103%' }],
      y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: +dur.toFixed(3), value: '103%' }],
      elements: [
        // the photo, clipped to its own shape
        { type: 'composition', clip: true, width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          elements: withBorder([applyPhotoColor({ type: 'image', source: it.url, ...coverBox(it, box.w * W, box.h * H) }, it)], it, box.w * W, box.h * H, Math.min(W, H)) },
        // 1. the colour halo, as a STACK OF CRISP STROKES rather than one
        //    blurred one.
        //
        //    This was `stroke_width: 2.6vmin, blur_radius: 22, blend_mode:
        //    screen`, and it has been rendering GREY since the style was
        //    written. A stroked shape's fill is transparent BLACK, and blurring
        //    it drags that black through the stroke: what comes back is around
        //    150/255 whatever colour went in. Glass made this obvious because
        //    its wall is light and grey-on-light reads as a black edge; Neon sits
        //    on black, where a grey halo still passes for a glow, so it was
        //    never caught. Measured: render 005's beams (white FILL + blur +
        //    screen) went 86 -> 178 over a dark photo; render V4's rim (white
        //    STROKE + blur + screen) went 241 -> 157 over a light wall.
        //
        //    Four unblurred strokes, widest and faintest first, give the falloff
        //    without the blur — and they carry the actual neon colour.
        ring({ stroke_color: neon, stroke_width: '3.0vmin', blend_mode: 'screen', opacity: '16%' }),
        ring({ stroke_color: neon, stroke_width: '2.1vmin', blend_mode: 'screen', opacity: '26%' }),
        ring({ stroke_color: neon, stroke_width: '1.4vmin', blend_mode: 'screen', opacity: '42%' }),
        // 2. the tube itself
        ring({ stroke_color: neon, stroke_width: '0.85vmin', blend_mode: 'screen', opacity: '95%' }),
        // 3. near-white core
        ring({ stroke_color: '#FFFFFF', stroke_width: '0.28vmin', opacity: '85%' }),
        // 4. the light running round the perimeter — halo, then core. Same
        //    treatment: stepped, not blurred.
        ring({ stroke_color: neon, stroke_width: '3.4vmin', blend_mode: 'screen', opacity: '20%',
          stroke_start: '0%', stroke_end: `${HALO}%`, stroke_offset: travel(100) }),
        ring({ stroke_color: neon, stroke_width: '2.0vmin', blend_mode: 'screen', opacity: '34%',
          stroke_start: '0%', stroke_end: `${HALO}%`, stroke_offset: travel(100) }),
        ring({ stroke_color: '#FFFFFF', stroke_width: '0.9vmin', blend_mode: 'screen',
          stroke_start: '0%', stroke_end: `${ARC}%`, stroke_offset: travel(100) }),
        // A run up one side, and — a beat later and further out — the piece that
        // turns a corner. Two splashes, not a second frame.
        splash(112, 30, 13, dur * 0.16, dur * 0.62, '0.5vmin'),
        splash(122, 57, 8, dur * 0.40, dur * 0.80, '0.34vmin'),
      ],
    });

    // THE FLASH. Josh: "create a neon flash to be used as a transition between
    // images to hide the different size issue."
    //
    // The real problem it solves: consecutive photos have different shapes, so
    // the frame changes size at every cut and a plain cross-fade shows one
    // rectangle morphing into another. A bloom of light across the whole frame
    // covers the moment the geometry changes — the eye reads the flash, not the
    // resize. It is screen-blended so it lifts whatever is underneath rather
    // than greying it, and it is skipped on green backdrops, where a
    // full-frame white pulse would wreck the key.
    if (!last && !backdropIsGreen(background, S)) {
      const nextIt = items[i + 1];
      const flashAt = start0 + (i + 1) * step;
      const flashCol = nextIt && nextIt.green ? null : NEON_COLOURS[(i + 1) % NEON_COLOURS.length];
      if (flashCol) {
        // MEASURED NOT FIRING, render 011. Frame brightness across the whole
        // piece sits at a median of 51.6 and never rises more than 8 levels
        // above it except during the two green bookends. A wash at 30% plus a
        // white core at 44%, screen-blended over a frame that dark, would lift
        // it by roughly 45 levels. Nothing of the sort appears, so the flash is
        // built and then does nothing — which is why render 011 measured 7 hard
        // cuts across 9 transitions, and why the size changes Josh asked this
        // to hide are still visible.
        //
        // It is the same construction that failed in Glass: a composition that
        // pins time and duration AND carries keyframed opacity. That is a
        // CORRELATION, not a proven cause — Two Panel and Hollywood build
        // opacity the same way and both dissolve correctly — so the fix here is
        // the cheap defensive one rather than a claim. The outer composition
        // keeps the timing; an inner one that pins nothing carries the fade.
        // The probe added to /api/admin/probe renders both constructions side
        // by side, so the next probe run settles it either way.
        elements.push({
          name: `Flash-${i + 1}`, type: 'composition', track: 12 + (i % 2),
          time: +Math.max(0, flashAt - FADE * 0.8).toFixed(3), duration: +(FADE * 1.7).toFixed(3),
          width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          elements: [{
          type: 'composition', width: '100%', height: '100%',
          x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          opacity: [
            { time: 0, value: '0%', easing: 'quadratic-out' },
            { time: +(FADE * 0.8).toFixed(3), value: '100%', easing: 'quadratic-in' },
            { time: +(FADE * 1.7).toFixed(3), value: '0%' },
          ],
          elements: [
            // A wash of the incoming photo's own colour...
            { type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
              x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
              fill_color: flashCol, blend_mode: 'screen', opacity: '30%' },
            // ...with a soft white core in the middle of the frame, so it reads
            // as a tube firing rather than as a colour card.
            //
            // Pulled back from 46%/62% after seeing it: at full strength the
            // flash did not hide the size change so much as replace the picture
            // with a colour card for a third of a second. It only has to cover
            // the moment, not own it.
            { type: 'shape', path: GLASS_RECT, width: '150%', height: '26%',
              x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
              fill_color: '#FFFFFF', blend_mode: 'screen',
              blur_radius: Math.round(H * 0.09), blur_mode: 'stack', opacity: '44%' },
          ],
          }],
        });
      }
    }
  });

  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements: slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H }) };
}

// DRAFT RESOLUTION, per style. A watermarked draft has rendered at half scale
// for every style since drafts existed, which is right for most of them and
// wrong for Glass: Glass carries ~1,900 elements of which ~260 are blurred, and
// blur cost is per-pixel, so it is the one style where output resolution
// dominates render time. Josh, after six 20-minute drafts: "Is it possible to
// have 'Glass' render at a slightly lower quality for preview then others?"
//
// Yes, and only resolution. FRAME RATE is the other obvious lever and it is
// deliberately NOT touched: every draft in this series has been judged on
// MOTION, and a draft at a lower frame rate would look choppier than the real
// render, which is a false signal about the exact thing being reviewed.
//
// 0.35 of 1920x1080 is 672x378. Against 0.5 that is 51% fewer pixels. EXPECTED
// to cut render time substantially; NOT measured, because Creatomate is not
// reachable from the build environment and the only clock is Josh's.
//
// Credits, from Creatomate's published formula (w x h x fps x seconds / 1e8):
// a 48s piece is ~7.5 credits at 0.5 and ~3.7 at 0.35.
const DRAFT_SCALE = { glass: 0.35 };
export function draftScaleFor(style) {
  return DRAFT_SCALE[style] || 0.5;
}

// Styles whose layout depends on each photo's REAL pixel aspect: native-shape
// cells, aspect-aware fills, and head-safe cover crops. The DRAFT render and the
// Export (finalize) re-render MUST use the SAME answer here — if the export skips
// the dimension probe, photos fall back to "landscape" and come out stretched or
// with heads cropped out of frame, so the export won't match the draft. Keep this
// as the ONE source of truth for both routes.
export function styleNeedsDims(st) {
  const s = st || {};
  return !!(s.collage || s.epic || s.trendy || s.wholePhoto || s.story || s.multipage || s.duotone || s.pan
    || s.slidePush || s.slideRail || s.multiSlide || s.ribbon || s.neon || s.comic
    // Glass picks a landscape or portrait ROOM from the photo's own aspect, and
    // its crop-safety rule is computed from the real pixel shape. Without dims
    // every photo would be treated as landscape and every accent pane would fall
    // back to plain glass.
    || s.glass
    // Framed Box cover-fills both the bed and the box from the photo's real
    // shape; without dims every picture would be treated as landscape.
    || s.framedBox);
}

// Which styles want studio_media.faces threaded onto their items.
//
// Only Glass, and only because its accent panes take TIGHT crops — a narrow pane
// showing a picture is showing a small part of it, and the part has to be aimed
// at a face or the pane shows plain glass instead. Every other style either
// shows the whole photograph or cover-fills it top-anchored, where there is no
// crop to get wrong. Keeping this narrow means no other style pays for the
// extra column read.
export function styleNeedsFaces(st) {
  // Collage joins Glass here. Its camera rests inside a cell that is often
  // taller than the window, and without faces the only thing it can do is bias
  // to the top of the cell — which is head-safe but, on a 9:16 where the people
  // sit low, leaves the headroom Josh flagged. With faces it can put them where
  // they belong.
  // Framed Box joins them: its blurred bed is a cover-crop of a photograph into
  // a 16:9 frame, which on a tall picture throws most of the height away. With
  // no faces it falls back to the house top-bias and the people end up low —
  // Josh: "Can you do a better job centering the faces on the blurred
  // background? most of them are lower on the page."
  return !!(st && (st.glass || st.collage || st.framedBox));
}

// ============================================================================
// TWO PANEL — two native-frame photos per card (odd tail = 1). Each photo gets a
// clean 16:9 (landscape) or 9:16 (portrait) frame, cover-filled so the Fix-framing
// controls (up/down, left/right, zoom) drive it. Placement ADAPTS to the pair's
// shapes and ALTERNATES between two arrangements each time that combo recurs. They
// pop on one at a time from the outer edges (or dissolve). All on green screen.
// ============================================================================
const AR_169 = 16 / 9, AR_916 = 9 / 16;
// Place a box by width% + aspect, pinned to a horizontal + vertical edge.
function twoPanelBox(widthPct, aspect, hSide, hIns, vSide, vIns, W, H) {
  const hPct = ((widthPct / 100) * W / aspect) / H * 100;
  const x = hSide === 'left' ? hIns : (100 - hIns - widthPct);
  const y = vSide === 'top' ? vIns : (100 - vIns - hPct);
  return { x, y, w: widthPct, h: hPct, from: hSide };
}
const twoPanelIsP = (it) => it && it.ar === 'p';
// Return [{ it, box }] for a card. `variant` (0/1) flips the arrangement.
// SIZES. Josh on render 014: "looks good. just make the images a bit bigger but
// not all the way to the edge." Every box below is about 12% larger than it was
// and the margins were pulled in to match, but each pair still keeps a clear
// band of background all the way round — the point of the style is two pictures
// arranged ON something, and a photo touching the frame edge stops reading that
// way. Widths: single 60->68 / 30->34, portrait pair 26->29, landscape pair
// 53->59, mixed 53->58 and 26->29.
function twoPanelCard(items, variant, W, H) {
  const flip = (variant % 2 === 1);
  if (items.length === 1) {
    const it = items[0], p = twoPanelIsP(it), w = p ? 34 : 68;
    const box = twoPanelBox(w, p ? AR_916 : AR_169, 'left', (100 - w) / 2, 'top', 0, W, H);
    box.y = (100 - box.h) / 2; box.from = flip ? 'right' : 'left';
    return [{ it, box }];
  }
  const [a, b] = items, pa = twoPanelIsP(a), pb = twoPanelIsP(b);
  if (pa && pb) { // two portraits — tall pair, offset high/low
    const left = twoPanelBox(29, AR_916, 'left', 19, flip ? 'bottom' : 'top', 4, W, H);
    const right = twoPanelBox(29, AR_916, 'right', 19, flip ? 'top' : 'bottom', 4, W, H);
    return [{ it: a, box: left }, { it: b, box: right }];
  }
  if (!pa && !pb) { // two landscapes — wide pair on a diagonal
    const left = twoPanelBox(59, AR_169, 'left', 3, flip ? 'bottom' : 'top', 5, W, H);
    const right = twoPanelBox(59, AR_169, 'right', 3, flip ? 'top' : 'bottom', 5, W, H);
    return [{ it: a, box: left }, { it: b, box: right }];
  }
  // mixed — landscape high, portrait low; alternate which side each sits on
  const land = pa ? b : a, landLeft = !flip;
  const lBox = twoPanelBox(58, AR_169, landLeft ? 'left' : 'right', 4, 'top', 6, W, H);
  const pBox = twoPanelBox(29, AR_916, landLeft ? 'right' : 'left', 12, 'bottom', 6, W, H);
  return [{ it: a, box: a === land ? lBox : pBox }, { it: b, box: b === land ? lBox : pBox }]; // keep play order for stagger
}
function twoPanelSource({ S, seq, watermarkUrl, width, height, mp = {} }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const transition = mp.transition || 'record-fwd';
  const photos = seq.filter((it) => it.type !== 'placeholder' && it.url && !it.green); // green bookends skipped (bg is already green)
  photos.forEach((p) => { const A = (p.w > 0 && p.h > 0) ? p.w / p.h : 1.4; p.ar = A < 0.9 ? 'p' : A > 1.2 ? 'l' : 's'; });
  const cards = [];
  for (let i = 0; i < photos.length; i += 2) cards.push(photos.slice(i, i + 2));
  if (!cards.length) return { output_format: 'mp4', width, height, frame_rate: 30, elements: [{ type: 'shape', track: 1, time: 0, duration: 2, path: rect, width: '100%', height: '100%', fill_color: S.bg }] };

  const STAG = Math.max(0.06, Number(mp.stagger) || 0.28);
  const HOLD = Math.max(0.3, Number(mp.hold) || 1.5);
  const MOVE = Math.max(0.25, Number(mp.speed) || 0.72);
  const FADE = 0.5;

  const elements = [];
  const bg = { name: 'Background', type: 'shape', track: 1, time: 0, duration: 1, path: rect, width: '100%', height: '100%', fill_color: S.bg };
  elements.push(bg);

  const comboSeen = {};
  let t = 0, toggle = 0;
  cards.forEach((group, ci) => {
    const key = group.map((g) => (g.ar === 'p' ? 'p' : 'l')).sort().join(''); // pp | ll | lp
    const variant = (comboSeen[key] = (comboSeen[key] || 0)); comboSeen[key]++;
    const placed = twoPanelCard(group, variant, width, height);
    const n = placed.length;
    const revealDur = (n - 1) * STAG + MOVE;
    const pageDur = revealDur + HOLD + 0.3;
    const photoEls = placed.map((pl, idx) => {
      const c = pl.box, st = idx * STAG;
      const inner = withBorder([applyPhotoColor({ type: 'image', source: pl.it.url, ...coverBox(pl.it, (c.w / 100) * width, (c.h / 100) * height) }, pl.it)], pl.it, (c.w / 100) * width, (c.h / 100) * height, Math.min(width, height));
      const cm = transition === 'dissolve' ? 'dissolve' : (c.from === 'left' ? 'slide-right' : 'slide-left');
      return mpPhotoEnter(cm, c, st, MOVE, FADE, inner);
    });
    const pageComp = { name: `Card-${ci + 1}`, type: 'composition', track: 2 + toggle, time: t, duration: pageDur,
      width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', elements: photoEls,
      opacity: [{ time: 0, value: '100%' }, { time: pageDur - 0.3, value: '100%' }, { time: pageDur, value: '0%' }] };
    t += pageDur - 0.25;
    elements.push(pageComp);
    toggle ^= 1;
  });
  const total = t + 0.3;
  bg.duration = total;
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}
// Per-photo card + frame shape for the admin framer (matches twoPanelSource pairing).
export function twoPanelLayout({ items } = {}) {
  const photos = (items || []).filter((it) => it && it.type !== 'placeholder' && it.url && !it.green);
  const out = new Array(photos.length);
  for (let i = 0; i < photos.length; i += 2) {
    const cells = Math.min(2, photos.length - i);
    for (let j = 0; j < cells; j++) {
      const p = photos[i + j], A = (p.w > 0 && p.h > 0) ? p.w / p.h : 1.4;
      out[i + j] = { page: i / 2 + 1, cell: j + 1, cells, cellAspect: A < 0.9 ? AR_916 : AR_169 };
    }
  }
  return out;
}

// ============================================================================
// GLASS — panes of lit glass in a bright room, the photograph mounted on the
// front one. Designed with Josh across frames 10, 17, 19, 23 and 24.
//
// TWO IDEAS CARRY THE WHOLE STYLE.
//
// 1. THE ROOM RECONFIGURES ITSELF AROUND EACH PHOTO'S SHAPE. A wide photo gets
//    one of two landscape rooms; a tall photo gets one of three portrait ones.
//    Nothing is designed per picture — the same rules run and the furniture
//    moves. That is the answer to a montage whose photos alternate 16:9 and
//    9:16, which is the case every other approach fell over on.
//
// 1b. EVERY SHOT ENDS WITH THE PHOTOGRAPH ALONE. The panes in front drift over
//    the picture, then part and clear off it, leaving it unobstructed for the
//    last ~1.5s before the transition. See GLASS_CLEAN_S / glassActs.
//
// 2. A PANE IN FRONT OF THE PHOTOGRAPH CARRIES NO PICTURE. Accent panes started
//    out holding crops of the same photo and every single time it read as the
//    same face three times across. In front, a pane is glass. Behind, or beside,
//    it may hold a picture — and then only a gentle one (see GLASS_MIN_VISIBLE).
//
// CROP SAFETY. An early version cropped accent panes to hardcoded percentages.
// On a tall photo of a standing child that isolated her torso and magnified it.
// The rule now: a pane may only carry a picture if it shows at least
// GLASS_MIN_VISIBLE of that picture — a gentle reframing, not a tight zoom — and
// the crop is TOP-anchored through coverBox like the rest of this engine, so it
// keeps heads. Anything tighter becomes plain glass. There is no way for this
// style to invent a close-up of a region nobody chose.
//
// (The sandbox prototype anchors tight crops on YuNet-detected eyes, which lets
// panes crop much harder in safety. That needs face detection in the render
// path, which does not exist yet — so this build simply does not take tight
// crops. See HANDOFF notes.)
//
// NOT RENDER-VERIFIED. y_rotation / perspective / backface behaviour is read off
// the Creatomate SDK types and previewed in the DOM simulator; no draft has been
// rendered. If the 3D properties misbehave, the panes fall flat and the style
// still reads, just without depth.
// ============================================================================

const GLASS_RECT = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';

// Track layout for this style, front to back. Higher renders on top. The shared
// shell owns 1 (background), 20 (cards) and 99 (watermark); everything between
// is ours. The room takes 2, the ten rays 3..12.
const GLASS_ROOM_TRACK = 2;
const GLASS_BEAM_TRACK = 3;
// Shots alternate between GLASS_SHOT_TRACK and the one above it, so the dissolve
// always has a fully opaque layer underneath. See "THE DISSOLVE, DONE BY HAND".
const GLASS_SHOT_TRACK = 15;
// The light bar rides ABOVE both shot tracks and below the cards.
const GLASS_SWEEP_TRACK = 17;

// ---------------------------------------------------------------------------
// WHAT WENT WRONG THE FIRST TIME, AND WHY THIS SECTION IS WRITTEN AGAINST THE
// PROTOTYPE LINE BY LINE.
//
// The prototype Josh signed off (tools sandbox: motion.html + shared.css) makes
// glass out of SEVEN layers per pane and THREE for the room. The first port
// carried the geometry across and left most of the material behind, so render
// 007 came back with, in Josh's words, black-looking edges, no glass feel, no
// texture in the background and panels that do not match the reference. All four
// are the same mistake. What was missing:
//
//   .rim   had an OUTER white glow (0 0 26px rgba(255,255,255,.85)) as well as
//          the inner rim and bloom. The port kept the two inner layers — which a
//          clip:true composition confines to the inside — and dropped the only
//          one that reaches the wall. So the sole thing where a pane met the
//          room was its dark drop shadow. That is the "edges look black".
//   .lead  a 3px hot white bar with an 18px glow running down each pane's
//          leading edge, and a second one on the hero's right. Absent entirely.
//   .sheen a 108-degree diagonal STREAK, peaking at .42 and falling away either
//          side. The port made it a FLAT 0.16 film over the whole pane, which is
//          a different thing: it washed every photograph instead of catching one
//          band of light. (Removing it fixed the wash and removed the shine.)
//   .cool  a multiply tint on accent panes so a 34%-opacity photo still reads
//          against a light wall. Absent.
//   frost  a 150-degree gradient from white to a cool grey. The port used a flat
//          white wash.
//   .room  a radial hot spot behind the panes, a floor with its own gradient and
//          a horizon line. The port painted one flat grey. That is the "no
//          texture in the background".
//   growOutward(p, 1.2) — Josh, explicitly: "make the side pains that have
//          images in them 20% bigger, but do not move them closer to center."
//          The port used the pre-growth numbers. Every accent pane in every
//          layout was 20% too small.
//   .refl  a mirrored, blurred, gradient-masked reflection under each pane.
//          Still absent — see the note on glassPane.
//
// Everything below is ported from the prototype in its own units (pixels at
// 1920x1080) so it can be diffed against motion.html by eye.
// ---------------------------------------------------------------------------

const GLASS_FW = 1920, GLASS_FH = 1080;

// ---- THE CROP GUARD --------------------------------------------------------
// This is the part of the style that has to be right, so it is written out in
// full.
//
// An accent pane is narrow. A narrow pane showing a picture is showing a TIGHT
// crop of it, and an early version aimed those crops at hardcoded percentages
// like '64% 50%'. On a tall photograph of a standing child that isolated her
// torso and magnified it. Nothing like that may ever reach a client.
//
// The rule, ported from the prototype:
//
//   1. A pane showing less than MIN_VISIBLE of the photograph is plain glass,
//      however confident the detector — at that magnification a slightly
//      misplaced box is still a very large picture of not-a-face.
//   2. A photograph with NO detected face gives every accent pane plain glass.
//   3. Otherwise the crop is anchored on the midpoint between a pair of EYES,
//      solved so the face lands in the part of the pane that is actually ON
//      SCREEN — see glassSolvePos, which is where the first version went wrong.
//   4. If no face can be brought into a pane's visible area, plain glass.
//
// Every uncertain case degrades to plain glass: a look already signed off, never
// a crop nobody chose. That is the whole design, and it is why MIN_VISIBLE can
// be as low as the prototype's 0.06 — the number is not doing the safety work,
// the anchoring is.
//
// The faces come from studio_media.faces, filled in by the scheduled job in
// .github/workflows/face-detect.yml. A photo that has not been processed yet has
// no faces, which lands on rule 2 — panes stay glass and nothing unsafe happens
// while the backfill catches up.
// REGRESSION, 2026-09-03. This was 0.55 in the original build and I dropped it
// to 0.06 when face detection went in, reasoning that eye-anchoring made a hard
// crop safe. It made it SAFE — the crop lands on a face — but not GOOD: a pane
// showing 6% of a photograph is a magnified forehead at low resolution, and
// render 017 put one across the whole left half of the frame with the same
// child's face appearing three times. Which is precisely the failure this
// constant was written to prevent; the design note two hundred lines up says
// so in as many words. Face detection chooses WHICH gentle reframing a pane
// gets. It is not permission to crop harder.
// 0.30, after render 004. 0.55 was an over-correction: Josh, on 004, "not all
// the slides have images in the glas". Measured across a 9-photo piece, the
// number of panes that actually carry a photograph is
//
//     0.06  ->  78 panes      (the giant-forehead setting, render 017)
//     0.25  ->  42
//     0.30  ->  ~40
//     0.45  ->  22
//     0.55  ->  20            (render 004 — glass everywhere, pictures nowhere)
//
// 2026-09-04. Josh on 019: the "H" on the right "seems vaccant and like a
// mistake". It is the P2/P3 crossbar — the wide pane that runs between the two
// verticals — and it was ALWAYS plain glass, never once carrying a picture.
//
// Measured, across all five layouts and six common photo shapes (106 accent
// panes): seenFrac clusters at 0.118-0.177, then 0.201-0.238, then 0.263-0.296
// (the crossbar), then 0.357+. At 0.30 only 14 of 106 panes could hold a
// picture, which is why the room reads empty and why the H is hollow.
//
// The floor moves to 0.18 — the natural gap in that distribution — and the
// thing the floor was really standing in for gets its own guard below. A low
// seenFrac was only ever a PROXY for "the face comes out magnified"; render 017
// at 0.06 was foreheads. GLASS_MAX_FACE measures that directly, so the floor no
// longer has to be set high enough to catch it by accident.
const GLASS_MIN_VISIBLE = 0.18;
// How much of a pane's shorter on-screen axis one face may fill before the crop
// stops being a portrait and starts being a forehead.
const GLASS_MAX_FACE = 0.62;
// How much closer an accent pane's view is than the hero's, before clamping.
// This is what stops an accent from being a same-scale copy of the hero — the
// wallpaper effect in render 020 — and it is bounded by GLASS_MAX_FACE above.
const GLASS_ACCENT_ZOOM = 1.45;
// The transition as a share of one shot: STYLES.glass fadeS / photoS = 1.25/4.6.
// Held as a RATIO so the rhythm survives length mode - see the note in
// glassSource. Deliberately Glass-only: fixing this globally would re-pace all
// 27 styles, several of which Josh has already signed off on.
const GLASS_FADE_RATIO = 1.25 / 4.6;
// How far the whole stage travels through a transition. The prototype's slide
// unit is 0.8 of ~190px; the stage carries hero and panes together.
const GLASS_STAGE_SLIDE = 190 * 0.8;
// The hero is exempt from all of it. It is never a tight crop, and its framing
// is the user's business — the Fix-framing control in the montage maker governs
// the main photograph and face detection must not quietly overrule it.

// Solve for the crop position that puts a face in the pane's ON-SCREEN part.
//
// This is where the first version was wrong, and the failure looked exactly like
// a detector miss. The crop was anchored on the face correctly — but the pane ran
// 1320px wide from x=1009, so a third of it lay past the frame edge, and the
// visible third showed a different part of the photograph. Worse, at that pane's
// aspect the image already filled the pane's width, so NO horizontal position
// could have moved the face into view. The anchor was right; the window was
// somewhere else. So: work out what is actually on screen, and require the face
// to land there.
//
// `p` is the pane in frame fractions, `f` a face normalised 0..1. Returns
// {x, y} as percentages for photoFramingBias, or null for "cannot reach it".
function glassSolvePos(p, it, f, zWant) {
  const pAR = (p.w * GLASS_FW) / (p.h * GLASS_FH);
  const iAR = (it.w > 0 && it.h > 0) ? it.w / it.h : 1.5;
  let visW = pAR > iAR ? 1 : pAR / iAR;        // fraction of the image's width shown
  let visH = pAR > iAR ? iAR / pAR : 1;        // ...and of its height
  // The pane's on-screen span, in pane-local 0..1.
  const u0 = Math.max(0, (0 - p.x) / p.w), u1 = Math.min(1, (1 - p.x) / p.w);
  const v0 = Math.max(0, (0 - p.y) / p.h), v1 = Math.min(1, (1 - p.y) / p.h);
  if (u1 - u0 < 0.25 || v1 - v0 < 0.25) return null;   // barely on screen at all
  // Anchor on the EYES. A box centre slides toward the chin on a tilted or
  // upward-looking head; the midpoint between the eyes does not.
  const fx = Number.isFinite(f.ex) ? f.ex : (f.x + f.w / 2);
  const fy = Number.isFinite(f.ey) ? f.ey : (f.y + f.h * 0.42);

  // THE ACCENT ZOOM, and why it is not a rejection any more.
  //
  // Josh, 2026-09-04, on the accent panes duplicating the hero: an accent pane
  // may crop — "as long as the full image is in one pannel 'hero' shot - the
  // others can be different. as they have been all along." Only the hero is
  // sacred. So an accent SHOULD be a different view, and render 020's fault was
  // that it was the same view at the same scale, which reads as one photograph
  // bleeding across the glass rather than as two panes of it.
  //
  // So accents now ask for a deliberately closer crop. And the forehead guard
  // stops REFUSING panes and starts CLAMPING them: it caps how far in we may
  // zoom so a face never fills more than GLASS_MAX_FACE of the pane, rather
  // than emptying the pane when it would. Refusing is what left the "H" hollow,
  // and Josh's note on that is unambiguous — "it looked wrong cause there was
  // no image in it."
  //
  // The floor is z = 1: the least zoomed a cover-crop can be. If a face still
  // overflows at z = 1 the pane's own shape is the cause, not the zoom, and
  // GLASS_MIN_VISIBLE has already excluded the shapes where that looks like a
  // sliver.
  const capW = (f.w > 0 && visW > 0) ? (GLASS_MAX_FACE * visW) / f.w : Infinity;
  const capH = (f.h > 0 && visH > 0) ? (GLASS_MAX_FACE * visH) / f.h : Infinity;
  const zUse = Math.max(1, Math.min(zWant, capW, capH));
  // At this zoom the pane shows less of the picture, so re-derive the spans the
  // face has to sit inside.
  visW /= zUse; visH /= zUse;

  const axis = (vis, w0, w1, fc) => {
    if (vis >= 0.999) {
      // The image fills this axis, so position cannot move it. The face is
      // either already inside the on-screen span or it is unreachable.
      return (fc >= w0 && fc <= w1) ? 0 : null;
    }
    const left = fc - ((w0 + w1) / 2) * vis;   // put the face mid-span
    const pos = left / (1 - vis);
    if (pos < -0.02 || pos > 1.02) return null;        // would need to leave the image
    return Math.max(0, Math.min(1, pos)) * 100;
  };

  const px = axis(visW, u0, u1, fx);
  const py = axis(visH, v0, v1, fy);
  if (px === null || py === null) return null;
  return { x: +px.toFixed(2), y: +py.toFixed(2), z: +zUse.toFixed(3) };
}

// Apply the guard to one accent pane. Returns the framing override to use, or
// null meaning "this pane is plain glass".
function glassSafeCrop(p, it, zWant) {
  const faces = Array.isArray(it.faces) ? it.faces : null;
  if (!faces || !faces.length) {
    // NO FACE DATA. This used to return null, which meant plain glass — and on
    // a library whose detection job has not run yet, that is EVERY accent pane
    // in the montage, i.e. exactly the empty room Josh keeps seeing. Since an
    // accent is allowed to crop, the safe fallback is the user's OWN framing
    // from the montage maker, barely zoomed: no face anchoring, no guess about
    // where anyone is, and nothing tighter than the picture already asked for.
    const { v, h } = photoFramingBias(it);
    return { x: +(h * 100).toFixed(2), y: +(v * 100).toFixed(2), z: +Math.min(zWant || 1, 1.1).toFixed(3) };
  }
  // Try the pane's preferred face first, then every other one — a pane near the
  // frame edge may simply be unable to reach the biggest face, and another may
  // work. (rules 3 and 4)
  const want = Math.min(p.face || 0, faces.length - 1);
  const order = [want].concat(faces.map((_, i) => i).filter((i) => i !== want));
  for (const i of order) {
    const pos = glassSolvePos(p, it, faces[i], zWant);
    if (pos) return pos;
  }
  return null;
}

// How much of the photograph a cover-fitted box actually shows.
function glassVisible(pw, ph, iw, ih) {
  if (!(pw > 0 && ph > 0 && iw > 0 && ih > 0)) return 0;
  const pAR = pw / ph, iAR = iw / ih;
  return Math.min(iAR / pAR, pAR / iAR);
}

// ---- THE ROOM --------------------------------------------------------------
// shared.css:
//   .room  radial-gradient(90% 70% at 50% 34%, #fdfdfe, #eceff3 38%, #d9dee5 72%, #ccd3dc 100%)
//   .floor bottom 14%, linear-gradient(180deg, #c9d0d9, #dde2e8 35%, #e9edf1)
//   .horizon 1px rgba(20,30,45,.10) along the top of the floor
//
// The hot spot is built as a blurred white ellipse over a flat base rather than
// as a radial gradient fill. Creatomate does support radial fills, but its own
// SDK disagrees with itself about whether the size key is `radius` or
// `fill_radius`, and this style has already cost two renders to guesses about
// property behaviour. blur_radius and screen blending are both proven in 005-007.
// A linear gradient is used for the floor, where the key names are unambiguous.
// ---- THE LIGHT SWEEP ------------------------------------------------------
// Josh on render 018: "there are disolves. not light transitions".
//
// He is right, and the prototype says exactly what the difference is. Its
// render() has no cross-fade at all. At a boundary it does this:
//
//     stage = renderShot(cur, 1, { slide:  e * 0.8,       fade: 1 - e })
//           + renderShot(nxt, 0, { slide: (1 - e) * -0.8, fade: e     });
//     const x = -40 + e * 180;
//     flash = linear-gradient(100deg,
//               transparent  (x-26)%,
//               white x .95*sin(PI*p)  at x%,
//               transparent  (x+26)%)  + blur(5px), mix-blend-mode: screen
//
// So the transition IS a bar of light crossing the frame while the two rooms
// slide past each other. The dissolve underneath is the least of it — which is
// why matching the dissolve length still did not look like the reference.
//
// BUILT AS A MOVING SHAPE, NOT A MOVING GRADIENT. Creatomate cannot keyframe
// the offsets inside a fill_color stop list, so the bar is a shape 52% of the
// frame wide (the prototype's +-26% band) carrying a fixed transparent-to-white
// -to-transparent gradient across its own width, and the SHAPE is what travels.
// Same picture, and it only uses constructions the probe render verified:
// gradient fills with alpha stops, screen blending, and blur on a FILLED shape.
//
// Opacity follows sin(PI*p) — nothing at the edges, brightest as it crosses the
// middle — approximated with three keyframes.
function glassSweep(name, at, dur, W, H) {
  // 019 measured +27..+34 and I pushed peak, width and fade all at once for 020.
  // That overshot: 020's transitions peak at 211-218 mean frame luminance
  // against a 175 median, with 6.8% of the video above 200 — the frame washes
  // out to white and both pictures disappear into it. Backing the bar off; the
  // fade length (1.25s) is now carrying the transition, not the flash.
  const peak = 70;
  // Outer composition carries the timing; the animated shape lives inside and
  // pins nothing. Same shape as the shot dissolve, and for the same reason:
  // the one construction this engine has not been able to clear is a pinned
  // time+duration element that also carries keyframes. verify catches it.
  return {
    name, type: 'composition', track: GLASS_SWEEP_TRACK,
    time: +at.toFixed(3), duration: +dur.toFixed(3),
    width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    elements: [{
      type: 'shape', path: GLASS_RECT,
      width: '52%', height: '150%',
      y: '50%', x_anchor: '50%', y_anchor: '50%',
      // 100deg in CSS is 10deg past straight-across, so the bar leans slightly.
      z_rotation: '10°',
      x: [
        { time: 0, value: '-30%', easing: 'linear' },
        { time: +dur.toFixed(3), value: '130%' },
      ],
      opacity: [
        { time: 0, value: '0%', easing: 'quadratic-out' },
        { time: +(dur * 0.5).toFixed(3), value: `${peak}%`, easing: 'quadratic-in' },
        { time: +dur.toFixed(3), value: '0%' },
      ],
      blend_mode: 'screen',
      blur_radius: Math.max(3, Math.round(H * 0.006)), blur_mode: 'stack',
      fill_mode: 'linear', fill_x0: '0%', fill_y0: '50%', fill_x1: '100%', fill_y1: '50%',
      fill_color: [
        { offset: '0%', color: 'rgba(255,255,255,0)' },
        { offset: '50%', color: 'rgba(255,255,255,1)' },
        { offset: '100%', color: 'rgba(255,255,255,0)' },
      ],
    }],
  };
}

function glassRoom(S, total, W, H) {
  const dur = +total.toFixed(3);
  const rect = GLASS_RECT;
  return [{
    name: 'Room', type: 'composition', track: GLASS_ROOM_TRACK, time: 0, duration: dur,
    width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    elements: [
      // The wall, at the gradient's OUTER colour. The hot spot brings the middle up.
      { type: 'shape', path: rect, width: '100%', height: '100%',
        x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', fill_color: '#E7EBF0' },
      // The hot spot: centred at 50%/34% like the prototype, wide and very soft.
      //
      // BIGGER AND WEAKER THAN THE FIRST ATTEMPT, because at 116% x 104% the
      // ellipse's own lower edge fell inside the frame and, even with a 140px
      // blur, showed as a visible crescent across the bottom third of render V4
      // — a shape in the room that is not part of the room. It now runs well
      // past every edge so there is no edge to see.
      //
      // BRIGHTER THAN IT WAS, 2026-09-03, and this reverses the reasoning that
      // stood here. The prototype's CSS says "Pure white walls leave no room for
      // white glass edges or white beams to register", and I took that to mean
      // the room had to be held down. It does — IF the glass is drawn in white.
      //
      // Josh wants the room as white as possible, so the glass is no longer
      // drawn in white: see the edge block in glassPane. It is drawn with a cool
      // multiply body, a fine refracted edge, a drop shadow and a reflection,
      // every one of which is a DARKENING operation with the full range of a
      // white wall to work in. White survives only as a small specular hit.
      //
      // Which inverts the constraint. A whiter room now makes the glass read
      // MORE strongly, not less, so the wall goes up from 204/221 to about
      // 231/248 and the note above no longer applies to this style.
      { type: 'shape', path: 'M 50 0 C 77.6 0 100 22.4 100 50 C 100 77.6 77.6 100 50 100 C 22.4 100 0 77.6 0 50 C 0 22.4 22.4 0 50 0 Z',
        width: '190%', height: '165%',
        x: '50%', y: '30%', x_anchor: '50%', y_anchor: '50%',
        fill_color: '#FFFFFF', blend_mode: 'screen',
        blur_radius: Math.round(H * 0.10), blur_mode: 'stack', opacity: '62%' },
      // The floor, with its own gradient. Bottom 14% of the frame.
      { type: 'shape', path: rect, width: '100%', height: '14%',
        x: '50%', y: '93%', x_anchor: '50%', y_anchor: '50%',
        fill_mode: 'linear', fill_x0: '50%', fill_y0: '0%', fill_x1: '50%', fill_y1: '100%',
        fill_color: [{ offset: '0%', color: '#DCE2E9' }, { offset: '35%', color: '#EAEEF2' }, { offset: '100%', color: '#F4F6F8' }] },
      // The horizon. One dark hairline is what tells the eye the floor is a floor.
      { type: 'shape', path: rect, width: '100%', height: `${(100 / H).toFixed(4)}%`,
        x: '50%', y: '86%', x_anchor: '50%', y_anchor: '50%',
        fill_color: 'rgba(20,30,45,0.10)' },
    ],
  }];
}

// ---- ONE PANE --------------------------------------------------------------
// Seven layers, matching shared.css. `p` is in FRACTIONS of the frame:
// {x,y,w,h} 0..1, plus ry (degrees), photo, op, frost, accent, dim.
//
// STRUCTURE, and why it is nested. The body has to CLIP — a photograph must not
// spill past its pane — but the outer rim glow has to spill, because that is the
// whole point of it. One composition cannot do both. So: an outer wrapper that
// clips nothing, holding the glow, then the clipped body, then the leading edge.
// The 3D rotation lives on the wrapper so the three move together.
//
// .refl IS NOW BUILT — the mirrored, blurred, gradient-masked reflection under
// each pane, nested inside the pane's own composition so it inherits the drift,
// the rotation and the shot fade. It leans on two constructions this engine has
// now verified in a real render: gradient fills (probe, 2026-09-03) and
// mask_mode 'alpha' over the element one track below (the MEvid face-wall iris).
// The mirror itself is y_scale:'-100%', which is the one part not yet proven in
// a render — if it comes back unflipped the reflection still reads, just wrong
// way up, and that is a one-property fix.
function glassPane(p, it, W, H, S, refl = true) {
  const pc = (v) => `${(v * 100).toFixed(3)}%`;
  const boxW = p.w * W, boxH = p.h * H;

  const wantsPhoto = !!p.photo && !it.green;
  const seenFrac = glassVisible(boxW, boxH, it.w || 0, it.h || 0);

  // THE HERO is exempt from the crop guard. It is never a tight crop, and its
  // framing belongs to the user — the Fix-framing control governs the main
  // photograph and face detection must not quietly overrule it.
  //
  // An ACCENT pane has to earn its picture twice: the crop must not be tighter
  // than MIN_VISIBLE, and a face must be reachable inside the part of the pane
  // that is on screen. Fail either and the pane is plain glass. `crop` is the
  // eye-anchored framing override, fed through the engine's ordinary framing
  // path so nothing about coverBox has to know faces exist. The user's own zoom
  // is preserved; only the position is overruled.
  let shot = it, crop = null;
  // `soft` panes opt out of the min-visible floor. That floor exists to stop a
  // pane READ AS A WINDOW from showing an unrecognisable sliver of the picture.
  // A reflection wing is not read as a window — it is read as a reflection, at
  // 42% over a bright wall, and a soft vertical slice of the photograph is
  // exactly what one looks like. Without this the Gallery layout's wings are
  // rejected (0.14 visible against a 0.18 floor) and the wide margins Josh
  // asked for come back empty, which is the opposite of the point.
  if (wantsPhoto && !p.hero && (p.soft || seenFrac >= GLASS_MIN_VISIBLE)) {
    // Ask for a closer view than the hero's. GLASS_ACCENT_ZOOM is the target;
    // the solver clamps it down if a face would end up oversized, so this is a
    // request, not a command. Panes alternate between two strengths so that two
    // accents in the same shot are not identical to each other either.
    const base = photoFramingBias(it).z;
    const want = base * GLASS_ACCENT_ZOOM * (p.face ? 1.18 : 1);
    crop = glassSafeCrop(p, it, want);
    if (crop) shot = { ...it, framing: { x: crop.x, y: crop.y, z: crop.z * 100 } };
  }
  const gentle = wantsPhoto && (p.hero ? seenFrac > 0 : !!crop);
  const front = !p.behind && !p.hero;
  // How much of the white edge survives where a pane runs across the photograph.
  // paneHTML: clear glass keeps .20, a pane carrying its own picture keeps .80,
  // because there the line bounds its own content instead of scoring someone
  // else's. Only panes IN FRONT of the hero can cross it.
  const dim = front ? (gentle ? 0.80 : (p.dim == null ? 0.30 : p.dim)) : 1;

  const body = [];
  if (gentle) {
    withBorder([applyPhotoColor({
      type: 'image', source: it.url, ...coverBox(shot, boxW, boxH),
      ...(p.op != null ? { opacity: `${Math.round(p.op * 100)}%` } : {}),
    }, it)], it, boxW, boxH, Math.min(W, H)).forEach((el) => body.push(el));
    // .cool — a cool multiply tint on accent panes. Without it a photo at 34%
    // opacity on a light wall fades to nothing, which is most of why the accent
    // panes in 007 read as empty even where they did carry a picture.
    //
    // 2026-09-03: this now runs on EVERY pane, not only accents. Josh wants the
    // room as WHITE as possible, and on a white wall a MULTIPLY has full range
    // while white-on-white has almost none — see the note above glassRoom. The
    // cool body IS the glass here. Accents keep the stronger mix because they
    // also have to hold a dimmed photograph.
    body.push({
      type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      fill_mode: 'linear', fill_x0: '18%', fill_y0: '0%', fill_x1: '82%', fill_y1: '100%',
      fill_color: p.accent
        ? [{ offset: '0%', color: 'rgba(196,214,232,0.55)' }, { offset: '100%', color: 'rgba(228,236,244,0.30)' }]
        : [{ offset: '0%', color: 'rgba(196,214,232,0.30)' }, { offset: '100%', color: 'rgba(228,236,244,0.16)' }],
      blend_mode: 'multiply',
    });
  } else {
    // Plain glass — and note this is where an accent pane lands whenever the
    // crop guard says no. The blurred-photograph fallback that stood here
    // briefly is gone: Josh asked for the reference behaviour exactly, and the
    // reference degrades to glass. It also means a photo whose faces have not
    // been detected yet gives glass rather than a guess, so nothing unsafe can
    // render while the detection job is still working through a library.
    //
    // The prototype fills it with a 150-degree gradient, white to a cool grey at
    // just over half the opacity — not a flat wash.
    const f = (p.frost == null ? 0.20 : p.frost);
    body.push({
      type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      fill_mode: 'linear', fill_x0: '14%', fill_y0: '0%', fill_x1: '86%', fill_y1: '100%',
      fill_color: [
        { offset: '0%', color: `rgba(255,255,255,${f.toFixed(3)})` },
        { offset: '100%', color: `rgba(226,236,246,${(f * 0.55).toFixed(3)})` },
      ],
    });
    // and the same cool body, because a frost made of WHITE is invisible on a
    // white wall. Measured: white at 0.20 over a 228 wall lifts it 4 levels.
    body.push({
      type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      fill_mode: 'linear', fill_x0: '18%', fill_y0: '0%', fill_x1: '82%', fill_y1: '100%',
      fill_color: [{ offset: '0%', color: 'rgba(196,214,232,0.26)' }, { offset: '100%', color: 'rgba(228,236,244,0.13)' }],
      blend_mode: 'multiply',
    });
  }

  // .sheen — a DIAGONAL STREAK, not a film. This is the distinction the first
  // port lost: a band of light crossing the pane at 108 degrees, transparent at
  // 26%, peaking at .42 by 44%, gone again by 70%. Because it is a band and not a
  // wash it can sit over a photograph without lifting the whole picture — which
  // is exactly what the flat version did, and why it had to come off entirely.
  body.push({
    type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    blend_mode: 'screen',
    fill_mode: 'linear', fill_x0: '96%', fill_y0: '0%', fill_x1: '4%', fill_y1: '100%',
    fill_color: [
      { offset: '0%', color: 'rgba(255,255,255,0)' },
      { offset: '26%', color: 'rgba(255,255,255,0)' },
      { offset: '44%', color: `rgba(255,255,255,${(0.42 * (gentle ? 0.62 : 1)).toFixed(3)})` },
      { offset: '58%', color: 'rgba(255,255,255,0.06)' },
      { offset: '70%', color: 'rgba(255,255,255,0)' },
      { offset: '100%', color: 'rgba(255,255,255,0)' },
    ],
  });

  // ---- THE EDGE, AND THE BUG THAT MADE IT BLACK -------------------------
  //
  // Josh, on render 007: "All the edges look wrong. They Look Black not White."
  // On V4 it got worse, and V4 is what finally made it measurable. A vertical
  // scan across a pane's top edge, on a background sitting at 241/255:
  //
  //     y88 240   <- wall
  //     y91 157   <- the "white" edge
  //     y97 229   <- inside the pane
  //
  // Six pixels of DARK where a white rim should be, and no bright pixel
  // anywhere near it. The edge was not dim, it was inverted.
  //
  // WHAT CAUSES IT. Those layers were STROKED shapes — no fill, or rather
  // `fill_color: 'rgba(0,0,0,0)'` — carrying blur_radius and blend_mode
  // 'screen'. Blur a shape whose fill is transparent BLACK and, with a
  // non-premultiplied blur, the black bleeds into the stroke: what comes out is
  // grey, around 150-180, not white. Screen blending does not rescue it.
  //
  // The proof is that the SAME three properties on a FILLED shape are fine.
  // Render 005's light beams are white fill + blur + screen and they measured
  // 86 -> 178 over a dark photo: bright, exactly as intended. And Neon Frame's
  // halo is a blurred stroke too — it has always come out grey — but Neon sits
  // on a BLACK background, where a grey halo still reads as a glow, so nobody
  // ever noticed. Glass put the same construction on a light grey wall and the
  // grey read as black.
  //
  // THE RULE FOR THIS ENGINE: a filled shape may be blurred. A stroked shape
  // may not. Everything below is crisp — three unblurred strokes of decreasing
  // width and increasing opacity approximate the bloom instead, which costs
  // nothing and cannot invert.
  const edgePx = Math.max(2, Math.round(H * 0.0022));

  // ---- THE EDGE, REBUILT FOR A WHITE ROOM -------------------------------
  //
  // The first version of this drew three white strokes of decreasing width, on
  // the theory that stacking crisp strokes would fake the prototype's bloom
  // without the blur that turns a stroked shape grey. The strokes are correct.
  // The COLOUR was not.
  //
  // Josh: "I want the room as white as possible." A white line on a white wall
  // has almost nowhere to go, and the probe render measured exactly how little:
  // screen-blended white reaches 75% of its ideal lift, so on a 228 wall the hot
  // rim gains 20 levels and the frost gains 4. That is inside h264's noise. It
  // is why render 017's panes read as wireframe: the material was arriving and
  // had no room to be seen.
  //
  // So the glass is drawn by its DARK side, which is also how glass actually
  // looks against white — you see a sheet of glass on a white table by its
  // shadow, its faintly cool body and a thin refracted edge, not because it is
  // brighter than the table. White survives only as a small specular hit where
  // light catches an edge.
  //
  // Every layer below is a DARKENING operation, so the whiter the room the
  // STRONGER this reads. Josh's preference and the renderer now want the same
  // thing, which was not true an hour ago.
  // Josh on 019: "there is a thin dark blue line on some of the frames that
  // needs to be dialed back". This is that line. At 0.55 alpha in a blue-grey it
  // read as drawn-on rather than as a refracted edge — measured on the far-left
  // pane of frame 31, the darkest pixels sat around 110 with blue running 10-25
  // above red. Softer, and much closer to neutral: the edge should say "there is
  // glass here", not draw a line.
  const coolEdge = (a) => `rgba(150,163,178,${(a * 0.52).toFixed(3)})`;

  // 1. The refracted edge: a fine cool-grey line all the way round. This is the
  //    layer that separates pane from wall, and it has full range on white.
  body.push({
    type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    fill_color: 'rgba(0,0,0,0)', stroke_color: coolEdge(0.55 * dim),
    stroke_width: `${Math.max(1, Math.round(edgePx * 1.2))} px`,
  });
  // 2. Just inside it, a paler line — the second surface of the sheet. Glass has
  //    thickness and this is what says so.
  body.push({
    type: 'shape', path: GLASS_RECT, width: '99.0%', height: '99.0%',
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    fill_color: 'rgba(0,0,0,0)', stroke_color: `rgba(216,228,240,${(0.80 * dim).toFixed(3)})`,
    stroke_width: '1 px',
  });
  // 3. THE SPECULAR, and only where light would actually catch: the leading
  //    vertical edge and the top. Not a uniform white box — a box outlined in
  //    white on white is the thing that failed. These are filled shapes, never
  //    stroked, so they may carry blur if we ever want to soften them.
  const spec = (w, h, x, y) => ({
    type: 'shape', path: GLASS_RECT,
    width: w, height: h, x, y, x_anchor: '50%', y_anchor: '50%',
    fill_color: '#FFFFFF', blend_mode: 'screen',
    opacity: `${Math.round(92 * dim)}%`,
  });
  body.push(spec(`${Math.max(2, Math.round(edgePx * 1.4))} px`, '100%', '0.4%', '50%'));
  body.push(spec('100%', `${Math.max(1, Math.round(edgePx))} px`, '50%', '0.3%'));

  const bodyComp = {
    type: 'composition', clip: true,
    width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    // .rim's fourth shadow: 0 30px 70px rgba(45,60,80,.20). Far softer and lower
    // than the port's 5vmin/2vmin, which drew a hard dark line round every pane.
    shadow_color: 'rgba(45,60,80,0.20)',
    shadow_blur: `${(70 / GLASS_FH * 100 * H / Math.min(W, H)).toFixed(2)}vmin`,
    shadow_x: '0vmin', shadow_y: `${(30 / GLASS_FH * 100 * H / Math.min(W, H)).toFixed(2)}vmin`,
    elements: body,
  };

  // The outer half of the rim, living outside the clip so it reaches the wall.
  // Crisp, for the reason above: two strokes rather than one blurred one.
  const glowOuter = {
    type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    fill_color: 'rgba(0,0,0,0)', stroke_color: '#FFFFFF',
    stroke_width: `${Math.max(3, Math.round(edgePx * 9))} px`,
    opacity: `${Math.max(1, Math.round(16 * dim))}%`,
  };
  const glowInner = {
    type: 'shape', path: GLASS_RECT, width: '100%', height: '100%',
    x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    fill_color: 'rgba(0,0,0,0)', stroke_color: '#FFFFFF',
    stroke_width: `${Math.max(2, Math.round(edgePx * 4.5))} px`,
    opacity: `${Math.max(1, Math.round(30 * dim))}%`,
  };

  // .lead — the hot highlight down the leading edge, with its own glow. On the
  // hero the prototype puts a second, softer one down the trailing edge.
  const leadW = Math.max(2, Math.round(H * 0.0028));
  const lead = (side, op) => ({
    type: 'shape', path: GLASS_RECT,
    width: `${(leadW / boxW * 100).toFixed(3)}%`, height: '104%',
    x: side === 'left' ? '0%' : '100%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    fill_color: '#FFFFFF', blend_mode: 'screen',
    blur_radius: Math.round(H * 0.007), blur_mode: 'stack',
    opacity: `${Math.round(op * dim)}%`,
  });

  // ---- THE DROP SHADOW --------------------------------------------------
  // .rim's fourth shadow: 0 30px 70px rgba(45,60,80,.20). On a white room this
  // is the single most important layer in the style — it is what puts a pane IN
  // FRONT OF the wall instead of drawn on it, and unlike every white layer it
  // has the full range of the wall to work with.
  //
  // A FILLED shape carrying blur, never a stroked one. That distinction is the
  // whole reason renders 007 through 017 had black edges, and the probe
  // measured a blurred stroke contributing 139 against a 137 wall — nothing at
  // all. Filled + blurred is verified good.
  const shadow = {
    type: 'shape', path: GLASS_RECT,
    width: '100%', height: '100%',
    x: '50%', y: `${(50 + (H * 0.028) / boxH * 100).toFixed(3)}%`,
    x_anchor: '50%', y_anchor: '50%',
    fill_color: '#2D3C50',
    blur_radius: Math.round(H * 0.033), blur_mode: 'stack',
    opacity: `${Math.round(26 * (front ? 0.55 : 1))}%`,
  };

  // ---- .refl — THE REFLECTION -------------------------------------------
  // Never built until now; the file has carried a "STILL MISSING vs the
  // prototype" note since the port. The prototype mirrors the pane below itself
  // at 20%, blurs it 3px and fades it out with a gradient mask by 58%.
  //
  // The mirror is y_scale:'-100%'. The fade is a gradient-filled shape with
  // mask_mode 'alpha' over the element one track below, which is the same
  // primitive the MEvid face-wall iris is built on and is verified working.
  // Gradient fills themselves were verified by the probe render.
  //
  // Like the shadow, a reflection is a DARKENING of the floor, so it gains
  // strength as the room gets whiter.
  // The reflection lives INSIDE the pane's own composition, sitting just below
  // it in the pane's local coordinates. That way it inherits the drift, the
  // rotation, the perspective and the shot's fade for free — a reflection that
  // stayed put while its pane moved, or lingered after the pane faded, would be
  // worse than none at all.
  //
  // COST. The reflection duplicates bodyComp, so it is most of why Glass is the
  // heaviest style in the engine: ~1,900 elements and 260 blurred ones for a 48s
  // eight-photo piece, which Creatomate takes 20+ minutes to render even as a
  // half-scale watermarked draft. Josh asked for it behind a switch so drafts
  // come back quickly and only the finished export pays. `refl` is that switch;
  // when it is off the pane is built exactly as before, minus this one layer.
  const reflFrac = 0.42;                       // of the pane's own height
  const reflEl = !refl ? null : {
    type: 'composition',
    width: '100%', height: `${(reflFrac * 100).toFixed(1)}%`,
    x: '50%', y: `${(100 + (reflFrac * 100) / 2).toFixed(1)}%`,
    x_anchor: '50%', y_anchor: '50%',
    opacity: `${Math.max(1, Math.round(20 * dim))}%`,
    elements: [
      { type: 'composition', track: 1,
        width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        y_scale: '-100%',
        blur_radius: Math.max(2, Math.round(H * 0.004)), blur_mode: 'stack',
        elements: [{ ...bodyComp }] },
      // the fade: strongest nearest the pane, gone by 58%
      { type: 'shape', path: GLASS_RECT, track: 2,
        width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        mask_mode: 'alpha',
        fill_mode: 'linear', fill_x0: '50%', fill_y0: '0%', fill_x1: '50%', fill_y1: '100%',
        fill_color: [
          { offset: '0%', color: 'rgba(0,0,0,0.85)' },
          { offset: '58%', color: 'rgba(0,0,0,0)' },
          { offset: '100%', color: 'rgba(0,0,0,0)' },
        ] },
    ],
  };

  const wrap = {
    type: 'composition',
    x: pc(p.x + p.w / 2), y: pc(p.y + p.h / 2),
    width: pc(p.w), height: pc(p.h),
    x_anchor: '50%', y_anchor: '50%',
    // Order is back-to-front. The reflection and the drop shadow go FIRST,
    // because on a white room they are what the eye actually reads.
    elements: [...(reflEl ? [reflEl] : []), shadow, glowOuter, glowInner, bodyComp, lead('left', 96), ...(p.hero ? [lead('right', 67)] : [])],
  };
  // Camera distance. Larger = flatter. The prototype's stage uses
  // perspective:1600px on a 1920-wide frame, so it scales with width. Set on
  // EVERY pane, not only the pre-rotated ones: the drift turns all of them.
  wrap.perspective = Math.round(W * (1600 / GLASS_FW));
  if (p.ry) wrap.y_rotation = `${p.ry}°`;
  return wrap;
}

// ---- LAYOUTS ---------------------------------------------------------------
// A DIRECT PORT of layoutFor() in motion.html, in the prototype's own pixel
// units, then normalised. Two rooms for wide photographs, three for tall ones,
// all from frames Josh chose: the rack (23/24), the hinged wings (19), the
// wings-and-blades portrait (17), the off-centre portrait (10) and its mirror.
//
// growOutward is applied exactly as the prototype applies it — every pane that
// is not clear glass and not the hero grows 20%, ANCHORED ON ITS INNER EDGE so
// it reaches further out into the margin and not one pixel further toward the
// middle. That was Josh's instruction and the first port simply did not do it.
function glassGrow(p, k) {
  if (!p.photo || p.hero) return p;
  const w = p.w * k, h = p.h * k;
  const leftSide = (p.x + p.w / 2) < GLASS_FW / 2;
  return { ...p, x: leftSide ? (p.x + p.w) - w : p.x, y: p.y - (h - p.h) / 2, w, h };
}

function glassLayout(it, variant) {
  const ar = (it.w > 0 && it.h > 0) ? it.w / it.h : 1.6;
  const land = ar >= 1;
  const F = GLASS_FW, G = GLASS_FH;
  let L;

  if (land && variant % 3 === 0) {
    // ---- L1: THE RACK (frames 23 + 24) -------------------------------------
    // Blades are positioned by their INNER edge — how far each may reach across
    // the hero — not by an arbitrary x. A wide hero leaves only ~190px of
    // margin, so placing a blade by its left edge puts it deep over the photo.
    const hw = 1540, hh = Math.round(hw / ar);
    const hx = Math.round((F - hw) / 2), hy = Math.round((G - hh) / 2);
    const inL = (over, w) => hx + over - w;
    const inR = (over) => hx + hw - over;
    L = { kind: 'land', hero: { x: hx, y: hy, w: hw, h: hh, ry: -3, photo: true, hero: true }, panes: [
      { x: inL(60, 250), y: 0, w: 250, h: 1080, ry: 20, frost: 0.22, zi: 30 },
      { x: inL(40, 200), y: 110, w: 200, h: 930, ry: 15, photo: true, op: 0.40, accent: true, face: 0, zi: 31 },
      { x: inL(75, 165), y: 240, w: 165, h: 700, ry: 10, photo: true, op: 0.55, accent: true, face: 1, zi: 32 },
      { x: inR(30), y: 150, w: 220, h: 820, ry: -12, frost: 0.18, zi: 30 },
      { x: inR(70), y: 60, w: 210, h: 1000, ry: -17, photo: true, op: 0.45, accent: true, face: 0, zi: 31 },
    ] };
  } else if (land && variant % 3 === 1) {
    // ---- L3: THE GALLERY ----------------------------------------------------
    // Josh, on the two v6 grabs he sent: "one of the things I like about the
    // grabs I just gave you is that the hero shot is not full frame. allowing
    // the side panels to have reflections and not cover the hero much."
    //
    // Measured on those grabs, the hero is 72% and 71% of the frame width. The
    // rack puts it at 80% and a wide photograph then runs it nearly edge to
    // edge, which squeezes the side panes into slivers with nothing readable
    // in them - the whole reason the room looked bare on landscape shots.
    //
    // So this layout gives the hero 72% and spends the rest on the sides: two
    // wide photo-carrying wings that sit ENTIRELY OUTSIDE the hero (they are
    // sized from the actual margin, so they cannot creep over it whatever the
    // photo's shape), a frosted sheet behind each for depth, and two thin
    // blades that only kiss the hero's edges - the bright rim in the grabs.
    const hw = Math.round(F * 0.72), hh = Math.min(1010, Math.round(hw / ar));
    const hx = Math.round((F - hw) / 2), hy = Math.round((G - hh) / 2);
    const marginL = hx + 30, marginR = F - (hx + hw) + 30;
    L = { kind: 'land', hero: { x: hx, y: hy, w: hw, h: hh, ry: -2, photo: true, hero: true }, panes: [
      { x: -80, y: 140, w: 320, h: 800, ry: 20, frost: 0.20, behind: true, zi: 4 },
      { x: F - 240, y: 140, w: 320, h: 800, ry: -20, frost: 0.20, behind: true, zi: 4 },
      { x: -40, y: 60, w: Math.max(240, marginL), h: 960, ry: 26, photo: true, op: 0.42, accent: true, soft: true, behind: true, face: 0, zi: 5 },
      { x: hx + hw - 30, y: 60, w: Math.max(240, marginR), h: 960, ry: -26, photo: true, op: 0.42, accent: true, soft: true, behind: true, face: 1, zi: 5 },
      { x: hx - 90, y: 40, w: 150, h: 1000, ry: 12, frost: 0.24, zi: 30 },
      { x: hx + hw - 60, y: 40, w: 150, h: 1000, ry: -12, frost: 0.24, zi: 30 },
    ] };
  } else if (land) {
    // ---- L2: HINGED WINGS (frame 19) ---------------------------------------
    const hw = 1400, hh = Math.round(hw / ar);
    const hx = Math.round((F - hw) / 2), hy = Math.round((G - hh) / 2);
    L = { kind: 'land', hero: { x: hx, y: hy, w: hw, h: hh, ry: -3, photo: true, hero: true }, panes: [
      { x: -40, y: 20, w: 560, h: 1040, ry: 44, frost: 0.16, behind: true, zi: 4 },
      { x: F - 520, y: 20, w: 560, h: 1040, ry: -44, frost: 0.16, behind: true, zi: 4 },
      { x: 150, y: 120, w: 300, h: 840, ry: 30, photo: true, op: 0.34, accent: true, behind: true, face: 1, zi: 5 },
      { x: F - 450, y: 120, w: 300, h: 840, ry: -30, photo: true, op: 0.34, accent: true, behind: true, face: 0, zi: 5 },
      { x: hx - 150, y: 60, w: 200, h: 960, ry: 15, frost: 0.24, zi: 30 },
      { x: hx + hw - 50, y: 60, w: 200, h: 960, ry: -15, frost: 0.24, zi: 30 },
    ] };
  } else if (variant % 3 === 0) {
    // ---- P1: WINGS + BLADES (frame 17) -------------------------------------
    const hh = 1010, hw = Math.round(hh * ar);
    const hx = Math.round((F - hw) / 2), hy = Math.round((G - hh) / 2);
    L = { kind: 'port', hero: { x: hx, y: hy, w: hw, h: hh, ry: -2, photo: true, hero: true }, panes: [
      { x: 120, y: 130, w: 470, h: 830, ry: 36, frost: 0.16, behind: true, zi: 4 },
      // The right wing carries the picture — a wide, generous crop, so it is a
      // second view into the same moment rather than a smaller copy of it.
      { x: F - 590, y: 130, w: 470, h: 830, ry: -36, photo: true, op: 0.40, accent: true, behind: true, face: 0, zi: 4 },
      { x: -10, y: 50, w: 330, h: 980, ry: 26, frost: 0.22, behind: true, zi: 5 },
      // ...and the far-right pane sits ON TOP of it.
      { x: F - 320, y: 50, w: 330, h: 980, ry: -26, frost: 0.22, behind: true, zi: 8 },
      { x: 250, y: 300, w: 190, h: 560, ry: 22, photo: true, op: 0.30, accent: true, behind: true, face: 1, zi: 6 },
      { x: hx - 130, y: 0, w: 240, h: 1080, ry: 14, frost: 0.24, zi: 30 },
      { x: hx + hw - 110, y: 60, w: 210, h: 960, ry: -14, frost: 0.20, zi: 30 },
    ] };
  } else if (variant % 3 === 2) {
    // ---- P3: P2 MIRRORED — hero RIGHT, the wide pane LEFT -------------------
    const hh = 990, hw = Math.round(hh * ar);
    const hx = Math.round(F * 0.66 - hw / 2), hy = Math.round((G - hh) / 2);
    L = { kind: 'port', hero: { x: hx, y: hy, w: hw, h: hh, ry: 3, photo: true, hero: true }, panes: [
      { x: F - 220, y: 150, w: 300, h: 800, ry: -22, frost: 0.20, behind: true, zi: 4 },
      // Kept fully on screen: a photo-carrying pane that runs off the frame can
      // end up showing a part of the picture nobody aimed at.
      { x: 60, y: 400, w: 940, h: 330, ry: 8, photo: true, op: 0.38, accent: true, behind: true, face: 0, zi: 6 },
      { x: 40, y: 90, w: 340, h: 900, ry: 24, frost: 0.18, behind: true, zi: 7 },
      { x: hx + hw + 10, y: 260, w: 200, h: 640, ry: -18, photo: true, op: 0.34, accent: true, behind: true, face: 1, zi: 6 },
      { x: hx + hw - 100, y: 20, w: 220, h: 1040, ry: -13, frost: 0.24, zi: 30 },
      { x: hx - 100, y: 80, w: 200, h: 940, ry: 13, frost: 0.20, zi: 30 },
    ] };
  } else {
    // ---- P2: OFF-CENTRE, WIDE PANE CROSSING BEHIND (frame 10) --------------
    const hh = 990, hw = Math.round(hh * ar);
    const hx = Math.round(F * 0.34 - hw / 2), hy = Math.round((G - hh) / 2);
    L = { kind: 'port', hero: { x: hx, y: hy, w: hw, h: hh, ry: -3, photo: true, hero: true }, panes: [
      { x: -80, y: 150, w: 300, h: 800, ry: 22, frost: 0.20, behind: true, zi: 4 },
      { x: hx + hw - 40, y: 400, w: Math.min(940, F - (hx + hw - 40) - 20), h: 330, ry: -8, photo: true, op: 0.38, accent: true, behind: true, face: 0, zi: 6 },
      { x: F - 380, y: 90, w: 340, h: 900, ry: -24, frost: 0.18, behind: true, zi: 7 },
      { x: hx - 210, y: 260, w: 200, h: 640, ry: 18, photo: true, op: 0.34, accent: true, behind: true, face: 1, zi: 6 },
      { x: hx - 120, y: 20, w: 220, h: 1040, ry: 13, frost: 0.24, zi: 30 },
      { x: hx + hw - 100, y: 80, w: 200, h: 940, ry: -13, frost: 0.20, zi: 30 },
    ] };
  }

  // Grow the picture-carrying panes 20% outward, then convert the whole layout
  // from prototype pixels to frame fractions.
  const norm = (p) => ({ ...p, x: p.x / F, y: p.y / G, w: p.w / F, h: p.h / G });
  return { kind: L.kind, hero: norm(L.hero), panes: L.panes.map((p) => norm(glassGrow(p, 1.2))) };
}
// switched on.
const GLASS_EASE = 'sinusoid-in-out';

// ---- THE CLEAN WINDOW ------------------------------------------------------
// Robyn's note on V6: the main image should BREAK THROUGH the panes moving over
// it, and the picture should be crisp and clean for a second and a half before
// the transition.
//
// So a shot is now in two acts. First the room: panes drift across and over the
// photograph — the part she liked. Then they part: the panes in FRONT of the
// hero slide outward off the picture and fade away, the hero pushes very
// slightly forward, and the photograph is left alone and unobstructed for the
// rest of the shot. The panes BEHIND the hero never crossed it, so they stay —
// clearing those too would just empty the room.
const GLASS_CLEAN_S = 1.5;
// How much of a shot the room keeps before the panes part and hand the
// photograph over. A SHARE, so a longer shot does not mean a longer wait.
const GLASS_HOLD_SHARE = 0.28;

// The budget, in the shot's OWN time. A shot dissolves in over its first `blend`
// seconds and the next one starts dissolving in at `step`, so the picture is on
// screen alone from `blend` to `step` and the clean window is [open, step].
//
// `hold` is how long the room runs before the panes part, `part` how long the
// parting takes, `open` the moment the picture is finally alone. The clean
// window is taken FIRST because it is the point of the exercise — but the room
// keeps at least `blend` plus a beat, or the panes would start leaving before
// the dissolve that brought them in has even finished. On a shot too short for
// all three the window shrinks rather than swallowing the shot.
function glassActs(step, blend) {
  const part = Math.min(0.85, Math.max(0.30, step * 0.22));
  const floor = Math.max(0.9, (blend || 0) + 0.45);
  // Josh, on render 023: "I want the Hero shot to disolve through the panels
  // earlier."
  //
  // The clean window was capped at GLASS_CLEAN_S and everything left over went
  // to `hold`, so the longer the shot the longer the panes sat on the
  // photograph: at step 6.0s that was hold 3.65s, part 0.85s, clean 1.5s — the
  // room owned three quarters of the shot and the picture got the last quarter.
  // Backwards. The room is the frame around the photograph, not the point of it.
  //
  // `hold` is now a SHARE of the shot and the clean window takes what is left,
  // which is the opposite of the old priority. It still cannot start before the
  // dissolve that brought the panes in has finished (`floor`), and the window
  // still shrinks rather than swallowing a short shot.
  const wantHold = Math.max(0.12, Math.min(step * GLASS_HOLD_SHARE, step - part - GLASS_CLEAN_S));
  const hold = Math.max(wantHold, Math.min(floor, step - part - 0.40));
  const clean = Math.max(0.40, step - part - hold);
  return { hold: +hold.toFixed(3), part: +part.toFixed(3), open: +(hold + part).toFixed(3), clean: +clean.toFixed(3) };
}

// Slow, unsynchronised drift. Movement is a POSITION and ROTATION change, never
// a change of box size: the photo is cover-cropped, so resizing its box re-crops
// the picture every frame and the result reads as camera shake.
//
// WHY THE ROTATION IS BACK, AND WHY IT IS THE FIX FOR THE JERK. Josh on the v9
// preview: "the movement is still jerky". Measured on a pane-only strip of that
// file, frame to frame: five or six frames of essentially NO change (mean grey
// delta 0.03-0.08) and then a jump (0.70-0.78), over and over. That is the exact
// signature of sub-pixel motion being snapped to whole pixels — the pane sits
// still for a fifth of a second and then hops.
//
// The arithmetic says the same thing. The prototype drifts a pane 26px over a
// shot, which at 4.6s and 30fps is 0.19 pixels per frame. No renderer that
// rounds to whole pixels can make that look continuous.
//
// The prototype does not suffer from it because its drift() also turns each pane
// on its vertical axis (+-2.2 degrees) and nudges it vertically. A rotation
// RESAMPLES the pane every frame instead of translating it, so the pixels change
// continuously however small the angle. The port kept only the horizontal shift
// and so kept only the part that quantises. Both are restored, at the
// prototype's own amounts.
// THE PANE SLIDE, the other half of the prototype's transition.
//
//     const away = p.hero ? 0 : (p.x < FRAME_W/2 ? -1 : 1) * o.slide * 190;
//     outgoing  slide =  e * 0.8        ->  away runs 0 -> +-152px
//     incoming  slide = (1 - e) * -0.8  ->  away runs -+152px -> 0
//
// So the room OPENS as a shot arrives — panes fly outward from the middle into
// their resting places — and opens further as it leaves. The hero never moves;
// it holds its ground while the furniture travels. That is what makes the
// handover read as a room changing rather than two pictures swapping.
//
// It rides on top of the existing drift rather than replacing it: the drift is
// the slow wander across the whole shot, this is the fast move at each end.
// `arrive` and `leave` are in fractions of the frame width, signed by which
// half of the frame the pane lives in.
function glassDrift(el, k, dur, p, slide) {
  // THE SECOND MOVE, and why it happened. Josh on render 019: "there seems to be
  // a second move on every slide along the sides. it should have a consisten
  // steady graceful move."
  //
  // The drift direction alternated by pane index (k), while the slide direction
  // is set by which half of the frame the pane sits in. Whenever those two
  // disagreed the pane travelled OUT, stopped, came BACK, then went out again —
  // a reversal mid-shot, which reads as a second move. It was not two
  // animations, it was one animation changing its mind.
  //
  // With a slide, the drift now continues the slide's own direction, so the
  // whole shot is monotonic: the pane enters, keeps travelling the same way all
  // the way through, and leaves. One move, start to finish.
  const outward = (p && p.x != null && (p.x + (p.w || 0) / 2) < 0.5) ? -1 : 1;
  // MY SIGN ERROR, and the whole of Josh's "the pannels are moving in and out".
  //
  // A sliding pane travels x0-away -> x0 -> x0+dx -> x0+dx+away, and `away` is
  // +outward. So the entry and the exit both move OUTWARD. Setting dx to
  // -outward made the middle leg run backwards against both of them: out 7.9,
  // back 1.0, out 7.9 again. Two reversals per pane per shot, on 35 of 39
  // animated panes. I wrote "the drift now continues the slide's direction" in
  // the commit that introduced it, and it did the exact opposite.
  //
  // The drift must share the slide's sign. Then the pane enters, keeps going the
  // same way through the hold, and leaves: one continuous move, which is what
  // Josh asked for — "should be 1 fluid movement".
  const dir = slide && !(p && p.hero) ? outward : (k % 2 ? -1 : 1);
  const clear = !(p && p.photo);
  const kf = (from, to) => ([
    { time: 0, value: from, easing: GLASS_EASE }, { time: dur, value: to },
  ]);
  const x0 = parseFloat(el.x);
  // The hold drift at 26/16px was 7 px/sec against 122 px/sec on the transition
  // legs — a 17:1 ratio, which is not a slow drift, it is a stop with rounding
  // error. Raised so the pane is still visibly travelling through the shot
  // (~25 px/sec, about 5:1), which is the difference between "speeds up on the
  // transitions" and "moves only on the transitions".
  const dx = dir * ((clear ? 62 : 42) / GLASS_FW) * 100;
  if (slide && !(p && p.hero)) {
    // TRAVEL DISTANCE, measured against the reference rather than guessed.
    // Frame-to-frame pixel change during a transition: reference v6 peaks at
    // 19.0-26.8, render 021 at 7.4-9.8 — the panes are moving about a third as
    // much as they should. 152px over a 1.25s transition is 120 px/sec, which
    // is a drift, not a move. Doubled.
    const away = outward * (190 * 1.6 / GLASS_FW) * 100;   // +-304px as a % of frame width
    const inS = Math.min(slide.arrive, dur * 0.45);
    const outS = Math.min(slide.leave, dur * 0.45);
    const end = x0 + dx;
    // EASING IS THE OTHER HALF of "1 fluid movement". Direction alone is not
    // enough: an ease-IN-OUT brings velocity to ZERO at every keyframe, so a
    // pane that never reverses still visibly STOPS on arrival and again before
    // it leaves, and three legs separated by two dead stops read as three
    // moves. Putting GLASS_EASE on all four (c89503d) is what did that.
    //
    // So the pane is eased only at the two ends of its whole journey and runs
    // continuously in between: decelerate in, hold a slow LINEAR drift,
    // accelerate away. Velocity never reaches zero between the first keyframe
    // and the last, and it is fastest exactly during the transitions, which is
    // what Josh allowed for — "they can speed up on the transtions".
    el.x = [
      { time: 0, value: `${(x0 - away).toFixed(3)}%`, easing: 'quadratic-out' },
      { time: +inS.toFixed(3), value: `${x0.toFixed(3)}%`, easing: 'linear' },
      { time: +Math.max(inS + 0.01, dur - outS).toFixed(3), value: `${end.toFixed(3)}%`, easing: 'quadratic-in' },
      { time: +dur.toFixed(3), value: `${(end + away).toFixed(3)}%` },
    ];
  } else {
    el.x = kf(`${x0.toFixed(3)}%`, `${(x0 + dx).toFixed(3)}%`);
  }
  const y0 = parseFloat(el.y);
  const dy = dir * ((clear ? -8 : 6) / GLASS_FH) * 100;
  el.y = kf(`${y0.toFixed(3)}%`, `${(y0 + dy).toFixed(3)}%`);
  const ry = p && p.ry ? p.ry : 0;
  el.y_rotation = kf(`${ry}°`, `${(ry + dir * 2.2).toFixed(2)}°`);
  return el;
}

// The hero. It creeps forward all shot, then pushes a little harder exactly as
// the front panes part. That small acceleration is what makes the picture read
// as breaking THROUGH the panes rather than merely being uncovered by them.
function glassHero(el, dur, acts, p) {
  const kf = () => ([
    { time: 0, value: '100%', easing: GLASS_EASE },
    { time: acts.hold, value: '100.6%', easing: GLASS_EASE },
    { time: acts.open, value: '102.0%', easing: GLASS_EASE },
    { time: dur, value: '102.4%' },
  ]);
  el.x_scale = kf();
  el.y_scale = kf();
  // The prototype's hero also creeps up and left and turns 1.6 degrees. Same
  // reason as the panes: a rotation resamples every frame, so the hero's own
  // motion is continuous instead of stepping a pixel at a time.
  const pair = (a, b) => ([{ time: 0, value: a, easing: GLASS_EASE }, { time: dur, value: b }]);
  const x0 = parseFloat(el.x), y0 = parseFloat(el.y);
  el.x = pair(`${x0.toFixed(3)}%`, `${(x0 - 6 / GLASS_FW * 100).toFixed(3)}%`);
  el.y = pair(`${y0.toFixed(3)}%`, `${(y0 - 3 / GLASS_FH * 100).toFixed(3)}%`);
  const ry = p && p.ry ? p.ry : 0;
  el.y_rotation = pair(`${ry}°`, `${(ry + 1.6).toFixed(2)}°`);
  return el;
}

// A pane in FRONT of the hero, in TWO copies — because it must stop covering the
// photograph without leaving the room.
//
// Two notes got us here. First, render 007: Josh asked for the panes to fade
// through the picture rather than slide out of the way — "a sudden move of the
// panes to get out of the way" is an event, and it pulls the eye at exactly the
// moment the photograph is meant to be taking it. So there is no positional
// change beyond the drift the pane was already doing.
//
// Then the v9 preview, where they faded to nothing: "when the image burst
// through the panes they disappear. they should remain behind the image." Also
// right, and a better description of the effect than mine — the pane is not
// supposed to leave, it is supposed to end up BEHIND the photograph.
//
// Depth in this engine is draw order, and draw order cannot be animated. So the
// pane is emitted twice, identical in every way including its drift: one copy
// ahead of the hero fading OUT across the parting window, one copy behind it
// fading IN across the same window. The pane is continuously present; what
// changes is which side of the photograph it is on.
function glassPart(el, k, dur, acts, p, behindCopy, slide) {
  glassDrift(el, k, dur, p, slide);
  el.opacity = behindCopy
    ? [{ time: 0, value: '0%', easing: GLASS_EASE },
      { time: acts.hold, value: '0%', easing: GLASS_EASE },
      { time: acts.open, value: '100%' }]
    : [{ time: 0, value: '100%', easing: GLASS_EASE },
      { time: acts.hold, value: '100%', easing: GLASS_EASE },
      { time: acts.open, value: '0%' }];
  return el;
}

// Light beams: thin bright bars fanned from low centre, screen-blended, turning
// very slowly across the whole piece so the room is never quite still. They sit
// BEHIND the glass — in front they cut across the subject's face, which is
// backwards for a montage.
//
// That was the intent from the start, but the first build handed this a base
// track of 40 while the shots ran on track 2, and in Creatomate a HIGHER track
// renders ON TOP. So the rays were in front of every photograph — which is
// exactly what Robyn was looking at. The tracks are now laid out in the order
// the picture is built: background 1, rays 2-11, shots 14, cards 20,
// watermark 99. The rays pass behind the hero and show past its edges, which is
// the "spotlight rays behind the main image" she asked for.
function glassBeams(S, total, W, H, track) {
  const defs = [
    [-116, 4, 82], [-124, 2, 58], [-133, 5, 72], [-147, 2, 48],
    [-64, 4, 82], [-56, 2, 58], [-47, 5, 72], [-33, 2, 48],
    [-97, 3, 54], [-83, 3, 54],
  ];
  // MEASURED OFF RENDER 005 AND WIDENED. At 0.18-0.45% of frame height with a
  // 3-7px blur these came out 1-3px wide with hard shoulders: over a dark
  // photograph a ray lifted the pixels under it by 25-90 levels, so they read as
  // scratches on the picture rather than light in the room. Three changes —
  // roughly triple the height, four times the blur, and about half the opacity
  // to pay for the extra spread. A beam should be something you notice as
  // brightness, not as a line.
  //
  // The origin also drops below the bottom edge. At y:96% the fan converged to a
  // visible point inside the frame, which read as a bundle of wires meeting
  // rather than as a source of light somewhere past the room.
  return defs.map(([a, h, op], i) => ({
    name: `Beam-${i + 1}`, type: 'shape', track: track + i,
    time: 0, duration: +total.toFixed(3),
    path: GLASS_RECT,
    x: '50%', y: '112%', x_anchor: '0%', y_anchor: '50%',
    width: `${(84 + (i % 3) * 7)}%`, height: `${(h * 0.28).toFixed(2)}%`,
    fill_color: '#FFFFFF', blend_mode: 'screen',
    blur_radius: 14 + (i % 3) * 6, blur_mode: 'stack',
    opacity: `${Math.round(op * 0.55)}%`,
    // Eased at the turn-around too, so the sway has no visible corner in it.
    z_rotation: [
      { time: 0, value: `${a - 1.6}°`, easing: 'sinusoid-in-out' },
      { time: +(total / 2).toFixed(3), value: `${a + 1.6}°`, easing: 'sinusoid-in-out' },
      { time: +total.toFixed(3), value: `${a - 1.6}°` },
    ],
  }));
}

function glassSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null, light = true, refl = true }) {
  const items = seq.filter((it) => it.type !== 'placeholder');
  const n = Math.max(1, items.length);
  const cardS = includeCards ? CARD_S : 0;
  const step = Math.max(1.4, perPhoto != null ? perPhoto : (Number(S.photoS) || 3.4));
  // THE TRANSITION IS A FRACTION OF THE SHOT, not a fixed number of seconds.
  //
  // Josh, on render 022: "Perhaps the :48 changed the rhythm." It did, though
  // not by misaligning anything - the pane keyframes track the fade exactly at
  // every length. What changed is the PROPORTION. Length mode sets the step from
  // the requested total, so eight photos in 48s gives step 6.0s while fadeS
  // stayed pinned at 1.25s: the hold stretched 3.35s -> 4.75s and the share of
  // each shot actually in motion fell from 27% to 21%. Same style, slower pulse,
  // and the longer the montage the more it drifts toward stillness punctuated by
  // lurches.
  //
  // THE TRAP, which cost me a wrong fix first: by the time a builder sees `S`,
  // buildMontageSource has ALREADY overwritten S.photoS with the length-mode
  // pace and re-derived S.fadeS from it. So deriving a ratio from S.fadeS /
  // S.photoS gives back exactly the number you started with - it cancels. The
  // style's authored pace is not visible from in here, so the ratio is stated
  // as a constant instead. It is GLASS.fadeS / GLASS.photoS at the top of this
  // file; keep the two in step if either changes.
  const fade = Math.min(Math.max(step * GLASS_FADE_RATIO, 0.35), step * 0.35);
  const total = cardS + n * step + cardS;

  const elements = slideFamilyShell({ S, background, total, includeCards, title, subtitle, watermarkUrl, H });
  // THE ROOM sits on top of the shared background layer, not instead of it, so
  // an imported backdrop or a green screen still governs what is behind
  // everything. It is skipped whenever the user has chosen their own backdrop —
  // painting a grey room over someone's imported image would be nonsense, and
  // over green it would break the key.
  const ownBackdrop = !!(background && (background.green || background.url || background.videoUrl || background.textureUrl));
  if (!ownBackdrop) glassRoom(S, total, W, H).forEach((el) => elements.push(el));
  // The light beams are optional. They are the loudest thing in the room, and on
  // a busy imported background or a montage that wants to be quiet they are the
  // first thing you would turn off. Default on: they are most of what makes the
  // room feel lit rather than drawn.
  if (light !== false) glassBeams(S, total, W, H, GLASS_BEAM_TRACK).forEach((b) => elements.push(b));

  // Each variant is counted per SHAPE, so two wide photos in a row get different
  // rooms rather than the same one twice.
  const seen = { land: 0, port: 0 };
  const acts = glassActs(step, fade);

  // ---- THE DISSOLVE, DONE BY HAND ----------------------------------------
  // Render 005/006 flashed to an EMPTY ROOM at every single shot change — 15
  // times in a 54s montage. Frames either side of the 23.80s boundary: at 23.75
  // the outgoing photo is at full strength, at 23.90 the frame is completely
  // bare, at 24.10 the incoming is a ghost. The outgoing was hard-cutting out
  // and the incoming was fading up from the background.
  //
  // The cause is that this style pinned BOTH `time` and `duration` on adjacent
  // shots, which leaves a Creatomate transition animation nothing to overlap.
  // The styles that work omit `time` entirely and let the same-track
  // auto-sequencer make the overlap.
  //
  // Rather than depend on semantics a render has now twice disagreed with, the
  // dissolve is built explicitly, the way holdFade solves the same problem for
  // Hollywood: shots alternate between two tracks, each runs `fade` seconds long
  // into its successor, the EVEN ones are always fully opaque, and the ODD ones
  // — which sit on the higher track — fade in over the even shot beneath and
  // later fade out over the next one. Something is fully opaque at every instant,
  // so there is nothing for the background to show through.
  //
  // ---- AND WHY THAT DISSOLVE DID NOT HAPPEN EITHER -----------------------
  //
  // Render 004 measured, frame by frame, against the prototype:
  //
  //     prototype   every transition is a run of 0.83-1.00s, peak 19-27
  //     render 004  every transition is a run of 0.03s — ONE FRAME — peak 11-33
  //
  // So the hand-built dissolve was not dissolving. It was hard-cutting, which
  // is exactly what Josh reported: "there are no transitions, pics are
  // snapping."
  //
  // THE CAUSE. In the built source, exactly FOUR elements carry both a pinned
  // `time`/`duration` AND a keyframed `opacity` — the four odd-numbered shots,
  // which are precisely the ones that failed. The other 66 keyframed-opacity
  // elements in the same source have no pinned time, and those animate
  // correctly (the hero burst visibly ramps in the same render).
  //
  // That is the same shape as the bug recorded above: pinning both `time` and
  // `duration` on an element also stopped `transition: true` from overlapping.
  // The working assumption is that Creatomate treats a composition with both
  // pinned as a fixed slot and drops animation on it.
  //
  // THE FIX, which needs no such assumption to be true: keep the pinned
  // time/duration on an OUTER composition, which is what places the shot on the
  // timeline, and move the opacity keyframes to an INNER composition that
  // pins neither. The inner one animates across the outer one's life. If the
  // assumption is wrong the inner keyframes still work, so this is safe either
  // way.
  //
  // A probe swatch covering this exact construction has been added to
  // /api/admin/probe so the next run measures it rather than trusting it.
  //
  // WHAT THE ASYMMETRY COST. The scheme above gave keyframes to the ODD shots
  // only and left the even ones permanently opaque, so that something was
  // always fully covering the frame. Measured on render 004 at the 6.0s
  // boundary, by region:
  //
  //     left and centre (the outgoing photo)   unchanged, 0.1-0.4
  //     right (empty wall -> incoming photo)   244 -> 134 in ONE frame
  //
  // The incoming shot did not ramp at all. I could not establish why: Two Panel
  // and Hollywood build opacity the same way — keyframes on a composition that
  // pins time and duration — and neither hard-cuts (Two Panel measures 0 hard
  // cuts across 6 transitions). So the construction is not inherently broken
  // and my first theory about pinning was wrong.
  //
  // What IS different is the asymmetry. Hollywood's holdFade gives EVERY shot
  // the full fade-in/hold/fade-out set; Glass gave half its shots none. So
  // Glass now uses Hollywood's shape, which is the one that demonstrably
  // dissolves in a real render, rather than a bespoke one that does not. The
  // keyframes also live on an inner composition that pins nothing, which costs
  // nothing and removes the construction I could not clear.
  //
  // The old worry was a flash to an EMPTY room, which is what renders 005 and
  // 006 did. That came from the outgoing shot hard-cutting out while the
  // incoming faded up from nothing — a gap, not a cross-dissolve. Complementary
  // fades cannot produce a gap: as one falls the other rises over it.
  const shotEl = (i, name, inner) => {
    const first = i === 0;
    const last = i === items.length - 1;
    const odd = i % 2 === 1;
    const dur = +((last ? step : step + fade)).toFixed(3);

    const kf = [];
    if (first) kf.push({ time: 0, value: '100%' });
    else kf.push({ time: 0, value: '0%' }, { time: +fade.toFixed(3), value: '100%' });
    if (!last) kf.push(
      { time: +step.toFixed(3), value: '100%' },
      { time: +(step + fade).toFixed(3), value: '0%' },
    );

    // THE STAGE SLIDE — the part of the prototype's transition that was never
    // ported, and the reason Josh keeps saying the transition movement is off.
    //
    // The prototype moves the WHOLE SHOT through a transition:
    //     stage = renderShot(cur, { slide:  e * 0.8,       fade: 1 - e })
    //           + renderShot(nxt, { slide: (1 - e) * -0.8, fade: e     });
    // Hero and panes travel together; the outgoing picture leaves, the incoming
    // one arrives. This port slid only the side panes and cross-dissolved the
    // hero in place, so the main subject — the thing the eye is actually on —
    // never moved at all, while the panes around it did. Panes moving past a
    // static photograph is precisely "the pannels trying to hit the transition".
    //
    // Measured, total pixel change across one transition (fps-independent):
    // reference 150, render 023 114. Moving the stage is the missing quarter,
    // and more importantly it is the missing SHAPE.
    const A = (GLASS_STAGE_SLIDE / GLASS_FW) * 100;
    const xkf = [];
    if (first) xkf.push({ time: 0, value: '50%', easing: 'linear' });
    else xkf.push(
      { time: 0, value: `${(50 - A).toFixed(3)}%`, easing: 'quadratic-out' },
      { time: +fade.toFixed(3), value: '50%', easing: 'linear' },
    );
    if (!last) xkf.push(
      { time: +step.toFixed(3), value: '50%', easing: 'quadratic-in' },
      { time: +(step + fade).toFixed(3), value: `${(50 + A).toFixed(3)}%` },
    );

    return {
      name, type: 'composition',
      track: GLASS_SHOT_TRACK + (odd ? 1 : 0),
      time: +(cardS + i * step).toFixed(3),
      duration: dur,
      // The inner wrapper pins nothing; it exists only to carry the fade.
      elements: [{
        type: 'composition',
        width: '100%', height: '100%',
        y: '50%', x_anchor: '50%', y_anchor: '50%',
        x: xkf.length > 1 ? xkf : '50%',
        opacity: kf,
        elements: inner,
      }],
    };
  };

  items.forEach((it, i) => {
    if (it.green) {
      elements.push(shotEl(i, `Green-${i + 1}`, [
        { type: 'shape', track: 1, path: GLASS_RECT, width: '100%', height: '100%', fill_color: CHROMA_GREEN },
      ]));
      return;
    }
    const kind = (it.w > 0 && it.h > 0 && it.w < it.h) ? 'port' : 'land';
    const L = glassLayout(it, seen[kind]++);

    const inner = [];
    // DEPTH IS DRAW ORDER, and the prototype states it explicitly as a
    // z-index per pane with the hero at 20. The first port used array order
    // instead, which is NOT the same: in P1 the prototype puts the far-right
    // frost pane (zi 8) ABOVE the small accent blade (zi 6) and its own comment
    // says so — "and the far-right pane sits ON TOP of it" — while array order
    // put the accent above the frost. L1 differs too: zi 30,31,32,30,31 sorts
    // to a different stacking than 0,1,2,3,4.
    //
    // Josh on render 004: "I don't even think the layout of the boxes are the
    // same." The x/y/w/h/ry/frost/op numbers ARE an exact port — verified value
    // by value against motion.html — so what differed was which pane covers
    // which. Sorting by the prototype's own zi fixes that.
    const byZ = (a, b) => (a.zi == null ? 1 : a.zi) - (b.zi == null ? 1 : b.zi);
    const frontPanes = L.panes.filter((p) => !p.behind).slice().sort(byZ);
    const behindPanes = L.panes.filter((p) => p.behind).slice().sort(byZ);
    // Depth in this engine is draw order, so this ordering IS the depth: the
    // panes that live behind the hero, then the BEHIND copy of each front blade
    // (invisible until the picture comes through), then the hero, then the front
    // copy of each blade.
    // NO PER-PANE SLIDE ANY MORE. The transition move now belongs to the whole
    // stage (see shotEl), exactly as the prototype does it, so a pane's only job
    // inside a shot is its own slow unsynchronised drift. That is also the end of
    // a construction that produced the same bug twice: the per-pane version had
    // three legs whose directions had to be kept in agreement by hand, and I got
    // that agreement wrong in both directions on consecutive attempts. A single
    // two-keyframe drift cannot reverse.
    const slide = null;
    behindPanes.forEach((p, k) => inner.push(glassDrift(glassPane(p, it, W, H, S, refl), k, step, p, slide)));
    frontPanes.forEach((p, k) => inner.push(glassPart(glassPane(p, it, W, H, S, refl), k + 1, step, acts, p, true, slide)));
    inner.push(glassHero(glassPane(L.hero, it, W, H, S, refl), step, acts, L.hero));
    frontPanes.forEach((p, k) => inner.push(glassPart(glassPane(p, it, W, H, S, refl), k + 1, step, acts, p, false, slide)));

    elements.push(shotEl(i, `Glass-${i + 1}`, inner));
    // A light bar across every boundary — the transition window is exactly the
    // span where shot i is fading out under shot i+1 fading in.
    if (i < items.length - 1 && fade > 0.01) {
      elements.push(glassSweep(`Sweep-${i + 1}`, cardS + (i + 1) * step, fade, W, H));
    }
  });

  slideFamilyTail(elements, { includeCards, total, title, watermarkUrl, S, H });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

function buildMontageSourceInner({ photos, items, style = 'hollywood', title, subtitle, watermarkUrl, photoSeconds = null, totalSeconds = null, includeCards = true, width = 1920, height = 1080, background = null, greenBookends = true, assetBase = null, mpTransition = null, mpStagger = null, mpHold = null, mpSpeed = null, duoPalette = null, duoTreatment: duoTreat = null, glassLight = true, glassRefl = true, atmosphere = true, atmoOpts = null, frameW = null, frameColor = null }) {
  const base = STYLES[style] || STYLES.hollywood;
  // Unified play sequence: photos and (optional) green-screen video placeholders.
  // Back-compat: if only `photos` is passed, treat them all as photo items.
  const seq = Array.isArray(items) && items.length
    ? items
    : (photos || []).map((p) => ({ type: 'photo', url: p.url, framing: p.framing, w: p.w, h: p.h, faces: p.faces || null }));

  // LENGTH MODE (Josh: "I choose 100 images but want them to cycle through in 1
  // minute"). When totalSeconds is set, every style paces so the PHOTOS cycle in
  // that many seconds — per-photo time = totalSeconds / photo count (title cards,
  // if on, add their fixed few seconds on top). perPhoto is threaded into the
  // builders that otherwise use fixed pacing (walls, epic, polaroid). When it's
  // null, each style keeps its own default pace (or the seconds-per-photo value).
  const nPhotos = Math.max(1, seq.filter((it) => it.type === 'photo' || (it.type !== 'placeholder' && it.type !== 'green')).length);
  const perPhoto = (totalSeconds && Number(totalSeconds) > 0)
    ? Math.max(0.4, Math.min(12, Number(totalSeconds) / nPhotos))
    : null;
  const photoS = perPhoto != null ? perPhoto : (photoSeconds ? Math.min(10, Math.max(1, Number(photoSeconds))) : base.photoS);
  const fadeS = Math.min(base.fadeS, photoS * 0.4);
  // Duotone background colour. An unset palette keeps the style's own pairs, so
  // Duotone Split stays neon and the Pastel style stays pastel unless asked
  // otherwise — this adds a choice without changing what the existing styles do.
  const duoPal = duoPalette && DUO_PALETTES[duoPalette] ? DUO_PALETTES[duoPalette] : null;
  const S = {
    ...base, photoS, fadeS,
    ...(duoPal ? { pairs: duoPal.pairs } : {}),
    ...(duoTreat && DUO_TREATMENTS[duoTreat] ? { duoTreatment: duoTreat } : {}),
  };

  // Polaroid uses its own stacking-pile builder (prints pile up, not a
  // slideshow); every other style falls through to the per-photo loop below.
  const wrap = (src) => (greenBookends ? addGreenBookends(src, includeCards) : src);
  // In length mode, snap the finished montage to exactly totalSeconds.
  const finish = (src) => (perPhoto != null ? scaleMontageToLength(src, Number(totalSeconds)) : src);
  if (S.duotone && S.frantic) return finish(wrap(duotone2Source({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height })));
  if (S.twoPanel) return twoPanelSource({ S, seq, watermarkUrl, width, height, mp: { transition: mpTransition, stagger: mpStagger, hold: mpHold, speed: mpSpeed } });
  if (S.multipage) return multiPageSource({ S, seq, watermarkUrl, width, height, mp: { transition: mpTransition, stagger: mpStagger, hold: mpHold, speed: mpSpeed } });
  if (S.polaroid) return finish(wrap(polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto })));
  if (S.collage) return finish(wrap(collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, assetBase, perPhoto })));
  if (S.epic) return finish(wrap(epicVintageSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, assetBase, perPhoto })));
  if (S.story) return finish(wrap(storyBuilderSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto })));
  if (S.trendy) return finish(wrap(trendyWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, assetBase, perPhoto })));
  // Aspect-aware slide family. finish() (NOT wrap) — these inject green as real
  // full-frame beats themselves, and they must stay length-mode compatible, which
  // twoPanelSource/multiPageSource silently are not.
  // Basic cut takes NO cards and NO green bookends — a hard-cut green-screen
  // reel is meant to start on the first photograph, not on a title.
  if (S.framedBox) return finish(framedBoxSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, assetBase, perPhoto, atmosphere: atmosphere !== false, atmoOpts, frameW, frameColor }));
  if (S.basicCut) return basicCutSource({ S, seq, watermarkUrl, width, height, background, perPhoto });
  if (S.slidePush) return finish(slidingImagesSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto }));
  if (S.slideRail) return finish(photoSlideSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto }));
  if (S.multiSlide) return finish(multiSlideSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto }));
  if (S.glass) return finish(glassSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto, light: glassLight !== false, refl: glassRefl !== false }));
  if (S.ribbon) return finish(photoRibbonSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto }));
  if (S.neon) return finish(neonFrameSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto }));
  if (S.comic) return finish(comicBookSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, assetBase, perPhoto }));

  // STANDARD (slideshow) styles: the green screen IS the first & last photo —
  // a full-length solid-green slot that plays for a whole photo beat and
  // transitions exactly like a photo (Josh: "imagine the first photo was just
  // solid green... the final photo solid green"). Injected into the play
  // sequence so NO client photo is lost and it inherits this style's own
  // transition. (Wall/pile styles show many photos at once — a single full-frame
  // green photo can't sit in the grid — so those get a green frame at the head
  // and tail via addGreenBookends instead.)
  const gseq = greenBookends ? [{ type: 'green' }, ...seq, { type: 'green' }] : seq;

  const durOf = (it) => (it.type === 'placeholder' ? PLACEHOLDER_S : photoS);
  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const total = cardsTime + gseq.reduce((a, it) => a + durOf(it), 0) - Math.max(0, gseq.length - 1) * fadeS;

  const elements = [];

  // Persistent background behind every photo/card for the whole montage. Honours
  // the "Add background" control (green-screen default / imported image + tint);
  // with no control set it's the style colour. Without it, a Fit (contain) photo's
  // letterbox/pillar margins would reveal neighbouring photos instead of a clean
  // backdrop.
  // Shots here overlap each other by fadeS, so a bed's beat is the ADVANCE
  // (durOf - fadeS), not the shot's full length — otherwise every bed after the
  // first would land progressively later than the cut it belongs to. Green
  // bookends and video placeholders have no picture to blow up; bedShotsFor
  // folds their beats into the neighbouring bed so nothing drifts.
  const bedShots = (() => {
    const list = [];
    let carry = includeCards ? CARD_S : 0;
    for (const it of gseq) {
      const adv = Math.max(0.1, durOf(it) - fadeS);
      if (it.type === 'green' || it.type === 'placeholder' || !it.url) {
        if (list.length) list[list.length - 1].dur += adv; else carry += adv;
        continue;
      }
      if (!list.length) list.lead = carry;
      list.push({ url: it.url, dur: adv });
    }
    if (list.length && list.lead === undefined) list.lead = carry;
    return list.length ? list : null;
  })();
  bgLayers(background, S, { track: 1, time: 0, duration: total, shots: bedShots }).forEach((el) => elements.push(el));

  if (includeCards) {
    elements.push({
      name: 'Opening',
      type: 'composition',
      track: 2,
      duration: CARD_S,
      elements: card(S, { kicker: S.kicker, title, subtitle, height }),
    });
  }

  // Per-photo framing fix: shifts the image inside the frame. Cover-crop
  // shows the CENTER by default; moving the element down reveals more of the
  // image's TOP (keeps heads), etc.
  // The photo element is a 110% box (5% overscan each side) so a cover-crop always
  // FILLS the frame AND there's headroom to bias the crop for framing without
  // revealing the background. Shifts stay within that 5% margin.
  const FRAMING = {
    top: { y: '55%' },    // show top of photo (heads) — shifts image down 5%
    center: {},           // true centered crop (no shift)
    bottom: { y: '45%' }, // show bottom
    left: { x: '55%' },   // show left side
    right: { x: '45%' },  // show right side
  };

  let photoCount = 0;
  const seqStart = elements.length; // where the play-sequence elements begin (for hold-fade)
  gseq.forEach((it, i) => {
    if (it.type === 'green') {
      // A full-length solid-green PHOTO slot: same beat + same transition as a
      // real photo, but pure broadcast chroma green the editor keys their intro/
      // outro (or a transition clip) into. The FIRST slot hard-cuts to clean
      // green so the segment opens on a pristine key frame; the tail slot
      // transitions IN from the montage like any other photo, then holds green.
      elements.push({
        name: i === 0 ? 'GreenIn' : 'GreenOut',
        type: 'composition', track: 2, duration: photoS,
        ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
        elements: [
          { type: 'shape', track: 1, path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', width: '100%', height: '100%', fill_color: CHROMA_GREEN },
        ],
      });
      return;
    }
    if (it.type === 'placeholder') {
      // A chroma-green gap the editor keys their real clip into. Clean dissolve
      // in/out; the clip name shows ONLY while the green fully covers the frame.
      const holdText = Math.max(0.4, PLACEHOLDER_S - 2 * fadeS);
      const fadeT = Math.min(0.25, holdText / 3);
      elements.push({
        name: `VideoGap-${i + 1}`,
        type: 'composition',
        track: 2,
        duration: PLACEHOLDER_S,
        ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
        elements: [
          { type: 'shape', track: 1, path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', width: '100%', height: '100%', fill_color: CHROMA_GREEN },
          {
            type: 'text', track: 2, time: fadeS, duration: holdText,
            text: it.name || 'VIDEO', font_family: S.font, font_weight: '700',
            font_size: `${Math.round(height * 0.05)} px`, fill_color: '#FFFFFF',
            x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', x_alignment: '50%',
            // Fade the label in/out INSIDE the full-green window so no text ever
            // sits on a transition frame (keeps the key clean).
            opacity: [
              { time: 0, value: '0%' }, { time: fadeT, value: '100%' },
              { time: Math.max(fadeT, holdText - fadeT), value: '100%' }, { time: holdText, value: '0%' },
            ],
          },
        ],
      });
      return;
    }
    const zoomIn = photoCount % 2 === 0;
    photoCount += 1;
    if (S.duotone) {
      elements.push({
        name: `Photo-${photoCount}`, type: 'composition', track: 2, duration: S.photoS,
        ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
        // A green frame renders PURE full-frame green (skip the duotone tint) so
        // it stays keyable.
        elements: it.green
          ? [{ type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', fill_color: CHROMA_GREEN }]
          : duotoneShot(S, it, photoCount),
      });
      return;
    }
    // ONE-AT-A-TIME styles fill the whole 16:9 frame: a single photo can't hold
    // its native shape full-screen without pillars/blur (which Josh ruled out), so
    // it always COVER-crops. Default anchor is the TOP (keep faces); the per-photo
    // framing / drag-to-position control still nudges it. `fit` is ignored here —
    // native aspect is honoured only by the tiled/print styles that can lay a
    // portrait beside a landscape.
    const sizePct = Math.min(140, Math.max(60, Number(it.size) || 100));
    const amp = Math.max(0, parseFloat(S.zoom[1]) - parseFloat(S.zoom[0])); // e.g. 12 for 100→112
    // FIT vs FILL, per the photo's editor setting (explicit Fit/Fill always wins):
    //  • FIT  → the WHOLE photo, native aspect, centred and letterboxed on the
    //    style's background palette (Josh: "retain their frame and fit on the
    //    palette"). Nothing is ever cropped. Only a very gentle zoom.
    //  • FILL → cover-crops to fill the frame (110% box + framing / drag / pan).
    // When the photo has NO explicit setting, the style default applies:
    //  • Party 2 (S.pan) is a MOVEMENT style. It RECOGNIZES orientation: a LANDSCAPE
    //    fills + drifts (fills 16:9 cleanly); a PORTRAIT (9:16) is shown WHOLE on the
    //    palette (Josh: a 9:16 must show the whole photo, nothing cropped) so heads +
    //    feet stay in — with the style's gentle movement.
    //  • Every other one-at-a-time style fits by default.
    // An explicit Fit/Fill ALWAYS wins over the default.
    const isPortrait = it.w > 0 && it.h > 0 && it.h > it.w;
    const eff = (it.fit === 'fill' || it.fit === 'fit')
      ? it.fit
      : (S.pan ? (isPortrait ? 'fit' : 'fill') : 'fit');
    let photoEl;
    if (S.pan && eff === 'fill') {
      // PARTY 2: head-safe cover-fill with a push/pull + horizontal drift. The image
      // is sized to its TRUE aspect inside a top-anchored clip comp (coverBox), so the
      // Fix-framing (up/down, left/right, zoom) actually drives the crop and the
      // push/pull grows DOWNWARD — heads stay in frame instead of getting centre-
      // cropped off. Party 2 always probes dims (styleNeedsDims), so coverBox is exact.
      photoEl = fullFrameMotion(S, it, { zoomIn, sizePct, amp, drift: photoCount, frameW: width, frameH: height });
    } else if (eff === 'fill' && it.w > 0 && it.h > 0) {
      // Other one-at-a-time styles set to FILL: same head-safe comp when we know the
      // photo's real dims. (No drift — these aren't movement styles.)
      photoEl = fullFrameMotion(S, it, { zoomIn, sizePct, amp, drift: null, frameW: width, frameH: height });
    } else if (eff === 'fill') {
      // Fallback cover-fill for FILL styles WITHOUT probed dims (can't size to true
      // aspect safely) — unchanged legacy behaviour so nothing regresses.
      const lo = sizePct, hi = sizePct + amp;
      const from = `${(zoomIn ? lo : hi).toFixed(1)}%`, to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
      photoEl = {
        type: 'image', source: it.url, fit: 'cover',
        width: '110%', height: '110%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
        y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      };
      if (Number.isFinite(it.posX) && Number.isFinite(it.posY)) {
        photoEl.x = `${it.posX}%`;
        photoEl.y = `${it.posY}%`;
      } else {
        // Honor the Fix-framing up/down + left/right (object/number/preset). The box
        // is 110% (5% overscan), so a 0..1 bias maps to a ±5% shift within it.
        const { v: fv, h: fh } = photoFramingBias(it);
        photoEl.x = `${(50 + (0.5 - fh) * 10).toFixed(1)}%`;
        photoEl.y = `${(50 + (0.5 - fv) * 10).toFixed(1)}%`;
      }
    } else {
      // FIT: whole photo, native aspect, on the palette. Gentle zoom (kept small so
      // the photo never crops out of frame).
      const gz = Math.min(4, amp);
      const lo = sizePct, hi = sizePct + gz;
      const from = `${(zoomIn ? lo : hi).toFixed(1)}%`, to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
      // A Fit photo does NOT fill the frame — it is letterboxed on the backdrop.
      // Josh chose the border to hug the picture rather than the slot, so when the
      // photo's real shape is known we build a box that IS the picture's rect and
      // put the photo and its border inside it together. The zoom then rides the
      // box, so the frame breathes with the picture it belongs to instead of
      // floating at the frame edge while a 9x16 sits in the middle of it.
      const rect = borderPx(it, Math.min(width, height)) ? containRectPct(it, width, height) : null;
      if (rect) {
        photoEl = {
          type: 'composition',
          width: `${rect.W.toFixed(3)}%`, height: `${rect.H.toFixed(3)}%`,
          x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
          y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
          elements: withBorder(
            [applyPhotoColor({
              type: 'image', source: it.url, fit: 'contain',
              width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            }, it)],
            it,
            (rect.W / 100) * width, (rect.H / 100) * height, Math.min(width, height),
          ),
        };
      } else {
        photoEl = {
          type: 'image', source: it.url, fit: 'contain',
          width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
          x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
          y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
        };
      }
    }
    // Colour is applied to the inner image inside fullFrameMotion for the head-safe
    // comp path; for the plain image paths apply it here.
    if (photoEl.type === 'image') applyPhotoColor(photoEl, it);
    // Still a bare image at this point means we never learned the photo's real
    // shape (the dimension probe was skipped or failed), so there is no way to
    // know where the picture's edge actually is. Frame the SLOT instead — a
    // border at the frame edge is a defensible fallback, and it is visible, which
    // matters: silently dropping the border would look like the control is broken.
    if (photoEl.type === 'image' && borderPx(it, Math.min(width, height))) {
      photoEl = {
        type: 'composition', width: '100%', height: '100%',
        x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', clip: true,
        elements: withBorder([photoEl], it, width, height, Math.min(width, height)),
      };
    }
    photoEl.name = `Photo-${photoCount}`;
    photoEl.track = 2;
    photoEl.duration = S.photoS;
    if (i > 0) photoEl.animations = transitionIn(S, i);
    elements.push(photoEl);
  });

  // ---- Cast-free hold-and-fade (holdFade styles: Hollywood, Timeless) ------
  // THE PROBLEM IT SOLVES. A symmetric cross-dissolve leaves BOTH photos partly
  // transparent mid-transition, so the green backdrop shows through and tints the
  // blend — a cast that survives chroma keying.
  //
  // THE SHAPE OF THE FIX. Items are re-laid on two alternating tracks: the even
  // one is HELD fully opaque while the odd one fades in over it and later fades
  // out over the next held item. The picture area therefore only ever blends
  // image→image, never image→green.
  //
  // WHY EACH SHOT IS WRAPPED IN AN OPAQUE COMPOSITION. The held item is never
  // animated, so it appears and disappears with a hard cut. That is invisible only
  // while the layer above covers the WHOLE frame — and in these styles it does
  // not: photos are Fit, so each one is a letterboxed rectangle. Wherever the
  // held photo stuck out beyond the fading one, it snapped on and off. Josh:
  // "the images cut on and off and if the image is not the same as the next one it
  // is very distracting and wrong" — exactly right, and worst between photos of
  // different shapes, which is when the uncovered area is biggest.
  //
  // So every shot now sits in a full-frame composition backed by the flat backdrop
  // colour. Each layer covers the entire frame, the held item's hard cut is always
  // hidden beneath an opaque neighbour, and the margins dissolve green→green
  // (invisible) while the picture dissolves image→image (cast-free). Where one
  // photo has picture and the other has margin, it fades photo→green — which is
  // what a dissolve to nothing should look like, and keys correctly.
  //
  // ONLY WHEN THE BACKDROP IS A FLAT COLOUR. With an imported image, video or
  // texture backdrop there is nothing to chroma key, so the cast-free structure
  // buys nothing and cannot be built (the backing would have to replicate a moving
  // backdrop per shot). Those fall through to the ordinary symmetric cross-
  // dissolve, which is the better-looking choice when the montage is a finished
  // look rather than a key.
  //
  // Do NOT set holdFade on styles that use slide / wipe / scale movement — it
  // replaces the movement with a dissolve. Those use coverTransitions instead.
  const bgCtl = background || {};
  const flatBackdrop = !(bgCtl.url || bgCtl.videoUrl || bgCtl.textureUrl);
  const backdropColour = (bgCtl.green || S.greenDefault) ? CHROMA_GREEN : S.bg;
  const usedHoldFade = !!S.holdFade && flatBackdrop;

  if (usedHoldFade) {
    const seqEls = elements.slice(seqStart);
    elements.length = seqStart;               // re-pushed below, wrapped
    const itemsStart = includeCards ? CARD_S : 0;
    // Explicit start times: each item overlaps the next by fadeS (same total).
    let t = itemsStart;
    const starts = seqEls.map((el) => { const s = t; t += (el.duration || photoS) - fadeS; return s; });
    seqEls.forEach((el, k) => {
      const dur = el.duration || photoS;
      const isLast = k === seqEls.length - 1;
      delete el.animations;                   // drop the symmetric transition
      delete el.time;                         // the wrapper owns placement now
      delete el.track;
      el.duration = dur;
      const shot = {
        name: `Shot-${k + 1}`, type: 'composition',
        track: 3 + (k % 2),                   // 3 = held layer, 4 = fading layer (always above 3)
        time: +starts[k].toFixed(3), duration: dur,
        width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        elements: [
          // the opaque backing that makes the hard cut invisible
          { name: 'ShotBacking', type: 'shape', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
            width: '100%', height: '100%', fill_color: backdropColour },
          el,
        ],
      };
      if (k % 2 === 1) {
        // Odd shot sits on top: fade IN over the previous held shot, and fade OUT
        // over the next held shot (unless it is the very last).
        const kf = [{ time: 0, value: '0%' }, { time: fadeS, value: '100%' }];
        if (!isLast) kf.push({ time: Math.max(fadeS, dur - fadeS), value: '100%' }, { time: dur, value: '0%' });
        shot.opacity = kf;
      }
      elements.push(shot);
    });
    // Cards share track 2 with nothing now; pin them explicitly so they don't
    // auto-sequence into the wrong slot.
    const opening = elements.find((e) => e.name === 'Opening');
    if (opening) opening.time = 0;
  }

  // Closing card also hard-cuts in (same replaceability rule as the opener).
  if (includeCards) {
    elements.push({
      name: 'Closing',
      type: 'composition',
      track: 2,
      duration: CARD_S,
      ...(usedHoldFade ? { time: Math.max(0, total - CARD_S) } : {}),
      elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }),
    });
  }

  // Deterrent watermark (Josh: "big enough to be annoying") — outlined
  // MAIN EVENT STUDIO wordmark, centered, translucent. Asset: public/watermark.png.
  if (watermarkUrl) {
    elements.push({
      name: 'Watermark',
      type: 'image',
      track: 9,
      source: watermarkUrl,
      time: 0,
      duration: Math.max(1, total - 0.1),
      // Explicit width AND height matching the PNG's aspect (2660x167 ≈ 15.9:1
      // → 62% of 1920 wide = 6.9% of 1080 tall). Width-only let Creatomate
      // cover-crop the strip into giant letters (first-render lesson).
      width: '62%',
      height: '6.9%',
      x: '50%',
      y: '50%',
      x_anchor: '50%',
      y_anchor: '50%',
      opacity: '42%',
    });
  }

  // No wrap() here — the standard path already injected green as real first/last
  // photo slots above (addGreenBookends is only for the wall/pile builders).
  return finish({
    output_format: 'mp4',
    width,
    height,
    frame_rate: 30,
    elements,
  });
}


// ---------------------------------------------------------------------------
// UNIVERSAL OVERLAYS — dust, light leaks, and neon squiggles, on any style.
//
// Josh asked for Framed Box's atmosphere and Neon Frame's squiggles as add-ons
// everywhere. Both are FULL-FRAME LAYERS that do not need to know where the
// photograph is, which is the whole reason they can be generic: they go on top
// of a finished montage, like applyKeyColor, instead of into seventeen builders.
//
// BE CLEAR ABOUT WHAT THIS IS NOT. Framed Box's own atmosphere is MARRIED to its
// layers — the hero's dust grows with the hero, the bed's drifts with the bed —
// and that is what makes it read as atmosphere in the room rather than a filter
// over the top. This is the flat version. It is what stock templates do and it
// looks fine, but it is not the same thing, and Framed Box keeps its own.
//
// IT MUST NOT RUN OVER GREEN. These layers are screen-blended light: over chroma
// green they lift it toward white and the key fails at exactly the edges that
// matter. The green bookends are handles for Premiere and the mid-timeline green
// slots are where Josh keys his real clips in — polluting either would be a bug
// he would find only in the edit. So the overlay is emitted as SEGMENTS in the
// gaps BETWEEN the green spans, never across them.
// ---------------------------------------------------------------------------
const OVL_TRACK_DUST = 120;
const OVL_TRACK_LEAK = 121;
const OVL_TRACK_NEON = 122;

// Two overlapping swells across the span rather than one pulse at the head —
// the shape measured off the Envato reference, whose short-term brightness
// change is even all the way through.
function ovlLeakCurve(span, peak) {
  return [
    { time: 0, value: '0%', easing: 'quadratic-out' },
    { time: +(span * 0.22).toFixed(3), value: `${peak}%`, easing: 'quadratic-in-out' },
    { time: +(span * 0.46).toFixed(3), value: `${Math.round(peak * 0.35)}%`, easing: 'quadratic-in-out' },
    { time: +(span * 0.72).toFixed(3), value: `${Math.round(peak * 0.85)}%`, easing: 'quadratic-in-out' },
    { time: +span.toFixed(3), value: '0%' },
  ];
}

// WHEN AN ELEMENT DOES NOT SAY WHEN IT PLAYS. Styles built on holdFade pin an
// explicit time on every shot, but the ordinary slideshow styles do not: their
// photos carry only a duration and a transition, and Creatomate SEQUENCES them
// down their track, each starting where the previous ended minus the length of
// its own transition. Reading `time` alone therefore sees nothing at all on
// party/party2/party3 and the duotones — which is how the first version of the
// overlay ended up running straight across their green bookends.
//
// So resolve it the way the renderer does: per track, in array order, an
// explicit time wins and anything else continues the lane.
function ovlResolveTimes(elements) {
  const lanes = new Map();
  const spans = new Map();
  for (const e of elements || []) {
    if (!e || typeof e !== 'object') continue;
    const trk = e.track == null ? '_' : String(e.track);
    const prevEnd = lanes.get(trk) || 0;
    const dur = Number(e.duration) || 0;
    const trans = (e.animations || []).find((a) => a && a.transition);
    const lap = trans ? (Number(trans.duration) || 0) : 0;
    const start = Number.isFinite(Number(e.time)) ? Number(e.time) : Math.max(0, prevEnd - lap);
    const end = start + dur;
    if (dur > 0) { spans.set(e, [start, end]); lanes.set(trk, end); }
  }
  return spans;
}

// Where the green is, so the overlay can step around it. Top-level only: the
// overlay is top-level too, so a green slot nested inside a shot is already
// covered by that shot's own picture.
//
// GREEN COMES IN TWO SHAPES and both have to be caught. Some builders emit a
// NAMED slot (GreenIn, Green-4). The shared slideshow emits the bookend as an
// ordinary shot — Shot-1 — that happens to contain nothing but a green fill. So
// the test is structural: a top-level element is a green slot when it contains a
// green surface and NO actual picture. That also correctly ignores every normal
// shot, since holdFade gives all of them a green ShotBacking behind the photo.
//
// The full-length Background is excluded by name: it is green under everything
// by design, and treating it as a green span would swallow the whole montage.
function ovlGreenSpans(elements, keyHex, spans) {
  const KEY = String(keyHex || CHROMA_GREEN).toUpperCase();
  const isKeyAsset = (v) => typeof v === 'string' && /\/(green|key-[0-9a-f]{6})\.png(\?|$)/i.test(v);
  const scan = (node, acc) => {
    if (!node || typeof node !== 'object') return acc;
    if (Array.isArray(node)) { node.forEach((n) => scan(n, acc)); return acc; }
    if ((node.type === 'image' || node.type === 'video') && node.source && !isKeyAsset(node.source)) acc.picture = true;
    if (isKeyAsset(node.source)) acc.green = true;
    if (typeof node.fill_color === 'string' && node.fill_color.trim().toUpperCase() === KEY) acc.green = true;
    (node.elements || []).forEach((n) => scan(n, acc));
    return acc;
  };
  const out = [];
  for (const e of elements || []) {
    const sp = spans.get(e);
    if (!sp || e.name === 'Background') continue;
    const named = /^Green/i.test(e.name || '');
    const acc = scan(e, { green: false, picture: false });
    if (named || (acc.green && !acc.picture)) out.push([sp[0], sp[1]]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export function applyOverlays(source, {
  assetBase = null, atmosphere = null, neon = null, keyColor = null, width: W = 1920, height: H = 1080,
} = {}) {
  const atmoOn = !!(atmosphere && atmosphere.on);
  const neonOn = !!(neon && neon.on);
  // assetBase gates the ATMOSPHERE only: dust and leaks are PNG overlays and
  // cannot be drawn without a base URL to fetch them from. The neon arcs are
  // shapes and need no asset at all, so requiring one for them silently threw
  // the whole effect away whenever NEXT_PUBLIC_SITE_URL was unset.
  const canAtmo = atmoOn && !!assetBase;
  if (!source || !Array.isArray(source.elements) || (!canAtmo && !neonOn)) return source;

  const spans = ovlResolveTimes(source.elements);
  let total = 0;
  spans.forEach(([, end]) => { total = Math.max(total, end); });
  if (!(total > 0)) return source;

  // Complement of the green spans, so nothing screen-blended ever lands on a
  // surface that has to key. Spans shorter than a beat are not worth lighting.
  const greens = ovlGreenSpans(source.elements, keyColor, spans);
  const gaps = [];
  let cursor = 0;
  for (const [g0, g1] of greens) {
    if (g0 - cursor > 0.6) gaps.push([cursor, g0]);
    cursor = Math.max(cursor, g1);
  }
  if (total - cursor > 0.6) gaps.push([cursor, total]);
  if (!gaps.length) return source;

  // Option C: one master, then a trim per layer. Base figures are the measured
  // Framed Box values. Opacity cannot exceed 100%, so the trims stop biting
  // past roughly 2.8x on dust and 2.2x on leaks — said plainly in the UI.
  // Same null trap as the Framed Box scaling below: Number(null) is 0 and 0 is
  // finite, so an isFinite-only guard silently turns "not set" into "none".
  const pc = (v, dflt) => ((v === null || v === undefined || v === '' || !Number.isFinite(Number(v)))
    ? dflt : Math.max(0, Number(v))) / 100;
  const master = pc(atmosphere && atmosphere.intensity, 100);
  const dustPct = Math.round(Math.min(100, 36 * master * pc(atmosphere && atmosphere.dust, 100)));
  const leakPct = Math.round(Math.min(100, 46 * master * pc(atmosphere && atmosphere.leak, 100)));
  // INTENSITY HAS TO DRIVE MORE THAN OPACITY. Josh: "I turned it up to 100% and
  // it was no different. I want to be able to really pump it up to make it
  // exciting for kids." Two separate faults, both mine:
  //   1. 100% IS the default, so of course nothing changed. The slider read as
  //      a control that did nothing when it was simply already there.
  //   2. Intensity only scaled OPACITY, which is capped at 100 — so past about
  //      143% the top of the slider did literally nothing at all.
  // A dial whose top half is inert is worse than no dial.
  //
  // Now it drives everything that reads as "more": brightness, the THICKNESS of
  // the tube, HOW MANY lights run each picture, and how fast they travel. 100%
  // is unchanged from the look already rendered, so the setting he has judged
  // stays exactly where it was, and the headroom is above it — up to 300%.
  const neonMul = pc(neon && neon.intensity, 100);          // 1 = the current look
  const neonPct = Math.min(100, Math.round(70 * neonMul));
  // Thickness grows sub-linearly so 300% is bolder without going to mush.
  const neonWide = Math.pow(Math.max(0.15, neonMul), 0.7);
  // One light per picture at 100%, up to four when it is pushed.
  const neonLights = Math.max(1, Math.min(4, Math.round(neonMul)));
  // And they move faster: one lap of the picture at 100%, two at 200%.
  const neonLaps = Math.max(1, Math.round(neonMul));
  // COLOUR, one or many. Josh asked for an alternating selector: pick several and
  // the arcs cycle through them instead of every squiggle being the same hue,
  // which is what real neon in a room looks like. One colour selected behaves
  // exactly as before. The cycle is by ARC, not by shot, so a single beat can
  // carry two colours crossing each other.
  const hexOk = (c) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
  const neonPalette = (() => {
    const many = Array.isArray(neon && neon.colors) ? neon.colors.filter(hexOk) : [];
    if (many.length) return many.map((c) => c.toUpperCase());
    return [hexOk(neon && neon.color) ? neon.color.toUpperCase() : '#00E5FF'];
  })();

  const add = [];
  gaps.forEach(([t0, t1], gi) => {
    const span = +(t1 - t0).toFixed(3);
    const at = +t0.toFixed(3);
    if (canAtmo && dustPct > 0) {
      add.push({
        name: `OvlDust-${gi + 1}`, type: 'image', source: `${assetBase}/overlays/dust${(gi % 2) + 1}.png`,
        track: OVL_TRACK_DUST, time: at, duration: span,
        x: '50%', y: '50%', width: '150%', height: '150%', x_anchor: '50%', y_anchor: '50%',
        blend_mode: 'screen', opacity: `${dustPct}%`,
        // Degrees per SECOND, not per montage. Six degrees across a whole 40s
        // film is 0.15 deg/sec, which is a still transparency.
        z_rotation: [{ time: 0, value: '0deg', easing: 'linear' },
          { time: span, value: `${(6 * span / 12).toFixed(2)}deg` }],
      });
    }
    if (canAtmo && leakPct > 0) {
      add.push({
        name: `OvlLeak-${gi + 1}`, type: 'image',
        source: `${assetBase}/overlays/leak_epic${(gi % 3) + 1}.png`,
        track: OVL_TRACK_LEAK, time: at, duration: span,
        x: '50%', y: '50%', width: '140%', height: '140%', x_anchor: '50%', y_anchor: '50%',
        blend_mode: 'screen', opacity: ovlLeakCurve(span, leakPct),
      });
    }
    // Neon is no longer emitted here. It used to be free-floating rings placed
    // at random points in the frame, and Josh's verdict on the first render
    // that actually showed them was the right one: "placement isn't great. if
    // its going to trace a straight line it has to be an image line." A
    // straight neon segment hanging in empty space reads as an accident. See
    // neonOnShots below, which puts it on the picture's own edge instead.
  });
  // ---- NEON ON THE PICTURE'S OWN EDGE ------------------------------------
  //
  // Josh, on the first render that actually showed the arcs: "placement isn't
  // great. if its going to trace a straight line it has to be an image line."
  // Exactly right — a straight neon segment floating in empty space reads as an
  // accident, and the earlier free-floating rings were exactly that.
  //
  // THE TRICK, and it needs no per-style work at all: every one of these
  // builders wraps each shot in a COMPOSITION SIZED TO ITS PICTURE and hangs the
  // motion on that composition (sliding_images Slide-1 is 72.54% x 86.00% with
  // its slide keyframed on the wrapper; photo_slide's Print-N the same). Nest a
  // ring inside that composition at 100% x 100% and it lands on the picture's
  // real edge and inherits the travel, the scale and the timing for free. It is
  // the same construction Framed Box uses for its frame and its married
  // atmosphere, and it is why THIS can be generic when the tube on a bare
  // <image> could not be.
  //
  // A shot whose wrapper is the whole frame traces the frame instead, which for
  // a full-bleed style is still the edge of the picture.
  if (neonOn && neonPct > 0) {
    const isGreenish = new Set(greens.map(([g0]) => g0.toFixed(3)));
    let shotIdx = 0;
    for (const e of source.elements) {
      const sp = spans.get(e);
      if (!sp || e.type !== 'composition' || !Array.isArray(e.elements) || !e.elements.length) continue;
      if (/^(Background|Opening|Closing|Watermark|Green)/i.test(e.name || '')) continue;
      if (isGreenish.has(sp[0].toFixed(3))) continue;      // never light a green slot
      const life = +(sp[1] - sp[0]).toFixed(3);
      if (life < 0.5) continue;
      const seed = shotIdx * 11;
      shotIdx += 1;

      // Corner radius has to be corrected for the box's real shape or a tall
      // print gets stretched corners. Width/height can be keyframed on some
      // styles, so fall back to a near-square radius when they are not plain.
      const pw = parseFloat(e.width), ph = parseFloat(e.height);
      const arW = Number.isFinite(pw) ? (pw / 100) * W : W;
      const arH = Number.isFinite(ph) ? (ph / 100) * H : H;
      const path = roundedRect(1.2, +(1.2 * arW / Math.max(1, arH)).toFixed(2));
      const lenOf = (li) => 0.18 + pol_rand(seed + 2 + li * 5) * 0.10;
      const fromOf = (li) => +(pol_rand(seed + 1 + li * 5) * (1 - lenOf(li))).toFixed(3);
      const hexOf = (li) => neonPalette[(shotIdx + li) % neonPalette.length];

      const px = (v) => `${Math.max(1, Math.round(Math.min(W, H) * v * neonWide))} px`;
      // Each light gets its own colour from the palette, its own start point and
      // its own length, so two running the same picture never look like one
      // thick one. Length and start stay inside 0-100 — Creatomate rejects the
      // whole render otherwise, which it has already done once.
      const ring = (width, opacity, li) => ({
        type: 'shape', path,
        x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        width: '100%', height: '100%',
        fill_color: 'rgba(0,0,0,0)',
        stroke_color: hexOf(li), stroke_width: width,
        stroke_cap: 'round', stroke_join: 'round', blend_mode: 'screen',
        stroke_start: `${(lenOf(li) === 0 ? 0 : fromOf(li) * 100).toFixed(2)}%`,
        stroke_end: `${((fromOf(li) + lenOf(li)) * 100).toFixed(2)}%`,
        // The light travels the perimeter across the shot — more laps the
        // harder it is pushed. Offset is a SHARE of the path length, so it
        // reads the same on a wide print and a tall one. Creatomate caps this
        // at 100, so extra laps are keyframed as repeated 0-100 sweeps rather
        // than one big number.
        stroke_offset: Array.from({ length: neonLaps * 2 + 1 }, (_, q) => {
          const t = +(life * (q / (neonLaps * 2))).toFixed(3);
          return q === neonLaps * 2
            ? { time: t, value: q % 2 ? '100%' : '0%' }
            : { time: t, value: q % 2 ? '100%' : '0%', easing: 'linear' };
        }),
        opacity: [
          { time: 0, value: '0%', easing: 'quadratic-out' },
          { time: +(life * 0.16).toFixed(3), value: `${opacity}%`, easing: 'linear' },
          { time: +(life * 0.74).toFixed(3), value: `${opacity}%`, easing: 'quadratic-in' },
          { time: life, value: '0%' },
        ],
      });
      // Stacked crisp strokes, never a blurred one: a stroked shape carrying
      // blur_radius renders as NOTHING in Creatomate (measured on the Glass
      // probe). Widest and faintest first so the core sits on top.
      for (let li = 0; li < neonLights; li++) {
        e.elements.push(ring(px(0.022), Math.round(neonPct * 0.24), li));
        e.elements.push(ring(px(0.010), Math.round(neonPct * 0.48), li));
        e.elements.push(ring(px(0.004), neonPct, li));
      }

      // ---- FLASHES, from 150% up ------------------------------------------
      // Josh: "can we add neon flashes and squigly lines in the higher
      // settings. Almost 80's nestalgia."
      //
      // A flash is a fast colour wash, and it lives INSIDE the shot rather than
      // over the whole frame ON PURPOSE. A full-frame screen-blended flash
      // would wash over the chroma backdrop too and wreck the key at exactly
      // the moment it is brightest. Confined to the picture it reads the same
      // and keys clean, which matters more than the extra couple of percent of
      // frame it would have covered.
      if (neonMul >= 1.5) {
        const nFlash = Math.max(1, Math.min(4, Math.round((neonMul - 1) * 2)));
        for (let fi = 0; fi < nFlash; fi++) {
          const at = +(life * (0.12 + pol_rand(seed + 40 + fi) * 0.74)).toFixed(3);
          const dur = +(0.10 + pol_rand(seed + 50 + fi) * 0.10).toFixed(3);
          const peak = Math.min(70, Math.round(26 * neonMul));
          e.elements.push({
            type: 'shape', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
            x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '100%',
            fill_color: hexOf(fi), blend_mode: 'screen',
            // Hard in, quick out — a tube striking, not a dissolve.
            opacity: [
              { time: 0, value: '0%', easing: 'linear' },
              { time: Math.max(0, at - 0.03), value: '0%', easing: 'linear' },
              { time: at, value: `${peak}%`, easing: 'quadratic-in' },
              { time: Math.min(life, at + dur), value: '0%', easing: 'linear' },
              { time: life, value: '0%' },
            ],
          });
        }
      }
    }
  }

  // ---- SQUIGGLES ACROSS THE FRAME, from 150% up -------------------------
  // The rings trace the pictures; these are the loose neon scrawls between
  // them, and they are what makes it read as 80s rather than tidy. They are
  // free-floating, which is exactly what Josh rejected for the RINGS ("if its
  // going to trace a straight line it has to be an image line") — the
  // difference is that a squiggle is not a straight line. It is obviously
  // hand-drawn light, so it does not read as a misplaced edge.
  //
  // Emitted only in the gaps BETWEEN green spans, like the atmosphere, so
  // screen-blended light never lands on a surface that has to key.
  if (neonOn && neonPct > 0 && neonMul >= 1.5) {
    const perGap = Math.max(1, Math.min(6, Math.round((neonMul - 1) * 3)));
    let lane = OVL_TRACK_NEON;
    gaps.forEach(([t0, t1], gi) => {
      const span = +(t1 - t0).toFixed(3);
      for (let k = 0; k < perGap; k++) {
        const seed = 500 + gi * 17 + k * 29;
        const life = +Math.min(span, 0.9 + pol_rand(seed) * 1.1).toFixed(3);
        const at = +(t0 + (span - life) * pol_rand(seed + 1)).toFixed(3);
        const w = 34 + pol_rand(seed + 2) * 46;          // 34-80% of frame wide
        const h = 8 + pol_rand(seed + 3) * 16;
        const cx = w / 2 + pol_rand(seed + 4) * (100 - w);
        const cy = 12 + pol_rand(seed + 5) * 76;
        const path = squigglePath(2 + Math.floor(pol_rand(seed + 6) * 3), 34, pol_rand(seed + 7) * 6.28);
        const len = 0.30 + pol_rand(seed + 8) * 0.30;
        const from = +(pol_rand(seed + 9) * (1 - len)).toFixed(3);
        const hex = neonPalette[(gi + k) % neonPalette.length];
        const px2 = (v) => `${Math.max(1, Math.round(Math.min(W, H) * v * neonWide))} px`;
        const layer = (width, op, trk) => ({
          name: `OvlSquiggle-${gi + 1}-${k + 1}-L${trk - OVL_TRACK_NEON}`,
          type: 'shape', path, track: trk,
          time: at, duration: life,
          x: `${cx.toFixed(2)}%`, y: `${cy.toFixed(2)}%`,
          width: `${w.toFixed(2)}%`, height: `${h.toFixed(2)}%`,
          x_anchor: '50%', y_anchor: '50%',
          fill_color: 'rgba(0,0,0,0)',
          stroke_color: hex, stroke_width: width,
          stroke_cap: 'round', stroke_join: 'round', blend_mode: 'screen',
          // DRAWN ON, not faded in: the trim opens from nothing to its full
          // length, which is how a neon sign switches on.
          stroke_start: `${(from * 100).toFixed(2)}%`,
          stroke_end: [
            { time: 0, value: `${(from * 100).toFixed(2)}%`, easing: 'quadratic-out' },
            { time: +(life * 0.34).toFixed(3), value: `${((from + len) * 100).toFixed(2)}%` },
          ],
          opacity: [
            { time: 0, value: `${op}%`, easing: 'linear' },
            { time: +(life * 0.72).toFixed(3), value: `${op}%`, easing: 'quadratic-in' },
            { time: life, value: '0%' },
          ],
        });
        // A LANE EACH. All three layers of one squiggle occupy the same moment
        // by design — that stack IS the glow — and two elements sharing a track
        // and a moment is the one thing Creatomate will not have: it drops one.
        // Overlapping squiggles have the same problem between them. Tracks are
        // free, so every layer gets its own rather than trying to pack them.
        add.push(layer(px2(0.018), Math.round(neonPct * 0.22), lane));
        add.push(layer(px2(0.008), Math.round(neonPct * 0.5), lane + 1));
        add.push(layer(px2(0.003), neonPct, lane + 2));
        lane += 3;
      }
    });
  }

  // Each of the three tracks carries non-overlapping segments (the gaps are
  // disjoint by construction), except the neon arcs, which deliberately overlap
  // — so they are spread one track per arc rather than stacked in one lane.
  // The squiggles already assigned themselves a lane each above, so nothing
  // here needs re-homing any more; this stays as the guard for anything that
  // lands on the base neon track without one.
  const neonLane = OVL_TRACK_NEON;
  const seenNeon = [];
  for (const el of add) {
    if (el.track !== OVL_TRACK_NEON) { source.elements.push(el); continue; }
    // Give this arc the lowest neon lane whose last element has already ended.
    let lane = 0;
    while (lane < seenNeon.length && seenNeon[lane] > el.time + 0.001) lane++;
    if (lane === seenNeon.length) seenNeon.push(0);
    seenNeon[lane] = el.time + el.duration;
    source.elements.push({ ...el, track: neonLane + lane });
  }
  return source;
}

// The public entry point. Everything is built exactly as before, then the key
// colour is swapped in as a single post-pass so it reaches EVERY style — the
// slideshow path, all seventeen bespoke builders, and twoPanel/multiPage, which
// return early and bypass finish(). One place, nothing to miss.
export function buildMontageSource(opts = {}) {
  const src = applyKeyColor(buildMontageSourceInner(opts), opts.keyColor);
  // Framed Box carries its OWN atmosphere, married to its layers and controlled
  // by the same settings — adding the flat overlay on top would double it.
  const flatAtmo = opts.style === 'framed_box' ? null : opts.atmosphereOpts;
  return applyOverlays(src, {
    assetBase: opts.assetBase || null,
    atmosphere: flatAtmo,
    neon: opts.neonOpts || null,
    keyColor: opts.keyColor,
    width: opts.width, height: opts.height,
  });
}
