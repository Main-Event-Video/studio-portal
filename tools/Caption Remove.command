#!/bin/bash
# Double-click me. Removes burned-in captions from every clip in
# ~/Desktop/Caption Remove/In → ~/Desktop/Caption Remove/Out. Details: caption-remove.sh
cd "$(dirname "$0")" && bash ./caption-remove.sh
echo; read -n 1 -s -r -p "Press any key to close."
