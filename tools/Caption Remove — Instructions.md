# Caption Remove — how to use it

Removes burned-in captions (the yellow words baked into the picture) from video clips. Runs on your Mac. Nothing is uploaded anywhere.

## The folders

Everything lives in one folder on your Desktop:

```
Desktop
└── Caption Remove
    ├── In            ← drop the original clips here
    ├── Out           ← cleaned clips appear here
    └── settings.txt  ← the caption zone + mode (the tool fills this in for you)
```

Originals in `In` are never changed. Every cleaned clip is a new file.

## Step by step

1. **Get the original clip** (e.g. the Download button on Frame.io — not a screen recording; a real download gives a much cleaner result).
2. **Drop it in `Desktop › Caption Remove › In`.** Several clips at once is fine.
3. **Click the Caption Remove icon in the Dock.** A picture window opens showing the newest clip in `In`.
4. **Find a frame with a caption on it** — drag the slider at the top of the window.
5. **Drag a box around the caption.** It draws in yellow. If the captions move between shots, make the box tall enough to cover the highest and lowest spot you see while scrubbing. Keep it clear of faces and anything else you want untouched.
   - **C** clears the box so you can redraw it.
   - **Esc** skips drawing and uses the last box you saved.
6. **Press Enter.** The window closes and a Terminal window takes over, showing progress one clip at a time ("Subtitle Removing: 43% …").
7. **Wait.** Roughly 1 frame per second — a 30-second clip is about 12–15 minutes, a 2-minute clip about an hour. You can keep using the Mac; just don't close the lid (it pauses). Leaving it overnight for a batch is the normal way.
8. **Find the result in `Desktop › Caption Remove › Out`.** Same name as the original with `_clean` added, e.g. `FOX_Picky Eaters_V1.mp4` → `FOX_Picky Eaters_V1_clean.mp4`. Same resolution and frame rate; the original audio is copied through untouched.
9. When the Terminal says `Done: 1 cleaned …` and "Press any key to close", press any key.

## Checking the result

Open the `_clean` file and scrub through the spots where the captions were. Over a plain wall, shirt or black backdrop it should be nearly invisible. Where a hand or busy detail passed through the box you may see a soft patch for a few frames — that is the limit of the technique.

## Running it again / batches

- Clips already in `Out` are skipped on the next run, so you can top up `In` and click the icon again any time.
- To **re-do** a clip (new box, new mode), first move or delete its `_clean` file from `Out`, then click the icon.
- The box you draw is saved in `settings.txt` and reused for every clip in that run. If a new batch has captions in a different spot, just draw a new box when the picture window opens.

## settings.txt (optional)

You normally never touch this — the box you draw writes the ZONE lines. The one thing worth knowing is **MODE** (open the file in TextEdit, change the line, save):

- `MODE=sttn-det` — default. Looks for text inside your box and only repairs the frames that have it. Fastest; very rarely misses a frame, which shows as a caption flashing on for a moment.
- `MODE=sttn-auto` — repairs the whole box on every frame. Never misses, but anything passing through the box (a hand) gets smoothed too, so keep the box tight.
- `MODE=propainter` — best quality on movement, about 3–4× slower. Use for a hero clip when the default leaves a visible patch.

Lines starting with `#` are notes and do nothing.

## If something goes wrong

- **"Nothing in In"** — the `In` folder is empty or the file isn't .mp4/.mov/.m4v.
- **"FAILED — left in In"** — that clip errored; the others continue. Try it alone, and send me the Terminal lines above the word FAILED.
- **Picture window doesn't open** — the first time, macOS may ask to let Python control the screen; allow it and click the icon again.
- **Opened the icon twice by mistake** — in the extra picture window press Esc, then in its Terminal press Ctrl+C and close that window.
- **"Operation not permitted" in Terminal** — System Settings › Privacy & Security › Files and Folders › Terminal → allow Desktop.

## Where the pieces live (for reference)

- Dock icon: `Documents › GitHub › studio-portal › tools › Caption Remove.command`
- Scripts: `tools/caption-zone.py` (the box picker), `tools/caption-remove.sh` (the batch), `tools/caption-remove-install.sh` (one-time install, already done)
- The AI tool itself: `~/CaptionRemover` (video-subtitle-remover, open source, Apache 2.0)
