# The Great Emu War of 1932

Original animated history short. 66.000 seconds, 1440×2560, 30 fps.

The opening joke uses “lost” as shorthand for a failed pest-control operation. The narration distinguishes it from a conventional war, qualifies Meredith's reported kill figures, and rejects the bulletproof-emu myth.

## File

- File: `great-emu-war-1932.mp4`
- Size: 143,278,887 bytes (136.64 MiB)
- SHA-256: `8ece1c732f0ac5380971c67ee95d38ee0ae0cae18a00c361f1e4fe850cae3c92`
- Composition: `EmuWarShort`
- Video: H.264; audio: AAC, 48000 Hz, 2 channels

## Production

All picture frames were rendered with Remotion, Three.js, and `@remotion/three`. Original procedural farm, period props, cartoon cast, camera movement, lighting, ink, depth of field and grading. No captions or labels. Narration, original synthesized march score, and Foley were mixed separately. FFmpeg was used for final audio processing and muxing; the picture was copied without re-encoding during muxing.

Commands used inside `/workspace/shorts-dev`:

```bash
export TMPDIR=/workspace/shorts-dev/work/remotion-tmp
export TEMP="$TMPDIR" TMP="$TMPDIR"
npx remotion render src/index.tsx EmuWarShort work/emu-war/picture.mp4 --codec h264 --crf 16 --scale 1.3333333333333333 --browser-executable /usr/bin/chromium --gl angle-egl --concurrency 2 --timeout 180000 --log info
ffmpeg -hide_banner -loglevel error -y -i work/emu-war/picture.mp4 -i work/emu-war/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -t 66 -movflags +faststart output/great-emu-war-1932.mp4
```

Production source remains in `/workspace/shorts-dev/src/videos/emu-war/`. This dedicated output branch contains deliverables only. The existing source branches and project files are unchanged.

## Sources and narration

See [SCRIPT.md](SCRIPT.md) for the sourced facts, historical staging notes, and complete narration.

## Audio provenance


Piper en_US-ryan-high, ONNX model from https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ryan-high.tar.bz2 . Model card identifies RyanSpeech (https://www.kaggle.com/datasets/roholazandie/ryanspeech), CC BY-NC-SA 4.0. Narration is synthetic, using original historical script; it is not a historical recording. Voice generated at length_scale=1/1.18 with native Piper.

Score and Foley: original D-major 126bpm march, additive/modal/filtered-noise synthesis, adapted from project bridge DSP helpers. No external recording, music sample, or reference-channel audio used.

The narration model card lists the RyanSpeech dataset license as [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

## Final validation

Automated QA scanned all 1,980 frames: no black frames, unplanned white frames, frozen spans, or unplanned pop frames. Manual final audit reviewed the opening, jam, truck, fan cue, transitions, and ending. The two initial pop flags were intentional cuts; the shot metadata was corrected to the actual JavaScript frame boundaries. The MP4 was not changed or re-rendered.

Final audio: -15.0 LUFS integrated, 2.0 LU loudness range, -2.0 dBFS true peak, no detected silences.

The 143,278,887-byte MP4 exceeds GitHub's regular Git-file limit. GitHub also rejects new LFS objects in public forks. This output therefore preserves the unchanged MP4 as two ordinary binary parts, each below the Git-file limit.

## Restore the MP4 from this download package

1. Download and extract the output branch ZIP.
2. Open `restore-video.html` in a desktop browser, select both `.part001` and `.part002` files, and click **Verify and save MP4**. The helper runs locally, makes no network requests, and verifies the original SHA-256 before saving.

Python alternative (no extra packages):

```bash
python restore_video.py
```

The resulting `great-emu-war-1932.mp4` is byte-for-byte identical to the completed render, not a re-encode. The Python helper refuses to overwrite an existing file. `parts-manifest.json` records the original and per-part checksums.

A direct single-MP4 download and Codex task-UI artifact could not be created in this environment; this package is the GitHub preservation fallback.
