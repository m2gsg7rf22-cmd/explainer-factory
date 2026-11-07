"""Instagram posting through a real logged-in browser session (no API, no tokens).
Login once with `python run.py ig-login`; the session cookie is kept in config instagram.profile_dir and re-used."""
import os, re, time, random, json
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
from . import make_video
ROOT = make_video.ROOT

def _profile(cfg): return os.path.join(ROOT, cfg["instagram"]["profile_dir"])
def _launch(p, cfg, headless):
    """Local: persistent profile folder. CI (GitHub Actions): session JSON from the IG_STORAGE_STATE secret."""
    st = os.getenv("IG_STORAGE_STATE")
    if st:
        b = p.chromium.launch(headless=True); ctx = b.new_context(storage_state=json.loads(st), locale="en-US", viewport={"width": 1280, "height": 900}); ctx._browser_ref = b; return ctx
    return p.chromium.launch_persistent_context(_profile(cfg), headless=headless, locale="en-US", viewport={"width": 1280, "height": 900})
def _logged_in(ctx): return any(c["name"] == "sessionid" and "instagram.com" in c["domain"] for c in ctx.cookies())
def _pause(a=0.8, b=2.0): time.sleep(random.uniform(a, b))

def _dismiss_popups(page):
    for name in ("Not now", "Not Now", "Save info", "Allow all cookies", "Decline optional cookies", "Accept"):
        try:
            b = page.get_by_role("button", name=re.compile(f"^{name}$", re.I)).first
            if b.is_visible(timeout=600): b.click(); _pause(0.5, 1.2)
        except Exception: pass

def login(cfg):
    """Opens a visible browser. Fill username/password yourself (supports 2FA) or let IG_USER / IG_PASS (env or .env) autofill."""
    ig = cfg["instagram"]; user, pw = os.getenv(ig["username_env"]), os.getenv(ig["password_env"])
    with sync_playwright() as p:
        ctx = _launch(p, cfg, headless=False); page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://www.instagram.com/accounts/login/"); _pause(2, 3); _dismiss_popups(page)
        if user and pw and not _logged_in(ctx):
            try:
                page.locator('input[name="username"]').fill(user); _pause(); page.locator('input[name="password"]').fill(pw); _pause(); page.keyboard.press("Enter")
            except Exception as e: print("autofill failed, please log in by hand:", e)
        print("Waiting for you to finish logging in (2FA / checkpoints included)... up to 10 minutes")
        t0 = time.time()
        while time.time() - t0 < 600 and not _logged_in(ctx): time.sleep(2); _dismiss_popups(page)
        ok = _logged_in(ctx)
        if ok: _pause(2, 3); ctx.storage_state(path=os.path.join(ROOT, "ig_state.json"))   # used by: python run.py export-secrets
        ctx.close(); print("LOGIN SAVED" if ok else "login not completed"); return ok

def _click(page, pattern, timeout=15000, role="button"):
    loc = page.get_by_role(role, name=re.compile(pattern, re.I)).first
    loc.wait_for(state="visible", timeout=timeout); _pause(0.6, 1.4); loc.click()

def post(cfg, video, caption, dry_run=None):
    ig = cfg["instagram"]; dry = ig.get("dry_run", True) if dry_run is None else dry_run
    with sync_playwright() as p:
        ctx = _launch(p, cfg, headless=ig.get("headless", True)); page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto("https://www.instagram.com/"); _pause(2, 4); _dismiss_popups(page)
            if not _logged_in(ctx): raise RuntimeError("not logged in - run: python run.py ig-login")
            # 1. open the create dialog
            page.locator('svg[aria-label="New post"]').first.click(); _pause()
            try: page.get_by_role("link", name=re.compile(r"^Post$", re.I)).first.click(timeout=3000)
            except Exception: pass
            # 2. choose the file
            with page.expect_file_chooser(timeout=20000) as fc:
                try: page.get_by_role("button", name=re.compile(r"select from computer", re.I)).first.click(timeout=8000)
                except Exception: page.locator('input[type="file"]').first.evaluate("e => e.click()")
            fc.value.set_files(os.path.abspath(video)); _pause(3, 5)
            try: _click(page, r"^OK$", 4000)                      # "video posts are now shared as reels" notice
            except Exception: pass
            # 3. crop -> edit -> details
            for _ in range(2): _click(page, r"^Next$", 120000); _pause(1.5, 3)
            box = page.locator('div[role="textbox"][aria-label*="aption" i]').first
            box.wait_for(state="visible", timeout=30000); box.click(); page.keyboard.type(caption, delay=random.randint(12, 35)); _pause(1, 2)
            os.makedirs(os.path.join(ROOT, "out", "logs"), exist_ok=True); page.screenshot(path=os.path.join(ROOT, "out", "logs", "ig_last_before_share.png"))
            if dry: print("DRY RUN: stopped before Share (see out/logs/ig_last_before_share.png)"); return "dry_run"
            _click(page, r"^Share$", 20000)
            page.get_by_text(re.compile(r"(Your reel has been shared|Your post has been shared|Reel shared|Post shared)", re.I)).first.wait_for(timeout=300000)
            page.screenshot(path=os.path.join(ROOT, "out", "logs", "ig_last_shared.png")); print("POSTED"); return "posted"
        finally:
            ctx.close()
