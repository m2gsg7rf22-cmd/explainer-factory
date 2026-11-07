"""Optional: local LLM writes new storyboards (Ollama or any OpenAI-compatible local server, e.g. llama.cpp / LM Studio).
Every candidate is verified by the real renderer (preview) and retried with the error message if it breaks."""
import json, os, re, urllib.request
from .spec import SPEC
from . import make_video, preview

def _chat(cfg, system, user):
    l = cfg["llm"]
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

def generate(topic, cfg, tries=4):
    root = make_video.ROOT; ex = open(os.path.join(root, "storyboards", "dishwasher.json")).read()
    user = f"Write a storyboard for this topic: {topic}\n\nA complete valid example (different topic, for format and quality only):\n{ex}"
    last_err = ""
    for k in range(tries):
        msg = user + (f"\n\nYour previous attempt failed: {last_err}\nFix it and output the full JSON again." if last_err else "")
        try:
            sb = _extract(_chat(cfg, SPEC, msg))
            words = sum(len(b["say"].split()) for b in sb["beats"])
            if words < 110 or len(sb["beats"]) < 8: raise ValueError(f"too short ({words} words, {len(sb['beats'])} beats); need 150-190 words and 9-16 beats")
            sb["id"] = re.sub(r"[^a-z0-9_]+", "_", sb.get("id", topic).lower())[:40].strip("_") or "video"
            out = os.path.join(root, "storyboards", "generated"); os.makedirs(out, exist_ok=True); path = os.path.join(out, sb["id"] + ".json")
            json.dump(sb, open(path, "w"), indent=1); preview.preview(path, cfg)   # raises if the engine rejects it
            return path
        except Exception as e:
            last_err = str(e)[:600]; print(f"[scriptgen] attempt {k+1} failed: {last_err[:160]}")
    raise RuntimeError(f"could not generate a valid storyboard for '{topic}'")
