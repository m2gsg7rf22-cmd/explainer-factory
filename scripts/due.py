"""Decides whether a publishing slot is due right now (Israel time) and not yet done. Used by the lightweight 'check' job so the heavy render job only runs when needed.
Cron runs every 30 minutes; if GitHub delays or skips a run, the next one catches the missed slot up (max 3 h late)."""
import json, os, re, sys, datetime as dt
from zoneinfo import ZoneInfo
import yaml
times = yaml.safe_load(open("config.yaml"))["schedule"]["times"]
state = json.load(open("state.json")) if os.path.exists("state.json") else {}
done = set(state.get("slots_done", []))
now = dt.datetime.now(ZoneInfo("Asia/Jerusalem")); due = None
for t in times:
    hh, mm = map(int, t.split(":")); slot = now.replace(hour=hh, minute=mm, second=0, microsecond=0); key = f"{now.date()} {t}"
    if now >= slot and (now - slot).total_seconds() <= 3 * 3600 and key not in done: due = key; break
force = os.getenv("FORCE") == "1"
print("now", now.isoformat(timespec="minutes"), "slots", times, "due", due, "force", force)
with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as f:
    f.write(f"due={'true' if (due or force) else 'false'}\nslot={due or 'manual-' + now.strftime('%Y%m%d%H%M')}\n")
