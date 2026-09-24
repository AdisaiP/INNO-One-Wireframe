from pathlib import Path
from html.parser import HTMLParser
import re, sys

ROOT=Path(__file__).resolve().parent
EXTERNAL={"asset-mobile.html","helpdesk-agent-request.html","agent-ownership-confirmation.html"}
REFERENCE={"design-system.html"}
issues=[]
metrics={"modern_pages":0,"web_pages":0,"shared_save_controls":0,"required_controls":0,"filters":0,"confirms":0,"search_targets":0,"bulk_tables":0,"legacy_toasts":0,"inline_commit_handlers":0,"app_hash_links":0,"broken_local_routes":0}

for page in sorted(ROOT.glob("*.html")):
    source=page.read_text(encoding="utf-8")
    if "inno-design-system.css" not in source:continue
    metrics["modern_pages"]+=1
    if page.name in EXTERNAL or page.name in REFERENCE:continue
    metrics["web_pages"]+=1

    if "inno-interactions.js" not in source:issues.append(f"{page.name}: missing inno-interactions.js")
    if "inno-states.js" not in source:issues.append(f"{page.name}: missing inno-states.js")

    # Navigation contract: application pages use real routes or query-state routes, not hash routing.
    for href in re.findall(r'href=["\']([^"\']+)["\']',source,re.I):
        if href.startswith(("http://","https://","mailto:","tel:","javascript:")):continue
        if "#" in href and not href.startswith("design-system.html#"):
            metrics["app_hash_links"]+=1;issues.append(f"{page.name}: application hash route remains: {href}")
        target=href.split("?")[0].split("#")[0]
        if target.endswith(".html") and not (ROOT/target).exists():
            metrics["broken_local_routes"]+=1;issues.append(f"{page.name}: missing local route target: {href}")

    metrics["shared_save_controls"]+=len(re.findall(r"<(?:button|a)\b[^>]*data-inno-save",source,re.I))
    metrics["required_controls"]+=len(re.findall(r"<(?:input|select|textarea)\b[^>]*\brequired\b",source,re.I))
    metrics["filters"]+=source.count("data-inno-filter")
    metrics["confirms"]+=source.count("data-inno-confirm")
    metrics["search_targets"]+=source.count("data-inno-search-target")

    if re.search(r"function\s+showToast\s*\(",source) or re.search(r"(?<![.\w])showToast\s*\(",source):
        metrics["legacy_toasts"]+=1;issues.append(f"{page.name}: legacy page-local showToast remains")
    if re.search(r'class=["\'][^"\']*\bds-toast\b',source,re.I):
        metrics["legacy_toasts"]+=1;issues.append(f"{page.name}: legacy ds-toast container remains")

    if re.search(r'getElementById\(["\'][^"\']*(?:save|startRollout|scheduleRestart|createSoftwareJob)[^"\']*["\']\)\.onclick',source,re.I):
        metrics["inline_commit_handlers"]+=1;issues.append(f"{page.name}: inline commit handler remains")

    for m in re.finditer(r'<button\b(?P<a>[^>]*)>(?P<t>.*?)</button>',source,re.S|re.I):
        attrs=m.group("a");label=" ".join(re.sub(r"<[^>]+>"," ",m.group("t")).split())
        if "disabled" in attrs or 'aria-disabled="true"' in attrs:continue
        if re.search(r'^(Save\b|Create Ticket$|Create Job$|Schedule Restart$|Start Staged Rollout$)',label,re.I):
            if "data-inno-save" not in attrs:
                issues.append(f"{page.name}: active commit button not using data-inno-save: {label}")
        if "danger" in re.findall(r'class=["\']([^"\']*)',attrs,re.I)[0].split() if re.findall(r'class=["\']([^"\']*)',attrs,re.I) else False:
            if "data-inno-confirm" not in attrs and "data-inno-save" not in attrs:
                issues.append(f"{page.name}: active danger button missing confirmation: {label}")

    bulkbars=len(re.findall(r'data-inno-bulkbar',source))
    metrics["bulk_tables"]+=bulkbars
    if "ds-bulkbar" in source:
        if not bulkbars:issues.append(f"{page.name}: bulk bar missing shared contract")
        if "data-inno-select-all" not in source or "data-inno-select-row" not in source:
            issues.append(f"{page.name}: bulk selection markers incomplete")

interactions=(ROOT/"inno-interactions.js").read_text(encoding="utf-8")
for token in ("dirtyScopes","validateScope","confirmDiscard","enhanceBulkSelection","data-inno-filter-values","uiDirtyCount","uiBulkSelected","inno:filters-applied"):
    # dataset attribute is camel-cased in JS; allow actual implementation token below.
    if token=="data-inno-filter-values":
        ok="innoFilterValues" in interactions
    else: ok=token in interactions
    if not ok:issues.append(f"interaction contract missing: {token}")

states=(ROOT/"inno-states.js").read_text(encoding="utf-8")
for token in ('type==="partial"',"data-inno-retry","simulateSave","validateScope","data-inno-navigate","data-inno-close-target"):
    js_token={"data-inno-navigate":"innoNavigate","data-inno-close-target":"innoCloseTarget"}.get(token,token)
    if js_token not in states:issues.append(f"state contract missing: {token}")

css=(ROOT/"inno-design-system.css").read_text(encoding="utf-8")
for token in ("/* NEXT 4 — Interaction Consistency */",".editor-save-state.is-unsaved",".field [aria-invalid=\"true\"]",'tr[aria-selected="true"]'):
    if token not in css:issues.append(f"interaction CSS missing: {token}")

if metrics["shared_save_controls"]<20:issues.append("too few shared save controls")
if metrics["required_controls"]<2:issues.append("validation has no representative required fields")
if metrics["bulk_tables"]<2:issues.append("bulk selection contract missing representative tables")

for k,v in metrics.items():print(f"{k}={v}")
print(f"issues={len(issues)}")
for item in issues:print(" -",item)
sys.exit(1 if issues else 0)
