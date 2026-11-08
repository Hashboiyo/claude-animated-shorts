# Every sound effect + ambience bed of "The Wooden Bomb" as a cue list timed to the picture (timeline.py), rendered
# into one stereo SFX stem. Each EVENT sits SFX_DB = -6 dB under its own naive level; BEDS are not reduced. Camera
# distance adds gain, a low-pass and more field reverb. Written against the same generators as the bridge short.
import math

import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, pan, st, place, fades, widen, convolve_st,
                 momentary_max, integrated, colored, smooth_noise, modal)
import sfx_gen as G
import timeline as T

N = ns(T.DUR)
SFX_DB = -6.0


class Cue:
    def __init__(self, t, name, desc, gen, naive, kind="event", p=0.0, extra=0.0, lpf=None, send=0.12, group=None, cut=None):
        self.t, self.name, self.desc, self.gen, self.naive = t, name, desc, gen, naive
        self.kind, self.p, self.extra, self.lpf, self.send, self.cut = kind, p, extra, lpf, send, cut
        self.group = group or name
        self.applied = naive + (SFX_DB if kind == "event" else 0.0) + extra
        self.measured = None


def cues():
    C = []
    R = rng(1943)
    rr = lambda: rng(int(R.integers(1 << 30)))
    add = C.append

    # ------------------------------------------------ ambience beds (not reduced by the -6 dB event rule)
    def amb_field(dur, seed=1):
        def g():
            r = rng(seed)
            x = G.breeze(dur, r, 1.0, 0.16, 900)
            x += pan(G.bird_chirps(dur, r, 0.5, "sparrow") * 0.09, 0.5)
            x += pan(G.bird_chirps(dur, r, 0.3, "sparrow") * 0.06, -0.6)
            return fades(x, 0.5, 0.6), 0.0
        return g

    def amb_dawn(dur, seed=8):
        def g():
            r = rng(seed)
            x = G.breeze(dur, r, 0.8, 0.14, 680)
            x += pan(G.bird_chirps(dur, r, 0.42, "blackbird") * 0.07, -0.45)
            x += pan(G.bird_chirps(dur, r, 0.25, "blackbird") * 0.05, 0.55)
            x += widen(G.crickets(dur, r, 2) * 0.006, r, 9, 1.0)
            return fades(x, 0.6, 0.7), 0.0
        return g

    def amb_night(dur, seed=13):
        def g():
            r = rng(seed)
            x = G.breeze(dur, r, 0.55, 0.12, 520)
            x += widen(G.crickets(dur, r, 5) * 0.012, r, 11, 1.0)
            return fades(x, 0.6, 0.8), 0.0
        return g

    add(Cue(0.0, "amb_field", "daytime polder air: breeze, sparrows, distant farm life (shots 1-7)",
            _envlambda(amb_field(34.0, 7), 34.0, 0.5, 1.2), -30, "bed", send=0.0))
    add(Cue(34.6, "amb_dawn", "dawn air: colder breeze, first blackbirds, faint crickets die out (shots 8-12)",
            _envlambda(amb_dawn(20.0, 13), 20.0, 0.8, 0.7), -29, "bed", send=0.0))
    add(Cue(54.9, "amb_night", "night air over the British decoys: crickets, low breeze (shot 13)",
            _envlambda(amb_night(8.4, 17), 8.4, 0.6, 0.8), -27, "bed", send=0.0))
    add(Cue(63.3, "amb_dawn2", "the morning after: birds back, breeze (shots 14, tail)",
            _envlambda(amb_dawn(4.9, 23), 4.9, 0.5, 1.4), -27, "bed", send=0.0))

    # ------------------------------------------------ hook: flash + early field cues
    add(Cue(T.FLASH, "flash_whoosh", "reverse swell into the white flash (frame 127) + soft low whoomp",
            lambda: (_flash(rng(127)), -0.0), -5, send=0.2))

    # ------------------------------------------------ build beats: hammers + plank slides + the painter
    for shot, t1 in [(3, 15.0), (4, 20.0)]:
        for k, tm in enumerate(T.hammer_hits(shot)):
            d = T.cam_distance(tm)
            g, lpf, send = T.dist_fx(d)
            pp = float(np.clip((k % 5 - 2) * 0.35, -0.85, 0.85))
            add(Cue(tm, "hammer", f"carpenter nail {k + 1} shot {shot} (cam {d:.0f} m)",
                    (lambda r=rr(), big=float(np.clip(1.4 - d / 30, 0.5, 1.1)): (G.hammer_hit(r, big), 0.0)),
                    -7, p=pp, extra=max(g, -10.0), lpf=lpf, send=send, group="hammers"))
    # the painter swipes + bucket clunk (shot 3)
    for tm in [13.12, 13.66]:
        add(Cue(tm, "paint_swipe", "the painter strokes the grey along the boards",
                (lambda r=rr(): (G.stick_slip(0.45, r.uniform(5.2, 6.4), r, 0.05), 0.05)), -13, p=0.3, lpf=9000, send=0.12,
                group="painter"))
    add(Cue(12.9, "paint_bucket", "the paint bucket lands by the plank line",
            (lambda r=rr(): (G.clink(r, r.uniform(340, 420), 0.14, bright=0.6), 0.0)), -14, p=0.25, send=0.15))

    # hangar shells: two big timber creaks + saw strokes (shot 4)
    for tm, a in [(15.4, 0.7), (16.6, 0.9), (17.9, 1.0)]:
        add(Cue(tm, "shell_creak", "hangar frame timber creak as the shell rises",
                (lambda r=rr(), a=a: (G.creak(0.7, r, 45, 85, G.TIMBER, [(0, 0), (0.5, 1), (1, 0.7)], 0.22, 0.06) * 0.8 * a, 0.1)),
                -12, p=-0.35, lpf=7500, send=0.2, group="shells"))
    for tm in [16.2, 17.1, 18.0, 18.9]:
        add(Cue(tm, "saw", "a saw strokes through a plank",
                (lambda r=rr(): (G.stick_slip(0.5, r.uniform(7.0, 8.6), r, 0.09, amp=0.55), 0.05)), -14, p=0.5,
                lpf=8500, send=0.15, group="saw"))

    # trucks + gun + tower + barrels pop (shot 4): wooden thocks + tyre roll
    for tm, nm in [(16.4, "truck 1 rolls in"), (17.0, "truck 2 follows"), (17.32, "gun pit drops"), (15.55, "watchtower drops")]:
        add(Cue(tm, "prop_thock", f"{nm}: timber thock + small rattle",
                (lambda r=rr(): (G.wood_crack(r) * 0.5 + G.rattle(0.4, r, 14.0) * 0.5, 0.0)), -12, p=float(R.uniform(-0.6, 0.6)),
                lpf=9000, send=0.2, group="props"))
    for k in range(7):  # the rail plane's engine pops in after the roll
        add(Cue(18.28 + k * 0.16, "engine_chug", "the wooden fighter's engine huff",
                (lambda r=rr(): (_engine_chug(r, 0.16, 1.0 - 0.05 * k), 0.02)), -16, p=0.6, lpf=3000, send=0.12, group="engine"))

    # ------------------------------------------------ the rail plane (shot 5): squeaks + slow wheel tok-tok + cap waves
    def rail_squeaks():
        out = []
        for k in range(26):
            t = 20.2 + k * 0.145
            v = T.rail_speed(t + 0.02)
            if abs(v) < 0.002:
                continue
            a = min(1.0, abs(v) / 0.5)
            out.append((t, a, 1 if v > 0 else -1))
        return out
    for (tm, a, d) in rail_squeaks():
        add(Cue(tm, "rail_squeak", "hidden-rail squeak under the wooden fighter",
                (lambda r=rr(), a=a, d=d: (G.swing_squeak(r, 0.35 * a, d > 0) * 0.8, 0.05)), -13,
                p=0.45, extra=-6.0 + 9.0 * a, lpf=9500, send=0.14, group="rail"))
    for k in range(16):  # the wheels flapping over the ties
        tm = 20.3 + k * 0.23
        if tm < 20.2 or tm > 23.9:
            continue
        add(Cue(tm, "wheel_tok", "wheel_tok over the wooden ties",
                (lambda r=rr(): (_tok(r), 0.0)), -17, p=0.55, lpf=6000, send=0.12, group="rail"))
    for tm in [21.05, 22.15]:
        add(Cue(tm, "cap_wave", "an engineer waves his cap: cloth swish",
                (lambda r=rr(): (G.whoosh(0.3, r, 0.09, 800, 3200, 0.7, 0.05, 0.25), 0.05)), -15, p=0.3, send=0.12, group="rail"))

    # ------------------------------------------------ the photo pass (shot 6): plane whoosh + two shutters
    add(Cue(25.1, "photo_pass", "the recon plane crosses high: doppler whoosh + faint engine tone",
            lambda: (_photo_pass(2.6, rng(635)), 0.4), -8, p=0.0, send=0.2))
    for k, tm in enumerate(T.SHUTTERS):
        add(Cue(tm, "shutter", f"camera shutter click {k + 1}/2 (the eyes that get two seconds)",
                (lambda r=rr(): (G.clink(r, r.uniform(2400, 3100), 0.07, bright=1.3), 0.0)), -11, p=0.2, send=0.1,
                group="shutter"))
    add(Cue(T.SHUTTERS[1] + 0.06, "motor", "film motor wind after the second frame",
            (lambda r=rr(): (G.rattle(0.22, r, 42.0), 0.0)), -19, p=0.2, lpf=8000, send=0.1))

    # ------------------------------------------------ the party mugs (shot 7)
    for k in range(7):
        tm = T.MUGS_UP + 0.02 + k * 0.11
        add(Cue(tm, "mug_clink", f"mug clink {k + 1}/7 raising (comic timing)",
                (lambda r=rr(), k=k: (G.clink(r, r.uniform(1150, 1500), 0.09, bright=1.15), 0.0)), -12,
                p=float(np.clip((k % 4 - 1.4) * 0.4, -0.8, 0.8)), lpf=11000, send=0.14, group="mugs"))

    # ------------------------------------------------ the dawn: final plank strikes (shot 8)
    for k, th in enumerate(T.FINAL_PLANK_STRIKES):
        add(Cue(th, "hammer", f"the final plank tap {k + 1}/3 (dawn, close, the last board)",
                (lambda r=rr(): (G.hammer_hit(r, 0.75), 0.0)), -6, p=-0.15, lpf=12000, send=0.18, group="hammers"))

    # ------------------------------------------------ the crossing, the circle, the release (shots 8-9)
    add(Cue(T.ENGINE_T0, "engine", "lone RAF plane: steady prop drone, nearing then circling overhead",
            lambda: (_engine_bed(T.ENGINE_T1 - T.ENGINE_T0, rng(4496)), 0.0), -13, p=-0.15, send=0.12, group="engine"))
    for f, desc in [(1119, "ride alongside the crossing plane"), (1198, "follow the lap"), (1246, "fall away to the ground")]:
        add(Cue(T.fr(f), "whoosh_cam", f"camera {desc}", (lambda r=rr(): (G.whoosh(0.55, r, 0.1, 380, 2000, 0.8, 0.15, 0.2), 0.1)), -12, send=0.12))

    # ------------------------------------------------ the bomb: whistle fall, THE CLONK, splinters
    add(Cue(T.RELEASE + 0.05, "fall_whistle", "cartoon bomb whistle: enters on the release, dies the frame before the clonk",
            lambda: (_bomb_whistle(T.FALL_T - 0.12, rng(4487)), T.FALL_T - 0.12), -9, p=0.05, send=0.1))
    add(Cue(T.RELEASE + 0.6, "fall_air", "air rush building under the wooden bomb",
            (lambda r=rr(): (G.whoosh(1.7, r, 0.16, 260, 1400, 0.9, 0.02, 0.2), 1.68)), -14, lpf=5000, send=0.1))
    add(Cue(T.CLONK, "THE_CLONK", "the wooden bomb on the wooden runway: hollow clonk + rim of splinters",
            lambda: (_clonk(rng(4462)), 0.0), -2, p=0.1, send=0.2))
    add(Cue(T.CLONK + 0.05, "splinters", "splinter shards scatter, clatter and stop",
            (lambda r=rr(): (G.rattle(1.0, r, 26.0, heavy=True), 0.0)), -10, p=0.2, lpf=12000, send=0.25))
    add(Cue(T.BOUNCE2, "clonk2", "second bounce, smaller: a wooden thud + two ticks",
            (lambda r=rr(): (_hollow_thud(r, 0.42) + G.clink(r, r.uniform(1500, 1800), 0.07, bright=0.8), 0.0)),
            -9, p=-0.1, lpf=9000, send=0.2))
    for tm in [43.75, 44.4]:
        add(Cue(tm, "birddrop", "a relieved blackbird phrase",
                (lambda r=rr(): (G.bird_chirps(1.2, r, 2.5, "blackbird") * 0.5, 0.05)), -18, p=-0.4, lpf=9000, send=0.3))

    # ------------------------------------------------ the trench crew + the officer's walk (shot 10)
    add(Cue(T.CLONK + 0.08, "trench_pop", "the trench crew bursts up: boards and boots",
            (lambda r=rr(): (G.rattle(0.5, r, 36.0) + G.stroll_step(r, 1.1) * 0.4, 0.0)), -12, p=-0.25, lpf=9000, send=0.2))
    for k in range(6):  # the officer walks the apron to the bomb
        tm = 43.2 + k * 0.33
        add(Cue(tm, "boot_step", "the officer's boot (greatcoat), approaching the bomb",
                (lambda r=rr(): (G.stroll_step(r, 0.8), 0.0)), -13,
                p=-0.35 + 0.11 * k, lpf=7500, send=0.18, group="officer_boots"))
    add(Cue(45.3, "dust_off", "two little dust-off brushes on the stencil band",
            (lambda r=rr(): (G.stick_slip(0.4, 5.5, r, 0.04, amp=0.3), 0.05)), -16, p=0.15, lpf=8000, send=0.12))

    # ------------------------------------------------ the cockpit card (shot 11): soft engine close + blink tick
    add(Cue(47.1, "cockpit_air", "engine close-up under the card: warm hum + two instrument ticks",
            lambda: (_cockpit_bed(7.9, rng(4711)), 0.0), -17, p=0.2, send=0.05, group="engine"))

    # ------------------------------------------------ the night decoy war (shot 13): bomber far + thuds on empty plywood
    add(Cue(55.4, "bomber_drone", "the German bomber far overhead: deep, slow, wide",
            lambda: (_bomber_bed(6.2, rng(5540)), 0.0), -18, p=-0.4, send=0.15, group="engine"))
    for k, th in enumerate(T.THUDS):
        add(Cue(th, "thud", f"bomb lands on the empty plywood field {k + 1}/4: distant wooden thump",
                (lambda r=rr(): (_hollow_thud(r, 1.0, mid=62) + G.wood_crack(r) * 0.25, 0.0)),
                -6, p=float(np.clip((k % 2) * 0.5 - 0.25, -0.6, 0.6)), lpf=5200, send=0.3, group="thuds"))
        add(Cue(th + 0.35, "fire_flicker", "the decoy lamp flare answers the thud (small crackle)",
                (lambda r=rr(): (G.rattle(0.5, r, 9.0) * 0.35, 0.0)), -20, p=0.5, lpf=6000, send=0.25, group="thuds"))

    # ------------------------------------------------ the tail (shot 14): wind + one wooden tick on the punch word
    add(Cue(T.END_WORD, "bomb_tick", "the bomb settles one tiny tick as 'the compliment.' lands",
            (lambda r=rr(): (G.clink(r, r.uniform(900, 1100), 0.06, bright=0.7), 0.0)), -16, p=0.1, lpf=7000, send=0.2))
    return C


def _envlambda(gen, dur, fin, fout):
    def g():
        x, a = gen()
        return fades(x, fin, fout), a
    return g


# ================================================================ composite generators
def _tok(r):
    """wooden wheel on ties: a short two-surface tick"""
    y = G.clink(r, r.uniform(480, 560), 0.05, bright=0.6) + 0.4 * lp(colored(ns(0.05), r, 0.7), 400)
    y = np.concatenate([y, np.zeros(ns(0.02))])
    y[ns(0.03):] += G.clink(r, r.uniform(430, 500), 0.05, bright=0.55) * 0.7
    return y, 0.0


def _hollow_thud(r, g=1.0, mid=74):
    """wooden-on-wooden landing: hollow body + short plank ring"""
    t = tt(0.45)
    tone = (np.sin(2 * np.pi * mid * t) * np.exp(-t / 0.05) + 0.35 * np.sin(2 * np.pi * mid * 2.7 * t) * np.exp(-t / 0.035))
    body = modal(0.3, [(mid * 1.1, 1.0, 0.05), (mid * 2.3, 0.5, 0.03)], r)
    return tone * g * 0.8 + body * g * 0.7


def _clonk(r):
    """the whole wooden-missile landing: nose clonk, forearm boing, splinter dust"""
    n = ns(1.6)
    out = np.zeros(n)
    nose = _hollow_thud(r, 1.35, mid=74)
    place(out, nose, 0.0)
    for k, (tm, a) in enumerate([(0.06, 0.5), (0.11, 0.3), (0.17, 0.18)]):
        place(out, G.clink(r, r.uniform(300, 420) - k * 40, 0.09, bright=0.5) * a, tm)
    place(out, lp(G.whoosh(0.4, r, 0.2, 140, 900, 0.9, 0.1, 0.0), 1100, 1) * 0.55, 0.12)
    return out


def _flash(r):
    dur = 0.75
    y = G.whoosh(dur, r, 0.33, 500, 4200, 0.9, 0.09, 0.4)  # type: ignore[arg-type]
    t = tt(dur)
    boom = np.where(t > 0.33, np.exp(-(t - 0.33) / 0.12) * np.sin(2 * np.pi * 62 * (t - 0.33)), 0) * 0.8
    return widen(y + boom, r, 12, 0.9), 0.33


def _photo_pass(dur, r):
    """high recon plane: distant drone with a narrow doppler sweep, quiet"""
    n = ns(dur)
    t = tt(dur)
    drone = lp(colored(n, r, 0.55), 340) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * t) ** 2)
    sweep = G.whoosh(dur, r, 0.5, 300, 2400, 0.85, 0.35, 0.3)  # type: ignore[arg-type]
    return pan(drone, float(np.interp(t, [0, dur * 0.45, dur], [-0.7, -0.2, 0.75]))) + sweep * 0.7


def _engine_bed(dur, r):
    """steady prop drone of the lone RAF plane (weaker first, overhead in the lap)"""
    n = ns(dur)
    t = tt(dur)
    core = lp(colored(n, r, 0.62), 300) * (0.55 + 0.45 * np.sin(2 * np.pi * 4.2 * t) ** 2)
    growl = modal(0.02, [(58, 1.0, 0.08), (117, 0.5, 0.04), (230, 0.3, 0.03)], r) + 0
    en = core + 0.35 * lp(np.tile(growl, (n // len(growl)) + 1)[:n], 500, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.27 * t))
    a = 0.45 + 0.55 * smooth_noise(n, r, 0.55)
    en *= a
    return fades(pan(en, float(np.interp(t, [0, 2.5, 5.0, dur], [0.5, -0.4, 0.25, 0.6]))), 0.3, 0.6)


def _bomber_bed(dur, r):
    """far away big bomber: very low, slow, wide"""
    n = ns(dur)
    t = tt(dur)
    x = lp(colored(n, r, 0.5), 160) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.9 * t) ** 2)
    return widen(fades(x, 0.8, 1.0), r, 14, 1.1)


def _engine_chug(r, dur, g):
    n = ns(dur)
    t = tt(dur)
    x = lp(colored(n, r, 0.6), 420) * np.sin(2 * np.pi * 15 * t) ** 2
    return x * g


def _cockpit_bed(dur, r):
    n = ns(dur)
    t = tt(dur)
    hum = lp(colored(n, r, 0.65), 220) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.9 * t) ** 2)
    for tm in [1.9, 5.4]:
        tick = G.clink(r, 2100, 0.05, bright=1.1)
        place(hum, tick * 0.4, tm)
    return fades(pan(hum, 0.25), 0.5, 0.8)


def _bomb_whistle(dur, r):
    """descending siren: pitch drops as the bomb slows (cartoon), slight warble"""
    n = ns(dur)
    t = tt(dur)
    f = np.interp(t, [0, dur], [1650, 780])
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t))
    s = bp(s, 1200, 2800, 1.1) * fades(n, 0.05, 0.001)
    return widen(s, r, 5, 0.7), 0.0


# ================================================================ render (unchanged machinery)
def render(v_ref, on_event=None):
    """v_ref = integrated loudness of the voice stem (stereo). Returns (stereo stem, cue list with measured levels)."""
    C = cues()
    out = np.zeros((2, N))
    send = np.zeros(N)
    for c in C:
        x, anchor = c.gen()
        x = np.asarray(x, float)
        if x.ndim == 1:
            x = pan(x, c.p)
        if x.ndim == 2 and x.shape[0] == 1:
            x = np.vstack([x, x])
        if c.cut is not None:
            k = ns(c.cut - (c.t - anchor))
            if 0 < k < x.shape[1]:
                x = fades(x[:, :k], 0.0, 0.02)
        tgt = v_ref + c.applied
        cur = momentary_max(x) if c.kind == "event" else integrated(x)
        if np.isfinite(cur):
            x = x * dbg(tgt - cur)
        if c.lpf:
            x = lp(x, c.lpf, 1)
        c.measured = momentary_max(x) - v_ref if c.kind == "event" else integrated(x) - v_ref
        t0 = c.t - anchor
        place(out, x, t0)
    return out, C
