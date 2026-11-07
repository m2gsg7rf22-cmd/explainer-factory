"""Storyboard -> narration.wav + timeline.json (beat start/end, caption phrase timings)."""
import re, json, os, wave, numpy as np
from . import tts

def parse_say(say):
    """'Your *dishwasher* | uses less water.' -> spoken text, caption phrases [{text,hl,w}]"""
    phrases = []
    for chunk in [c.strip() for c in say.split("|") if c.strip()]:
        hl = re.findall(r"\*(.+?)\*", chunk); text = chunk.replace("*", "")
        phrases.append({"text": text, "hl": hl[0] if hl else None, "w": max(1, len(text))})
    spoken = " ".join(p["text"] for p in phrases)
    return spoken, phrases

def build(sb, workdir, cfg):
    os.makedirs(workdir, exist_ok=True)
    gap, lead = cfg.get("gap", 0.22), cfg.get("lead", 0.25)
    t = lead; beats = []; chunks = []; engine = None
    sr = tts.SR
    chunks.append(np.zeros(int(lead * sr), dtype=np.float32))
    for i, b in enumerate(sb["beats"]):
        spoken, phr = parse_say(b["say"]); wav = os.path.join(workdir, f"beat{i:02d}.wav")
        engine = tts.synth(spoken, wav, cfg); pcm = tts.read_pcm(wav)
        # trim leading/trailing silence a little so pacing feels tight
        nz = np.where(np.abs(pcm) > 0.01)[0]
        if len(nz): pcm = pcm[max(0, nz[0] - int(0.03 * sr)): nz[-1] + int(0.06 * sr)]
        dur = len(pcm) / sr; tot_w = sum(p["w"] for p in phr); acc = 0; caps = []
        for p in phr:
            caps.append({"text": p["text"], "hl": p["hl"], "at": round(dur * acc / tot_w, 3)}); acc += p["w"]
        beat_len = max(1.5, dur + gap)
        beats.append({"start": round(t, 3), "end": round(t + beat_len, 3), "caps": caps, "speech": round(dur, 3)})
        chunks.append(pcm); chunks.append(np.zeros(int((beat_len - dur) * sr), dtype=np.float32)); t += beat_len
    cta_len = cfg.get("cta_seconds", 2.8)
    # CTA card: optional spoken line
    cta_text = sb.get("channel", {}).get("cta_say", "")
    if cta_text:
        wav = os.path.join(workdir, "cta.wav"); tts.synth(cta_text, wav, cfg); pcm = tts.read_pcm(wav); chunks.append(pcm); cta_len = max(cta_len, len(pcm) / sr + 0.6)
    tl = {"beats": beats, "ctaStart": round(t, 3), "total": round(t + cta_len, 3), "engine": engine}
    audio = np.concatenate(chunks); total_samples = int(tl["total"] * sr)
    audio = np.pad(audio, (0, max(0, total_samples - len(audio))))[:total_samples]
    path = os.path.join(workdir, "narration.wav")
    with wave.open(path, "wb") as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
    json.dump(tl, open(os.path.join(workdir, "timeline.json"), "w"), indent=1)
    return tl, path
