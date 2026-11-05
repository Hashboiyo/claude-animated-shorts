# Erfurt original narration

Generated with native Piper1.8.0 and `en_US-ryan-high`, following the documented Great Emu War workflow in the user's repository:
https://github.com/Hashboiyo/claude-animated-shorts/blob/outputs/great-emu-war-1932-20261103-package/outputs/great-emu-war-1932/README.md

Model download:
https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-ryan-high.tar.bz2

The included model card identifies RyanSpeech (https://www.kaggle.com/datasets/roholazandie/ryanspeech), CC BY-NC-SA4.0. This is synthetic narration of the original approved Erfurt script, not a historical recording, cloned user voice, or reused emu audio.

## Deliverable stems

- `voice.wav`:60.000 seconds,48kHz, mono,24-bit PCM. Six original narration segments begin at0.08,8.08,19.08,29.08,40.08,52.08s.
- `voice-continuous.wav`:46.324 seconds, same voice segments joined with0.18s paragraph gaps. Optional alternate if picture is tightened.
- `segment-XX-steady.wav`:native22,050Hz individual spoken segments, Piper length_scale1.2. Natural spoken length45.244s in total. No per-segment time stretch applied.
- `segment-XX-native.wav`:the initial comparison take at the emu setting length_scale1/1.18.37.094s of speech total; retained for provenance/alternate pacing.

The60s version has available pauses after the collapse and ladder narration for visual/SFX beats; these pauses should be covered by the final sound bed, or the picture can be tightened using the continuous alternate. Parent editor should review this pacing in the final sequence.

## Script and pronunciation

Source script is `../SCRIPT.md`. No narrative wording was added or removed. TTS input expands1184 to “eleven eighty-four,” Henry VI to “Henry the Sixth,” and uses commas for em-dash pauses. This avoids TTS reading the Roman numeral as letters.

## Timing

- `timeline.json`:actual segment starts/ends and continuous alternate starts/ends.
- `words.json`:129 spoken tokens with sample-derived timings, assigned to actual Piper phoneme groups.
- `phonemes.json`:full model-derived phoneme timing in60s timeline.
- `alignment-method.json`:method and limitations.

Piper's ONNX alignment output was enabled in memory. Four coarticulated function-word patterns (“for a,” “with the,” “in the,” “was a”) were split at their phoneme boundaries and flagged. These are synthesized-model alignment timings, not independently ASR-verified or manually listened word by word. The complete phoneme records are preserved for review.

## Checks

All six chunks generated successfully. Native audio was resampled from22,050Hz to48kHz with SciPy polyphase resampling. One uniform gain0.8736173216 was applied for headroom; no per-segment volume normalization or time stretching beyond the model's fixed length_scale.

FFmpeg meter on `voice.wav`: integrated-16.25LUFS, true peak-0.99dBTP, loudness range4.60LU. No full mix or picture mux was done by this narration task. Human listening review remains recommended before final delivery.

Reproduction: `generate-emu-rate.py`, `generate-steady.py`, `assemble.py`. Dependencies are isolated in `venv/`; the source repository was not modified.
