"""Optional: local LLM writes new storyboards (Ollama or any OpenAI-compatible local server, e.g. llama.cpp / LM Studio).
Every candidate is verified by the real renderer (preview) and retried with the error message if it breaks."""
import json, os, re, urllib.request, urllib.error
from .spec import SPEC
from . import make_video, preview

def _chat(cfg, system, user):
    l = cfg["llm"]
    if l["backend"] == "github_models":   # free inference for GitHub accounts; in Actions the built-in GITHUB_TOKEN works (permissions: models: read)
        tok = os.getenv("MODELS_TOKEN") or os.getenv("GITHUB_TOKEN"); last = None
        endpoints = [("https://models.github.ai/inference/chat/completions", l.get("models", [l["model"]])),
                     ("https://models.inference.ai.azure.com/chat/completions", [m.split("/")[-1] for m in l.get("models", [l["model"]])])]
        for url, models in endpoints:
            for model in models:
                body = {"model": model, "temperature": 0.7, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
                req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", "Accept": "application/vnd.github+json", "User-Agent": "explainer-factory/1.0", "Authorization": f"Bearer {tok}", "X-GitHub-Api-Version": "2022-11-28"})
                try:
                    resp = urllib.request.urlopen(req, timeout=300); raw = resp.read()
                    try: return json.loads(raw)["choices"][0]["message"]["content"]
                    except Exception: raise RuntimeError(f"HTTP {resp.status} bad body: {raw[:200]!r}")
                except urllib.error.HTTPError as e: last = e; print(f"[llm] {url.split('/')[2]} {model} HTTP {e.code}: {e.read()[:200]!r}")
                except Exception as e: last = e; print(f"[llm] {url.split('/')[2]} {model} failed: {str(e)[:200]}")
        raise RuntimeError(f"all GitHub Models endpoints failed: {last}")
    if l["backend"] == "ollama":
        body = {"model": l["model"], "stream": False, "format": "json", "options": {"temperature": 0.7, "num_ctx": 16384}, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        req = urllib.request.Request(l["url"] + "/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"})
        return json.load(urllib.request.urlopen(req, timeout=900))["message"]["content"]
    body = {"model": l["model"], "temperature": 0.7, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(l["url"].rstrip("/") + "/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=900))["choices"][0]["message"]["content"]

def _extract(txt):
    m = re.search(r"\{.*\}", txt, re.S)
    return json.loads(m.group(0)) if m else json.loads(txt)

def generate(topic, cfg, tries=4, context=None, source=None):
    root = make_video.ROOT; ex = open(os.path.join(root, "storyboards", "dishwasher.json")).read()
    ctx = (f"\n\nThis is a NEWS topic. Use ONLY facts stated in this source text; do not add numbers, dates or claims that are not in it; say 'according to {source}' once. Explain what it is and why it matters in plain English:\n{context}") if context else ""
    user = f"Write a storyboard for this topic: {topic}{ctx}\n\nA complete valid example (different topic, for format and quality only):\n{ex}"
    last_err = ""
    for k in range(tries):
        msg = user + (f"\n\nYour previous attempt failed: {last_err}\nFix it and output the full JSON again." if last_err else "")
        try:
            sb = _extract(_chat(cfg, SPEC, msg))
            words = sum(len(b["say"].split()) for b in sb["beats"])
            if words < 110 or len(sb["beats"]) < 8: raise ValueError(f"too short ({words} words, {len(sb['beats'])} beats); need 150-190 words and 9-16 beats")
            if source: sb["ig_caption"] = (sb.get("ig_caption", "") + f" Source: {source}").strip()
            sb["id"] = re.sub(r"[^a-z0-9_]+", "_", sb.get("id", topic).lower())[:40].strip("_") or "video"
            out = os.path.join(root, "storyboards", "generated"); os.makedirs(out, exist_ok=True); path = os.path.join(out, sb["id"] + ".json")
            json.dump(sb, open(path, "w"), indent=1); preview.preview(path, cfg)   # raises if the engine rejects it
            return path
        except Exception as e:
            last_err = str(e)[:600]; print(f"[scriptgen] attempt {k+1} failed: {last_err[:160]}")
    raise RuntimeError(f"could not generate a valid storyboard for '{topic}'")
