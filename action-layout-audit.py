from pathlib import Path
from html.parser import HTMLParser
import json
import re
import sys

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "qa-final-visual" / "manifest.json").read_text(encoding="utf-8"))
WEB = sorted(manifest["web"])

EDITOR_PAGES = {
    "access-scope-edit.html",
    "asset-user-detail.html",
    "agent-rollout-new.html",
    "device-alert-channels.html",
    "device-alert-rule.html",
    "endpoint-policies.html",
    "helpdesk-calendar.html",
    "helpdesk-categories.html",
    "helpdesk-notification-rule.html",
    "helpdesk-notification-settings.html",
    "helpdesk-notification-template.html",
    "helpdesk-requester-groups.html",
    "remote-consent-message.html",
    "remote-consent-policy.html",
    "restart-schedule.html",
    "software-maintenance-new.html",
    "ticket-new.html",
    "helpdesk-sla.html",
    "organization.html",
    "organization-locations.html",
    "organization-positions.html",
    "user-edit.html",
    "helpdesk-automation-rule.html",
}

BUILDER_PAGES = {"asset-qr.html", "device-groups.html", "device-query.html", "report-builder.html"}
WIZARD_PAGES = {"deployment-new.html"}

RESOURCE_DETAIL_PAGES = {
    "asset-detail.html",
    "deployment-job-detail.html",
    "device-detail-v2.html",
    "meeting-detail.html",
    "remote-session.html",
    "ticket-detail.html",
    "device-group-detail.html",
    "user-detail.html",
}

TASK_PAGES = EDITOR_PAGES | BUILDER_PAGES | WIZARD_PAGES | RESOURCE_DETAIL_PAGES
OVERVIEW_LIST_PAGES = set(WEB) - TASK_PAGES

PRIMARY_RE = re.compile(
    r"\b(save|create|schedule|start staged rollout|continue|upload & process)\b",
    re.I,
)
EDITOR_SAVE_RE = re.compile(r"\b(save|create job|schedule restart|start staged rollout)\b", re.I)

CANONICAL_FOOTER = "inno-editor-footer"
BUILDER_FOOTER = "inno-builder-footer"
WIZARD_FOOTER = "inno-wizard-footer"
LEGACY_FOOTERS = {"arch-editor-actions", "form-footer", "editor-footer", "sticky-actions"}
ACTION_ZONES = {
    "page-head",
    "resource-actions",
    "panel-head",
    "section-title",
    "ux-action-strip",
    CANONICAL_FOOTER,
    BUILDER_FOOTER,
    WIZARD_FOOTER,
    *LEGACY_FOOTERS,
}


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag = tag
        self.attrs = dict(attrs)
        self.classes = set((self.attrs.get("class") or "").split())
        self.parent = parent
        self.children = []
        self.text = ""

    def ancestor_with_class(self, names):
        cur = self.parent
        while cur:
            hit = cur.classes.intersection(names)
            if hit:
                return next(iter(hit))
            cur = cur.parent
        return None


class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = Node("root", {})
        self.current = self.root
        self.nodes = []

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.current)
        self.current.children.append(n)
        self.nodes.append(n)
        if tag not in {"meta", "link", "input", "img", "br", "hr"}:
            self.current = n

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.current.tag == tag:
            self.current = self.current.parent

    def handle_data(self, data):
        cur = self.current
        while cur:
            cur.text += " " + data
            cur = cur.parent

    def handle_endtag(self, tag):
        cur = self.current
        while cur is not self.root:
            if cur.tag == tag:
                self.current = cur.parent
                return
            cur = cur.parent


def norm(s):
    return re.sub(r"\s+", " ", s or "").strip()


def descendants_of(root, nodes):
    out = []
    for node in nodes:
        cur = node.parent
        while cur:
            if cur is root:
                out.append(node)
                break
            cur = cur.parent
    return out


issues = []
metrics = {
    "web_routes": len(WEB),
    "editor_pages": len(EDITOR_PAGES),
    "builder_pages": len(BUILDER_PAGES),
    "wizard_pages": len(WIZARD_PAGES),
    "resource_detail_pages": len(RESOURCE_DETAIL_PAGES),
    "overview_list_pages": len(OVERVIEW_LIST_PAGES),
    "page_type_coverage": len(TASK_PAGES | OVERVIEW_LIST_PAGES),
    "canonical_editor_footers": 0,
    "legacy_editor_footers": 0,
    "builder_footers": 0,
    "wizard_footers": 0,
    "generic_editor_actions": 0,
    "disabled_footer_actions": 0,
    "page_header_save_actions": 0,
    "editor_pages_without_footer": 0,
    "footer_primary_errors": 0,
    "high_emphasis_disabled_actions": 0,
    "high_emphasis_action_overflow": 0,
    "high_emphasis_multiple_primary": 0,
    "detail_page_header_actions": 0,
    "unexpected_task_footers": 0,
}

for filename in WEB:
    src = (ROOT / filename).read_text(encoding="utf-8")
    p = Parser()
    p.feed(src)

    canonical = [n for n in p.nodes if CANONICAL_FOOTER in n.classes]
    legacy = [n for n in p.nodes if n.classes.intersection(LEGACY_FOOTERS)]
    builders = [n for n in p.nodes if BUILDER_FOOTER in n.classes]
    wizards = [n for n in p.nodes if WIZARD_FOOTER in n.classes]
    metrics["canonical_editor_footers"] += len(canonical)
    metrics["legacy_editor_footers"] += len(legacy)
    metrics["builder_footers"] += len(builders)
    metrics["wizard_footers"] += len(wizards)

    all_task_footers = canonical + legacy + builders + wizards
    if filename not in (EDITOR_PAGES | BUILDER_PAGES | WIZARD_PAGES) and all_task_footers:
        metrics["unexpected_task_footers"] += len(all_task_footers)
        issues.append(f"{filename}: non-editor page contains a task footer")

    if filename in RESOURCE_DETAIL_PAGES:
        for page_head in [n for n in p.nodes if "page-head" in n.classes]:
            misplaced = [
                n for n in descendants_of(page_head, p.nodes)
                if n.tag in {"button", "a"} and "btn" in n.classes
            ]
            if misplaced:
                metrics["detail_page_header_actions"] += len(misplaced)
                labels = ", ".join(norm(n.text) for n in misplaced)
                issues.append(
                    f"{filename}: resource detail actions belong in resource-actions, not page-head: {labels}"
                )

    # High-emphasis zones must stay concise and must not advertise unavailable actions.
    for zone_class, max_controls in (("page-head", 2), ("resource-actions", 4)):
        zones = [n for n in p.nodes if zone_class in n.classes]
        for zone_node in zones:
            controls = [
                n for n in descendants_of(zone_node, p.nodes)
                if n.tag in {"button", "a"} and "btn" in n.classes
            ]
            disabled_controls = [
                n for n in controls
                if "disabled" in n.attrs or n.attrs.get("aria-disabled") == "true"
            ]
            primary_controls = [
                n for n in controls
                if not n.classes.intersection({"secondary", "ghost", "danger"})
                and not ("disabled" in n.attrs or n.attrs.get("aria-disabled") == "true")
            ]
            if disabled_controls:
                metrics["high_emphasis_disabled_actions"] += len(disabled_controls)
                labels = ", ".join(norm(n.text) for n in disabled_controls)
                issues.append(f"{filename}: unavailable action in {zone_class}: {labels}")
            if len(controls) > max_controls:
                metrics["high_emphasis_action_overflow"] += 1
                issues.append(
                    f"{filename}: {zone_class} has {len(controls)} actions; max is {max_controls}"
                )
            if len(primary_controls) > 1:
                metrics["high_emphasis_multiple_primary"] += 1
                labels = ", ".join(norm(n.text) for n in primary_controls)
                issues.append(f"{filename}: multiple primary actions in {zone_class}: {labels}")

    # Save/Create/Schedule actions inside generic .actions are inconsistent for editor work.
    for n in p.nodes:
        if n.tag not in {"button", "a"} or "btn" not in n.classes:
            continue
        label = norm(n.text)
        zone = n.ancestor_with_class(ACTION_ZONES)
        disabled = "disabled" in n.attrs or n.attrs.get("aria-disabled") == "true"

        if filename in (EDITOR_PAGES | BUILDER_PAGES) and EDITOR_SAVE_RE.search(label) and zone == "page-head":
            metrics["page_header_save_actions"] += 1
            issues.append(f"{filename}: editor save action in page header: {label}")

        if filename in (EDITOR_PAGES | BUILDER_PAGES) and EDITOR_SAVE_RE.search(label):
            generic = n.ancestor_with_class({"actions"})
            if generic and not zone in {CANONICAL_FOOTER, BUILDER_FOOTER, WIZARD_FOOTER, *LEGACY_FOOTERS}:
                metrics["generic_editor_actions"] += 1
                issues.append(f"{filename}: editor save action uses generic .actions: {label}")

        if disabled and zone in {CANONICAL_FOOTER, BUILDER_FOOTER, *LEGACY_FOOTERS}:
            metrics["disabled_footer_actions"] += 1
            issues.append(f"{filename}: disabled/Coming Soon action inside editor footer: {label}")

    if filename in EDITOR_PAGES:
        footers = canonical + legacy
        if not footers:
            metrics["editor_pages_without_footer"] += 1
            issues.append(f"{filename}: editor page has no editor footer")

        # During migration legacy footers are allowed structurally but reported as debt.
        if legacy and not canonical:
            issues.append(f"{filename}: editor still uses legacy footer class")

        for footer in footers:
            buttons = [
                n for n in p.nodes
                if n.tag in {"button", "a"}
                and "btn" in n.classes
                and n.ancestor_with_class({CANONICAL_FOOTER, BUILDER_FOOTER, WIZARD_FOOTER, *LEGACY_FOOTERS})
                in {CANONICAL_FOOTER, BUILDER_FOOTER, WIZARD_FOOTER, *LEGACY_FOOTERS}
            ]
            # Scope to footer by walking ancestry.
            scoped = []
            for btn in buttons:
                cur = btn.parent
                while cur:
                    if cur is footer:
                        scoped.append(btn)
                        break
                    cur = cur.parent
            primary = [
                b for b in scoped
                if not b.classes.intersection({"secondary", "ghost", "danger"})
                and not ("disabled" in b.attrs or b.attrs.get("aria-disabled") == "true")
            ]
            if len(primary) != 1:
                metrics["footer_primary_errors"] += 1
                issues.append(
                    f"{filename}: editor footer must contain exactly one enabled primary action; found {len(primary)}"
                )

    if filename in BUILDER_PAGES:
        if len(builders) != 1:
            issues.append(f"{filename}: builder page must have exactly one canonical builder footer; found {len(builders)}")
        if legacy:
            issues.append(f"{filename}: builder still uses legacy footer class")

    if filename in WIZARD_PAGES:
        if len(wizards) != 1:
            issues.append(f"{filename}: wizard page must have exactly one canonical wizard footer; found {len(wizards)}")
        if legacy:
            issues.append(f"{filename}: wizard still uses legacy footer class")

# Endpoint Policies is the reference architecture and must keep editing/monitoring split.
endpoint = (ROOT / "endpoint-policies.html").read_text(encoding="utf-8")
for required in [
    'data-view="policies"',
    'data-view="compliance"',
    'class="inno-master-editor"',
    'class="inno-editor-footer"',
]:
    if required not in endpoint:
        issues.append(f"endpoint-policies.html: reference contract missing {required}")

if "Preview Impact" in endpoint:
    issues.append("endpoint-policies.html: unavailable Preview Impact still competes with Save")

print("Action/Layout Audit")
for k, v in metrics.items():
    print(f"{k}={v}")
print(f"issues={len(issues)}")
for i in issues:
    print(" -", i)

sys.exit(1 if issues else 0)
