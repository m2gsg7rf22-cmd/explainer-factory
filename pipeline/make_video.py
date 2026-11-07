"""storyboard.json -> finished vertical mp4 (voice + music + 3D animation + captions). Fully offline."""
import json, os, subprocess, sys, shutil, time, yaml
from . import timeline, music
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_cfg():
    return yaml.safe_load(open(os.path.join(ROOT, "config.yaml")))

def run(cmd, **kw):
    r = subprocess.run(cmd, **kw)
    if r.returncode: raise RuntimeError(f"command failed: {' '.join(map(str, cmd))[:200]}")

def make(storyboard_path, out_mp4=None, cfg=None, keep_frames=False, only_frames=None):
    cfg = cfg or load_cfg(); sb = json.load(open(storyboard_path)); sid = sb.get("id") or os.path.splitext(os.path.basename(storyboard_path))[0]
    sb["channel"] = dict(cfg["channel"]); 
    if sb["channel"].get("avatar"): sb["channel"]["avatar"] = "/" + sb["channel"]["avatar"].lstrip("/")
    work = os.path.join(ROOT, "out", "work", sid); os.makedirs(work, exist_ok=True)
    t0 = time.time()
    tl, narr = timeline.build(sb, work, {**cfg["tts"], "gap": 0.3})
    print(f"[{sid}] voice via {tl['engine']}: {tl['total']:.1f}s")
    sbp = os.path.join(work, "storyboard.json"); json.dump(sb, open(sbp, "w"))
    frames = os.path.join(work, "frames"); os.makedirs(frames, exist_ok=True)
    cmd = ["node", os.path.join(ROOT, "engine", "render.js"), sbp, os.path.join(work, "timeline.json"), frames, "--workers", str(cfg["render"]["workers"]), "--fps", str(cfg["render"]["fps"]), "--quality", str(cfg["render"]["quality"])]
    if only_frames: cmd += ["--only", only_frames]
    run(cmd, cwd=ROOT)
    if only_frames: return frames
    mix = os.path.join(work, "mix.wav"); mus = os.path.join(work, "music.wav")
    if cfg["render"].get("music", True):
        music.make(tl["total"] + 1, mus, seed=abs(hash(sid)) % 7)
        run(["ffmpeg", "-v", "error", "-y", "-i", narr, "-i", mus, "-filter_complex",
             "[0:a]loudnorm=I=-16:TP=-1.5:LRA=7,asplit=2[v][sc];[1:a]volume=0.20[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[v][md]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]",
             "-map", "[a]", "-ar", "44100", "-ac", "2", mix])
    else:
        run(["ffmpeg", "-v", "error", "-y", "-i", narr, "-af", "loudnorm=I=-16:TP=-1.5", "-ar", "44100", "-ac", "2", mix])
    out_mp4 = out_mp4 or os.path.join(ROOT, "out", "videos", f"{sid}.mp4"); os.makedirs(os.path.dirname(out_mp4), exist_ok=True)
    run(["ffmpeg", "-v", "error", "-y", "-framerate", str(cfg["render"]["fps"]), "-i", os.path.join(frames, "f%05d.jpg"), "-i", mix,
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out_mp4])
    if not keep_frames: shutil.rmtree(frames, ignore_errors=True)
    print(f"[{sid}] done in {time.time()-t0:.0f}s -> {out_mp4}")
    return out_mp4

if __name__ == "__main__":
    make(sys.argv[1], keep_frames="--keep" in sys.argv)
