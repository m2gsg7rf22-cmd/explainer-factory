#!/usr/bin/env python3
"""explainer-factory CLI.   python run.py --help"""
import argparse, os, sys, time, json, threading, datetime as dt, subprocess
ROOT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ROOT); os.chdir(ROOT)
def _env():
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for l in open(p):
            if "=" in l and not l.startswith("#"): k, v = l.strip().split("=", 1); os.environ.setdefault(k, v.strip('"\''))
_env()
from pipeline import make_video, preview, queue, scriptgen

def caption_for(r): return (r["caption"] + "\n\n" + " ".join(r.get("hashtags", []))).strip()

def post_one(cfg, r):
    """Post to every enabled platform. LIVE=1 (env / repo variable) switches off dry-run and enables platforms whose session exists."""
    live = os.getenv("LIVE") == "1"; res = []
    for name, env in (("instagram", "IG_STORAGE_STATE"), ("tiktok", "TT_STORAGE_STATE")):
        c = cfg.get(name, {})
        if not (c.get("enabled") or (live and os.getenv(env))): continue
        mod = __import__("pipeline." + name, fromlist=["post"]); cap = caption_for(r) if name == "instagram" else (r["caption"] + " " + " ".join(r.get("hashtags", [])))
        try: res.append(mod.post(cfg, r["video"], cap, dry_run=False if live else None))
        except Exception as e: print(f"[post] {name} FAILED:", e); res.append("failed")
    if not res: print("[post] no platform enabled -> kept for manual upload:", r["video"]); return "manual"
    return "posted" if "posted" in res else ("dry_run" if "dry_run" in res else "failed")

def once(cfg):
    """Render ONE video and post it (used by the GitHub Actions workflow, 3 runs per day)."""
    s = queue.ensure_ready(cfg, 1); r = queue.pop_ready()
    if not r: print("OUT OF CONTENT"); sys.exit(2)
    st = post_one(cfg, r); print("RESULT", r["id"], st)
    if st in ("posted", "manual"): queue.mark_posted(r)
    elif st == "dry_run": queue.mark_posted({**r, "dry_run": True})
    else: queue.save({**queue.load(), "ready": [r] + queue.load()["ready"]}); sys.exit(1)

def export_secrets(cfg):
    """Pushes the saved browser sessions to GitHub Actions secrets (needs: gh auth login). Values never leave your machine except to GitHub."""
    repo = os.getenv("GH_REPO") or subprocess.run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], capture_output=True, text=True).stdout.strip()
    for f, name in (("ig_state.json", "IG_STORAGE_STATE"), ("tt_state.json", "TT_STORAGE_STATE")):
        if os.path.exists(f): subprocess.run(["gh", "secret", "set", name, "--repo", repo], stdin=open(f), check=True); print("secret set:", name, "->", repo)
    print("Now set the repo variable LIVE_POSTING=1 when you want real posting: gh variable set LIVE_POSTING --body 1 --repo", repo)

def serve(cfg):
    print("serving. slots:", cfg["schedule"]["times"]); done = set(); busy = {"v": False}
    def refill():
        if busy["v"]: return
        busy["v"] = True
        try: queue.ensure_ready(cfg, cfg["schedule"]["videos_per_day"])
        except Exception as e: print("[refill] error:", e)
        finally: busy["v"] = False
    threading.Thread(target=refill, daemon=True).start()
    while True:
        now = dt.datetime.now()
        for t in cfg["schedule"]["times"]:
            key = f"{now.date()} {t}"; hh, mm = map(int, t.split(":")); slot = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
            if key in done or now < slot or (now - slot).total_seconds() > 6 * 3600: continue
            r = queue.pop_ready()
            if not r: print("[serve] no finished video yet for", key, "- waiting"); threading.Thread(target=refill, daemon=True).start(); continue
            done.add(key)
            try: st = post_one(cfg, r); print("[serve]", key, r["id"], st)
            except Exception as e: print("[serve] POST FAILED", key, e); queue.save({**queue.load(), "ready": [r] + queue.load()["ready"]}); done.discard(key); time.sleep(600)
            else:
                if st in ("posted", "manual"): queue.mark_posted(r)
            threading.Thread(target=refill, daemon=True).start()
        time.sleep(30)

def install_service():
    py = sys.executable
    if sys.platform == "darwin":
        pl = os.path.expanduser("~/Library/LaunchAgents/com.explainer.factory.plist")
        open(pl, "w").write(f"""<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>Label</key><string>com.explainer.factory</string><key>ProgramArguments</key><array><string>{py}</string><string>{ROOT}/run.py</string><string>serve</string></array>
<key>WorkingDirectory</key><string>{ROOT}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardOutPath</key><string>{ROOT}/out/serve.log</string><key>StandardErrorPath</key><string>{ROOT}/out/serve.log</string></dict></plist>""")
        os.makedirs(os.path.join(ROOT, "out"), exist_ok=True); subprocess.run(["launchctl", "unload", pl], capture_output=True); subprocess.run(["launchctl", "load", pl]); print("installed launchd agent:", pl)
    else:
        d = os.path.expanduser("~/.config/systemd/user"); os.makedirs(d, exist_ok=True)
        open(f"{d}/explainer-factory.service", "w").write(f"[Unit]\nDescription=explainer-factory\n[Service]\nWorkingDirectory={ROOT}\nExecStart={py} {ROOT}/run.py serve\nRestart=always\n[Install]\nWantedBy=default.target\n")
        subprocess.run(["systemctl", "--user", "daemon-reload"]); subprocess.run(["systemctl", "--user", "enable", "--now", "explainer-factory"]); print("installed systemd user service")

def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    for n in ("make", "preview", "gen", "ig-post"): sp.add_parser(n).add_argument("arg", nargs="+")
    for n in ("queue", "serve", "ig-login", "tt-login", "once", "export-secrets", "install-service", "status"): sp.add_parser(n)
    a = ap.parse_args(); cfg = make_video.load_cfg()
    if a.cmd == "make": make_video.make(a.arg[0], cfg=cfg)
    elif a.cmd == "preview": preview.preview(a.arg[0], cfg)
    elif a.cmd == "gen": print(scriptgen.generate(" ".join(a.arg), cfg))
    elif a.cmd == "queue": queue.ensure_ready(cfg, cfg["schedule"]["videos_per_day"])
    elif a.cmd == "serve": serve(cfg)
    elif a.cmd == "ig-login":
        from pipeline import instagram; instagram.login(cfg)
    elif a.cmd == "tt-login":
        from pipeline import tiktok; tiktok.login(cfg)
    elif a.cmd == "once": once(cfg)
    elif a.cmd == "export-secrets": export_secrets(cfg)
    elif a.cmd == "ig-post":
        from pipeline import instagram; print(instagram.post(cfg, a.arg[0], " ".join(a.arg[1:]) or "test", dry_run=None))
    elif a.cmd == "install-service": install_service()
    elif a.cmd == "status": s = queue.load(); print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in s.items()}, indent=1)); print("ready:", [r["id"] for r in s["ready"]])
main()
