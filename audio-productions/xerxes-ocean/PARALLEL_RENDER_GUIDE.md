# Instructions for another AI: parallel GitHub rendering

This production used eight GitHub Actions runners to render a 2,055-frame Remotion film. Each runner received one contiguous range: 0–255, 256–512, 513–769, 770–1026, 1027–1283, 1284–1540, 1541–1797, 1798–2054.

The animation is a deterministic function of the absolute frame number. Each runner can therefore start at its assigned frame without simulating previous frames. Stateful simulations must be baked or given adequate deterministic preroll before using this approach.

Every worker uses the same checked-out commit, locked dependencies, composition, resolution, frame rate, codec, pixel format, CRF and rendering flags. Here that was native 1440×2560, 30fps, H.264 CRF16, yuv420p, Chrome software WebGL, one render worker per runner. WebGL DPR and export scale are both 4/3 for a 1080×1920 composition. Chrome temporary files use a short /tmp path to avoid Unix socket-length failures.

A preflight job verifies types, composition metadata and an actual nonblank frame-zero capture. A matrix job then renders the eight ranges. Each output carries its frame range, source commit and SHA-256 checksum. A final job downloads the chunks, checks complete coverage and joins them in numeric frame order:

```sh
ffmpeg -f concat -safe 0 -i chunks.txt -c copy -movflags +faststart final.mp4
```

`chunks.txt` contains one `file '/absolute/path/chunk-00.mp4'` line per chunk. All chunks must have matching stream settings. Initial keyframes and reset chunk timestamps are supplied by Remotion's individual encodes.

The final job validates dimensions, frame count, duration and decoding, then uploads downloadable GitHub artifacts. Retain successful chunk artifacts and retry only failed jobs. GitHub performs the frame computation; the chat agent prepares source/workflows and inspects the results.

Audio can be added later using the completed visual artifact:

```sh
ffmpeg -i visual-master.mp4 -i mix.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k \
  -movflags +faststart narrated-final.mp4
```

This copies the video stream and encodes only the audio. Preserve the original visual artifact, verify video stream identity, and check audio duration and loudness. An audio-only pull request should target the existing render branch and modify separate audio paths, so its changes do not trigger another expensive visual render.

## Copyable instruction

```text
Set up a GitHub Actions matrix workflow to render this Remotion video
in eight parallel, non-overlapping absolute frame ranges. Ensure the
animation is deterministic at arbitrary frames. Validate types,
composition metadata and a real frame-zero capture before rendering.

Use the same commit, locked dependencies, composition, resolution,
fps, codec, pixel format, CRF and WebGL settings for every chunk.
Use one worker per runner and a short Chrome temp path. Install
required system tools explicitly instead of assuming runner contents.

Upload chunks with range, source-commit and checksum manifests.
After all succeed, download in frame order, verify no gaps or overlaps,
and concatenate with FFmpeg -c copy. Validate the final file and
upload it with QA reports as downloadable artifacts. Retry only
failed jobs; preserve successful chunks.

For later narration/music changes, download the completed visual
master and attach the mixed audio with -c:v copy. Do not rerender
video. Keep audio paths separate from visual-workflow triggers.
```
