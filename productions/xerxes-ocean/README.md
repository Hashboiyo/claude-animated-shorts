# Xerxes Ocean — parallel GitHub render

Original Persian cartoon short with the revision-four lighting, cast, harbor, pavilion, physical props, acting and environment animation.

Composition: `XerxesOcean`; 2,055 frames at 30 fps, 68.5 seconds. Export: native 1440×2560 H.264, CRF16. Native WebGL DPR and export scale are both 4/3.

The workflow first checks types, composition metadata and an actual initial-frame capture. It renders eight disjoint frame ranges on separate GitHub runners, one browser worker per runner. Completed chunks are retained separately, so a failed job can be retried without recomputing successful chunks. The assembly job checks frame coverage, source commit and SHA-256 checksums, then concatenates the chunks without re-encoding. It validates final dimensions/frame count/duration, decodes every frame for QA and uploads the MP4, a contact sheet and JSON reports.

The file `xerxes-ocean-visual-master-1440x2560.mp4` is a **silent visual master**. An original narration recording and checked word timings have not been supplied. No placeholder voice is represented as a finished narration. Audio sync and a finished sound mix remain pending.

The workflow runs for this production's pull request and can also be started manually once available to GitHub Actions. Standard Ubuntu runners perform all rendering. This production uses only original procedural assets and reused MIT-licensed template code; no private reference imagery is included in this production or uploaded render artifacts.

Final artifacts are kept for 14 days. Chunk artifacts are kept for 7 days. Download the final MP4 from the workflow's assembly-job summary. The source project is preserved on the dedicated branch; the repository's default branch is not modified.
