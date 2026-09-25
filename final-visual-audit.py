from pathlib import Path
import hashlib, json, sys

ROOT=Path(__file__).resolve().parent
QA=ROOT/"qa-final-visual"
MANIFEST=QA/"manifest.json"
issues=[]
metrics={}

required=[
    "INNO-One-Final-Visual-QA-Baseline.md",
    "qa-final-visual.py",
    "design-system.html",
    "inno-design-contract.js",
    "inno-inputs.js",
    "INNO-One-Design-System-V1-Frozen.md",
]
for name in required:
    if not (ROOT/name).exists(): issues.append(f"missing final baseline source: {name}")

if not MANIFEST.exists():
    issues.append("missing qa-final-visual/manifest.json")
    data={"web":{},"surfaces":{},"states":{},"summary":{}}
else:
    data=json.loads(MANIFEST.read_text(encoding="utf-8"))

web=data.get("web",{})
surfaces=data.get("surfaces",{})
states=data.get("states",{})
summary=data.get("summary",{})
metrics.update({
    "web_routes":len(web),
    "surface_routes":len(surfaces),
    "state_screenshots":len(states),
    "route_screenshots":summary.get("routeScreenshots",0),
})

if len(web)!=93:issues.append(f"expected 93 Web routes, found {len(web)}")
if len(surfaces)!=4:issues.append(f"expected 4 reference/external surfaces, found {len(surfaces)}")
if len(states)!=14:issues.append(f"expected 14 important states, found {len(states)}")
if summary.get("routeScreenshots")!=97:issues.append(f"expected 97 route screenshots, found {summary.get('routeScreenshots')}")
if summary.get("stateScreenshots")!=14:issues.append(f"expected 14 state screenshots, found {summary.get('stateScreenshots')}")
if summary.get("failures")!=0:issues.append(f"manifest recorded failures={summary.get('failures')}")

allowed_dead={"device-alerts.html","remote-consent-rules.html","remote-session.html"}
for page,m in web.items():
    if m.get("overflow"):issues.append(f"{page}: page overflow")
    if m.get("railActive")!=1:issues.append(f"{page}: rail active={m.get('railActive')}")
    if m.get("sideActive")!=1:issues.append(f"{page}: side active={m.get('sideActive')}")
    if m.get("rawPlaceholders")!=0:issues.append(f"{page}: raw placeholders={m.get('rawPlaceholders')}")
    if m.get("contract")!="1.20.0":issues.append(f"{page}: contract={m.get('contract')}")
    if m.get("status")!="frozen":issues.append(f"{page}: contract status={m.get('status')}")
    if m.get("primaryHead",0)>1:issues.append(f"{page}: page-head primary={m.get('primaryHead')}")
    if m.get("railWidth")!=60:issues.append(f"{page}: rail width={m.get('railWidth')}")
    if m.get("sideWidth")!=216:issues.append(f"{page}: sidebar width={m.get('sideWidth')}")
    if m.get("headerHeight")!=56:issues.append(f"{page}: header height={m.get('headerHeight')}")
    if m.get("dead") and page not in allowed_dead:issues.append(f"{page}: dead candidates={m.get('dead')}")

for page,m in surfaces.items():
    if m.get("overflow"):issues.append(f"{page}: surface overflow")
    if m.get("contract")!="1.20.0":issues.append(f"{page}: contract={m.get('contract')}")
    if m.get("status")!="frozen":issues.append(f"{page}: contract status={m.get('status')}")

for name,m in states.items():
    if "present" in m and not m["present"]:issues.append(f"state {name}: expected selector missing")

hash_checks=0
for section in ("web","surfaces","states"):
    for name,m in data.get(section,{}).items():
        rel=m.get("file");expected=m.get("sha256")
        if not rel or not expected:
            issues.append(f"{section}:{name}: missing screenshot metadata");continue
        p=ROOT/rel
        if not p.exists():
            issues.append(f"{section}:{name}: missing screenshot {rel}");continue
        actual=hashlib.sha256(p.read_bytes()).hexdigest();hash_checks+=1
        if actual!=expected:issues.append(f"{section}:{name}: screenshot hash mismatch")

metrics["hash_checks"]=hash_checks
if hash_checks!=111:issues.append(f"expected 111 screenshot hash checks, found {hash_checks}")

contract=(ROOT/"inno-design-contract.js").read_text(encoding="utf-8")
if 'contractVersion:"1.20.0"' not in contract:issues.append("machine contract is not 1.20.0")
if 'documentationVersion:"1.26"' not in contract:issues.append("machine documentation version is not 1.26")
if '"INNO-One-Final-Visual-QA-Baseline.md"' not in contract:issues.append("final baseline missing from contract sourceOfTruth")

design=(ROOT/"design-system.html").read_text(encoding="utf-8")
if "Design System V1.26" not in design:issues.append("Design System visual reference is not V1.26")
if "UI Contract 1.20.0 is frozen" not in design:issues.append("Design System freeze banner is not 1.20.0")

print("\n".join(f"{k}={v}" for k,v in metrics.items()))
print(f"issues={len(issues)}")
for x in issues:print(" -",x)
sys.exit(1 if issues else 0)
