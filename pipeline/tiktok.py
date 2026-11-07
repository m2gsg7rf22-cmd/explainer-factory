"""TikTok posting through a logged-in browser session (TikTok Studio web uploader). Same idea as instagram.py: no API."""
import os, re, time, random, json
from playwright.sync_api import sync_playwright
from . import make_video
ROOT = make_video.ROOT
def _pause(a=0.8, b=2.0): time.sleep(random.uniform(a, b))
def _launch(p, cfg, headless):
    st = os.getenv("TT_STORAGE_STATE")
    if st:
        b = p.chromium.launch(headless=True); ctx = b.new_context(storage_state=json.loads(st), locale="en-US", viewport={"width": 1366, "height": 900}); ctx._browser_ref = b; return ctx
    return p.chromium.launch_persistent_context(os.path.join(ROOT, cfg["tiktok"]["profile_dir"]), headless=headless, locale="en-US", viewport={"width": 1366, "height": 900})
def _logged_in(ctx): return any(c["name"] in ("sessionid", "sessionid_ss") and "tiktok.com" in c["domain"] for c in ctx.cookies())

def login(cfg):
    with sync_playwright() as p:
        ctx = _launch(p, cfg, headless=False); page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://www.tiktok.com/login"); print("Log in to TikTok in the window (any method, incl. QR / 2FA). Waiting up to 10 minutes...")
        t0 = time.time()
        while time.time() - t0 < 600 and not _logged_in(ctx): time.sleep(2)
        ok = _logged_in(ctx)
        if ok: _pause(2, 3); ctx.storage_state(path=os.path.join(ROOT, "tt_state.json"))
        ctx.close(); print("LOGIN SAVED" if ok else "login not completed"); return ok

def post(cfg, video, caption, dry_run=None):
    tt = cfg["tiktok"]; dry = tt.get("dry_run", True) if dry_run is None else dry_run
    with sync_playwright() as p:
        ctx = _launch(p, cfg, headless=tt.get("headless", True)); page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto("https://www.tiktok.com/tiktokstudio/upload?from=webapp"); _pause(3, 5)
            if not _logged_in(ctx): raise RuntimeError("not logged in - run: python run.py tt-login")
            page.locator('input[type="file"]').first.set_input_files(os.path.abspath(video)); _pause(4, 6)
            ed = page.locator('div[contenteditable="true"]').first; ed.wait_for(state="visible", timeout=120000); ed.click(); page.keyboard.press("ControlOrMeta+A"); page.keyboard.type(caption[:2000], delay=random.randint(10, 30)); _pause(1, 2)
            btn = page.get_by_role("button", name=re.compile(r"^Post$", re.I)).first
            for _ in range(60):   # wait until upload finished and the button is enabled
                if btn.is_enabled(): break
                time.sleep(5)
            os.makedirs(os.path.join(ROOT, "out", "logs"), exist_ok=True); page.screenshot(path=os.path.join(ROOT, "out", "logs", "tt_last_before_post.png"))
            if dry: print("DRY RUN: stopped before Post"); return "dry_run"
            btn.click(); _pause(2, 3)
            try: page.get_by_role("button", name=re.compile(r"post now", re.I)).first.click(timeout=5000)
            except Exception: pass
            page.get_by_text(re.compile(r"(Video uploaded|being uploaded|Manage your posts|Your video)", re.I)).first.wait_for(timeout=180000); print("POSTED"); return "posted"
        finally:
            ctx.close()
