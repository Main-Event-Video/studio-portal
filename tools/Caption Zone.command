#!/bin/bash
# Double-click me. Opens the newest clip in ~/Desktop/Caption Remove/In so you can
# drag a box around the captions; saves the zone into settings.txt.
source "$HOME/CaptionRemover/venv/bin/activate" && python "$(dirname "$0")/caption-zone.py"
echo; read -n 1 -s -r -p "Press any key to close."
