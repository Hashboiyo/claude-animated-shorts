#!/usr/bin/env bash
set -euo pipefail
STAGE_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
SOURCE_DIR=/workspace/shorts-dev
DEST_DIR="$STAGE_DIR/render-source/erfurt-v2"
cp "$SOURCE_DIR"/src/videos/erfurt-v2/{Erfurt.tsx,story.ts,ink.ts,lensblur.ts,grade.ts} "$DEST_DIR/src/videos/erfurt-v2/"
cp "$SOURCE_DIR"/work/erfurt-v2-audio/{mix.wav,VOICE-LICENSE.md,timeline.json,words.json} "$DEST_DIR/"
printf '%s\n' 'Snapshot copied. No commit or push performed.'
