# The Wooden Bomb - soundtrack cue sheet

All sound is original: synthesized in numpy/scipy by `sfx_gen.py` / `instruments.py`, placed by `sfx.py` / `music.py`, mixed by `mix.py`.
Voice = `voice/voice.wav`, gain only (no EQ, no compression, no pitch).

## Files
| file | content |
|---|---|
| `mix.wav` | final mix, 48 kHz, stereo, 24-bit, 3,264,000 samples = 68.000 s |
| `stem_voice.wav` / `stem_music.wav` / `stem_sfx.wav` | stems at mix gain (they sum to the mix before the master limiter) |

## Master loudness (own BS.1770-4 meter)
- Integrated **-15.0 LUFS**, true peak **nan dBTP**, LRA 2.0 LU, max momentary nan LUFS, max short-term nan LUFS
- Stems: voice -14.9 LUFS, music -25.3 LUFS, sfx -31.5 LUFS (voice gain +3.84 dB, same gain on every stem)
- Master limiter (4x oversampled look-ahead, ceiling -1.2 dBTP): max gain reduction nan dB, active (>0.1 dB) on 4.54 % of samples, >0.5 dB on 1.06 %

ffmpeg ebur128 cross-check:
```
ffmpeg check failed: [WinError 2] The system cannot find the file specified
```

## Voice on top: per-section loudness (LUFS, integrated per stem, at mix gain)
bed = music + sfx. margin = voice - bed (integrated over the section). speech median / p10 = median and 10th percentile of the 400 ms momentary margin (voice - bed) over windows centred on spoken words.

| section (shots) | time s | voice | music | sfx | bed | margin LU | speech median LU | speech p10 LU |
|---|---|---|---|---|---|---|---|---|
| hook (1) | 0.00-4.23 | -14.7 | -24.3 | -43.6 | -24.2 | 9.5 | 10.0 | 6.6 |
| wreck (2) | 4.23-10.90 | -14.7 | -24.7 | -42.6 | -24.7 | 10.0 | 10.1 | 6.8 |
| planks (3) | 10.90-15.17 | -15.3 | -25.3 | -40.0 | -25.2 | 9.9 | 8.7 | 5.7 |
| build (4) | 15.17-20.20 | -15.6 | -25.4 | -32.7 | -25.0 | 9.3 | 9.0 | 6.0 |
| toy (5) | 20.20-24.57 | -14.6 | -25.1 | -27.4 | -23.2 | 8.6 | 8.8 | 6.2 |
| gawk (6) | 24.57-29.67 | -14.8 | -24.0 | -31.2 | -24.0 | 9.1 | 10.2 | 4.0 |
| party (7) | 29.67-35.10 | -14.7 | -26.2 | -29.3 | -25.7 | 11.0 | 10.9 | 6.6 |
| cross (8) | 35.10-38.20 | -14.3 | -56.9 | -29.0 | -29.0 | 14.7 | 16.9 | 11.2 |
| circle (9) | 38.20-41.33 | -15.6 | -33.1 | -31.5 | -30.9 | 15.3 | 15.6 | 10.4 |
| clonk (10) | 41.33-47.33 | -15.1 | -27.3 | -29.0 | -25.6 | 10.5 | 12.5 | 6.5 |
| pilot (11) | 47.33-50.83 | -14.8 | -25.6 | -38.1 | -25.3 | 10.5 | 10.2 | 5.2 |
| coat (12) | 50.83-55.20 | -15.5 | -27.1 | -38.2 | -26.8 | 11.2 | 11.1 | 6.3 |
| decoys (13) | 55.20-61.00 | -14.8 | -25.3 | -31.3 | -24.3 | 9.5 | 9.4 | 6.4 |
| tail (14) | 61.00-68.00 | -14.2 | -24.2 | -41.0 | -24.1 | 9.9 | 10.7 | 6.6 |

## Music map (original march, Bb major, 120 bpm: quarter note = footfall)
Music target per section, LU under the voice (after a -3 dB speech duck keyed from words.json): hook -9.5, setting -10.0, build -10.0, shells -10.0, toy -10.5, mystery -10.0, nobombs -10.5, hold -14.0, reveal -12.0, explain -11.0, decoywar -10.5, punch -9.5, tail -11.0. Applied section gains (dB): hook -10.5, setting -6.2, build -4.6, shells -7.5, toy -9.3, mystery -2.2, nobombs -9.0, reveal -6.3, explain -6.4, decoywar -6.9, punch -2.0, tail -inf, hold -12.0.

Rides (music only, dB): 3.90-4.28 s -2.5, 34.00-35.03 s -2.5 - so quiet sentence-final words stay on top and the band blooms in the gaps after them. The hook's last two footfalls (3.5, 4.0) are also 3 dB lower in the SFX for '...walking across it.'

| time s | frame | music |
|---|---|---|
| 0.00 | 0 | hook: theme A1-A2 tutti, 7 whistlers, tuba/after-beats/snare; snare fill under the last words |
| 4.23 | 127 | Bb button + light clash exactly on the white flash, then silence for the bad news |
| 4.60 | 138 | setting: dark Cm pad, lone fife A3-A4, two low timpani on 'flattening' |
| 10.90 | 327 | build: one bar of tune Bb on glock, tuba + light snare; the crew hammers are the backbeat |
| 15.10 | 453 | shells: theme A7-A8 full band, bounce octaves through the planes paint |
| 20.30 | 609 | toy gag: music-box A1-A2 solo + bouncing tuba, triangle on its stops |
| 24.58 | 737 | mystery watchfulness, glock/dull band only under the photo pass |
| 27.55 | 826 | no-bomb tension: F7 pedal, drive snare, climb F7-Gm-G#o7 with the tally months |
| 35.05 | 1052 | DEAD STOP on 'Then,' - silence through the dawn, the one circle and the whole fall |
| 40.15 | 1204 | one low pad swells under the fall (starts 40.3, ends frozen at the clonk) |
| 42.72 | 1282 | reveal: pluck Bb (the clonk rings wood), triangle, F timpani on the 'Unluckily' word |
| 47.00 | 1410 | explain: music-box waltz 3/4, one bar per 1.55 s breath, warm pad underneath |
| 55.30 | 1659 | decoy war: theme A1-A3 soft golden march; the distant thuds are SFX timpani |
| 61.60 | 1848 | punch: snare roll, Bb stab on 'destroy', low F on 'ever', big button chord ON 'compliment.' |

## SFX events
Level convention: every EVENT has a naive level (LU vs the voice stem, as the event's max momentary loudness); applied = naive - 6 dB (standard mix rule) + distance/intensity offsets. BEDS are integrated loudness, not reduced. 'mix LUFS' = the event's max momentary loudness in the final mix (voice stem = -14.9 LUFS integrated). Column sounds also get the camera-distance low-pass and more valley reverb.

| # | time s | frame | cue | what | naive LU | applied LU | mix LUFS | pan |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | 0.0 | amb_field (bed, integrated) | daytime polder air: breeze, sparrows, distant farm life (shots 1-7) | -30 | -30.0 | -44.9 | +0.00 |
| 2 | 4.233 | 127.0 | flash_whoosh | reverse swell into the white flash (frame 127) + soft low whoomp | -5 | -11.0 | -25.9 | +0.00 |
| 3 | 12.900 | 387.0 | paint_bucket | the paint bucket lands by the plank line | -14 | -20.0 | -34.9 | +0.25 |
| 4 | 13.120 | 393.6 | paint_swipe | the painter strokes the grey along the boards | -13 | -19.0 | -38.2 | +0.30 |
| 5 | 13.660 | 409.8 | paint_swipe | the painter strokes the grey along the boards | -13 | -19.0 | -38.2 | +0.30 |
| 6 | 15.400 | 462.0 | shell_creak | hangar frame timber creak as the shell rises | -12 | -18.0 | -34.2 | -0.35 |
| 7 | 15.550 | 466.5 | prop_thock | watchtower drops: timber thock + small rattle | -12 | -18.0 | -33.1 | +0.35 |
| 8 | 16.200 | 486.0 | saw | a saw strokes through a plank | -14 | -20.0 | -39.4 | +0.50 |
| 9 | 16.400 | 492.0 | prop_thock | truck 1 rolls in: timber thock + small rattle | -12 | -18.0 | -33.1 | -0.58 |
| 10 | 16.600 | 498.0 | shell_creak | hangar frame timber creak as the shell rises | -12 | -18.0 | -34.2 | -0.35 |
| 11 | 17.000 | 510.0 | prop_thock | truck 2 follows: timber thock + small rattle | -12 | -18.0 | -33.1 | +0.27 |
| 12 | 17.100 | 513.0 | saw | a saw strokes through a plank | -14 | -20.0 | -39.4 | +0.50 |
| 13 | 17.320 | 519.6 | prop_thock | gun pit drops: timber thock + small rattle | -12 | -18.0 | -33.1 | -0.54 |
| 14 | 17.900 | 537.0 | shell_creak | hangar frame timber creak as the shell rises | -12 | -18.0 | -34.2 | -0.35 |
| 15 | 18.000 | 540.0 | saw | a saw strokes through a plank | -14 | -20.0 | -39.4 | +0.50 |
| 16 | 18.280 | 548.4 | engine_chug | the wooden fighter's engine huff | -16 | -22.0 | -37.0 | +0.60 |
| 17 | 18.440 | 553.2 | engine_chug | the wooden fighter's engine huff | -16 | -22.0 | -37.0 | +0.60 |
| 18 | 18.600 | 558.0 | engine_chug | the wooden fighter's engine huff | -16 | -22.0 | -37.0 | +0.60 |
| 19 | 18.760 | 562.8 | engine_chug | the wooden fighter's engine huff | -16 | -22.0 | -37.0 | +0.60 |
| 20 | 18.900 | 567.0 | saw | a saw strokes through a plank | -14 | -20.0 | -39.4 | +0.50 |
| 21 | 18.920 | 567.6 | engine_chug | the wooden fighter's engine huff | -16 | -22.0 | -37.0 | +0.60 |
| 22 | 19.080 | 572.4 | engine_chug | the wooden fighter's engine huff | -16 | -22.0 | -37.0 | +0.60 |
| 23 | 19.240 | 577.2 | engine_chug | the wooden fighter's engine huff | -16 | -22.0 | -37.0 | +0.60 |
| 24 | 20.200 | 606.0 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -23.2 | -38.8 | +0.45 |
| 25 | 20.300 | 609.0 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 26 | 20.345 | 610.3 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.6 | +0.45 |
| 27 | 20.490 | 614.7 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.6 | +0.45 |
| 28 | 20.530 | 615.9 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 29 | 20.635 | 619.0 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 30 | 20.760 | 622.8 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 31 | 20.780 | 623.4 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 32 | 20.925 | 627.8 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.6 | +0.45 |
| 33 | 20.990 | 629.7 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 34 | 21.050 | 631.5 | cap_wave | an engineer waves his cap: cloth swish | -15 | -21.0 | -35.9 | +0.30 |
| 35 | 21.070 | 632.1 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 36 | 21.215 | 636.5 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.4 | +0.45 |
| 37 | 21.220 | 636.6 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 38 | 21.360 | 640.8 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 39 | 21.450 | 643.5 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 40 | 21.505 | 645.1 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.4 | +0.45 |
| 41 | 21.650 | 649.5 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.4 | +0.45 |
| 42 | 21.680 | 650.4 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 43 | 21.795 | 653.8 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -19.0 | -34.6 | +0.45 |
| 44 | 21.910 | 657.3 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 45 | 22.140 | 664.2 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 46 | 22.150 | 664.5 | cap_wave | an engineer waves his cap: cloth swish | -15 | -21.0 | -35.9 | +0.30 |
| 47 | 22.370 | 671.1 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 48 | 22.375 | 671.2 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -24.0 | -39.5 | +0.45 |
| 49 | 22.520 | 675.6 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 50 | 22.600 | 678.0 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 51 | 22.665 | 679.9 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.6 | +0.45 |
| 52 | 22.810 | 684.3 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.4 | +0.45 |
| 53 | 22.830 | 684.9 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 54 | 22.955 | 688.6 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 55 | 23.060 | 691.8 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 56 | 23.100 | 693.0 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 57 | 23.245 | 697.3 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.5 | +0.45 |
| 58 | 23.290 | 698.7 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 59 | 23.390 | 701.7 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.6 | +0.45 |
| 60 | 23.520 | 705.6 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 61 | 23.535 | 706.0 | rail_squeak | hidden-rail squeak under the wooden fighter | -13 | -16.0 | -31.6 | +0.45 |
| 62 | 23.750 | 712.5 | wheel_tok | wheel_tok over the wooden ties | -17 | -23.0 | -38.0 | +0.55 |
| 63 | 25.100 | 753.0 | photo_pass | the recon plane crosses high: doppler whoosh + faint engine tone | -8 | -14.0 | -28.9 | +0.00 |
| 64 | 25.900 | 777.0 | shutter | camera shutter click 1/2 (the eyes that get two seconds) | -11 | -17.0 | -31.9 | +0.20 |
| 65 | 26.750 | 802.5 | shutter | camera shutter click 2/2 (the eyes that get two seconds) | -11 | -17.0 | -31.9 | +0.20 |
| 66 | 26.810 | 804.3 | motor | film motor wind after the second frame | -19 | -25.0 | -40.8 | +0.20 |
| 67 | 30.470 | 914.1 | mug_clink | mug clink 1/7 raising (comic timing) | -12 | -18.0 | -33.1 | -0.56 |
| 68 | 30.580 | 917.4 | mug_clink | mug clink 2/7 raising (comic timing) | -12 | -18.0 | -33.1 | -0.16 |
| 69 | 30.690 | 920.7 | mug_clink | mug clink 3/7 raising (comic timing) | -12 | -18.0 | -33.1 | +0.24 |
| 70 | 30.800 | 924.0 | mug_clink | mug clink 4/7 raising (comic timing) | -12 | -18.0 | -33.1 | +0.64 |
| 71 | 30.910 | 927.3 | mug_clink | mug clink 5/7 raising (comic timing) | -12 | -18.0 | -33.1 | -0.56 |
| 72 | 31.020 | 930.6 | mug_clink | mug clink 6/7 raising (comic timing) | -12 | -18.0 | -33.1 | -0.16 |
| 73 | 31.130 | 933.9 | mug_clink | mug clink 7/7 raising (comic timing) | -12 | -18.0 | -33.1 | +0.24 |
| 74 | 34.600 | 1038.0 | amb_dawn (bed, integrated) | dawn air: colder breeze, first blackbirds, faint crickets die out (shots 8-12) | -29 | -29.0 | -43.9 | +0.00 |
| 75 | 34.900 | 1047.0 | engine | lone RAF plane: steady prop drone, nearing then circling overhead | -13 | -19.0 | -33.9 | -0.15 |
| 76 | 35.620 | 1068.6 | hammer | the final plank tap 1/3 (dawn, close, the last board) | -6 | -12.0 | -27.0 | -0.15 |
| 77 | 36.060 | 1081.8 | hammer | the final plank tap 2/3 (dawn, close, the last board) | -6 | -12.0 | -27.0 | -0.15 |
| 78 | 36.500 | 1095.0 | hammer | the final plank tap 3/3 (dawn, close, the last board) | -6 | -12.0 | -27.0 | -0.15 |
| 79 | 37.300 | 1119.0 | whoosh_cam | camera ride alongside the crossing plane | -12 | -18.0 | -32.9 | +0.00 |
| 80 | 39.933 | 1198.0 | whoosh_cam | camera follow the lap | -12 | -18.0 | -32.9 | +0.00 |
| 81 | 40.350 | 1210.5 | fall_whistle | cartoon bomb whistle: enters on the release, dies the frame before the clonk | -9 | -15.0 | -29.9 | +0.05 |
| 82 | 40.900 | 1227.0 | fall_air | air rush building under the wooden bomb | -14 | -20.0 | -35.8 | +0.00 |
| 83 | 41.533 | 1246.0 | whoosh_cam | camera fall away to the ground | -12 | -18.0 | -32.9 | +0.00 |
| 84 | 42.640 | 1279.2 | THE_CLONK | the wooden bomb on the wooden runway: hollow clonk + rim of splinters | -2 | -8.0 | -22.9 | +0.10 |
| 85 | 42.690 | 1280.7 | splinters | splinter shards scatter, clatter and stop | -10 | -16.0 | -31.0 | +0.20 |
| 86 | 42.720 | 1281.6 | trench_pop | the trench crew bursts up: boards and boots | -12 | -18.0 | -33.5 | -0.25 |
| 87 | 43.200 | 1296.0 | boot_step | the officer's boot (greatcoat), approaching the bomb | -13 | -19.0 | -34.0 | -0.35 |
| 88 | 43.200 | 1296.0 | clonk2 | second bounce, smaller: a wooden thud + two ticks | -9 | -15.0 | -30.1 | -0.10 |
| 89 | 43.530 | 1305.9 | boot_step | the officer's boot (greatcoat), approaching the bomb | -13 | -19.0 | -34.0 | -0.24 |
| 90 | 43.750 | 1312.5 | birddrop | a relieved blackbird phrase | -18 | -24.0 | -296.8 | -0.40 |
| 91 | 43.860 | 1315.8 | boot_step | the officer's boot (greatcoat), approaching the bomb | -13 | -19.0 | -34.0 | -0.13 |
| 92 | 44.190 | 1325.7 | boot_step | the officer's boot (greatcoat), approaching the bomb | -13 | -19.0 | -34.0 | -0.02 |
| 93 | 44.400 | 1332.0 | birddrop | a relieved blackbird phrase | -18 | -24.0 | -296.8 | -0.40 |
| 94 | 44.520 | 1335.6 | boot_step | the officer's boot (greatcoat), approaching the bomb | -13 | -19.0 | -34.0 | +0.09 |
| 95 | 44.850 | 1345.5 | boot_step | the officer's boot (greatcoat), approaching the bomb | -13 | -19.0 | -34.0 | +0.20 |
| 96 | 45.300 | 1359.0 | dust_off | two little dust-off brushes on the stencil band | -16 | -22.0 | -41.7 | +0.15 |
| 97 | 47.100 | 1413.0 | cockpit_air | engine close-up under the card: warm hum + two instrument ticks | -17 | -23.0 | -37.9 | +0.20 |
| 98 | 54.900 | 1647.0 | amb_night (bed, integrated) | night air over the British decoys: crickets, low breeze (shot 13) | -27 | -27.0 | -41.9 | +0.00 |
| 99 | 55.400 | 1662.0 | bomber_drone | the German bomber far overhead: deep, slow, wide | -18 | -24.0 | -38.9 | -0.40 |
| 100 | 56.300 | 1689.0 | thud | bomb lands on the empty plywood field 1/4: distant wooden thump | -6 | -12.0 | -27.0 | -0.25 |
| 101 | 56.650 | 1699.5 | fire_flicker | the decoy lamp flare answers the thud (small crackle) | -20 | -26.0 | -42.7 | +0.50 |
| 102 | 58.050 | 1741.5 | thud | bomb lands on the empty plywood field 2/4: distant wooden thump | -6 | -12.0 | -27.0 | +0.25 |
| 103 | 58.400 | 1752.0 | fire_flicker | the decoy lamp flare answers the thud (small crackle) | -20 | -26.0 | -42.5 | +0.50 |
| 104 | 59.850 | 1795.5 | thud | bomb lands on the empty plywood field 3/4: distant wooden thump | -6 | -12.0 | -27.0 | -0.25 |
| 105 | 60.200 | 1806.0 | fire_flicker | the decoy lamp flare answers the thud (small crackle) | -20 | -26.0 | -42.6 | +0.50 |
| 106 | 60.550 | 1816.5 | thud | bomb lands on the empty plywood field 4/4: distant wooden thump | -6 | -12.0 | -27.0 | +0.25 |
| 107 | 60.900 | 1827.0 | fire_flicker | the decoy lamp flare answers the thud (small crackle) | -20 | -26.0 | -42.4 | +0.50 |
| 108 | 63.300 | 1899.0 | amb_dawn2 (bed, integrated) | the morning after: birds back, breeze (shots 14, tail) | -27 | -27.0 | -41.8 | +0.00 |
| 109 | 65.510 | 1965.3 | bomb_tick | the bomb settles one tiny tick as 'the compliment.' lands | -16 | -22.0 | -37.1 | +0.10 |
