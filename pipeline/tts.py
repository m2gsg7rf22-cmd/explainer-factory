"""Offline text-to-speech. Order: Piper (neural, open source) -> Kokoro (neural, open source) -> espeak-ng (robotic fallback).
Nothing here calls the network at render time; voices are downloaded once by setup.sh."""
import subprocess, shutil, os, wave, numpy as np
SR = 24000

def _to_wav(src, dst):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", str(SR), "-sample_fmt", "s16", dst], check=True)

def _piper(text, out, cfg):
    voice = os.path.expanduser(cfg.get("piper_voice", "models/piper/en_US-ryan-high.onnx"))
    if not os.path.exists(voice): raise RuntimeError("piper voice missing")
    exe = shutil.which("piper") or None
    cmd = ([exe] if exe else ["python3", "-m", "piper"]) + ["-m", voice, "-f", out + ".raw.wav", "--length-scale", str(cfg.get("length_scale", 0.92))]
    subprocess.run(cmd, input=text.encode(), check=True, capture_output=True); _to_wav(out + ".raw.wav", out)

_K = None
def _kokoro(text, out, cfg):
    from kokoro_onnx import Kokoro
    import wave as w
    m = os.path.expanduser(cfg.get("kokoro_model", "models/kokoro/kokoro-v1.0.onnx")); v = os.path.expanduser(cfg.get("kokoro_voices", "models/kokoro/voices-v1.0.bin"))
    if not (os.path.exists(m) and os.path.exists(v)): raise RuntimeError("kokoro models missing")
    global _K
    if _K is None: _K = Kokoro(m, v)
    k = _K; samples, sr = k.create(text, voice=cfg.get("kokoro_voice", "am_michael"), speed=cfg.get("speed", 1.08), lang="en-us")
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with w.open(out + ".raw.wav", "wb") as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes(pcm.tobytes())
    _to_wav(out + ".raw.wav", out)

def _espeak(text, out, cfg):
    subprocess.run(["espeak-ng", "-v", cfg.get("espeak_voice", "en-us+m3"), "-s", str(cfg.get("espeak_speed", 170)), "-p", "42", "-w", out + ".raw.wav", text], check=True); _to_wav(out + ".raw.wav", out)

ENGINES = {"piper": _piper, "kokoro": _kokoro, "espeak": _espeak}

def synth(text, out, cfg):
    order = [cfg["engine"]] if cfg.get("engine", "auto") != "auto" else ["kokoro", "piper", "espeak"]
    last = None
    for name in order:
        try: ENGINES[name](text, out, cfg); return name
        except Exception as e: last = e
    raise RuntimeError(f"no TTS engine worked: {last}")

def wav_len(p):
    with wave.open(p) as f: return f.getnframes() / f.getframerate()

def read_pcm(p):
    with wave.open(p) as f: return np.frombuffer(f.readframes(f.getnframes()), dtype="<i2").astype(np.float32) / 32768
