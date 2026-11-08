"""Gives a rendered video a public URL (GitHub Release asset of this public repo) so Buffer can download it. Old releases are pruned."""
import subprocess, os, json, shutil, tempfile, time, urllib.request, datetime as dt
def _gh(*a, **k): return subprocess.run(["gh", *a], capture_output=True, text=True, **k)
def repo():
    return os.getenv("GITHUB_REPOSITORY") or _gh("repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner").stdout.strip()
def upload(path, vid):
    r = repo(); tag = f"v-{vid}-{dt.datetime.utcnow():%Y%m%d%H%M}"
    out = _gh("release", "create", tag, path, "--repo", r, "--title", vid, "--notes", "AI-generated explainer video (auto)")
    if out.returncode: raise RuntimeError("release upload failed: " + out.stderr[-300:])
    return f"https://github.com/{r}/releases/download/{tag}/{os.path.basename(path)}"
def prune(keep_days=10):
    r = repo(); cut = dt.datetime.utcnow() - dt.timedelta(days=keep_days)
    for rel in json.loads(_gh("release", "list", "--repo", r, "--limit", "200", "--json", "tagName,createdAt").stdout or "[]"):
        if dt.datetime.fromisoformat(rel["createdAt"].replace("Z", "")) < cut: _gh("release", "delete", rel["tagName"], "--repo", r, "--cleanup-tag", "--yes")

def reachable(url, tries=4):
    """True once the URL answers 200 with video bytes (GitHub release assets can lag right after upload)."""
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Range": "bytes=0-1023", "User-Agent": "explainer-factory"})
            r = urllib.request.urlopen(req, timeout=30)
            if r.status in (200, 206) and len(r.read(64)) > 0: return True
        except Exception: pass
        time.sleep(10 * (i + 1))
    return False

def raw(path):
    """Fallback host: single-commit branch 'media-feed' (force-pushed, no history growth) served by raw.githubusercontent.com (no redirects)."""
    r = repo(); tmp = tempfile.mkdtemp(); shutil.copy(path, os.path.join(tmp, "video.mp4"))
    tok = os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN")
    for cmd in (["init", "-q", "-b", "media-feed"], ["config", "user.name", "explainer-bot"], ["config", "user.email", "bot@users.noreply.github.com"], ["add", "video.mp4"], ["commit", "-q", "-m", "media"],
                ["push", "-q", "--force", f"https://x-access-token:{tok}@github.com/{r}.git", "media-feed"]):
        out = subprocess.run(["git", "-C", tmp, *cmd], capture_output=True, text=True)
        if out.returncode: raise RuntimeError("raw host failed: " + out.stderr[-200:].replace(tok or "x", "***"))
    return f"https://raw.githubusercontent.com/{r}/media-feed/video.mp4?v={int(time.time())}"
