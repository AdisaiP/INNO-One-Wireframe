from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
QA = (ROOT / "step42_2h-final-visual-browser-qa.py").read_text(encoding="utf-8")
SHEETS = (ROOT / "step42_2h-build-contact-sheets.ps1").read_text(encoding="utf-8")
DS = (ROOT / "production/apps/web-portal/src/pages/InternalDesignSystemPage.tsx").read_text(encoding="utf-8")
BASELINE = (ROOT / "INNO-One-Final-Visual-QA-Baseline.md").read_text(encoding="utf-8")

checks = 0
fails = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + detail) if detail else ""))
    if not ok:
        fails.append((name, detail))

check("frozen documentation remains Design System V1.26", "Design System V1.26" in DS)
check("frozen UI contract remains 1.20.0", "UI Contract 1.20.0" in DS)
check("final visual baseline keeps canonical 1366 viewport", "1366" in BASELINE and "900" in BASELINE)

check("final visual QA owns dedicated evidence directory",
      'OUT = ROOT / "qa-step42_2h-final-visual"' in QA)
check("canonical widths are 1366 1024 768",
      "WIDTHS = (1366, 1024, 768)" in QA)
check("final readiness waits for mounted shell and page",
      ".inno-production-shell" in QA and ".prod-main" in QA
      and ".inno-page,.workspace-home-page" in QA and ".page-loading-wrap" in QA)
check("dynamic detail routes are recaptured at 1366",
      'for route in sorted(dynamic_routes.difference(STATIC_ROUTES)):' in QA
      and 'c.viewport(1366)' in QA
      and '"ready dynamic 1366 " + route' in QA)
check("all widths verify document scroll ownership",
      'document does not own scroll' in QA and 'docH' in QA and 'docC' in QA)
check("all widths verify main scroll ownership",
      'main scroll ownership' in QA and 'm.scrollTop=m.scrollHeight' in QA)
check("scrollable routes capture bottom screenshots",
      '__bottom.png' in QA and 'if data["scrollable"]:' in QA)
check("interactive controls are checked for viewport clipping",
      'clippedInteractive' in QA and 'interactive controls fit' in QA)
check("local horizontal scrollers are respected",
      'hasLocalXOwner' in QA and "overflowX" in QA)
check("rail chrome position is checked during scroll",
      'rail stays chrome' in QA)
check("desktop sidebar chrome position is checked during scroll",
      'sidebar stays chrome' in QA)
check("compact sidebar remains fixed off canvas",
      'sidebar keeps off-canvas ownership' in QA and 'before["sidePos"] == "fixed"' in QA)
check("compact context drawer visual is captured",
      'workspace-home__context-open.png' in QA and 'prod-side-backdrop' in QA)
check("matrix completeness requires every route at every width",
      'matrix_complete = all(' in QA and 'for width in WIDTHS' in QA)
check("matrix completeness requires exact 51 x 3 top screenshots",
      'len(ALL_ROUTES) == 51' in QA and 'len(top_shots) == 153' in QA)

check("contact sheet builder covers three canonical widths",
      "foreach ($width in @(1366, 1024, 768))" in SHEETS)
check("contact sheet builder separates top and bottom evidence",
      "'__bottom$'" in SHEETS and "'__context-open$'" in SHEETS)
check("contact sheet builder emits six sheets",
      'contact_sheets=' in SHEETS and "'-top'" in SHEETS and "'-bottom'" in SHEETS)

print(f"step42_2h_final_visual_static_checks={checks}")
print(f"step42_2h_final_visual_static_failures={len(fails)}")
if fails:
    for item in fails:
        print("FAILED", item)
    sys.exit(1)
