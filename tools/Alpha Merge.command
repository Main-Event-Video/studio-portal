#!/bin/bash
# Double-click me. Merges every "Export with alpha" pair in ~/Downloads into a
# .mov with a real alpha channel. Details + Terminal alternative: alpha-merge.sh
cd "$(dirname "$0")" && bash ./alpha-merge.sh
echo; read -n 1 -s -r -p "Press any key to close."
