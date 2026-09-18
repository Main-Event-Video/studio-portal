#!/bin/bash
# One-time setup for Caption Remove (burned-in caption removal, AI inpainting).
# Installs into ~/CaptionRemover:  Python 3.12 (Homebrew) + video-subtitle-remover
# (github.com/YaoFANGUK/video-subtitle-remover, Apache 2.0) + its models.
# Takes 5-15 minutes and a few GB. Safe to re-run; it only fills in what is missing.
set -e
APP="$HOME/CaptionRemover"
BREW=/opt/homebrew/bin/brew
echo "== Caption Remove — install =="
[ -x "$BREW" ] || { echo "Homebrew not found at /opt/homebrew — install it first (brew.sh)."; exit 1; }

echo "-- Python 3.12 + git"
"$BREW" list python@3.12 >/dev/null 2>&1 || "$BREW" install python@3.12
"$BREW" list git >/dev/null 2>&1 || "$BREW" install git
"$BREW" list ffmpeg >/dev/null 2>&1 || "$BREW" install ffmpeg
PY=/opt/homebrew/opt/python@3.12/bin/python3.12

echo "-- the tool (git clone, includes the AI models — this is the big download)"
mkdir -p "$APP"
if [ ! -d "$APP/vsr/.git" ]; then
  git clone --depth 1 https://github.com/YaoFANGUK/video-subtitle-remover.git "$APP/vsr"
fi

echo "-- Python packages"
[ -d "$APP/venv" ] || "$PY" -m venv "$APP/venv"
source "$APP/venv/bin/activate"
pip install --upgrade pip wheel >/dev/null
pip install "paddlepaddle==3.0.0" || pip install "paddlepaddle==3.0.0" -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
pip install "torch==2.7.0" "torchvision==0.22.0"
pip install -r "$APP/vsr/requirements.txt"

echo "-- folders"
mkdir -p "$HOME/Desktop/Caption Remove/In" "$HOME/Desktop/Caption Remove/Out"
touch "$APP/.installed"
echo
echo "Installed. Drop clips into  Desktop/Caption Remove/In  and double-click Caption Remove.command."
