# Cloud rendering setup

Everything that produces a still or a video frame runs on GitHub-hosted
runners. Your laptop is only used to edit code and, optionally, to preview the
timeline in Remotion Studio. No local `remotion render` is required or
recommended.

## Why this is free

`Hashboiyo/claude-animated-shorts` is a **public** repository. GitHub gives
public repositories unlimited standard GitHub-hosted runner minutes, and
artifact storage for public repositories is free within GitHub's limits.
A render fans out to 8+ runners in parallel, so a 60 s short that takes
~30 minutes per chunk still finishes in roughly 30-45 minutes of wall time.

If you ever make the repository private, the free plan includes 2,000
runner-minutes per month. At 8 chunks, a single 1080x1920 short can consume
several hundred of those minutes, so keep it public for unlimited cloud
renders.

## Workflows

| Workflow | File | Purpose |
| --- | --- | --- |
| **Render video (cloud matrix)** | `.github/workflows/render-video.yml` | Validate, render frame 0, split into 8+ chunks, render in parallel, verify checksums, concatenate losslessly, mux audio, QA, upload the MP4, optionally publish a GitHub Release. |
| **Render stills + contact sheet (cloud)** | `.github/workflows/stills.yml` | Render 12 evenly spaced stills (or a specific comma-separated frame list), build a labelled contact sheet, upload everything. |
| **Validate** | `.github/workflows/validate.yml` | `npm ci` + `tsc --noEmit` on every push/PR. No rendering, so it is cheap and fast. |

## Run a render

### From the GitHub UI

1. Open `https://github.com/Hashboiyo/claude-animated-shorts/actions`.
2. Choose **Render video (cloud matrix)**.
3. Click **Run workflow** and fill in:
   - **composition_id**: `LanternCove` for the demo, or your new composition ID.
   - **chunks**: `8` (minimum; up to 32). More chunks = more parallel runners.
   - **scale**: `1` for 1080x1920, `1.3333` for 1440x2560 (2K vertical).
   - **crf**: `18` (house default; lower = larger/better).
   - **audio_file**: repo-relative path to the final mixed WAV, e.g.
     `public/audio/lantern-cove-music.wav`.
   - **release_tag**: optional, e.g. `lantern-cove-v1`. If set, the final MP4
     is attached to a GitHub Release for a permanent download link.
4. Wait for **Validate + frame 0**, then the parallel **Chunk** jobs, then
   **Assemble + audio mux + QA**.
5. Download the MP4 and QA report from the run's **Artifacts** section.

### From the command line

```bash
# after `gh auth login --web`
gh workflow run render-video.yml \
  -f composition_id=LanternCove \
  -f chunks=8 \
  -f scale=1 \
  -f crf=18 \
  -f audio_file=public/audio/lantern-cove-music.wav \
  -f release_tag=lantern-cove-v1

gh run list --workflow=render-video.yml
gh run watch <run-id>
```

Download artifacts:

```bash
gh run download <run-id>
```

Retry only the failed chunks (completed chunks are reused):

```bash
gh run rerun <run-id> --failed
```

### Stills / contact sheet

```bash
gh workflow run stills.yml \
  -f composition_id=LanternCove \
  -f frames=auto \
  -f scale=0.5
```

`frames=auto` renders 12 evenly spaced frames including frame 0 and the last
frame. To render specific beats:

```bash
gh workflow run stills.yml \
  -f composition_id=LanternCove \
  -f frames=0,60,120,180,239 \
  -f scale=1
```

## What the video workflow actually does

### Stage 1 — `validate`

- Checks out the exact commit and installs the lockfile with `npm ci`.
- Runs `tsc --noEmit`.
- Bundles Remotion and reads the composition metadata (`durationInFrames`,
  `fps`, `width`, `height`) with `selectComposition()`.
- Verifies the master audio is a readable 48 kHz stereo PCM WAV whose length
  covers the composition.
- Renders **frame 0** as a real still and rejects it if the image is blank
  (standard deviation test), proving WebGL, textures, fonts and shaders work.
- Splits `[0, durationInFrames)` into 8+ non-overlapping, gap-free ranges and
  emits a GitHub Actions matrix.

### Stage 2 — `render-chunks`

- One matrix job per chunk, `fail-fast: false`, so a failed chunk can be
  retried without discarding the others.
- Identical settings on every runner: same commit, same lockfile, H.264,
  CRF, `yuv420p`, `--scale`, `--concurrency=1`, `--muted`.
- `--gl=angle`, with an automatic retry using `--gl=swangle` if a runner's
  ANGLE backend cannot initialize.
- Short temp paths (`REMOTION_TMP=/tmp/remotion-tmp`) avoid Chromium socket
  and path-length failures.
- Every chunk gets a JSON manifest with its exact start/end frame, byte size
  and SHA256 checksum. The MP4 + manifest + checksum are uploaded as
  `chunk-<index>-<start>-<end>`.

### Stage 3 — `assemble-and-qa`

- Downloads every chunk artifact in one directory.
- Verifies every SHA256 and byte size.
- Asserts chunk 0 starts at frame 0, each next chunk starts at
  `previous_end + 1`, and the last ends at `durationInFrames - 1`.
- Concatenates with the FFmpeg concat demuxer and `-c:v copy` — no video
  re-encoding.
- Muxes the master audio with `-map 0:v:0 -map 1:a:0`, AAC 192 kbps,
  48 kHz, `-shortest`, `+faststart`.
- Probes the final MP4 for exact frame count, duration, dimensions, fps,
  H.264, AAC/48 kHz/stereo, and runs a full decode with zero errors.
- Extracts five sample frames and a QA contact sheet, writes
  `qa-report.json` + `qa-report.md`, and uploads everything.
- Optionally publishes the MP4 to a GitHub Release.

## Audio contract

The workflow expects **one already-mixed WAV**:

- PCM WAV, 48 kHz, stereo, 16-bit (or float).
- Length at least `durationInFrames / fps`.
- Contains voice + music + SFX, already ducked and loudness-normalized.

The real production pipeline is `templates/audio/` (Python): it generates SFX
and the score, ducks music under the voice, and writes `mix.wav`. Point
`audio_file` at that file once it exists in the repo, e.g.
`public/audio/<video>/mix.wav`.

The demo uses `public/audio/lantern-cove-music.wav`, generated deterministically
by `scripts/make-audio.mjs`. Regenerate it with:

```bash
npm run audio:demo
```

## Adding a new short

1. Copy the template folder:
   `src/videos/lantern-cove/` → `src/videos/<name>/`.
2. Rewrite `timeline.ts` (shots, camera keys, beats) and `World.tsx`
   (environment) for the new story. Keep every animation a pure function of
   the absolute frame.
3. Register the composition in `src/Root.tsx` with the correct
   `durationInFrames`, `fps`, `width` and `height`.
4. Put the premixed audio at `public/audio/<name>/mix.wav`.
5. Run the **Render stills** workflow first. Review the contact sheet against
   `references/STYLE_BIBLE.md`, `references/frames/`, and
   `references/sheets/`. Iterate until the stills are right.
6. Only then run **Render video (cloud matrix)**.

The production rules (script gate, contact-sheet gate, no local full render)
are in `AGENTS.md` and `SKILL.md`.

## Cost and concurrency notes

- GitHub's free public-repo plan allows up to 20 concurrent standard jobs.
  The workflow caps the matrix at 16 so it stays within the free concurrency
  envelope even if other workflows are running.
- Each chunk is one browser tab and one FFmpeg encoder
  (`--concurrency=1`). This is deliberate: it keeps memory flat on the
  7 GB runners and makes chunk output byte-stable.
- Artifact retention defaults to 14 days. Set `retention_days` lower for
  experiments, or publish a Release for a permanent copy.
- The final MP4 is also uploaded as an artifact for 14 days. A Release asset
  is the durable link.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing master audio` | The `audio_file` input is wrong, or the WAV is not committed. The path is repo-relative. |
| `Master audio must be 48 kHz / stereo` | Re-export the mix as 48 kHz stereo PCM WAV. |
| `angle failed; retrying with swangle` | Normal fallback on some runners. The render continues. |
| A chunk fails | Open the failed job, read the Remotion log, fix the code, then `gh run rerun <run-id> --failed`. Completed chunks are not re-rendered. |
| QA frame count off by one | Check that the composition's `durationInFrames` matches the audio/video plan. Do not trim the final MP4 by hand. |
| Release step fails | The optional `release_tag` may already exist with a protected tag, or the workflow token lacks `contents: write`. The MP4 artifact is still available. |
| Browser download slow | First run on a cold runner downloads Chrome Headless Shell. Later runs reuse the npm/browser caches. |

## What stays local

- `npm run typecheck` — TypeScript only.
- `npm run dev` — optional Remotion Studio preview. This is interactive
  preview, not a deliverable render.
- `npm run compositions` — metadata only.
- Git operations.

All stills, frame-zero proofs, contact sheets, chunk renders, final renders,
concatenation, audio muxing and QA run in GitHub Actions.
