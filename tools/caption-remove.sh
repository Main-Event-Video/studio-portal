#!/bin/bash
# Caption Remove — batch. Every video in  ~/Desktop/Caption Remove/In  gets its
# burned-in captions inpainted away and lands in  .../Out  as <name>_clean.<ext>,
# same resolution and frame rate, audio copied through. Already-done clips are
# skipped, so you can top up In and re-run any time. Originals are never touched.
#
# CAPTION ZONE — fractions of the frame (top 0.0 … bottom 1.0, left 0.0 … right 1.0).
# Default = the lower band where the FOX-style captions sit. Text is detected
# INSIDE this zone and only those frames are inpainted; frames without text pass
# through untouched. Widen it if captions ever land outside.
ZONE_TOP=0.50; ZONE_BOTTOM=0.95; ZONE_LEFT=0.00; ZONE_RIGHT=1.00
# MODE: sttn-det = detect text in the zone, inpaint only where/when it is (default).
#       sttn-auto = inpaint the WHOLE zone on every frame (no detection; use if
#       detection keeps missing stylised captions). propainter = slower, better on motion.
MODE=${MODE:-sttn-det}

APP="$HOME/CaptionRemover"; IN="$HOME/Desktop/Caption Remove/In"; OUT="$HOME/Desktop/Caption Remove/Out"
[ -f "$APP/.installed" ] || { echo "Not installed yet — running the installer first."; bash "$(dirname "$0")/caption-remove-install.sh" || exit 1; }
source "$APP/venv/bin/activate"
mkdir -p "$IN" "$OUT"
shopt -s nullglob nocaseglob
CLIPS=("$IN"/*.mp4 "$IN"/*.mov "$IN"/*.m4v)
[ ${#CLIPS[@]} -eq 0 ] && { echo "Nothing in  $IN"; exit 0; }
n=0; done_=0; skipped=0; failed=0
for f in "${CLIPS[@]}"; do
  n=$((n+1)); name=$(basename "$f"); stem="${name%.*}"; ext="${name##*.}"
  out="$OUT/${stem}_clean.${ext}"
  if [ -f "$out" ]; then echo "[$n/${#CLIPS[@]}] $name — already in Out, skipped"; skipped=$((skipped+1)); continue; fi
  read W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f" | tr ',' ' ')
  ymin=$(python3 -c "print(int($H*$ZONE_TOP))"); ymax=$(python3 -c "print(int($H*$ZONE_BOTTOM))")
  xmin=$(python3 -c "print(int($W*$ZONE_LEFT))"); xmax=$(python3 -c "print(int($W*$ZONE_RIGHT))")
  echo; echo "[$n/${#CLIPS[@]}] $name  (${W}x${H}, zone y $ymin-$ymax, x $xmin-$xmax, $MODE)"
  tmp="$OUT/.${stem}_working.${ext}"
  if (cd "$APP/vsr" && caffeinate -i python backend/main.py -i "$f" -o "$tmp" -c $ymin $ymax $xmin $xmax --inpaint-mode "$MODE"); then
    # Put the ORIGINAL audio back ourselves (the tool only keeps AAC audio; a
    # ProRes/PCM .mov would come out silent). Video from the cleaned file, audio
    # from the original, both copied — no re-encode.
    if ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$f" | grep -q audio; then
      ffmpeg -y -loglevel error -i "$tmp" -i "$f" -map 0:v:0 -map 1:a:0 -c copy -shortest "$out" && rm -f "$tmp" || mv -f "$tmp" "$out"
    else
      mv -f "$tmp" "$out"
    fi
    echo "   → Out/$(basename "$out")"; done_=$((done_+1))
  else
    rm -f "$tmp"; echo "   FAILED — left in In"; failed=$((failed+1))
  fi
done
echo; echo "Done: $done_ cleaned, $skipped skipped, $failed failed.  Out = $OUT"
