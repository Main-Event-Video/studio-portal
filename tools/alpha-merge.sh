#!/bin/bash
# ALPHA MERGE — joins an "Export with alpha" pair from the Studio Portal into ONE
# QuickTime file with a real alpha channel that Premiere reads natively.
#
#   ###HR_<name>.mp4   the COLOUR pass (rendered over black)
#   ###HRM_<name>.mp4  the MATTE pass  (photos white, backdrop black)
#   →  ###_<name>_ALPHA.mov   Animation codec (qtrle, ARGB) + the original audio
#
# WHY ANIMATION, NOT PRORES: Premiere ignored the alpha in every ProRes 4444
# ffmpeg produced (tested 9/15: straight, premultiplied, 8-bit alpha, Apple
# vendor tag). Animation-codec alpha imported first time. Files are big
# (~60 MB per second of montage) but correct.
#
# HOW: double-click "Alpha Merge.command" (same folder) — or in Terminal:
#   bash ~/Documents/GitHub/studio-portal/tools/alpha-merge.sh
# It scans ~/Downloads for every ###HR / ###HRM pair that has no _ALPHA.mov yet
# and merges them. Pass a folder as the first argument to scan somewhere else.
#
# NEEDS ffmpeg once:  brew install ffmpeg     (https://brew.sh if brew is missing)

set -u
DIR="${1:-$HOME/Downloads}"
FF=""
for c in /opt/homebrew/bin/ffmpeg /usr/local/bin/ffmpeg "$(command -v ffmpeg 2>/dev/null)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then FF="$c"; break; fi
done
if [ -z "$FF" ]; then
  echo "ffmpeg is not installed. One-time setup — paste this in Terminal, then run Alpha Merge again:"
  echo
  echo "    brew install ffmpeg"
  echo
  echo "(No Homebrew? Install it first from https://brew.sh — one command on that page.)"
  exit 1
fi

shopt -s nullglob
found=0
for color in "$DIR"/[0-9][0-9][0-9]HR_*.mp4; do
  base="$(basename "$color")"
  num="${base:0:3}"
  rest="${base#*HR_}"                 # "<name>.mp4"
  matte="$DIR/${num}HRM_${rest}"
  out="$DIR/${num}_${rest%.mp4}_ALPHA.mov"
  [ -f "$matte" ] || continue
  found=$((found+1))
  if [ -f "$out" ]; then echo "✓ already merged: $(basename "$out")"; continue; fi
  echo "▶ merging $num …  ($(basename "$color") + $(basename "$matte"))"
  "$FF" -v error -stats -y -i "$color" -i "$matte" \
    -filter_complex "[1:v]format=gray,scale=1920:1080,split[m1][m2];[0:v]format=gbrp[c];[c][m1]premultiply=inplace=0[pm];[pm][m2]alphamerge,format=argb[out]" \
    -map "[out]" -map "0:a?" -c:v qtrle -pix_fmt argb -c:a pcm_s16le "$out" \
    && echo "✓ wrote $(basename "$out")" || { echo "✗ merge failed for $num"; rm -f "$out"; }
done
if [ "$found" -eq 0 ]; then
  echo "No pairs found in $DIR — need both ###HR_<name>.mp4 and ###HRM_<name>.mp4 from 'Download alpha pair'."
fi
echo; echo "Done. The _ALPHA.mov files are in $DIR — import into Premiere, drop above your backdrop. No key needed."
