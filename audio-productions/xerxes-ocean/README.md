# Xerxes narration and original music

This workflow adds audio to the completed 68.5-second visual master from GitHub render run 42292016933. It does not render or re-encode video frames.

Narration uses the approved script verbatim, spoken by the Kokoro bm_george English preset in one steady tone. Sixteen narration cues follow the existing scene boundaries. Neural phoneme durations are mapped to source words and adjusted by the measured pitch-preserving time fit. Raw phoneme timestamps, word timings, cue duration/match statistics and a narration preview are retained.

An original plucked-string, muted-mallet and light-percussion score supports the comic story. Storm sections darken, the march follows the 150bpm planted-step grid, and the boat callback has a small major-key variation. Music is calibrated beneath speech, uses the +3dB music setting, and ducks 3dB under narration. The whole mix receives final loudness and true-peak calibration.

Narration and music jobs run independently on GitHub. A final job downloads both stems and the existing video artifact, mixes the sound, copies the original H.264 stream into an AAC-stereo MP4, and checks video-stream identity, dimensions, frame count, duration, word coverage and final audio levels.

Download `xerxes-ocean-final-with-narration-and-music` for the final MP4. `xerxes-ocean-audio-preview` provides compact MP3 previews, word timings, licensing notes and QA results. Full audio stems are retained separately for remixing. No external voice account, API key or video re-render is required.
