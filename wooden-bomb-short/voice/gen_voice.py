# Generate the "Wooden Bomb" narration: voice.wav (48 kHz mono pcm) + words.json
# Voice: en-GB-RyanNeural, steady deadpan tone, house pace ~3.55-3.85 words/s.
# Deterministic: same Text/voice/rate -> same audio + same word boundaries.
import json
import os
import sys

import edge_tts

VOICE = "en-GB-RyanNeural"
RATE = "+42%"  # steady, brisk; house style ~3.7 w/s
PITCH = "-2Hz"  # a touch of gravel for the deadpan

# The approved script v1 (16 lines). Commas = micro-breaths, em-dashes = beat pauses.
LINES = [
    "The Germans built a wooden airfield to fool Britain. Britain bombed it with a wooden bomb.",
    "It's occupied Holland, 1943. British bombers keep flattening the real airfields, so the Germans decide to build a decoy.",
    "So the carpenters start small: one wooden runway, painted the exact grey of the real thing.",
    "Then the wooden hangars arrive, wooden fuel trucks, wooden gun pits, and wooden planes in perfect squadron paint.",
    "One fake fighter even trundles along a hidden rail whenever enemy planes come near, just to look busy.",
    "Month after month, British photo planes pass over and take pictures.",
    "And month after month, not a single bomb falls.",
    "The Germans can hardly believe it. The camouflage, clearly, is working.",
    "Then, the morning after the final plank goes down, a lone RAF plane crosses the Channel, circles the field exactly once, and drops a bomb.",
    "A large, very wooden bomb.",
    "Luckily, it does no damage. Unluckily, that was the damage.",
    "You see, a bombing crew gets about two seconds to read an airfield from way up high.",
    "Ever jumped at a coat on a hook in the dark? A shape and a shadow - the eyes invent the rest.",
    "And this wasn't just one prank. Britain built hundreds of fake airfields too, and for years German crews bombed empty plywood.",
    "The Germans wanted an airfield no one could ever destroy.",
    "The RAF returned the compliment.",
]

TEXT = "  ".join(LINES)


async def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    mp3_path = os.path.join(here, "voice.mp3")
    words_path = os.path.join(here, "words.json")
    wav_path = os.path.join(here, "voice.wav")

    words = []
    last_end = 0.0
    comm = edge_tts.Communicate(TEXT, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    with open(mp3_path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                t0 = chunk["offset"] / 1e7
                dur = chunk["duration"] / 1e7
                words.append({
                    "w": chunk["text"],
                    "t0": round(t0, 3),
                    "t1": round(t0 + dur, 3),
                })
                last_end = t0 + dur

    with open(words_path, "w", encoding="utf-8") as f:
        json.dump({"voice": VOICE, "rate": RATE, "last_end": round(last_end, 3), "words": words},
                  f, indent=1, ensure_ascii=False)

    print(f"words={len(words)} last_end={last_end:.3f}s -> {mp3_path}")
    if os.name != "nt":
        code = os.system(f'ffmpeg -y -v error -i "{mp3_path}" -ar 48000 -ac 1 -sample_fmt s16 "{wav_path}"')
        if code:
            sys.exit("ffmpeg wav conversion failed")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
