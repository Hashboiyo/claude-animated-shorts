# Narration timing

The supplied recording stays at normal speed. Cuts use phrase onsets aligned against the recording, rounded to the nearest 24 FPS frame. The last scene holds through the end of the file.

| Scene | Title | Start | End | Frames |
| --- | --- | ---: | ---: | ---: |
| 01 | An Airfield Made of Wood | 0.000s | 3.167s | 76 |
| 02 | The Wooden Bomb | 3.167s | 5.417s | 54 |
| 03 | The Serious Plan | 5.417s | 8.750s | 80 |
| 04 | The Real Airfields | 8.750s | 13.458s | 113 |
| 05 | The Surveyors | 13.458s | 16.417s | 71 |
| 06 | Construction | 16.417s | 20.750s | 104 |
| 07 | Painted to Perfection | 20.750s | 24.000s | 78 |
| 08 | The Hidden Rail | 24.000s | 27.667s | 88 |
| 09 | It Was Carpentry | 27.667s | 31.083s | 82 |
| 10 | From the Air | 31.083s | 33.583s | 60 |
| 11 | Photo Reconnaissance | 33.583s | 37.167s | 86 |
| 12 | Waiting | 37.167s | 39.792s | 63 |
| 13 | The Photograph | 39.792s | 42.667s | 69 |
| 14 | The Final Plank | 42.667s | 44.917s | 54 |
| 15 | The RAF Returns | 44.917s | 49.042s | 99 |
| 16 | The Wooden Bomb Falls | 49.042s | 53.417s | 105 |
| 17 | That Was the Damage | 53.417s | 57.500s | 98 |
| 18 | Reading the Airfield | 57.500s | 62.625s | 123 |
| 19 | The Coat on the Hook | 62.625s | 66.917s | 103 |
| 20 | Britain Played the Same Trick | 66.917s | 72.375s | 131 |
| 21 | The RAF Returned the Compliment | 72.375s | 77.333s | 119 |

Source MP3 duration: 77.322449 seconds. Output: 1,856 frames / 24 FPS = 77.333333 seconds. The final frame boundary adds less than one frame of silence.

The recording includes “it seemed to work” in scene 11; the scene timing and narration metadata include that phrase.

To adjust a cut, edit the corresponding absolute frame in `src/timing.json`. Frame values are zero-based; the end of each scene is the start of the next.
