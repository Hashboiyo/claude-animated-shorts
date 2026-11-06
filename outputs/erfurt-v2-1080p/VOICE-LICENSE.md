# Erfurt original narration

Generated with native Piper1.8.0 and `en_US-ryan-high`, following the documented Great Emu War workflow in the user's repository:
https://github.com/Hashboiyo/claude-animated-shorts/blob/outputs/great-emu-war-1932-20261103-package/outputs/great-emu-war-1932/README.md

Model download:
https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ryan-high.tar.bz2

The included model card identifies RyanSpeech (https://www.kaggle.com/datasets/roholazandie/ryanspeech), CC BY-NC-SA4.0. This is synthetic narration of the original approved Erfurt script, not a historical recording, cloned user voice, or reused emu audio.

## Revision 2 production

Fresh Piper synthesis at length_scale0.85 using the same en_US-ryan-high model. The approved script is unchanged; pronunciation expands1184 to eleven eighty-four and Henry VI to Henry the Sixth. Model silence is trimmed conservatively with35ms leading and55ms trailing margins, then segments are spaced180ms apart. Native22050Hz output is resampled to48000Hz. No pitch shifting or voice cloning.

The full mixed deliverable is38.566667seconds,1157frames at30fps,48kHz stereo PCM24. voice.wav is the isolated mono narration; segment-01.wav through segment-06.wav preserve the individual48kHz takes. timeline.json has exact segment bounds; words.json has129 spoken token timings derived from Piper phoneme sample boundaries. These timings have not been independently checked with ASR or human listening.

Music and sound effects are original synthesized material generated with the source repository's MIT-licensed DSP/SFX tools, retained beside make_mix.py. See README.md and validation.log for measured mastering results.
