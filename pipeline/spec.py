"""The vocabulary an LLM (or a human) can use to write a storyboard. Kept as text so it can be pasted into any local model."""
SPEC = r"""
You write storyboards (JSON) for 45-70 second vertical explainer videos in the style of a premium 3D "hologram" explainer channel.
Topic style: an everyday object/technology, one simple question, a surprising hook, then a clear step-by-step mechanism. English only.

OUTPUT: one JSON object, nothing else:
{"id": "snake_case_id", "title": "...", "ig_caption": "2 short sentences + question", "hashtags": ["#..",".."],
 "objects": [ {"prefab": NAME, "id": "unique", "pos": [x,y,z], "rot": [rx,ry,rz], "scale": 1.0, "hidden": false, + prefab options} ... ],
 "beats": [ {"say": "...", "cam": {...}, "fx": [ ... ]} ... ] }

RULES FOR "say" (one sentence or two per beat, 9-16 beats, 150-190 words total):
 - Beat 1 is a HOOK: a surprising fact or myth-bust, then a promise ("Here's how.").
 - Use "|" to split the sentence into on-screen caption phrases of 2-6 words each. Wrap the single most important word in *stars* to show it in red (max one per beat).
 - Plain spoken English, short sentences, no jargon without explanation, only facts you are sure are true. Last beat: a neat one-line takeaway.
 - Example: "Your dishwasher uses *less water* | than washing by hand. | Here's the trick."

PREFABS (units ~ meters; y is up; floor is y=0). Use "scale" to enlarge small things (airtag, phone, chip -> 1.5-2.5):
 phone{screen:lock|home|airplane|wifi|search|text|map|off, text, xray:true} parts: body screen chip battery antenna camera top
 router parts: body leds antenna1 antenna2 antenna3 tip1 tip2 tip3      airtag parts: shell battery chip speaker antenna top
 dishwasher{doorOpen} parts: body floor lowerRack upperRack plates mugs sprayArm hub heater pump door detergent upperSpray
 person{sit:true, cloth:"#hex", skin:"#hex"} parts: torso head eyes handL handR      tower parts: mast tip top
 server parts: leds stack     plane parts: body wingL tail nose engineL engineR      laptop parts: base lid screen
 headphones parts: band cupL cupR micL micR padL padR ear      microwave parts: body turntable cup water magnetron door mouth
 globe parts: sphere     satellite parts: body dish     cloud     lock parts: body shackle     battery parts: body charge
 magnet parts: body     bulb parts: glass filament     gear parts: body     chip parts: body core     coffee parts: cup liquid
 mag (magnifier) parts: lens glass     sign{text,w,h} parts: plane (floating text plaque)
 primitives: {"type":"box|rbox|cyl|sphere|torus|cone|capsule|disc|plane","size":[w,h,d] or "r","h","mat":"glass|solid|glow|white","color":"#hex","pos":[..],"id":".."}
 groups: {"type":"group","children":[...]}
A part is addressed as "<objectId>.<part>", e.g. "dw.sprayArm". An anchor is an id, a part, a point [x,y,z], or {"on":id,"off":[x,y,z]}.

CAMERA per beat: {"look": anchor, "dist": 2-12, "az": degrees(-60..60), "el": degrees(5..40), "orbit": degrees swept during the beat (-30..30), "dolly": 0-1}.
 Change the shot every beat. Small objects: dist 2-4. Scenes with far objects: dist 9-14.

FX per beat (all optional; "at" = seconds after beat start, "dur" = seconds, defaults to rest of beat; color = hex; make something happen in EVERY beat):
 {"t":"ring","on":anchor,"r":1.0,"n":3,"color":"#6ac1ff","face":"cam"}   expanding signal rings
 {"t":"beam","from":anchor,"to":anchor,"arc":0.5,"color":".."}            glowing arc that draws itself
 {"t":"flow","from":anchor,"to":anchor,"n":50,"spread":0.3,"arc":0.0,"color":".."}   moving particle stream
 {"t":"arrow","from":anchor,"to":anchor}   {"t":"pulse","on":anchor,"r":0.2}   {"t":"sparkle","on":anchor,"r":0.6,"n":50,"color":".."}
 {"t":"rain","on":anchor,"w":1,"h":1.2,"n":80}   {"t":"wave","from":anchor,"to":anchor,"amp":0.2,"freq":5,"inv":false,"color":".."}
 {"t":"label","on":anchor,"text":"Heating element","sub":"optional","dy":-120}    {"t":"stat","value":"60°C","sub":"wash temperature"}
 object animation: {"t":"move","obj":id,"to":[x,y,z]} {"t":"rot","obj":id,"by":[rx,ry,rz]} {"t":"scale","obj":id,"to":1.5} {"t":"fade","obj":id,"to":0..1} {"t":"color","obj":id,"to":"#hex"} {"t":"spin","obj":id,"rps":0.5}
 Objects with "hidden":true start invisible; reveal them with fade. Put at most 2 labels/stats on screen per beat.
"""
