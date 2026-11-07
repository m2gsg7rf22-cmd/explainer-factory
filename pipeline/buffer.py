"""Publish through Buffer (the user's connected Instagram + TikTok channels). Needs the BUFFER_API_KEY secret (Buffer > Settings > API).
NOTE: written against Buffer's GraphQL API from its documentation; run `python run.py buffer-check` once to verify the schema."""
import os, json, urllib.request
URL = "https://api.buffer.com"
def _gql(query, variables=None):
    key = os.getenv("BUFFER_API_KEY")
    if not key: raise RuntimeError("BUFFER_API_KEY is not set")
    req = urllib.request.Request(URL, json.dumps({"query": query, "variables": variables or {}}).encode(), {"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    out = json.load(urllib.request.urlopen(req, timeout=60))
    if out.get("errors"): raise RuntimeError("Buffer GraphQL error: " + json.dumps(out["errors"])[:600])
    return out["data"]

CREATE = """mutation Create($input: CreatePostInput!) { createPost(input: $input) { __typename ... on PostActionSuccess { post { id status dueAt } } ... on MutationError { message } } }"""

def publish(cfg, video_url, caption, title, hashtags, live):
    """One post per configured channel. live=False -> saved as DRAFT in Buffer (safe test mode)."""
    res = {}
    for name, ch in cfg["buffer"]["channels"].items():
        inp = {"channelId": ch, "schedulingType": "automatic", "mode": "shareNow", "text": caption + ("\n\n" + " ".join(hashtags) if hashtags else ""), "needsApproval": False, "aiAssisted": True, "assets": [{"video": {"url": video_url}}]}
        if name == "instagram": inp["metadata"] = {"instagram": {"type": "reel", "shouldShareToFeed": True, "isAiGenerated": True}}
        if name == "tiktok": inp["metadata"] = {"tiktok": {"title": title[:90], "isAiGenerated": True}}; inp["text"] = caption[:150] + " " + " ".join(hashtags[:4])
        if not live: inp["saveToDraft"] = True
        r = _gql(CREATE, {"input": inp})["createPost"]
        if r["__typename"] != "PostActionSuccess": raise RuntimeError(f"Buffer rejected {name}: {r}")
        res[name] = r["post"]["id"]
    return res

def check():
    """Prints the live schema bits we depend on, so mismatches are visible in one run."""
    d = _gql('{ __type(name:"Mutation"){ fields { name type { name kind possibleTypes { name } } } } }')
    print("createPost ->", json.dumps([f for f in d["__type"]["fields"] if f["name"] == "createPost"])[:700])
    for t in ("AssetInput", "CreatePostInput", "PostActionSuccess"):
        d = _gql('query($n:String!){__type(name:$n){name inputFields{name type{name kind ofType{name kind ofType{name}}}} fields{name}}}', {"n": t})
        print(t, "->", json.dumps(d["__type"])[:1800])
