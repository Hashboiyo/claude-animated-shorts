# The Wooden Airfield

A complete Remotion project for the supplied 21-scene procedural 3D animation, with the uploaded Lauren narration included and enabled.

**Output:** 1080 × 1920, 24 FPS, 1,856 frames, 77.33 seconds, H.264 video with AAC audio.

## Render on GitHub

1. Extract this package and keep the project in `wooden-airfield/` and the workflow in `.github/workflows/render-wooden-airfield.yml` at the repository root.
2. Open the repository's **Actions** tab, select **Render Wooden Airfield**, and click **Run workflow**. If GitHub prompts you to enable Actions, enable it first.
3. When the workflow finishes, open the completed run and download the **wooden-airfield-video** artifact. Extract it to get `wooden-airfield.mp4`.

The workflow renders eight video chunks on GitHub's CPU runners, with up to four jobs at once. It joins them and adds the continuous original narration once, avoiding audio gaps at chunk boundaries. It checks the finished frame count, duration, and audio stream. Rendering uses GitHub Actions minutes.

## Preview or render locally

Use Node.js 22 or newer.

```sh
cd wooden-airfield
npm ci
npm run studio
```

Select the **WoodenAirfield** composition in Studio. The narration plays automatically.

```sh
npm run typecheck
npm run render
```

The finished file is `out/wooden-airfield.mp4`. Remotion downloads Chrome Headless Shell when required. FFmpeg is only needed for the GitHub chunk-assembly script; a normal local `npm run render` uses Remotion's encoder.

## Narration and scene timing

The original code was fixed at 118 seconds. This version cuts at the supplied recording's phrase onsets, rounded to the nearest frame. The MP3 lasts 77.322449 seconds; the video lasts 77.333333 seconds so its complete audio fits. Playback speed stays at 1×. All 21 scenes remain, with their camera movements fitted to the new scene durations.

- `public/audio/narration.mp3`: the uploaded recording, unchanged.
- `src/index.tsx`: the animation and composition registration.
- `src/timing.json`: absolute scene-cut frames and overall duration.
- `TIMING.md`: the scene timing table.
- `../.github/workflows/render-wooden-airfield.yml`: the manual GitHub Actions render workflow.

If replacing the narration, update `src/timing.json` to match the new recording. The checked-in cuts are specific to the included file. Optional score, atmosphere, and effects remain available as composition props; no additional audio assets are required.

The included installation patch enables SwiftShader software WebGL in the pinned Remotion version, which is required on current headless Chrome runners.

## Validation performed

TypeScript passed. A headless Chromium test rendered a clip with the narration, a representative frame from every scene, and the final black frame. The FFmpeg chunk assembly was checked locally with a full-duration test fixture. The GitHub workflow itself must run in your repository.
