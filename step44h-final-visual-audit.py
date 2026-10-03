from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parent
QA = (ROOT / "step44h-final-visual-browser-qa.py").read_text(encoding="utf-8")
SHEETS = (ROOT / "step44h-build-contact-sheets.ps1").read_text(encoding="utf-8")
DS = (ROOT / "production/apps/web-portal/src/pages/InternalDesignSystemPage.tsx").read_text(encoding="utf-8")
BASELINE = (ROOT / "production/design-system/frozen/v1.26/INNO-One-Final-Visual-QA-Baseline.md").read_text(encoding="utf-8")
MATRIX = json.loads((ROOT / "inno-step44a-screen-interaction-matrix.json").read_text(encoding="utf-8"))

checks = 0
fails = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        fails.append((name, detail))

check("frozen documentation remains Design System V1.26", "Design System V1.26" in DS)
check("frozen UI contract remains 1.20.0", "UI Contract 1.20.0" in DS)
check("final visual baseline keeps canonical 1366 x 900 viewport", "1366" in BASELINE and "900" in BASELINE)
check("current architecture matrix has 64 routes after Step 45B", len(MATRIX.get("routes", [])) == 64, len(MATRIX.get("routes", [])))

check("final visual QA owns Step 44H evidence directory",
      'OUT = ROOT / "qa-step44h-final-visual"' in QA)
check("canonical widths are 1366 1024 768",
      "WIDTHS = (1366, 1024, 768)" in QA)
check("current static route list includes create route",
      '"/admin/users/new"' in QA)
check("current dynamic discovery covers nine collection entry points",
      all(route in QA for route in [
          '"/admin/users"', '"/devices"', '"/devices/groups"', '"/assets/inventory"',
          '"/assets/owners"', '"/helpdesk/tickets"', '"/helpdesk/automation"',
          '"/admin/access-scopes"', '"/assets/contracts"',
      ]))
check("dynamic user and contract edit routes are included",
      'route in ("/admin/users", "/assets/contracts")' in QA and 'dynamic_routes.add(href + "/edit")' in QA)
check("dynamic detail routes are recaptured at 1366",
      'for route in sorted(dynamic_routes.difference(STATIC_ROUTES)):' in QA
      and 'c.viewport(1366)' in QA
      and '"ready dynamic 1366 " + route' in QA)

check("final readiness waits for mounted shell and page",
      ".inno-production-shell" in QA and ".prod-main" in QA
      and ".inno-page,.workspace-home-page" in QA and ".page-loading-wrap" in QA)
check("all widths verify document scroll ownership",
      "document does not own scroll" in QA and "docH" in QA and "docC" in QA)
check("all widths verify main scroll ownership",
      "main scroll ownership" in QA and "m.scrollTop=m.scrollHeight" in QA)
check("scrollable routes capture bottom screenshots",
      "__bottom.png" in QA and 'if data["scrollable"]:' in QA)
check("interactive controls are checked for viewport clipping",
      "clippedInteractive" in QA and "interactive controls fit" in QA)
check("local horizontal scrollers are respected",
      "hasLocalXOwner" in QA and "overflowX" in QA)
check("rail chrome position is checked during scroll", "rail stays chrome" in QA)
check("desktop sidebar chrome position is checked during scroll", "sidebar stays chrome" in QA)
check("compact sidebar remains fixed off canvas",
      "sidebar keeps off-canvas ownership" in QA and 'before["sidePos"] == "fixed"' in QA)
check("compact context drawer visual is captured",
      "workspace-home__context-open.png" in QA and "prod-side-backdrop" in QA)

check("Step 44H asserts organization architecture", "organization hierarchy is full-width tree" in QA)
check("Step 44H asserts audit architecture", "audit history table owns primary surface" in QA)
check("Step 44H asserts software-license architecture", "software licenses starts as primary list" in QA)
check("Step 44H asserts access utility dialog", "Evaluate Access opens dialog" in QA)
check("Step 44H asserts roles API boundary", "roles exposes immutable platform-role boundary" in QA)
check("Step 44H asserts Inventory Query builder", "inventory query remains builder-centric" in QA)
check("Step 44H asserts spacing remediations",
      all(marker in QA for marker in [
          "asset ownership overview/history spacing is preserved",
          "QR label setup owns full body padding",
          "asset current-owner body padding is preserved",
      ]))
check("interaction-state evidence uses dedicated states directory",
      'STATE_OUT = OUT / "states"' in QA and 'states/1366__organization__drawer.png' in QA)

check("matrix completeness requires every route at every width",
      "matrix_complete = all(" in QA and "for width in WIDTHS" in QA)
check("matrix completeness requires exact 56 x 3 top screenshots",
      "len(ALL_ROUTES) == 56" in QA and "len(top_shots) == 168" in QA)

check("contact sheet builder uses Step 44H evidence",
      "qa-step44h-final-visual" in SHEETS and "Step 44H -" in SHEETS)
check("contact sheet builder covers three canonical widths",
      "foreach ($width in @(1366, 1024, 768))" in SHEETS)
check("contact sheet builder separates top and bottom evidence",
      "'__bottom$'" in SHEETS and "'__context-open$'" in SHEETS)
check("contact sheet builder emits six sheets",
      "contact_sheets=" in SHEETS and "'-top'" in SHEETS and "'-bottom'" in SHEETS)

print(f"step44h_final_visual_static_checks={checks}")
print(f"step44h_final_visual_static_failures={len(fails)}")
if fails:
    for item in fails:
        print("FAILED", item)
    sys.exit(1)
