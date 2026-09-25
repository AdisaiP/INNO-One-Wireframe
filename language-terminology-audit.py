from pathlib import Path
from html.parser import HTMLParser
import html
import json
import re
import sys

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "qa-final-visual" / "manifest.json").read_text(encoding="utf-8"))
web_routes = sorted(manifest.get("web", {}).keys())
surfaces = manifest.get("surfaces", {})
issues = []
metrics = {
    "web_routes": len(web_routes),
    "english_surfaces": 0,
    "thai_surfaces": 0,
    "unscoped_thai_fragments": 0,
    "terminology_mismatches": 0,
}

# Thai letters/marks; intentionally excludes the Baht currency symbol.
THAI = re.compile(r"[\u0E01-\u0E3A\u0E40-\u0E5B]")

class LanguageParser(HTMLParser):
    def __init__(self, page):
        super().__init__(convert_charrefs=True)
        self.page = page
        self.stack = []
        self.in_script = 0
        self.in_style = 0

    def current_lang(self):
        for _, attrs in reversed(self.stack):
            lang = attrs.get("lang")
            if lang:
                return lang.lower()
        return ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.stack.append((tag, attrs))
        if tag == "script":
            self.in_script += 1
        if tag == "style":
            self.in_style += 1
        if self.in_script or self.in_style:
            return
        effective = attrs.get("lang", self.current_lang()).lower()
        for name, value in attrs.items():
            if not isinstance(value, str) or name in {"data-search"}:
                continue
            if THAI.search(value) and effective != "th":
                metrics["unscoped_thai_fragments"] += 1
                issues.append(f"{self.page}: Thai attribute content outside lang=th: {tag}@{name}")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "script" and self.in_script:
            self.in_script -= 1
        if tag == "style" and self.in_style:
            self.in_style -= 1
        for i in range(len(self.stack)-1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.in_script or self.in_style:
            return
        text = " ".join(data.split())
        if not text or not THAI.search(text):
            return
        if self.current_lang() != "th":
            metrics["unscoped_thai_fragments"] += 1
            issues.append(f"{self.page}: Thai text outside lang=th: {text[:80]}")

def page_lang(source):
    m = re.search(r"<html[^>]*\blang=[\"']([^\"']+)", source, re.I)
    return m.group(1).lower() if m else ""

# Web Portal + Design System = English.
english_pages = web_routes + ["design-system.html"]
for page in english_pages:
    source = (ROOT / page).read_text(encoding="utf-8")
    lang = page_lang(source)
    if lang != "en":
        issues.append(f"{page}: expected html lang=en, found {lang or 'missing'}")
    else:
        metrics["english_surfaces"] += 1
    parser = LanguageParser(page)
    parser.feed(source)

# Endpoint Agent + Android Mobile = Thai.
thai_pages = ["helpdesk-agent-request.html", "agent-ownership-confirmation.html", "asset-mobile.html"]
for page in thai_pages:
    source = (ROOT / page).read_text(encoding="utf-8")
    lang = page_lang(source)
    if lang != "th":
        issues.append(f"{page}: expected html lang=th, found {lang or 'missing'}")
    else:
        metrics["thai_surfaces"] += 1

# Contextual-navigation terminology checks.
def side_links(source):
    m = re.search(r'<aside class="side".*?</aside>', source, re.S | re.I)
    if not m:
        return "", []
    block = m.group(0)
    title = re.search(r'<div class="side-title">(.*?)</div>', block, re.S | re.I)
    side_title = re.sub(r"<[^>]+>", " ", title.group(1)).strip() if title else ""
    links = []
    for a in re.finditer(r'<a([^>]*)href="([^"]+)"([^>]*)>(.*?)</a>', block, re.S | re.I):
        href = a.group(2)
        text = re.sub(r"<[^>]+>", " ", a.group(4))
        text = html.unescape(re.sub(r"\s+", " ", text)).strip()
        links.append((href, text))
    return side_title, links

for page in web_routes:
    source = (ROOT / page).read_text(encoding="utf-8")
    side_title, links = side_links(source)
    for href, label in links:
        base = href.split("?", 1)[0].split("#", 1)[0]
        expected = None
        if side_title == "Helpdesk" and base == "helpdesk.html":
            expected = "Overview"
        elif base == "modules.html":
            expected = "Apps & Modules"
        elif base == "profile.html":
            expected = "Profile & Settings"
        if expected and label != expected:
            metrics["terminology_mismatches"] += 1
            issues.append(f"{page}: {base} label is '{label}', expected '{expected}'")

# Canonical spelling/casing rules on English UI surfaces.
for page in english_pages:
    source = (ROOT / page).read_text(encoding="utf-8")
    visible = re.sub(r"<script\b.*?</script>|<style\b.*?</style>", " ", source, flags=re.I | re.S)
    forbidden = {
        "E-mail": "Email",
        "WiFi": "Wi-Fi",
        "Log in": "Sign in",
    }
    for old, new in forbidden.items():
        if old in visible:
            metrics["terminology_mismatches"] += 1
            issues.append(f"{page}: use '{new}' instead of '{old}'")

print(f"web_routes={metrics['web_routes']}")
print(f"english_surfaces={metrics['english_surfaces']}/{len(english_pages)}")
print(f"thai_surfaces={metrics['thai_surfaces']}/{len(thai_pages)}")
print(f"unscoped_thai_fragments={metrics['unscoped_thai_fragments']}")
print(f"terminology_mismatches={metrics['terminology_mismatches']}")
print(f"issues={len(issues)}")
for issue in issues:
    print(" -", issue)

sys.exit(1 if issues else 0)
