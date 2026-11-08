# Picture timeline mirrored (read-only) from shorts-dev/src/videos/wooden-bomb/story.ts + cast.ts so every sound lands
# on the frame: shots, the build beat grids (hammer cycles per act), the rail plane, the RAF plane's crossing, release,
# clonk, the mug party, the shutter clicks, the night thuds. Fixed from words.json (narration) - do not move the anchors.
import json
import math

import numpy as np

FPS = 30
TOTAL = 2040
DUR = TOTAL / FPS            # 68.0 s exactly
fr = lambda f: f / FPS

FLASH = fr(127)              # 4.23 s white flash after the hook
RELEASE, CLONK, FALL_T = 40.30, 42.64, 2.34
BOUNCE2 = CLONK + 0.56       # second (smaller) bounce 43.20
REST = CLONK + 1.00          # bomb settles
SPLINTER_END = CLONK + 1.5
OFFICER_STOP = 45.05         # "Unluckily," - he reads the WOOD FOR WOOD stencil
END_WORD = 65.51             # "compliment."

SHOTS = {
    1: (0, 127, "day", "hook"), 2: (127, 327, "day", "wreck"), 3: (327, 455, "day", "planks"),
    4: (455, 606, "day", "shells"), 5: (606, 737, "day", "rails"), 6: (737, 890, "day", "gawk"),
    7: (890, 1053, "day", "party"), 8: (1053, 1146, "golden", "cross"), 9: (1146, 1240, "golden", "circle"),
    10: (1240, 1420, "golden", "clonk"), 11: (1420, 1525, "golden", "pilot"), 12: (1525, 1656, "golden", "coat"),
    13: (1656, 1830, "golden", "decoys"), 14: (1830, TOTAL, "day", "tail"),
}
XFADE = {8: 8, 11: 8, 12: 6, 13: 8, 14: 8}

# hammer grids (mirrors cast.ts hammerK): period + phase per crew
HAMMER_P = {3: 0.52, 4: 0.6, 8: 0.9}
FINAL_PLANK_STRIKES = [35.62, 36.06, 36.5]   # "the final plank goes down"
MUGS_UP = 30.45                              # "can hardly believe it"
THUDS = [56.3, 58.05, 59.85, 60.55]          # German bombs on the British decoys
SHUTTERS = [25.9, 26.75]                     # the photo plane takes two pictures
ENGINE_T0, ENGINE_T1 = 34.9, 43.4            # the lone RAF plane's drone
TAIL_T0 = 65.51                              # after "the compliment."


def shot_t(i):
    a, b = SHOTS[i][:2]
    return fr(a), fr(b)


def shot_at(t):
    f = t * FPS
    for i, (a, b, *_r) in SHOTS.items():
        if a <= f < b:
            return i
    return 14


def hh(i, s=0):
    """same hash as cast.ts"""
    v = math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return v - math.floor(v)


def easeout(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 4


def plank_edge(t):
    """runway tide edge (m from west), mirrors story.ts plankEdge"""
    u = min(1.0, max(0.0, (t - 12.14) / 2.37))
    return -34 + 78 * u


def rail_x(t):
    """mirrors story.ts railX: trundles out, waits, reverses, parks"""
    knots = [(20.2, 20.0), (21.9, 40.0), (22.4, 40.0), (23.65, 25.0)]
    if t < knots[0][0]:
        return 20.0
    if t > knots[-1][0]:
        return 25.0
    for (t1, b), (t0, a) in reversed(list(zip(knots[1:], knots[:-1]))):
        if t >= t0:
            u = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
            u = u * u * (3 - 2 * u)
            return a + (b - a) * u
    return 20.0


def rail_speed(t):
    d = 0.05
    return rail_x(t + d) - rail_x(t - d)


def hammer_hits(shot, t0=None, t1=None):
    """strike moments of the crew hammers of a shot (the cast.ts grid, strike at u = 1 of each cycle)"""
    out = []
    a, b = shot_t(shot) if t0 is None else (t0 * FPS, (t1 or t0) * FPS)
    p = HAMMER_P[shot]
    per = int((b - a) / FPS / p) + 1
    for i in range(per):
        t = a / FPS + (i + 0.62) * p   # u crosses 1 at i + 0.62 (cast: strike when u > 0.62 -> 1)
        if a / FPS <= t < b / FPS:
            out.append(t)
    return out


def distance_cams():
    """(t, distance m) pairs per shot from the camera keys: used for distance-aware gains/low-pass."""
    CAM = {
        3: [(fr(333), 9.0), (fr(393), 6.4)],
        4: [(fr(461), 22.0), (fr(511), 14.0), (fr(557), 11.0)],
        5: [(fr(612), 8.5), (fr(659), 8.0), (fr(697), 9.5)],
        6: [(fr(743), 30.0), (fr(789), 7.0)],
        7: [(fr(896), 12.0), (fr(949), 8.6), (fr(1005), 7.5)],
        8: [(fr(1059), 22.0), (fr(1146), 12.0)],
        10: [(fr(1246), 15.0), (fr(1292), 6.5), (fr(1330), 5.0)],
        13: [(fr(1662), 40.0), (fr(1715), 26.0), (fr(1765), 20.0)],
        14: [(fr(1836), 60.0), (fr(1897), 17.0), (fr(1957), 6.0)],
    }
    return CAM


def dist_fx(d):
    """distance -> (gain dB, low-pass Hz, reverb send) used for all field sounds"""
    d = max(d, 3.0)
    g = -14.0 * math.log10(d / 3.0)
    lpf = float(np.clip(17000 * (3.0 / d) ** 0.55, 1800, 17000))
    send = 0.06 + 0.45 * float(np.clip(math.log(d / 3.0) / math.log(25), 0, 1))
    return g, lpf, send


def cam_distance(t):
    CAM = distance_cams()
    s = shot_at(t)
    keys = CAM.get(s)
    if not keys:
        return 30.0
    f = t * FPS
    ld = math.log(max(keys[0][1], 3.0))
    for kf, d in keys[1:]:
        if f < kf:
            break
        ld = ld + (math.log(max(d, 3.0)) - ld) * easeout((f - kf) / max(6, kf - keys[0][0]))
    return math.exp(ld)


def words(path="wooden-bomb-short/voice/words.json"):
    return json.load(open(path, encoding="utf-8"))
