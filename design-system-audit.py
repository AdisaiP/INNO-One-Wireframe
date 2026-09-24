#!/usr/bin/env python3
from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parent
REQ_DESKTOP=["inno-interactions.js","inno-states.js","platform-shell.js","inno-responsive.js","inno-navigation.js","inno-icons.js","inno-design-contract.js"]
REQ_EXTERNAL=["inno-interactions.js","inno-icons.js","inno-design-contract.js"]
SOT=["design-system.html","inno-design-system.css","inno-design-contract.js","inno-interactions.js","inno-states.js","inno-responsive.js","inno-navigation.js","inno-icons.js","INNO-One-Design-System-V1-Frozen.md","INNO-One-Surface-Boundaries.md","INNO-One-Special-UI-Components.md","INNO-One-UI-Prototype-Summary.md","INNO-One-Screen-Architecture-Refactor-Plan.md","INNO-One-Final-Visual-QA-Baseline.md"]
EXTERNAL_SURFACE_ROUTES={"asset-mobile.html","helpdesk-agent-request.html","agent-ownership-confirmation.html"}
issues=[]; pages=[]
for p in sorted(ROOT.glob("*.html")):
    s=p.read_text(encoding="utf-8")
    if "inno-design-system.css" not in s: continue
    pages.append(p)
    scripts=re.findall(r'<script\s+src="([^"]+)"',s)
    external_surface=('data-inno-surface="mobile"' in s or 'data-inno-surface="agent"' in s)
    required=REQ_EXTERNAL if external_surface else REQ_DESKTOP
    if external_surface:
        for forbidden in ["platform-shell.js","inno-navigation.js"]:
            if forbidden in scripts: issues.append(f"{p.name}: external surface must not load {forbidden}")
    for x in required:
        count=scripts.count(x)
        if count!=1: issues.append(f"{p.name}: {x} script count={count}")
    if "fa-brands fa-usb" in s: issues.append(f"{p.name}: invalid brand USB")
    if "fa-file-export" in s: issues.append(f"{p.name}: legacy export icon")
    for h in re.findall(r'href="([^"]+)"',s):
        if ".html" in h:
            q=h.split("#",1)[0].split("?",1)[0]
            if q.endswith(".html") and not (ROOT/q).exists(): issues.append(f"{p.name}: missing {h}")
            if not external_surface and q in EXTERNAL_SURFACE_ROUTES: issues.append(f"{p.name}: Web surface links directly to external surface {q}")
for x in SOT:
    if not (ROOT/x).exists(): issues.append(f"missing source: {x}")
ds=(ROOT/"design-system.html").read_text(encoding="utf-8")
if "Design System V1.17" not in ds: issues.append("expected Design System V1.17")
if "UI Contract 1.11.0 is frozen" not in ds: issues.append("freeze banner missing")
if 'id="freeze"' not in ds: issues.append("freeze section missing")
nav=(ROOT/"inno-navigation.js").read_text(encoding="utf-8")
for q in EXTERNAL_SURFACE_ROUTES:
    if q in nav: issues.append(f"inno-navigation.js: external surface route registered in Web navigation: {q}")
ct=(ROOT/"inno-design-contract.js").read_text(encoding="utf-8")
if 'contractVersion:"1.11.0"' not in ct: issues.append("contract version mismatch")
if 'status:"frozen"' not in ct: issues.append("contract status mismatch")
print(f"modern_pages={len(pages)}")
print(f"source_of_truth_files={len(SOT)}")
print(f"issues={len(issues)}")
for x in issues: print(" -",x)
sys.exit(1 if issues else 0)
