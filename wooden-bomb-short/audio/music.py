# Original light comedic military march for "The Wooden Bomb" (Bb major, 120 bpm: one quarter note = 0.5 s, the
# grid every hammers/rails/thud cue lands on). Sections follow the picture: hook tutti + whistlers | darker setting
# pad over the wrecked real field | build march (the hammers are the percussion) | bounce through the shells beat |
# toy music-box gag on the rail plane | mystery braid under the photo pass | tension pedal for the no-bomb months,
# DEAD STOP on "Then," | silence through the dawn, the release and the fall (the pad swells under the bomb only) |
# deadpan pluck stabs between "Luckily"/"Unluckily" | warm waltz sway for the explanation | soft golden march under
# the decoy war | cadence stabs on "destroy", button on "compliment", ring out and birds.
import numpy as np
from dsp import SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, integrated, lp, hp
import instruments as I
import timeline as T

N = ns(T.DUR)
Q = 0.5  # quarter note (s)

# theme A: (bar, beat, length in quarters, midi)  - whistle / fife register
THEME = [
    (1, 0, 1, 82), (1, 1, .75, 82), (1, 1.75, .25, 84), (1, 2, 1, 86), (1, 3, 1, 82),
    (2, 0, 1, 77), (2, 1, .5, 79), (2, 1.5, .5, 81), (2, 2, 1, 82), (2, 3.5, .5, 77),
    (3, 0, .75, 79), (3, .75, .25, 81), (3, 1, .5, 82), (3, 1.5, .5, 79), (3, 2, 1, 87), (3, 3, .5, 86), (3, 3.5, .5, 84),
    (4, 0, 2, 84), (4, 3.5, .5, 77),
    (5, 0, 1, 82), (5, 1, .75, 82), (5, 1.75, .25, 84), (5, 2, 1, 86), (5, 3, 1, 89),
    (6, 0, .5, 87), (6, .5, .5, 86), (6, 1, .5, 84), (6, 1.5, .5, 82), (6, 2, 1, 81), (6, 3, .5, 82), (6, 3.5, .5, 84),
    (7, 0, .75, 86), (7, .75, .25, 84), (7, 1, .5, 82), (7, 1.5, .5, 81), (7, 2, 1, 79), (7, 3, 1, 84),
    (8, 0, 1, 82), (8, 1, .5, 77), (8, 1.5, .5, 74), (8, 2, 1, 70),
]
PICKUP3 = [(0, 2.5, .5, 74), (0, 3, .5, 75), (0, 3.5, .5, 77)]
CHB = {1: ["Bb"] * 4, 2: ["F", "F", "Bb", "Bb"], 3: ["Cm", "Cm", "Eb", "Eb"], 4: ["F7"] * 4, 5: ["Bb"] * 4,
       6: ["Eb", "Eb", "F", "F"], 7: ["Gm", "Gm", "Cm", "F7"], 8: ["Bb"] * 4}
CH = {
    "Bb": dict(oom=(34, 41), pah=[53, 58, 62], hi=[58, 62, 65]),
    "F": dict(oom=(41, 36), pah=[53, 57, 60], hi=[57, 60, 65]),
    "F7": dict(oom=(41, 36), pah=[51, 57, 60], hi=[57, 60, 63]),
    "Cm": dict(oom=(36, 43), pah=[55, 60, 63], hi=[60, 63, 67]),
    "Eb": dict(oom=(39, 46), pah=[55, 58, 63], hi=[58, 63, 67]),
    "Gm": dict(oom=(43, 38), pah=[55, 58, 62], hi=[58, 62, 67]),
    "F#o7": dict(oom=(42, 42), pah=[54, 57, 60, 63], hi=[57, 60, 63]),
    "G#o7": dict(oom=(44, 44), pah=[56, 59, 62, 65], hi=[59, 62, 65]),
}
F = I.m2f

SECTIONS = [
    ("hook", 0.0, T.FLASH),
    ("setting", T.FLASH, 10.91),
    ("build", 10.91, 15.12),
    ("shells", 15.12, 20.2),
    ("toy", 20.2, 24.58),
    ("mystery", 24.58, 27.55),
    ("nobombs", 27.55, 35.05),
    ("hold", 35.05, 42.64),       # silence, the pad swells under the falling bomb from 40.3
    ("reveal", 42.64, 47.0),
    ("explain", 47.0, 55.2),
    ("decoywar", 55.2, 61.48),
    ("punch", 61.48, 65.5),
    ("tail", 65.5, T.DUR),
]


def swingb(b):
    fl = np.floor(b)
    fr_ = b - fl
    return fl + (2 / 3 if fr_ in (0.5, 0.75) else (1 / 3 if fr_ == 0.25 else fr_))


def theme(t_bar1, bars=range(1, 9), transpose=0, pickup=False, swing=False, late=0.0):
    ev = []
    for (b, beat, d, m) in THEME + (PICKUP3 if pickup else []):
        if b == 0 and not pickup:
            continue
        if b != 0 and b not in bars:
            continue
        bb = swingb(beat) if swing else beat
        ev.append((t_bar1 + (b - 1) * 4 * Q + bb * Q + late, d * Q, m + transpose))
    return sorted(ev)


class Band:
    def __init__(self):
        self.tr = {}
        self.send = {}
        self.cues = []

    def track(self, name, send):
        if name not in self.tr:
            self.tr[name] = np.zeros((2, N))
            self.send[name] = send
        return self.tr[name]

    def add(self, name, x, t, p=0.0, g=1.0, send=0.15):
        buf = self.track(name, send)
        place(buf, pan(x, p) if np.ndim(x) == 1 else x, t, g)


R = rng(1943)


def _r():
    return rng(int(R.integers(1 << 30)))


def oompah(b, t_bar, chords, vel=0.6, every=True, pah_vel=0.4, bounce=False, pah=True):
    """tuba on the beats (root/fifth alternating) + after-beat horns on the &s; bounce = octave eighths"""
    for beat in range(4):
        c = CH[chords[beat]]
        t = t_bar + beat * Q
        if bounce:
            lo = c["oom"][0] if c["oom"][0] >= 36 else c["oom"][0] + 12
            b.add("tuba", I.brass(F(lo), 0.2, vel, _r(), "tuba", scoop=-30), t, -0.1)
            b.add("tuba", I.brass(F(lo + 12), 0.16, vel * 0.85, _r(), "tuba", scoop=-45), t + Q / 2, -0.1)
        elif every or beat in (0, 2):
            m = c["oom"][beat % 2] if every else c["oom"][0 if beat == 0 else 1]
            b.add("tuba", I.brass(F(m), 0.3, vel * (1.0 if beat in (0, 2) else 0.88), _r(), "tuba"), t, -0.1)
        if pah:
            if every:
                for k, m in enumerate(c["pah"]):
                    b.add("pah", I.brass(F(m), 0.15, pah_vel, _r(), "horn", scoop=-12), t + Q / 2 + 0.004 * k, 0.32 - 0.12 * k)
            elif beat in (1, 3):
                for k, m in enumerate(c["pah"]):
                    b.add("pah", I.brass(F(m), 0.17, pah_vel, _r(), "horn", scoop=-12), t + 0.004 * k, 0.32 - 0.12 * k)


SN = {
    "light": [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 1],
    "march": [3, 0, 1, 1, 2, 0, 1, 0, 3, 0, 1, 1, 2, 0, 1, 0],
    "drive": [2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1],
}


def snare_bar(b, t_bar, pat, vel, steps=range(16), cres=0.0):
    for s in steps:
        v = SN[pat][s]
        if not v:
            continue
        t = t_bar + s * Q / 4
        vv = vel * (1 + cres * s / 16) * {1: 0.5, 2: 0.9, 3: 0.95}[v] * R.uniform(0.93, 1.05)
        if v == 3:
            b.add("snare", I.snare(vv * 0.4, _r()), t - 0.026, 0.05)
        b.add("snare", I.snare(vv, _r()), t + R.normal(0, 0.002), 0.05)


def roll(b, t0, t1, v0, v1, accent=None, at=None):
    for t, v in I.snare_roll(t0, t1, v0, v1, _r()):
        b.add("snare", I.snare(v, _r(), dur=0.14, buzz=True), t, 0.05)
    if accent:
        at = t1 if at is None else at
        b.add("snare", I.snare(accent * 0.4, _r()), at - 0.026, 0.05)
        b.add("snare", I.snare(accent, _r()), at, 0.05)


def melody(b, name, notes, vel, transpose=0, fn="glock", p=0.0, gate=0.9):
    for (t, d, m) in notes:
        m = m + transpose
        if fn == "glock":
            x = I.glock(F(m), vel * R.uniform(0.92, 1.05), _r())
        elif fn == "fife":
            x = I.fife(F(m), d * gate, vel * R.uniform(0.94, 1.04), _r())
        elif fn == "vibes":
            x = I.vibes(F(m), vel * R.uniform(0.92, 1.05), _r(), dur=max(1.2, d + 0.8), damp=d + 0.35)
        elif fn == "musicbox":
            x = I.musicbox(F(m), vel * R.uniform(0.92, 1.05), _r())
        b.add(name, x, t, p)


def chorus(b, name, notes, voices, seed, joins=None, falters=None, spread=0.75, vel=1.0, solo_gain=1.0):
    """several men whistling the same tune: own detune, timing, vibrato, breath and place in the field"""
    rr = rng(seed)
    for v in range(voices):
        rv = rng(seed * 101 + v)
        nv = [(t, d, m, vel * rv.uniform(0.85, 1.0)) for (t, d, m) in notes if joins is None or t >= joins[v] - 1e-6]
        if not nv:
            continue
        fal = (falters[v], -rv.uniform(1.2, 3.2)) if falters else None
        t0, y = I.whistle(nv, rv, detune=rv.uniform(-11, 11) if v else 0.0, jit=0.010, lag=rv.uniform(0, 0.022) if v else 0.0,
                          vib_rate=rv.uniform(5.0, 6.6), vib_depth=rv.uniform(10, 22), breath=rv.uniform(0.04, 0.07), falter=fal)
        g = (solo_gain if v == 0 else rv.uniform(0.45, 0.8))
        p = 0.0 if v == 0 else spread * rr.uniform(-1, 1)
        if v:  # the rest are further away: a little duller
            y = lp(y, rv.uniform(5000, 9000), 1)
        b.add(name, y, t0, p, g)


def build():
    b = Band()
    for name, send in [("whistle", 0.0), ("fife", 0.16), ("glock", 0.22), ("tuba", 0.10), ("pah", 0.18), ("snare", 0.13),
                       ("cymbal", 0.16), ("stab", 0.16), ("timpani", 0.18), ("pad", 0.25), ("vibes", 0.26), ("musicbox", 0.26),
                       ("pluck", 0.18), ("brush", 0.12), ("triangle", 0.25)]:
        b.track(name, send)

    # ============ HOOK 0 - 4.23: tutti + whistling crew, drum fill under "...wooden bomb.", button ON the white flash
    h = theme(0.0, bars=[1, 2])
    chorus(b, "whistle", h, 7, 11)
    melody(b, "glock", h, 0.5, 12, "glock", -0.35)
    for bar in (1, 2):
        tb = (bar - 1) * 2.0
        oompah(b, tb, CHB[bar], 0.68, True, 0.42)
        snare_bar(b, tb, "march", 0.62, steps=range(16) if bar == 1 else range(8))
    roll(b, 3.0, 4.21, 0.25, 0.62)
    b.add("cymbal", I.cymbal(0.45, _r()), 0.0, 0.0)
    b.cues.append((0.0, "hook: theme A1-A2 tutti, 7 whistlers, tuba/after-beats/snare; snare fill under the last words"))
    hook_cut = np.ones(N)
    a, z = ns(T.FLASH - 0.03), ns(T.FLASH + 0.015)
    hook_cut[a:z] = np.linspace(1, 0, z - a)
    hook_cut[z:] = 0
    for k in b.tr:
        b.tr[k] *= hook_cut[None, :]
    for m in [46, 53, 58, 62, 65]:
        b.add("stab", I.brass(F(m), 0.2, 0.8, _r(), "stab", scoop=-15), T.FLASH, (m - 56) / 20)
    b.add("tuba", I.brass(F(34), 0.25, 0.8, _r(), "tuba"), T.FLASH, -0.1)
    b.add("glock", I.glock(F(94), 0.6, _r()), T.FLASH, -0.35)
    b.add("cymbal", I.cymbal(0.4, _r(), dur=1.2), T.FLASH, 0.0)
    b.cues.append((T.FLASH, "Bb button + light clash exactly on the white flash, then silence for the bad news"))

    # ============ SETTING 4.3 - 10.9: dark and small: low pad Cm, lone fife states the plan, light snare
    roll(b, 4.6, 5.02, 0.12, 0.42, accent=0.4, at=5.04)
    for (ta, tb_, ms) in [(4.4, 7.6, [46, 55, 60, 63]), (7.6, 9.9, [46, 55, 58, 62]), (9.9, 10.9, [39, 55, 58, 63])]:
        b.add("pad", I.pad([F(m) for m in ms], tb_ - ta, 0.5, _r(), att=0.4, rel=0.7), ta, 0.0)
    dn = theme(5.0, bars=[3, 4])
    melody(b, "fife", [n for n in dn if n[0] < 10.7], 0.5, 0, "fife", -0.2)
    for bar in (3, 4):
        tb = 5.0 + (bar - 3) * 2
        oompah(b, tb, CHB[bar], 0.34, False, 0.22)
        snare_bar(b, tb, "light", 0.22, steps=range(12))
    b.add("timpani", I.timpani(F(36), 0.6, _r()), 7.66, -0.15)  # "keep flattening": the real field takes the blows
    b.add("timpani", I.timpani(F(36), 0.6, _r()), 8.16, -0.15)
    b.cues.append((4.6, "setting: dark Cm pad, lone fife A3-A4, two low timpani on 'flattening'"))

    # ============ BUILD 10.9 - 15.1: the march starts with one carpenter (A5 in Bb), tuba joins the planks
    a5 = theme(10.9, bars=[5])
    melody(b, "glock", a5, 0.34, 12, "glock", -0.3)
    for bar in (5,):
        tb = 10.9
        oompah(b, tb, CHB[bar], 0.5, True, 0.34)
        snare_bar(b, tb, "light", 0.4)
    b.cues.append((10.9, "build: one bar of tune Bb on glock, tuba + light snare; the crew hammers are the backbeat"))
    for bar in (6,):
        tb = 12.9
        a6 = theme(12.9, bars=[6])
        melody(b, "glock", a6, 0.44, 12, "glock", -0.3)
        oompah(b, tb, CHB[bar], 0.56, True, 0.4)
        snare_bar(b, tb, "march", 0.5)

    # ============ SHELLS 15.1 - 20.2: full band bounce, the hangars grow with the tune (A7-A8)
    a78 = theme(15.1, bars=[7, 8])
    melody(b, "glock", a78, 0.52, 12, "glock", -0.35)
    melody(b, "fife", a78, 0.5, 0, "fife", 0.25)
    b.add("cymbal", I.cymbal(0.4, _r()), 15.1, 0.0)
    for bar in (7, 8):
        tb = 15.1 + (bar - 7) * 2
        oompah(b, tb, CHB[bar], 0.66, True, 0.44, bounce=bar == 8)
        snare_bar(b, tb, "march", 0.6, steps=range(16) if bar == 7 else range(12))
    roll(b, 19.7, 20.18, 0.3, 0.6, accent=0.6, at=20.2)
    b.cues.append((15.1, "shells: theme A7-A8 full band, bounce octaves through the planes paint"))

    # ============ TOY 20.2 - 24: the rail plane: music-box tune + bouncing tuba (stops on the gawk)
    tn = theme(20.3, bars=[1, 2])
    melody(b, "musicbox", tn[:14], 0.75, 12, "musicbox", -0.2)
    for bar in (1, 2):
        tb = 20.3 + (bar - 1) * 2
        oompah(b, tb, CHB[bar], 0.4, True, 0.3, bounce=True, pah=False)
    b.add("triangle", I.triangle(0.3, _r()), 20.3, 0.3)
    b.add("triangle", I.triangle(0.3, _r()), 21.9, 0.3)
    b.cues.append((20.3, "toy gag: music-box A1-A2 solo + bouncing tuba, triangle on its stops"))
    toy_cut = np.ones(N)
    a = ns(23.98)
    toy_cut[a:a + ns(0.02)] = np.linspace(1, 0.4, ns(0.02))
    for k in b.tr:
        if k == "musicbox":
            b.tr[k] *= toy_cut[None, :]

    # ============ MYSTERY 24.0 - 27.55: light band thins to a watchful pad (the photo plane passes)
    mth = theme(24.58, bars=[3])
    melody(b, "glock", mth, 0.3, 12, "glock", -0.3)
    for bar in (3,):
        tb = 24.58
        oompah(b, tb, CHB[bar], 0.4, False, 0.28)
        snare_bar(b, tb, "light", 0.34)
    b.cues.append((24.58, "mystery watchfulness, glock/dull band only under the photo pass"))

    # ============ NOBOMBS 27.4 - 35.05: dominant pedal, snare drive + roll, DEAD STOP on "Then,"
    oompah(b, 27.55, ["F7"] * 4, 0.62, True, 0.44)
    snare_bar(b, 27.55, "march", 0.6, steps=range(8))
    snare_bar(b, 27.6, "drive", 0.5, steps=range(8, 16), cres=0.3)
    climb = [("F7", 31.0), ("F#o7", 31.5), ("Gm", 32.55), ("G#o7", 33.3)]
    for i, (c, t) in enumerate(climb):
        m = CH[c]["oom"][0]
        for k in range(2):
            b.add("tuba", I.brass(F(m), 0.2, 0.62 + 0.05 * i, _r(), "tuba"), t + k * 0.25, -0.1)
        for k, mm in enumerate(CH[c]["pah"]):
            b.add("pah", I.brass(F(mm), 0.14, 0.42 + 0.05 * i, _r(), "horn"), t + 0.25 + 0.004 * k, 0.32 - 0.12 * k)
        for k in range(4):
            b.add("glock", I.glock(F(96 + i), 0.2 + 0.04 * i, _r(), dur=0.5), t + k * Q / 4, -0.35)
    snare_bar(b, 31.5, "drive", 0.55, steps=range(8), cres=0.5)
    roll(b, 33.4, 35.02, 0.4, 1.0)
    stop = np.ones(N)
    a = ns(35.035)
    stop[a:a + ns(0.012)] = np.linspace(1, 0, ns(0.012))
    stop[a + ns(0.012):] = 0
    for k in b.tr:
        b.tr[k] *= stop[None, :]
    b.cues.append((27.55, "no-bomb tension: F7 pedal, drive snare, climb F7-Gm-G#o7 with the tally months"))
    b.cues.append((35.05, "DEAD STOP on 'Then,' - silence through the dawn, the one circle and the whole fall"))

    # ============ HOLD 40.3 - 42.64: a low pad swells alone under the falling bomb, cut dead at the clonk
    b.add("pad", I.pad([F(34), F(46), F(51), F(58)], 2.5, 0.62, _r(), att=1.3, rel=0.4, trem=lambda t: 1 + 0.05 * np.sin(2 * np.pi * 1.15 * t)),
          T.RELEASE - 0.15, 0.0)
    cut = np.ones(N)             # the pad track holds only this swell so far: hard-stop it at the clonk
    a = ns(T.CLONK - 0.008)
    cut[a:a + ns(0.03)] = np.linspace(1, 0, ns(0.03))
    cut[a + ns(0.03):] = 0
    for k in ["pad"]:
        b.tr[k] *= cut[None, :]
    b.cues.append((40.15, "one low pad swells under the fall (starts 40.3, ends frozen at the clonk)"))

    # ============ REVEAL 42.64 - 47: deadpan space: two comic pluck stabs + triangle between the double line
    b.add("pluck", I.pluck(F(34), 0.95, _r(), dur=0.7), 42.72, 0.0)
    b.add("pluck", I.pluck(F(41), 0.6, _r(), dur=0.55, bright=0.5), 43.3, -0.1)
    b.add("triangle", I.triangle(0.3, _r()), 43.75, 0.3)
    b.add("timpani", I.timpani(F(29), 0.5, _r()), 45.12, -0.2)  # "Unluckily": the message lands
    for (ta, tb_, ms) in [(42.7, 45.1, [46, 58, 62, 65]), (45.1, 47.05, [41, 57, 60, 63])]:
        b.add("pad", I.pad([F(m) for m in ms], tb_ - ta, 0.42, _r(), att=0.3, rel=0.5), ta, 0.0)
    b.cues.append((42.72, "reveal: pluck Bb (the clonk rings wood), triangle, F timpani on the 'Unluckily' word"))

    # ============ EXPLAIN 47 - 55.2: warm waltz sway (3/4 at 84 bpm), pad + music-box lanterns of the idea
    Q3 = 1.55 / 3
    ch3 = ["Bb", "Bb", "Eb", "F7", "Bb"]
    bass = [46, 46, 39, 41, 46]
    bar_t = 47.0 + np.arange(5) * 1.55
    up = [[None, 77, 82], [86, 89, 87], [91, 94, 94], [89, None, None], [77, None, None]]
    for (ta, tb_, ms) in [(46.95, 50.05, [58, 62, 65]), (50.05, 51.6, [58, 63, 67]), (51.6, 53.7, [57, 60, 63]), (53.7, 55.3, [58, 62, 65])]:
        b.add("pad", I.pad([F(m) for m in ms], tb_ - ta, 0.34, _r(), att=0.3, rel=0.4), ta, 0.0)
    for k, tb_ in enumerate(bar_t):
        if tb_ > 55.1:
            break
        b.add("pluck", I.pluck(F(bass[k]), 0.7, _r(), dur=1.0), tb_, -0.05)
        for j, m in enumerate(up[k]):
            if m:
                b.add("musicbox", I.musicbox(F(m), 0.5, _r()), tb_ + j * Q3, 0.2)
        if k:
            b.add("triangle", I.triangle(0.3, _r(), dur=0.4), tb_, 0.35)
    b.cues.append((47.0, "explain: music-box waltz 3/4, one bar per 1.55 s breath, warm pad underneath"))

    # ============ DECOY WAR 55.2 - 61.5: soft golden march (6 whistlers) under the German thuds
    dn2 = theme(55.3, bars=[1, 2, 3])
    dn2 = [n for n in dn2 if n[0] < 61.4]
    chorus(b, "whistle", dn2, 6, 5432, spread=0.7, vel=0.72, solo_gain=0.75)
    melody(b, "glock", dn2, 0.28, 12, "glock", -0.3)
    for bar in (1, 2, 3):
        tb = 55.3 + (bar - 1) * 2
        oompah(b, tb, CHB[bar], 0.42, bar == 1, 0.3)
        snare_bar(b, tb, "light", 0.34, steps=range(14))
    b.add("cymbal", I.cymbal(0.2, _r()), 55.3, 0.0)
    b.cues.append((55.3, "decoy war: theme A1-A3 soft golden march; the distant thuds are SFX timpani"))

    # ============ PUNCH 61.5 - 65.5: roll -> stabs on 'destroy', the button lands on 'compliment'
    roll(b, 61.6, 62.4, 0.12, 0.5)
    b.add("cymbal", I.cymbal(0.3, _r()), 62.55, 0.0)
    stabs = [(63.5, [46, 53, 58, 62, 65], 46, 0.66), (64.17, [34, 46, 53, 58], 34, 0.6)]
    for (th, ms, tm, v) in stabs:
        for m in ms:
            b.add("stab", I.brass(F(m), 0.16, v, _r(), "stab", scoop=-10), th, (m - 56) / 22)
        b.add("timpani", I.timpani(F(tm), v, _r()), th, -0.1)
    roll(b, 64.5, 65.1, 0.2, 0.7)
    for m in [46, 58, 62, 65, 70]:
        b.add("stab", I.brass(F(m), 0.5, 0.72, _r(), "stab", scoop=-12), T.END_WORD, (m - 56) / 22)  # the final button ON the word
    b.add("cymbal", I.cymbal(0.42, _r(), dur=1.6), T.END_WORD, 0.0)
    b.add("glock", I.glock(F(94), 0.55, _r()), T.END_WORD, -0.35)
    b.cues.append((61.6, "punch: snare roll, Bb stab on 'destroy', low F on 'ever', big button chord ON 'compliment.'"))
    end = np.ones(N)
    a = ns(66.0)
    end[a:] = np.linspace(1, 0, N - a) ** 1.5
    for k in b.tr:
        b.tr[k] *= end[None, :]
    return b


def _pad_add(b, frs, dur):
    """kept for cue-shaping tweaks; currently unused"""
    return I.pad(frs, dur, 0.62, _r(), att=1.2, rel=0.05)


TARGET = {  # relative balance inside the band (LU, measured on each track's own active span)
    "whistle": 0.0, "fife": -3.0, "glock": -6.0, "tuba": -2.5, "pah": -7.5, "snare": -5.5, "cymbal": -11.0,
    "stab": -3.0, "timpani": -5.0, "pad": -3.5, "vibes": -2.0, "musicbox": -1.5, "pluck": -4.0, "brush": -13.0, "triangle": -15.0,
}


def render(b, ref=-20.0):
    hall = make_ir(1.5, 7, pre=0.018, hf=1.4)
    yard = make_ir(0.9, 8, pre=0.008, hf=1.8, early=[(0.11, 0.5, -0.4), (0.19, 0.35, 0.5)])
    dry = np.zeros((2, N))
    wet_hall = np.zeros((2, N))
    wet_yard = np.zeros((2, N))
    levels = {}
    for k, x in b.tr.items():
        if not np.any(x):
            continue
        L = integrated(x)
        g = dbg(ref + TARGET.get(k, -6) - L)
        levels[k] = (round(L, 1), round(ref + TARGET.get(k, -6), 1))
        x = x * g
        b.tr[k] = x
        dry += x
        if k == "whistle":
            wet_yard += 0.16 * x
        else:
            wet_hall += b.send[k] * x
    out = dry + 0.7 * convolve_st(wet_hall.mean(0), hall) + 0.8 * convolve_st(wet_yard.mean(0), yard)
    out = hp(out, 30, 2)
    return out, levels
