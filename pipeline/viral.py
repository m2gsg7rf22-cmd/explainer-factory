"""'What is going viral right now' topics, no API keys: top-of-the-day questions from r/explainlikeimfive (the exact 'how does X work?' format)
plus hot tech stories from Hacker News. Everything is filtered to safe, explainable subjects. Any failure just returns nothing (the queue then uses its normal sources)."""
import json, re, urllib.request, xml.etree.ElementTree as ET, html
UA = {"User-Agent": "Mozilla/5.0 (compatible; explainer-factory/1.0)"}
BLOCK = re.compile(r"\b(trump|biden|election|politic|war|gaza|ukraine|israel|palestin|nazi|sex|porn|rape|suicide|kill|murder|drug|cocaine|abortion|covid|vaccine|cancer|religio|god|racis|terror|shoot)\w*", re.I)
SHAPE = re.compile(r"^(eli5[:\s-]*)?(how|why|what)\b.*\?$", re.I)
def _get(url): return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read()
def eli5(limit=25):
    out = []
    try:
        for ch in json.loads(_get(f"https://www.reddit.com/r/explainlikeimfive/top.json?t=day&limit={limit}"))["data"]["children"]:
            d = ch["data"]; out.append((d["title"], d.get("ups", 0)))
    except Exception:
        try:
            root = ET.fromstring(_get("https://www.reddit.com/r/explainlikeimfive/top/.rss?t=day"))
            ns = "{http://www.w3.org/2005/Atom}"
            for i, e in enumerate(root.iter(ns + "entry")): out.append((e.findtext(ns + "title") or "", 1000 - i))
        except Exception as e: print("[viral] reddit failed:", str(e)[:80])
    return out
def hn(min_points=150):
    out = []
    try:
        for i in json.loads(_get("https://hacker-news.firebaseio.com/v0/topstories.json"))[:40]:
            it = json.loads(_get(f"https://hacker-news.firebaseio.com/v0/item/{i}.json"))
            if it and it.get("score", 0) >= min_points and it.get("title"): out.append((it["title"], it["score"], it.get("url", "")))
    except Exception as e: print("[viral] hn failed:", str(e)[:80])
    return out
def _clean(t): return re.sub(r"^eli5[:\s-]*", "", html.unescape(t).strip(), flags=re.I).strip()
def pick(used):
    """Best unused, safe, question-shaped trending topic -> {'topic','source'} or None."""
    for title, score in sorted(eli5(), key=lambda x: -x[1]):
        t = _clean(title)
        if SHAPE.match(title.strip()) or SHAPE.match(t):
            if BLOCK.search(t) or len(t) > 140 or len(t) < 15 or t in used: continue
            return {"topic": t, "source": "r/explainlikeimfive (top today)"}
    return None
if __name__ == "__main__":
    print("ELI5:", [(t, s) for t, s in eli5()][:8]); print("HN:", hn()[:6]); print("PICK:", pick(set()))
