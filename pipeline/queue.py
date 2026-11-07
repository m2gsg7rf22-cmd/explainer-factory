"""Decides what to publish next and keeps a buffer of finished videos. State lives in state.json."""
import json, os, glob, threading, datetime as dt
from . import make_video, scriptgen
ROOT = make_video.ROOT; STATE = os.path.join(ROOT, "state.json"); _lock = threading.Lock()

def load():
    return json.load(open(STATE)) if os.path.exists(STATE) else {"used": [], "ready": [], "posted": [], "topics_done": []}
def save(s): json.dump(s, open(STATE, "w"), indent=1)

def next_storyboard(cfg, s):
    bank = sorted(glob.glob(os.path.join(ROOT, "storyboards", "*.json"))) + sorted(glob.glob(os.path.join(ROOT, "storyboards", "generated", "*.json")))
    for p in bank:
        sid = os.path.splitext(os.path.basename(p))[0]
        if sid not in s["used"]: return sid, p
    if cfg["llm"]["enabled"]:
        tf = os.path.join(ROOT, cfg["llm"]["topics_file"])
        topics = [t.strip() for t in open(tf) if t.strip() and not t.startswith("#")] if os.path.exists(tf) else []
        for t in topics:
            if t not in s["topics_done"]:
                s["topics_done"].append(t); save(s)
                try:
                    p = scriptgen.generate(t, cfg); return os.path.splitext(os.path.basename(p))[0], p
                except Exception as e: print("[queue] skipping topic:", t, e)
    return None, None

def ensure_ready(cfg, n=3):
    """Render videos until n finished ones are waiting. Safe to call repeatedly."""
    with _lock:
        s = load(); s["ready"] = [r for r in s["ready"] if os.path.exists(r["video"])]
        while len(s["ready"]) < n:
            sid, p = next_storyboard(cfg, s)
            if not sid: print("[queue] OUT OF CONTENT: add storyboards or enable the local LLM"); break
            sb = json.load(open(p)); mp4 = make_video.make(p, cfg=cfg)
            s["used"].append(sid); s["ready"].append({"id": sid, "video": mp4, "caption": sb.get("ig_caption", sb.get("title", "")), "hashtags": sb.get("hashtags", [])}); save(s)
        return s

def pop_ready():
    with _lock:
        s = load()
        if not s["ready"]: return None
        r = s["ready"].pop(0); save(s); return r
def mark_posted(r):
    with _lock:
        s = load(); s["posted"].append({**r, "at": dt.datetime.now().isoformat(timespec="seconds")}); save(s)
