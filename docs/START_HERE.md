# Start here — how to begin a video

The workspace is ready. You do **not** need to render anything on this laptop.

## 1. One-time GitHub login

If `gh auth status` says you are logged out, run:

```bash
gh auth login --web --hostname github.com --git-protocol https --scopes repo,workflow
```

GitHub will open a browser tab. The terminal prints a one-time code such as
`ABCD-1234`; paste it into the page and click **Authorize**. That is the
one-click login. No token needs to be copied into a file.

## 2. Tell me the video idea

Send me:

- The **topic** (one surprising true story works best).
- Any **facts / sources** you already have.
- The **tone** (deadpan, warm, eerie, funny) and the target length
  (55-70 s is the house standard).
- Whether you already have a **voice recording**, or want a voice generated.

You do not need to write the script or the shot list.

## 3. What happens next (mandatory gates)

### Gate 1 — Script approval

I will write the full script in chat first: narration lines, scene-by-scene
visual descriptions, environment changes, and timing beats. **Nothing visual
is built until you approve or edit the script.**

### Gate 2 — Stills + contact sheet

After the script is approved, I build the Remotion + Three.js scene and push
it. Then I run the **Render stills + contact sheet (cloud)** workflow. You get
a labelled contact sheet rendered on GitHub's runners, not on your laptop.

You review the stills against the style references. We iterate on visuals,
timing, lighting and animation until you say there are no more changes.

### Final delivery choice

Once you confirm the stills are final, choose one:

- **Option A — Render the complete video in the cloud.** I trigger the
  8+ chunk matrix workflow, it assembles and QA-checks the MP4, and you get a
  download link (artifact or GitHub Release).
- **Option B — Output the entire implementation as one self-contained
  Three.js + Remotion code block in chat.** Nothing omitted or truncated.

## 4. How to trigger a render yourself

### Stills / contact sheet

GitHub → **Actions** → **Render stills + contact sheet (cloud)** →
**Run workflow**.

- Composition: `LanternCove` (demo) or your new ID.
- Frames: `auto` for 12 evenly spaced stills, or `0,60,120,180`.
- Scale: `0.5` for fast QA, `1` for full size.

Download `contact-sheet.png` from the run's **Artifacts**.

### Final video

GitHub → **Actions** → **Render video (cloud matrix)** → **Run workflow**.

- Composition: your composition ID.
- Chunks: `8` (more chunks = more parallel runners).
- Scale: `1` (1080x1920) or `1.3333` (1440x2560).
- CRF: `18`.
- Audio: `public/audio/<video>/mix.wav` (premixed 48 kHz stereo).
- Release tag: optional, e.g. `my-short-v1`.

The run goes **validate → 8+ parallel chunks → assemble + audio mux + QA**.
Download the MP4 from **Artifacts**, or from the **Releases** page if you set
a tag.

## 5. The demo composition

`LanternCove` is a self-contained 8-second smoke test: a painted 3D island
town at golden hour, a flat 2D ink character, a gliding camera, fireflies, a
moon and a deterministic music bed. It proves the full cloud pipeline before
the first real short.

It is **not** the first real video. Use it to confirm the workflows, then we
start the script gate for your actual story.

## 6. Files you will touch most

| Path | What it is |
| --- | --- |
| `src/videos/<name>/timeline.ts` | Shots, camera keys, beats, deterministic timing. |
| `src/videos/<name>/World.tsx` | Environment, set dressing, lighting. |
| `src/videos/<name>/Character.tsx` | Canvas-drawn 2D character + ink. |
| `src/Root.tsx` | Composition registry (ID, duration, fps, size). |
| `public/audio/<name>/mix.wav` | Premixed voice + music + SFX. |
| `.github/workflows/render-video.yml` | Cloud matrix render. |
| `.github/workflows/stills.yml` | Cloud stills + contact sheet. |

## 7. Useful commands

```bash
npm run typecheck        # TypeScript
npm run compositions     # validate composition metadata + audio
npm run dev              # optional interactive preview (not a render)
npm run audio:demo       # regenerate the demo music bed
```

Cloud commands:

```bash
gh workflow run stills.yml -f composition_id=LanternCove -f frames=auto -f scale=0.5
gh workflow run render-video.yml -f composition_id=LanternCove -f chunks=8 -f scale=1 -f crf=18 -f audio_file=public/audio/lantern-cove-music.wav
gh run list --workflow=render-video.yml
gh run watch <run-id>
gh run download <run-id>
```

## 8. The one rule to remember

Do not ask for a full render before the script and stills are approved. The
gates exist because a 60 s 3D short is expensive to iterate on, and the
contact sheet catches composition, ink, lighting and motion problems while
they are still cheap to fix.
