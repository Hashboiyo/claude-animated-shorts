# Erfurt v2 rendering output branch

Original revised animated short, native 1080×1920 at 30fps, 1157 frames (38.5667 seconds). Fresh Piper en_US-ryan-high narration at length_scale 0.85, original music and synthesized sound effects. See render-source/erfurt-v2/VOICE-LICENSE.md for voice provenance and licensing.

The workflow renders twelve independent 100-frame chunks (last chunk 57 frames), assembles them without re-encoding the picture, muxes the final soundtrack, checks decode/frame count/dimensions/audio/duration, and uploads the final ZIP artifact. It also preserves the final MP4 and verification files under outputs/erfurt-v2-1080p on this output branch. No default branch files are changed.

Only workflow-file changes trigger the push workflow. The final-output commit does not trigger another render. Read-only permissions apply to rendering; only the assembly job receives contents:write to preserve the approved video.

The final QA log contains black/freeze detector and loudness results for review; automated detection does not replace visual review.
