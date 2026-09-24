from pathlib import Path
import re, sys

ROOT=Path(__file__).resolve().parent
EXTERNAL={"asset-mobile.html","helpdesk-agent-request.html","agent-ownership-confirmation.html"}
REFERENCE={"design-system.html"}
issues=[]
metrics={"modern_pages":0,"web_pages":0,"tables":0,"sticky_areas":0,"editors":0,"wizards":0,"master_detail":0,"toolbars":0,"agent_pages":0,"mobile_pages":0}

for p in sorted(ROOT.glob("*.html")):
    s=p.read_text(encoding="utf-8")
    if "inno-design-system.css" not in s:continue
    metrics["modern_pages"]+=1

    if p.name in REFERENCE:continue
    if p.name in EXTERNAL:
        if 'data-inno-surface="agent"' in s:
            metrics["agent_pages"]+=1
            if "platform-shell.js" in s or "inno-navigation.js" in s:issues.append(f"{p.name}: Agent surface loads Web shell/navigation")
        elif 'data-inno-surface="mobile"' in s:
            metrics["mobile_pages"]+=1
            if "platform-shell.js" in s or "inno-navigation.js" in s:issues.append(f"{p.name}: Mobile surface loads Web shell/navigation")
        else:issues.append(f"{p.name}: external surface missing data-inno-surface")
        continue

    metrics["web_pages"]+=1
    if "inno-responsive.js" not in s:issues.append(f"{p.name}: Web page missing inno-responsive.js")
    metrics["tables"]+=s.count('class="table-wrap"')
    metrics["sticky_areas"]+=sum(s.count(x) for x in ("arch-editor-actions","form-footer","editor-footer","sticky-actions"))
    metrics["editors"]+=s.count('class="arch-editor"')
    metrics["wizards"]+=s.count('class="arch-stepper')
    metrics["master_detail"]+=sum(s.count(x) for x in ('class="arch-split-list"','class="registry-shell"','class="settings-layout"'))
    metrics["toolbars"]+=s.count("ds-toolbar")+s.count("table-toolbar")
    if re.search(r'class="arch-stepper"[^>]*style="[^"]*grid-template-columns',s):
        issues.append(f"{p.name}: wizard stepper uses inline grid columns")

css=(ROOT/"inno-design-system.css").read_text(encoding="utf-8")
required=[
    "/* NEXT 5 — Responsive Pass */",
    ".section-title:has(.ds-search)",
    ".panel-head:has(.ds-search)",
    ".arch-stepper.arch-stepper-4",
    "@media(max-width:1180px){.arch-stepper.arch-stepper-4",
    "@media(max-width:680px){.arch-stepper,.arch-stepper.arch-stepper-4",
]
for token in required:
    if token not in css:issues.append(f"responsive contract missing: {token}")

responsive=(ROOT/"inno-responsive.js").read_text(encoding="utf-8")
for token in ("OVERLAY_MAX=1180","updateTableWrap","enhanceHorizontalTabs","setOverlayOpen","setDesktopCollapsed"):
    if token not in responsive:issues.append(f"responsive runtime missing: {token}")

if metrics["web_pages"]!=83:issues.append(f"expected 83 Web pages, found {metrics['web_pages']}")
if metrics["agent_pages"]!=2:issues.append(f"expected 2 Agent pages, found {metrics['agent_pages']}")
if metrics["mobile_pages"]!=1:issues.append(f"expected 1 Mobile page, found {metrics['mobile_pages']}")

for k,v in metrics.items():print(f"{k}={v}")
print(f"issues={len(issues)}")
for x in issues:print(" -",x)
sys.exit(1 if issues else 0)
