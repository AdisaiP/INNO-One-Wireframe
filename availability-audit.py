from pathlib import Path
import json
import re
import sys
import html

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "qa-final-visual" / "manifest.json").read_text(encoding="utf-8"))
routes = sorted(set(manifest.get("web", {}).keys()) | set(manifest.get("surfaces", {}).keys()))
issues = []
metrics = {
    "canonical_pages": len(routes),
    "coming_soon_task_actions": 0,
    "future_nav_placeholders": 0,
    "disabled_nonfuture_controls": 0,
    "noninteractive_admin_tiles": 0,
}

CONTROL_RE = re.compile(r"<(button|a)\b([^>]*)>(.*?)</\1>", re.I | re.S)

def text_of(body):
    body = re.sub(r"<[^>]+>", " ", body)
    return re.sub(r"\s+", " ", html.unescape(body)).strip()

def attr(attrs, name):
    m = re.search(rf"\b{name}\s*=\s*(['\"])(.*?)\1", attrs, re.I | re.S)
    return html.unescape(m.group(2)).strip() if m else ""

for route in routes:
    source = (ROOT / route).read_text(encoding="utf-8")
    if route == "admin.html":
        passive_tiles = len(re.findall(r'<div\s+class=["\']admin-tile["\']', source, re.I))
        metrics["noninteractive_admin_tiles"] += passive_tiles
        if passive_tiles:
            issues.append(f"{route}: {passive_tiles} action-looking admin tiles are not interactive")

    for tag, attrs, body in CONTROL_RE.findall(source):
        text = text_of(body)
        title = attr(attrs, "title")
        blob = f"{text} {title} {attrs}".lower()
        is_nav_placeholder = "nav-disabled" in attrs and "coming soon" in blob
        if is_nav_placeholder:
            metrics["future_nav_placeholders"] += 1
            continue
        if "coming soon" in blob:
            metrics["coming_soon_task_actions"] += 1
            issues.append(f"{route}: Coming Soon task action remains: {text or title}")
        if ("disabled" in attrs or 'aria-disabled="true"' in attrs or "aria-disabled='true'" in attrs) and "coming soon" not in blob:
            metrics["disabled_nonfuture_controls"] += 1

css = (ROOT / "inno-design-system.css").read_text(encoding="utf-8")
if ".side a.nav-disabled{display:none!important}" not in css:
    issues.append("future sidebar placeholders are not globally hidden")

print(f"canonical_pages={metrics['canonical_pages']}")
print(f"coming_soon_task_actions={metrics['coming_soon_task_actions']}")
print(f"future_nav_placeholders={metrics['future_nav_placeholders']}")
print(f"disabled_nonfuture_controls={metrics['disabled_nonfuture_controls']}")
print(f"noninteractive_admin_tiles={metrics['noninteractive_admin_tiles']}")
print(f"issues={len(issues)}")
for issue in issues:
    print(" -", issue)

sys.exit(1 if issues else 0)
