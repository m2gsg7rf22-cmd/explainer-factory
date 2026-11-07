"""Fast storyboard check: renders one frame per beat (+ end card) and tiles them. Also catches bad anchors/prefabs."""
import json, os, subprocess, glob, sys
from . import make_video, timeline

def preview(path, cfg=None):
    cfg = cfg or make_video.load_cfg(); sb = json.load(open(path)); sb["channel"] = dict(cfg["channel"]); sb["channel"]["avatar"] = ("/" + sb["channel"]["avatar"].lstrip("/")) if sb["channel"].get("avatar") else ""; sid = sb["id"]
    work = os.path.join(make_video.ROOT, "out", "work", sid + "_prev"); os.makedirs(work, exist_ok=True)
    tl, _ = timeline.build(sb, work, {**cfg["tts"], "gap": 0.2})
    sbp = os.path.join(work, "storyboard.json"); json.dump(sb, open(sbp, "w"))
    fps = cfg["render"]["fps"]; ids = [int((b["start"] + (b["end"] - b["start"]) * 0.6) * fps) for b in tl["beats"]] + [int((tl["ctaStart"] + 1.5) * fps)]
    fr = os.path.join(work, "frames"); os.makedirs(fr, exist_ok=True)
    r = subprocess.run(["node", os.path.join(make_video.ROOT, "engine", "render.js"), sbp, os.path.join(work, "timeline.json"), fr, "--workers", "4", "--only", ",".join(map(str, ids))], capture_output=True, text=True, cwd=make_video.ROOT)
    if r.returncode or "PAGEERR" in r.stderr or any(l.startswith("CONSOLE") and "404" not in l for l in r.stderr.splitlines()): raise RuntimeError("storyboard invalid:\n" + (r.stderr or r.stdout)[-1500:])
    out = os.path.join(make_video.ROOT, "out", f"preview_{sid}.jpg"); cols = min(len(ids), 5)
    files = [os.path.join(fr, f"f{i:05d}.jpg") for i in ids]
    from PIL import Image
    ims = [Image.open(f).resize((300, 533)) for f in files]; rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (300 * cols, 533 * rows))
    for k, im in enumerate(ims): sheet.paste(im, ((k % cols) * 300, (k // cols) * 533))
    sheet.save(out, quality=88)
    print("beats:", len(tl["beats"]), "duration:", tl["total"], "->", out); return out

if __name__ == "__main__": preview(sys.argv[1])
