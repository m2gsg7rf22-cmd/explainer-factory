"""Procedural ambient bed (synth pads + soft pulse). Fully original, no downloads, no licensing."""
import numpy as np, wave
SR = 44100
def make(duration, path, seed=0):
    rng = np.random.default_rng(seed); n = int(duration * SR); t = np.arange(n) / SR
    roots = [220.0, 174.61, 196.0, 164.81]; bar = 8.0; out = np.zeros(n)
    for i in range(int(duration / bar) + 2):
        r = roots[(i + seed) % 4]; s, e = int(i * bar * SR), min(n, int((i + 1) * bar * SR))
        if s >= n: break
        tt = t[s:e]; env = np.minimum(1, (tt - tt[0]) / 2.0) * np.minimum(1, (tt[-1] - tt) / 2.0)
        for mult, amp in [(0.5, 0.5), (1, 0.4), (1.5, 0.25), (2, 0.2), (2.5, 0.1)]:
            f = r * mult; det = 1 + 0.002 * np.sin(2 * np.pi * 0.2 * tt + mult)
            out[s:e] += amp * env * (np.sin(2 * np.pi * f * det * tt) + 0.4 * np.sin(2 * np.pi * f * 2.0 * tt)) / 2
    pulse = 0.5 + 0.5 * np.sin(2 * np.pi * (1 / 4.0) * t); out *= (0.75 + 0.25 * pulse)
    # soft kick-ish heartbeat
    beat = (np.sin(2 * np.pi * 55 * t) * np.exp(-((t % 0.5) * 14))) * 0.25; out += beat * (np.sin(2 * np.pi * 0.03 * t) > -2)
    out /= np.max(np.abs(out)) + 1e-9; out *= 0.9
    st = np.stack([out, np.roll(out, 400)], 1)
    with wave.open(path, "wb") as f: f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((st * 32767).astype("<i2").tobytes())
