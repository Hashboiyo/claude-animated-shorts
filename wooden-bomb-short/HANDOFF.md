# HANDOFF — "The Wooden Bomb" (read this first in the next session)

Updated: end of the session that built the full visual codebase and got the first working render.
Everything below is on disk; nothing lives only in chat.

---

## Where we are in the pipeline (3-gate workflow per AGENTS.md)

- **Gate 1 (script): APPROVED** — `wooden-bomb-short/SCRIPT.md` (16 lines, ~257 words, jokes fact-checked).
- **Gate 2 (stills/contact sheet QA): APPROVED.** Contact sheet `out/wooden-sheet/contact.png` (18 stills, all
  14 shots). 4 issues found + user approved "fix the 4 issues, then render"; ALL FIXED and re-verified in
  `out/fixcheck*/`: (1) coat card readable (world.ts coatPoster: brighter walls/coat, warm door rim, floor
  pool), (2) planks → 4 smaller grounded props, (3) dawn magenta cast tamed (lights.ts golden lit/charTint/
  sunI + grade.ts GRADE_GOLDEN2 desaturated), (4) bomb rest yaw 3.94 rad puts the WOOD FOR WOOD stencil
  band in the lens for the shot-10 officer read and the shot-14 final push-in (verified f2030).
- **Gate 3 (cloud render): DISPATCHED** — GitHub Actions run **42508598918**
  (`render-video.yml`, WoodenBomb, 8 chunks, crf 18, audio `public/audio/wooden-mix.wav`, release tag
  `wooden-bomb-v1`). Final MP4 expected as release artifact — never render locally (AGENTS.md rule).

Voice is locked and generated: `wooden-bomb-short/voice/voice.wav` (48 kHz, 66.07 s,
`en-GB-RyanNeural` at +42% rate) + `voice/words.json` (232 word timestamps).
Composition: **`WoodenBomb`, 2040 frames @ 30 fps, 1080x1920** (registered in `src/Root.tsx`).

## State of the code (all type-checked)

`src/videos/wooden-bomb/` — full WWII airfield rewrite:
- `story.ts` — 14-shot plan, camera keys, DoF table, physics (plank run, rail plane, bomb FALL/CLONK
  at t=42.64 s, frame 1279), `BUILD` cast-position table (2-tuples `[[x,z],...]` shared by world+cast),
  `FOREGROUND` props, `TOTAL = 2040`, `FLASH_AT = 127`, `RELEASE = 40.30`, `CLONK = 42.64`, `FALL_T = 2.34`.
- `build.ts` — procedural scenery + prop factories (`makePlane`/`makeBomb`/`makeRail` return `THREE.Group`),
  `buildField` (now includes procedural haystacks; windmill/cart GLB props removed).
- `world.ts`, `cast.ts` (WWII cast: wreck{Colonel+greatcoats}, planks{5 carpenters+painter+2 carriers},
  shells, rails, gawk, party{mugs up at 30.45}, cross{dawn final plank}, clonk{officer walk 42.9→45.05},
  pilot{speed lines}, decoys{4 thuds at 56.3/58.05/59.85/60.55}, tail), `toon.ts` (LUFT/LUFT_OFF/
  LUFT_GREATCOAT/CARP/RAF_PLOT outfits, 4 hat styles, map/plank/mug props, fxFlare/fxSpeed),
  `paint.ts` (runwayHD/hangarHD/liveryHD roundel+cross/airframeHD/bombHD with "WOOD FOR WOOD" stencil/
  craterHD), `lights.ts`, `ink.ts`, `lensblur.ts`, `grade.ts`, `cardshade.ts`, `shade.ts` kept from template.
- **`WoodenBomb.tsx` + `post.ts` (NEW, critical)** — see the bug section below.

Last typecheck: **0 errors** on the final state (post.ts toggles act on the wrapping `EffectPass`
objects — `Effect` subclasses have no `enabled`; ONE EFFECT PER EffectPass is mandatory on this stack:
merging tone+grade into one pass blanked the render, so tone and grade each get their own pass:
`tonePass` / `gradePass`). If future edits re-introduce errors, candidates: `dofAt(f).focus`
3-spread (exists in story.ts), `LensBlur` fields `pre`/`main`/`focus`/`cInf`, `gradeFor` signature,
`chain.lens.dispose()` existence.

## THE RENDER BUG WE BEAT (do not undo this)

- The R3F `<EffectComposer>` (`@react-three/postprocessing`) is **broken on this Windows/swangle stack**:
  ANY composer with ≥2 passes renders a **transparent/blank canvas silently** (verified pass-by-pass:
  1 effect = renders, any 2 second config = blank, even in a bare setup).
- **Fix:** drive the raw `postprocessing` `EffectComposer` by hand. `post.ts` builds
  `RenderPass → InkPass → lens.pre → lens.main → bloom → NEUTRAL tone → grade` with `multisampling: 0`,
  and `WoodenBomb.tsx` calls `chain.render()` inside `useFrame(..., 1)` (priority 1 = R3F never
  auto-renders). **NEVER set `enabled=false` on any pass at runtime** — disabling ANY pass (even grain)
  blanked the composer; all passes stay on, every frame. One effect per `EffectPass` is mandatory.
- **Verified working:** frames 0/400/760 render with real content (stdev 66–79; previously 0.00).
  Still-0400 shows sky, field, runway edge and the shot-5 cast standing at their BUILD positions — all correct placement.
- Do **not** switch back to `<EffectComposer>` from `@react-three/postprocessing`.

## Known open visual issues (visible in the first working frame, still-0400 in out/wooden-stills/)

These are for the Gate-2 pass, in rough priority:
1. **World ink lines look absent** on runway/hedge edges (characters have outlines if any; check
   `InkPass` actually executes in the hand-driven chain — possibly the ink pass needs `composer`'s
   depth texture, or its `enabled` flag. Compare with the bridge template's local stills).
2. Cast read as cute blobs: hats read as skin-tone caps (hat styling points at "carpenter" not LUFT
   field caps — check `hatOn` mapping in toon.ts), arms are nearly invisible in front view
   (check `bodyFront` arm layering/z-order), hammers/plank props thin to nothing.
3. Planks being laid (shot 3 tide-edge behavior) not visibly in progress at frame 400 — verify
   `plankAt` timeline and slab reveal.
4. Sky/ground fine; consider slight horizon warmth per Style Bible after contact sheet.

## The missing Kenney kit (IMPORTANT for stills on any machine)

`public/` here only contains `audio/lantern-cove-music.wav` — **the `public/bridge/kenney/*.glb`
props 404 on every still render** (trees, bushes, hedges, flowers, grass, stall). The scene survived
because `build.ts` `prop()` tolerates load failures, but distant dressing is missing. Check whether
the repo workflow fetches the kit (see `.github/workflows/stills.yml` / `render-video.yml` steps or a
download script) or whether `loadKit()` in `build.ts` falls back to procedural shapes; mirror whatever
the cloud workflow does locally. `FOREGROUND` cart was already swapped to `hedge`.

## Audio pipeline (DONE — mixed end-to-end, 2026-11-08)

`wooden-bomb-short/audio/` (copies of the bridge templates, now edited for Wooden Bomb):
- `timeline.py` — REWRITTEN for this film (shots 1–14 from story.ts, XFADE, hammer grids, rail_x,
  cam_distance, DUR=68.0). `words()` returns `[{w, s, e}]` mapped from words.json.
- `music.py` — REWRITTEN (same instrument machinery; sections hook→setting→build→shells→toy→mystery→
  nobombs→hold(40.3 pad swell)→reveal→explain→decoywar→punch→tail). `music import ok` confirmed.
- `sfx.py` — REWRITTEN and **fully fixed 2026-11-08**. The composite helpers were re-grounded against the
  real dsp/sfx_gen signatures; rules of thumb now proven: `widen()` is MONO-in → stereo-out; `place()`
  needs a (2,N) buffer (use `sfx._place_mono` for mono bufs); `stick_slip(amp=)` wants an ARRAY (or drop
  it and scale the result); `bp(..., order)` order must be an int; `dsp.fades()` needs an ARRAY (never
  a scalar int); `stroll_step` is a fixed 0.3 s mono step; `clink(dur)` returns exactly `ns(dur)`;
  **composite generators must return the sound only — the Cue lambda sets the anchor — or you get nested
  `(sound, anchor)` tuples** (that was the last "inhomogeneous shape (2,)" bug). All ~120 cues verified
  shape/finite clean.
- `mix.py` — adapted (MUSIC_TARGET/section names, DIPS, REPORT, write_cues header, section_db hard
  switches at T.FLASH/35.04/42.6). **Rendered:** master −15.0 LUFS integrated, peak −1.2 dBFS, all
  stems finite (the "TP nan dBTP" in the log is a measurement artifact; files verified NaN-free and
  peak-clean by decode). Local `ffmpeg` missing → the workflow's own ffprobe QA is its substitute.
- `dsp.py`, `instruments.py`, `sfx_gen.py` — template machinery, unchanged.
- numpy/scipy are installed (`python -m pip install --user` worked; exit code noise is expected).

**Delivered:** `wooden-bomb-short/audio/mix.wav` (68 s @ 48 kHz stereo 24-bit) + stems + cues.md, copied
to `public/audio/wooden-mix.wav` and pushed; the cloud render muxes it. WoodenBomb.tsx does NOT need an
`<Audio>` tag — the workflow muxes master audio in the assemble stage.

## Tooling quirks (Windows)

- `npx` blocked by PowerShell policy → **`cmd /c "npx ..."`** always.
- TypeScript check: `cmd /c "npx tsc --noEmit > out\tsc.log 2>&1"` then read the log.
- Stills: `cmd /c "set TEMP=%TEMP%\opencode\remotion-tmp&& ... node scripts/render-stills.mjs
  --comp=WoodenBomb --frames=0,400,760,1240 --scale=0.5 --out=out/wooden-stills"`; create that TEMP
  dir first (`New-Item -Force -ItemType Directory`) or bundling fails with ENOENT mkdtemp.
- ffmpeg/ffprobe not on PATH: `cmd /c "npx remotion ffmpeg ..."` if needed.
- Chrome-headless-shell already downloaded to node_modules/.remotion.

## Immediate next steps (pick up here)

1. `cmd /c "npx tsc --noEmit"` → fix any type errors from the post.ts/WoodenBomb.tsx rewrite.
2. Render a broader still set (probe shots: 0,127,300,455,610,890,1053,1146,1240,1280,1440,1550,1700,1900,2039)
   and build the **contact sheet**; compare to STYLE_BIBLE; fix ink/hats/arms/planks issues above.
3. Investigate the Kenney kit availability (step above) so dressing props exist in stills.
4. Present the contact sheet to the user (Gate 2) and get change list.
5. After approval: `python mix.py` for the soundtrack, then trigger the cloud render workflow —
   `gh workflow run render-video.yml -f composition_id=WoodenBomb -f chunks=8` (repo is
   `Hashboiyo/claude-animated-shorts`, gh auth works as Hashboiyo). Verify matrix/qa artifact, deliver.

## Files map (fast resume)

- Script/facts: `wooden-bomb-short/SCRIPT.md`
- Voice: `wooden-bomb-short/voice/voice.{wav,json}` (words.json has t0/t1 per word)
- Audio templates adapted: `wooden-bomb-short/audio/*.py` (see per-file status above)
- Compositional story: `src/videos/wooden-bomb/story.ts` (read SHOTS + comment header first)
- Component: `src/videos/wooden-bomb/WoodenBomb.tsx` ; post chain: `post.ts`
- Registry: `src/Root.tsx` (LanternCove + WoodenBomb)
- Latest stills: `out/wooden-stills/still-*.png` (+ manifest) — frame 0400 is the good one to show progress
- Last verified-good render command is in §Tooling above.
