from pathlib import Path
from html.parser import HTMLParser
import re, sys

ROOT=Path(__file__).resolve().parent
EXTERNAL={"asset-mobile.html","helpdesk-agent-request.html","agent-ownership-confirmation.html"}
REFERENCE={"design-system.html"}
SPECIAL_HEADERS={"workspace-v2.html","asset-detail.html","device-detail-v2.html","device-group-detail.html","user-detail.html","meeting-detail.html","remote-session.html","ticket-detail.html"}
issues=[]
metrics={"modern_pages":0,"web_pages":0,"page_headers":0,"buttons":0,"fields":0,"tables":0,"subnavs":0,"tabsets":0,"sticky_action_areas":0}

class Node:
    def __init__(self,tag,attrs,parent=None):
        self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[];self.text=""
    def classes(self):
        return self.attrs.get("class","").split()

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.root=Node("root",[]);self.stack=[self.root]
    def handle_starttag(self,tag,attrs):
        node=Node(tag,attrs,self.stack[-1]);self.stack[-1].children.append(node)
        if tag not in {"meta","link","input","img","br","hr"}:self.stack.append(node)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:self.stack=self.stack[:i];return
    def handle_data(self,data):
        self.stack[-1].text+=data
def walk(node):
    yield node
    for child in node.children:
        yield from walk(child)

def text_of(node):
    return " ".join("".join(x.text for x in walk(node)).split())

def has_class(node,name):
    return name in node.classes()

def descendants(node,tag=None,cls=None):
    out=[]
    for x in walk(node):
        if x is node:continue
        if tag and x.tag!=tag:continue
        if cls and cls not in x.classes():continue
        out.append(x)
    return out

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
    for tag in re.findall(r"<[^>]+>",source):
        if len(re.findall(r"\bclass\s*=",tag,re.I))>1:
            issues.append(f"{page.name}: duplicate class attribute")
            break

    heads=[n for n in nodes if has_class(n,"page-head")]
    if page.name not in SPECIAL_HEADERS and not heads:
        issues.append(f"{page.name}: missing page-head")
    for head in heads[:1]:
        metrics["page_headers"]+=1
        if not descendants(head,cls="eyebrow"):issues.append(f"{page.name}: page-head missing eyebrow")
        if not descendants(head,tag="h1"):issues.append(f"{page.name}: page-head missing h1")
        if not descendants(head,cls="sub"):issues.append(f"{page.name}: page-head missing subtitle")
        actions=descendants(head,cls="actions")
        buttons=[]
        for area in actions:
            buttons += [x for x in walk(area) if x.tag in {"a","button"} and has_class(x,"btn")]
        primary=[b for b in buttons if not any(v in b.classes() for v in ("secondary","ghost","danger"))]
        secondary=[b for b in buttons if any(v in b.classes() for v in ("secondary","ghost","danger"))]
        if len(primary)>1:issues.append(f"{page.name}: page-head has {len(primary)} primary actions")
        if len(secondary)>2:issues.append(f"{page.name}: page-head has {len(secondary)} secondary actions")

    for node in nodes:
        if node.tag not in {"a","button"} or "btn" not in node.classes():continue
        metrics["buttons"]+=1
        variants=sum(v in node.classes() for v in ("secondary","ghost","danger"))
        if variants>1:issues.append(f"{page.name}: button has multiple variants: {text_of(node)}")
    for node in nodes:
        if node.tag!="div" or "field" not in node.classes():continue
        metrics["fields"]+=1
        controls=[x for x in node.children if x.tag in {"input","select","textarea"}]
        if controls and not any(x.tag=="label" for x in node.children):
            issues.append(f"{page.name}: field control missing visible label")

    for table in [n for n in nodes if n.tag=="table" and "table" in n.classes()]:
        metrics["tables"]+=1
        parent=table.parent;wrapped=False
        while parent and parent.tag!="root":
            if "table-wrap" in parent.classes():wrapped=True;break
            parent=parent.parent
        if not wrapped:issues.append(f"{page.name}: table missing table-wrap")

    subnavs=[n for n in nodes if "section-subnav" in n.classes()]
    metrics["subnavs"]+=len(subnavs)
    for nav in subnavs:
        active=[a for a in descendants(nav,tag="a") if "active" in a.classes()]
        dynamic_subnav = "data-policy-view" in source and "classList.toggle('active'" in source
        if len(active)!=1 and not dynamic_subnav:issues.append(f"{page.name}: section-subnav active count={len(active)}")

    tabsets=[n for n in nodes if any(x in n.classes() for x in ("surface-tabs","detail-tabs","asset-tabs"))]
    metrics["tabsets"]+=len(tabsets)
    for tabs in tabsets:
        active=[b for b in descendants(tabs,tag="button") if "active" in b.classes()]
        if len(active)!=1:issues.append(f"{page.name}: tabset active count={len(active)}")
    sticky=any(any(c in n.classes() for c in ("inno-editor-footer","inno-builder-footer","inno-wizard-footer","arch-editor-actions","form-footer","editor-footer","sticky-actions")) for n in nodes)
    if sticky:metrics["sticky_action_areas"]+=1
    field_count=sum(1 for n in nodes if n.tag=="div" and "field" in n.classes())
    has_commit=bool(re.search(r">\s*(?:<i[^>]*></i>)?\s*(?:Save\b|Create Ticket\b|Create Job\b|Schedule Restart\b|Start Staged Rollout\b)",source,re.I))
    dialog_commit=bool(re.search(r'class="ds-dialog-foot"[^>]*>.*?(?:Save|Create)',source,re.I|re.S))
    if field_count>=6 and has_commit and not sticky and not dialog_commit:
        issues.append(f"{page.name}: long form has no sticky action area")

css=(ROOT/"inno-design-system.css").read_text(encoding="utf-8")
if "/* NEXT 2 — Component Consistency Pass */" not in css:issues.append("component consistency CSS patch missing")
for token in ("--ds-control-h:36px","--ds-table-row-h:48px",".section-subnav a[aria-current=\"page\"]"):
    if token not in css:issues.append(f"component CSS contract missing: {token}")

interactions=(ROOT/"inno-interactions.js").read_text(encoding="utf-8")
for token in ("enhanceComponentSemantics","uiSubnavActive","uiFieldLabels","uiTableRegions"):
    if token not in interactions:issues.append(f"interaction enhancement missing: {token}")

responsive=(ROOT/"inno-responsive.js").read_text(encoding="utf-8")
if ".section-subnav" not in responsive:issues.append("responsive subnav overflow support missing")

for k,v in metrics.items():print(f"{k}={v}")
print(f"issues={len(issues)}")
for item in issues:print(" -",item)
sys.exit(1 if issues else 0)
