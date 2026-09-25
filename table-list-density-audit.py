from pathlib import Path
import json,re,sys

ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/"qa-final-visual"/"manifest.json").read_text())
web=sorted(manifest.get("web",{}))
issues=[]

primary_tables={
    "devices.html":"#deviceRows",
    "asset-inventory.html":"#assetRows",
    "asset-users.html":"#assetUserRows",
    "deployment-jobs.html":"#deploymentRows",
    "device-alert-rules.html":"#alertRuleRows",
    "device-alert-history.html":"#alertHistoryRows",
    "helpdesk-notification-templates.html":"#templateRows",
    "helpdesk-notification-delivery.html":"#deliveryRows",
    "maintenance-history.html":"#maintenanceHistoryRows",
    "remote-consent-history.html":"#consentHistoryRows",
    "remote-consent-rules.html":"#bypassRuleRows",
    "software-maintenance.html":"#softwareJobRows",
}

action_tables={
    "devices.html",
    "asset-inventory.html",
    "asset-users.html",
    "deployment-jobs.html",
    "device-alert-rules.html",
    "helpdesk-notification-templates.html",
    "remote-consent-rules.html",
}

metrics={"web_routes":len(web),"table_pages":0,"tables":0,"primary_collections":len(primary_tables),"primary_search_targets":0,"compact_primary_tables":0,"action_columns":0}
for fn in web:
    s=(ROOT/fn).read_text(errors="ignore")
    n=len(re.findall(r"<table\b",s,re.I))
    if n: metrics["table_pages"]+=1; metrics["tables"]+=n

for fn,target in primary_tables.items():
    s=(ROOT/fn).read_text(errors="ignore")
    if 'data-density="compact"' not in s:
        issues.append(f"{fn}: primary collection table is not compact density")
    else:
        metrics["compact_primary_tables"]+=1
    if "data-toolbar" not in s and fn not in {"devices.html","asset-inventory.html"}:
        issues.append(f"{fn}: primary collection missing canonical data toolbar")
    if f'data-inno-search-target="{target}"' not in s:
        issues.append(f"{fn}: primary search is not wired to {target}")
    else:
        metrics["primary_search_targets"]+=1
    target_id=target[1:]
    if f'id="{target_id}"' not in s:
        issues.append(f"{fn}: search target {target} does not exist")
    if re.search(r'<div class="section-title">.*?<div class="arch-toolbar">',s,re.S):
        issues.append(f"{fn}: toolbar is nested inside section-title")
    if fn in action_tables:
        if 'class="table-action"' not in s:
            issues.append(f"{fn}: action column not marked with table-action")
        else:
            metrics["action_columns"]+=1

# One-off inline search filtering is forbidden on canonical primary collections.
for fn in primary_tables:
    s=(ROOT/fn).read_text(errors="ignore")
    if re.search(r'\.oninput\s*=|addEventListener\(["\']input["\']',s):
        # shared scripts are external; inline one-off filtering should be gone.
        issues.append(f"{fn}: inline one-off search handler remains")

css=(ROOT/"inno-design-system.css").read_text()
for rule in [
    ".data-collection-head",
    ".data-toolbar",
    ".data-table-meta",
    ".table .table-action",
    '.table[data-density="compact"]',
]:
    if rule not in css: issues.append(f"shared CSS missing {rule}")

print(f"web_routes={metrics['web_routes']}")
print(f"table_pages={metrics['table_pages']}")
print(f"tables={metrics['tables']}")
print(f"primary_collections={metrics['primary_collections']}")
print(f"compact_primary_tables={metrics['compact_primary_tables']}/{metrics['primary_collections']}")
print(f"primary_search_targets={metrics['primary_search_targets']}/{metrics['primary_collections']}")
print(f"action_columns={metrics['action_columns']}/{len(action_tables)}")
print(f"issues={len(issues)}")
for x in issues: print(" -",x)
sys.exit(1 if issues else 0)
