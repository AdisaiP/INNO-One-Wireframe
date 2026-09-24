from pathlib import Path
from html.parser import HTMLParser
import re, sys

ROOT=Path(__file__).resolve().parent
EXTERNAL={"asset-mobile.html","helpdesk-agent-request.html","agent-ownership-confirmation.html"}
REFERENCE={"design-system.html"}
ALLOWED_SPACE={0,4,8,12,16,24,32,48}
issues=[]
metrics={"modern_pages":0,"web_pages":0,"nested_surfaces":0,"offscale_inline_spacing":0,"inline_tiny_type":0,"page_headers":0,"tables":0}

class Node:
    def __init__(self,tag,attrs,parent=None):
        self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[];self.text=""
    def classes(self): return self.attrs.get("class","").split()

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.root=Node("root",[]);self.stack=[self.root]
    def handle_starttag(self,tag,attrs):
        n=Node(tag,attrs,self.stack[-1]);self.stack[-1].children.append(n)
        if tag not in {"meta","link","input","img","br","hr"}:self.stack.append(n)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:self.stack=self.stack[:i];return
    def handle_data(self,data):self.stack[-1].text+=data

def walk(node):
    yield node
    for c in node.children:yield from walk(c)

def surface(node):
    return any(c in node.classes() for c in ("card","panel","arch-form-section","arch-detail-panel","property-group"))
for page in sorted(ROOT.glob("*.html")):
    source=page.read_text(encoding="utf-8")
    if "inno-design-system.css" not in source:continue
    metrics["modern_pages"]+=1
    if page.name in EXTERNAL or page.name in REFERENCE:continue
    metrics["web_pages"]+=1
    parser=Parser()
    try:parser.feed(source)
    except Exception as e:
        issues.append(f"{page.name}: parse error {e}");continue
    nodes=list(walk(parser.root))
    metrics["page_headers"]+=sum(1 for n in nodes if "page-head" in n.classes())
    metrics["tables"]+=sum(1 for n in nodes if n.tag=="table" and "table" in n.classes())

    for n in nodes:
        if surface(n):
            p=n.parent
            while p and p.tag!="root":
                if surface(p):
                    metrics["nested_surfaces"]+=1
                    issues.append(f"{page.name}: nested surface {'/'.join(n.classes())}")
                    break
                p=p.parent

        style=n.attrs.get("style","")
        for prop,val in re.findall(r"(margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|gap)\s*:\s*([0-9]+)px",style,re.I):
            value=int(val)
            if value not in ALLOWED_SPACE:
                metrics["offscale_inline_spacing"]+=1
                issues.append(f"{page.name}: off-scale inline {prop}={value}px")
        m=re.search(r"font-size\s*:\s*([0-9]+)px",style,re.I)
        if m and int(m.group(1))<10:
            metrics["inline_tiny_type"]+=1
            issues.append(f"{page.name}: inline font-size {m.group(1)}px")
css=(ROOT/"inno-design-system.css").read_text(encoding="utf-8")
required=[
    "/* NEXT 3 — Density / Spacing / Typography */",
    "--ds-content-max:1520px",
    "--ds-space-1:4px",
    "--ds-space-2:8px",
    "--ds-space-3:12px",
    "--ds-space-4:16px",
    "--ds-space-6:24px",
    "--ds-space-8:32px",
    'body{line-height:1.45',
    '.content{max-width:var(--ds-content-max)',
    '.card-pad{padding:16px}',
    '.panel-head{padding:12px 16px}',
    '.panel-body{padding:16px}',
    '.form{gap:12px}',
    '.field{gap:8px}',
    '.arch-form-section{padding:16px',
    '.arch-action-card b{font-size:11px',
    '.arch-action-card small{font-size:10px',
    '.arch-kpi span{font-size:10px',
]
for token in required:
    if token not in css:issues.append(f"missing density contract: {token}")

# Frozen component dimensions must remain unchanged.
for token in ("--ds-control-h:36px","--ds-table-row-h:48px","--ds-control-radius:8px"):
    if token not in css:issues.append(f"frozen component dimension missing: {token}")

# Main Web typography that was previously 6–9px must have readable overrides.
legibility=[
    ".workspace-pill,.workspace-app span",
    ".query-join,.query-expression span",
    ".agent-version-card span,.agent-version-card small",
    ".scope-tree-root b,.scope-tree-branch b",
    ".remote-session-sub,.session-timer,.remote-tool",
    ".fleet-alert-bars>div,.fleet-alert-bars strong",
]
for token in legibility:
    if token not in css:issues.append(f"missing legibility override: {token}")

print("\n".join(f"{k}={v}" for k,v in metrics.items()))
print(f"issues={len(issues)}")
for x in issues:print(" -",x)
sys.exit(1 if issues else 0)
