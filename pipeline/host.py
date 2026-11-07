"""Gives a rendered video a public URL (GitHub Release asset of this public repo) so Buffer can download it. Old releases are pruned."""
import subprocess, os, json, datetime as dt
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
