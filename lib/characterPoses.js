// =============================================================
// MAIN EVENT STUDIO — "Character Build" reference shots
// Shared by the client capture flow (CharacterCapture.jsx) and the server-side
// build-sheet generator (lib/characterSheet.js) so the shot list, order, and
// labels never drift.
//
// These shots are a HOLDING AREA for the client's AI character build. They are
// NOT part of the montage or the play-order timeline — they live under a
// reserved folder_path sentinel that buildTimeline() and the upload album list
// exclude (same idea as 'Trash'). No DB migration needed.
// =============================================================

// Reserved folder_path for character-build shots. Double-underscored so it can
// never collide with a human-chosen album name, and it is hidden everywhere a
// client or the studio sees albums.
export const CHAR_FOLDER = '__character_build__';

// Multi-character (#9): additional named characters namespace their shots under
// `${CHAR_FOLDER}::${characterId}`; the first/legacy character keeps CHAR_FOLDER
// itself. Keep that convention in one place.
export const CHAR_FOLDER_SEP = '::';
export function characterFolderPath(characterId) {
  return characterId ? `${CHAR_FOLDER}${CHAR_FOLDER_SEP}${characterId}` : CHAR_FOLDER;
}
// True for ANY character-build folder (legacy or per-character). Used to exclude
// these reserved shots from albums and the play-order timeline.
export function isCharacterFolder(folderPath) {
  return folderPath === CHAR_FOLDER
    || (typeof folderPath === 'string' && folderPath.startsWith(CHAR_FOLDER + CHAR_FOLDER_SEP));
}

// The definitive 12-shot reference set (curated for the most consistent AI
// character model: multi-angle head geometry + expression range + full body).
// index (1-based) === studio_media.sort_number for a captured guided shot.
// camera:'environment' — someone else shoots with the phone's REAR camera (no
// selfies), so the rear camera is the default for every shot.
export const POSES = [
  { slug: 'face-front-neutral', label: 'Face — Front (neutral)', short: 'Front, neutral', group: 'face', camera: 'environment', overlay: 'faceFront',
    hint: 'Subject looks straight at the camera. Relaxed face, mouth closed.' },
  { slug: 'face-front-smile', label: 'Face — Big smile', short: 'Big smile', group: 'face', camera: 'environment', overlay: 'faceFront',
    hint: 'Straight at the camera. Big genuine smile, showing teeth.' },
  { slug: 'face-front-angry', label: 'Face — Angry / serious', short: 'Angry / serious', group: 'face', camera: 'environment', overlay: 'faceFront',
    hint: 'Straight at the camera. Serious or angry — brows down.' },
  // NOTE ON OVERLAY DIRECTION: the subject faces the camera, so "THEIR left"
  // appears on the VIEWER's right in the photo (and vice-versa). The dashed
  // guide must match the camera image, so a "3/4 left" turn uses the
  // right-pointing overlay ('face34r'), etc. Labels/hints stay subject-relative.
  { slug: 'face-34-left', label: 'Face — 3/4 left', short: '3/4 left', group: 'face', camera: 'environment', overlay: 'face34r',
    hint: 'Subject turns their head about halfway to THEIR left. Eyes to camera.' },
  { slug: 'face-34-right', label: 'Face — 3/4 right', short: '3/4 right', group: 'face', camera: 'environment', overlay: 'face34l',
    hint: 'Subject turns their head about halfway to THEIR right. Eyes to camera.' },
  { slug: 'face-profile-left', label: 'Face — Left profile', short: 'Left profile', group: 'face', camera: 'environment', overlay: 'profileR',
    hint: 'Subject turns their head fully to THEIR left — a clean side view.' },
  { slug: 'face-profile-right', label: 'Face — Right profile', short: 'Right profile', group: 'face', camera: 'environment', overlay: 'profileL',
    hint: 'Subject turns their head fully to THEIR right — a clean side view.' },
  { slug: 'head-top', label: 'Head — Top / hair', short: 'Top of head', group: 'face', camera: 'environment', overlay: 'faceFront',
    hint: 'Subject tips their head down so the camera sees the top of the hair.' },
  { slug: 'body-front-apose', label: 'Full body — Front (A-pose)', short: 'Body front (A-pose)', group: 'body', camera: 'environment', overlay: 'bodyFront',
    hint: 'Whole body in frame, facing forward. Arms slightly away from the sides.' },
  { slug: 'body-back', label: 'Full body — Back', short: 'Body back', group: 'body', camera: 'environment', overlay: 'bodyBack',
    hint: 'Whole body, facing AWAY from the camera.' },
  { slug: 'body-left', label: 'Full body — Left side', short: 'Body left', group: 'body', camera: 'environment', overlay: 'bodySide',
    hint: 'Whole body, turned to the subject’s LEFT (side-on).' },
  { slug: 'body-right', label: 'Full body — Right side', short: 'Body right', group: 'body', camera: 'environment', overlay: 'bodySide',
    hint: 'Whole body, turned to the subject’s RIGHT (side-on).' },
];

export const POSE_COUNT = POSES.length;

// Shown on the intro screen BEFORE capture starts. Friendly + fun on purpose.
export const CAPTURE_INTRO_TITLE = 'Before we start snapping 📸';
export const CAPTURE_INTRO = [
  'Hand your phone to a friend — no selfies! You’re the star, they’re the photographer.',
  'Use the big camera on the back of the phone.',
  'Pick a plain wall — the more boring the background, the more you pop.',
  'Get in good light: bright room, light on your face, no gnarly shadows.',
  'Keep it simple — solid colors, no busy patterns or logos.',
  'Same outfit and hair the whole way through. You’re one character, not twelve!',
  'Lose the hats and sunglasses, and keep hair off your face for the close-ups.',
  'Hold the phone upright at eye level and fill up the outline on screen.',
  'For the full-body shots, back up so you fit head to toe.',
  'Skip the beauty filters — we want the real you, nice and sharp.',
];

// Map a stored character shot to its pose. Guided shots carry sort_number 1..12;
// a client's own free uploads have no matching slot and are treated as "extra".
export function poseForSortNumber(sortNumber) {
  if (!Number.isInteger(sortNumber) || sortNumber < 1 || sortNumber > POSES.length) return null;
  return POSES[sortNumber - 1];
}
