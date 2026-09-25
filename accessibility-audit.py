from pathlib import Path
import json
import re
import sys
import html

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "qa-final-visual" / "manifest.json").read_text(encoding="utf-8"))
web_routes = sorted(manifest.get("web", {}).keys())
surface_routes = sorted(manifest.get("surfaces", {}).keys())
routes = sorted(set(web_routes + surface_routes))
issues = []
metrics = {
    "canonical_pages": len(routes),
    "web_routes": len(web_routes),
    "surface_routes": len(surface_routes),
    "icon_controls_checked": 0,
    "nonsemantic_clicks": 0,
    "invalid_switches": 0,
    "images_missing_alt": 0,
}

TAG_RE = re.compile(r"<(button|a)\b([^>]*)>(.*?)</\1>", re.I | re.S)
CLICK_RE = re.compile(r"<(div|span|label|li)\b([^>]*\bonclick\s*=\s*['\"][^'\"]+['\"][^>]*)>", re.I | re.S)
IMG_RE = re.compile(r"<img\b([^>]*)>", re.I | re.S)
SWITCH_RE = re.compile(r"<([a-z0-9]+)\b([^>]*\brole\s*=\s*['\"]switch['\"][^>]*)>", re.I | re.S)
TOGGLE_RE = re.compile(r"<([a-z0-9]+)\b([^>]*\bclass\s*=\s*['\"][^'\"]*\btoggle\b[^'\"]*['\"][^>]*)>", re.I | re.S)

def attr(attrs, name):
    m = re.search(rf"\b{name}\s*=\s*(['\"])(.*?)\1", attrs, re.I | re.S)
    return html.unescape(m.group(2)).strip() if m else ""

def visible_text(body):
    txt = re.sub(r"<script\b.*?</script>|<style\b.*?</style>", " ", body, flags=re.I | re.S)
    txt = re.sub(r"<[^>]+>", " ", txt)
    return re.sub(r"\s+", " ", html.unescape(txt)).strip()

for route in routes:
    source = (ROOT / route).read_text(encoding="utf-8")

    # Rail icons receive their accessible names in platform-shell.js.
    static_source = re.sub(r'<aside class="rail">.*?</aside>', "", source, flags=re.I | re.S)

    for tag, attrs, body in TAG_RE.findall(static_source):
        text = visible_text(body)
        if text:
            continue
        metrics["icon_controls_checked"] += 1
        if not (attr(attrs, "aria-label") or attr(attrs, "aria-labelledby") or attr(attrs, "title")):
            issues.append(f"{route}: unnamed icon-only {tag}")

    for tag, attrs in CLICK_RE.findall(static_source):
        metrics["nonsemantic_clicks"] += 1
        issues.append(f"{route}: non-semantic clickable <{tag}>; use button/link/input semantics")

    for attrs in IMG_RE.findall(static_source):
        if not re.search(r"\balt\s*=", attrs, re.I):
            metrics["images_missing_alt"] += 1
            issues.append(f"{route}: image missing alt attribute")

    for tag, attrs in SWITCH_RE.findall(static_source):
        if tag.lower() not in {"button", "input"}:
            metrics["invalid_switches"] += 1
            issues.append(f"{route}: role=switch must use button/input, found <{tag}>")
        if not attr(attrs, "aria-checked"):
            metrics["invalid_switches"] += 1
            issues.append(f"{route}: role=switch missing aria-checked")
        if not (attr(attrs, "aria-label") or attr(attrs, "aria-labelledby")):
            metrics["invalid_switches"] += 1
            issues.append(f"{route}: role=switch missing accessible name")

    for tag, attrs in TOGGLE_RE.findall(static_source):
        interactive = bool(re.search(r"\bonclick\s*=|\bdata-toggle\s*=", attrs, re.I))
        if interactive and tag.lower() not in {"button", "input"}:
            metrics["invalid_switches"] += 1
            issues.append(f"{route}: interactive .toggle must be button/input, found <{tag}>")

print(f"canonical_pages={metrics['canonical_pages']}")
print(f"web_routes={metrics['web_routes']}")
print(f"surface_routes={metrics['surface_routes']}")
print(f"icon_controls_checked={metrics['icon_controls_checked']}")
print(f"nonsemantic_clicks={metrics['nonsemantic_clicks']}")
print(f"invalid_switches={metrics['invalid_switches']}")
print(f"images_missing_alt={metrics['images_missing_alt']}")
print(f"issues={len(issues)}")
for issue in issues:
    print(" -", issue)

sys.exit(1 if issues else 0)
