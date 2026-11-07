"""Fresh 'what's new in AI' topics from public RSS feeds (no API keys). Items already used are remembered in state.json."""
import urllib.request, xml.etree.ElementTree as ET, re, html
FEEDS = [
    "https://techcrunch.com/category/artificial-intelligence/feed/",
    "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    "https://openai.com/news/rss.xml",
    "https://blog.google/technology/ai/rss/",
    "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    "https://venturebeat.com/category/ai/feed/",
]
def _clean(t): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t or ""))).strip()
def fetch(feeds=None, limit=6):
    items = []
    for url in feeds or FEEDS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 explainer-factory"})
            root = ET.fromstring(urllib.request.urlopen(req, timeout=20).read())
            src = re.sub(r"^www\.", "", url.split("/")[2])
            for it in root.iter("item"):
                items.append({"title": _clean(it.findtext("title")), "summary": _clean(it.findtext("description"))[:700], "link": (it.findtext("link") or "").strip(), "source": src})
                if len([i for i in items if i["source"] == src]) >= limit: break
        except Exception as e:
            print("[news] feed failed:", url, str(e)[:80])
    return [i for i in items if i["title"] and i["link"]]
def pick_unused(used_links, feeds=None):
    for it in fetch(feeds):
        if it["link"] not in used_links and len(it["summary"]) > 60: return it
    return None
