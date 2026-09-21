#!/bin/bash
# ALPHA MERGE — joins an "Export with alpha" pair from the Studio Portal into ONE
# QuickTime file with a real alpha channel that Premiere reads natively.
#
#   ###HR_<name>.mp4  + ###HRM_<name>.mp4   (full rez)  →  ###HR_<name>_ALPHA.mov
#   ###_<name>.mp4    + ###M_<name>.mp4     (low rez)   →  ###_<name>_ALPHA.mov
#   Animation codec (qtrle, ARGB), premultiplied, + the original audio
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
FP="$(dirname "$FF")/ffprobe"; [ -x "$FP" ] || FP="$(command -v ffprobe 2>/dev/null || true)"
# Pairs come in two sizes: FULL REZ  ###HR_<name>.mp4 + ###HRM_<name>.mp4  →  ###HR_<name>_ALPHA.mov
#                          LOW REZ   ###_<name>.mp4   + ###M_<name>.mp4    →  ###_<name>_ALPHA.mov
for color in "$DIR"/[0-9][0-9][0-9]HR_*.mp4 "$DIR"/[0-9][0-9][0-9]_*.mp4; do
  base="$(basename "$color")"
  num="${base:0:3}"
  case "$base" in
    ???HR_*) tag="HR"; rest="${base#???HR_}" ;;
    *)       tag="";   rest="${base#???_}" ;;
  esac
  stem="${rest%.mp4}"
  stem="$(printf '%s' "$stem" | sed -E 's/ \([0-9]+\)$//')"   # drop a trailing " (1)" the browser added
  case "$stem" in *_ALPHA) continue ;; esac
  # the matte may carry its own " (n)" — take the newest that matches
  # (Bug 9/20: with nullglob, an unmatched pattern left `ls -t` with NO argument,
  #  so it listed the whole folder and "paired" every matte-less clip with the
  #  newest file in Downloads — caption-zone.py that day. Expand first, check.)
  mattes=( "$DIR/${num}${tag}M_${stem}"*.mp4 )
  # (9/20: 042's matte came down as _V6 beside a _V5 colour pass — the matte
  #  re-render took the next version number — so fall back to "same render
  #  number, any name". ###HRM_ / ###M_ + the number is unique to that render.)
  if [ "${#mattes[@]}" -eq 0 ]; then
    # Only when this number has ONE colour file — otherwise an older flat export
    # of the same number (042 …_V2 beside …_V5) would also grab the matte.
    colors=( "$DIR/${num}${tag}_"*.mp4 )
    if [ "${#colors[@]}" -eq 1 ]; then mattes=( "$DIR/${num}${tag}M_"*.mp4 )
    else echo "⚠ ${num}${tag}: no matte named like $(basename "$color") and ${#colors[@]} colour files share this number — skipped. Trash the old one and run again."; continue; fi
  fi
  matte=""
  if [ "${#mattes[@]}" -gt 0 ]; then matte="$(ls -t "${mattes[@]}" | head -1)"; fi
  out="$DIR/${num}${tag}_${stem}_ALPHA.mov"
  [ -n "$matte" ] && [ -f "$matte" ] || continue
  found=$((found+1))
  if [ -f "$out" ]; then echo "✓ already merged: $(basename "$out")"; continue; fi
  # scale the matte to the colour pass's exact size (low-rez pairs are half size)
  dims="1920:1080"
  if [ -n "$FP" ]; then d="$("$FP" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$color" 2>/dev/null | tr ',' ':')"; case "$d" in [0-9]*:[0-9]*) dims="$d" ;; esac; fi
  echo "▶ merging ${num}${tag} …  ($(basename "$color") + $(basename "$matte"))  ${dims}"
  "$FF" -v error -stats -y -i "$color" -i "$matte" \
    -filter_complex "[1:v]format=gray,scale=${dims},split[m1][m2];[0:v]format=gbrp[c];[c][m1]premultiply=inplace=0[pm];[pm][m2]alphamerge,format=argb[out]" \
    -map "[out]" -map "0:a?" -c:v qtrle -pix_fmt argb -c:a pcm_s16le "$out" \
    && echo "✓ wrote $(basename "$out")" || { echo "✗ merge failed for ${num}${tag}"; rm -f "$out"; }
done
if [ "$found" -eq 0 ]; then
  echo "No pairs found in $DIR — need a pair from 'Download alpha pair' (###HR_ + ###HRM_, or ###_ + ###M_ for low rez) — got them from 'Download alpha pair'."
fi
echo; echo "Done. The _ALPHA.mov files are in $DIR — import into Premiere, drop above your backdrop. No key needed."
