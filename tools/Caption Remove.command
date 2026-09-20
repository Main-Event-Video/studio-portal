#!/bin/bash
# Double-click me. 1) Opens the newest clip in ~/Desktop/Caption Remove/In — drag a
# box around the captions, ENTER. (ESC keeps the last zone.) 2) Removes the captions
# from every clip in In → Out. Details: caption-zone.py, caption-remove.sh
cd "$(dirname "$0")"
if [ -f "$HOME/CaptionRemover/venv/bin/activate" ]; then
  ( source "$HOME/CaptionRemover/venv/bin/activate" && python ./caption-zone.py )
fi
bash ./caption-remove.sh
echo; read -n 1 -s -r -p "Press any key to close."
