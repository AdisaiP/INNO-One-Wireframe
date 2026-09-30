from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parent
SHELL = (ROOT / "production/apps/web-portal/src/shell.css").read_text(encoding="utf-8")
UI = (ROOT / "production/packages/ui/src/styles.css").read_text(encoding="utf-8")
DS = (ROOT / "production/apps/web-portal/src/pages/InternalDesignSystemPage.tsx").read_text(encoding="utf-8")

checks = 0
fails = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + detail) if detail else ""))
    if not ok:
        fails.append((name, detail))

def block(css, query):
    match = re.search(query + r"\s*\{(?P<body>.*?)\n\}", css, re.S)
    return match.group("body") if match else ""

check("frozen documentation remains V1.26", "Design System V1.26" in DS)
check("frozen contract remains 1.20.0", "UI Contract 1.20.0" in DS)
check("wide boundary starts at 1600", "<b>≥ 1600</b>" in DS or "<b>≥1600</b>" in DS)
check("desktop production breakpoint ends at 1599",
      "@media (max-width: 1599px)" in SHELL)
check("legacy max-width 1600 shell breakpoint removed",
      "@media (max-width: 1600px)" not in SHELL)

check("compact 1366 rail token", "--prod-rail-w: 60px; --prod-side-w: 216px;" in SHELL)
check("tablet 1180 rail token", "--prod-rail-w: 58px; --prod-side-w: 0px;" in SHELL)
check("narrow 850 rail token has one shared owner", SHELL.count("--prod-rail-w: 56px") == 1,
      f"count={SHELL.count('--prod-rail-w: 56px')}")
check("very narrow 680 rail token has one shared owner", SHELL.count("--prod-rail-w: 52px") == 1,
      f"count={SHELL.count('--prod-rail-w: 52px')}")
check("legacy 54 rail token removed", "--prod-rail-w: 54px" not in SHELL)
check("legacy 50 rail token removed", "--prod-rail-w: 50px" not in SHELL)
check("compact header derives rail width",
      "grid-template-columns: var(--prod-rail-w) 44px auto;" in SHELL)

check("context sidebar overlay breakpoint 1180 has one shared owner",
      SHELL.count("--prod-rail-w: 58px; --prod-side-w: 0px;") == 1
      and SHELL.count("width: min(270px, calc(100vw - var(--prod-rail-w) - 16px));") == 1)
check("collapsed desktop breakpoint 1181",
      "@media (min-width: 1181px)" in SHELL)
check("shared narrow page/resource heads stack",
      ".inno-page-head," in UI and ".inno-resource-head { flex-direction: column; align-items: stretch; }" in UI)
check("shared narrow resource summary uses two columns",
      ".inno-resource-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }" in UI)
check("shared very narrow resource summary uses one column",
      ".inno-resource-summary { grid-template-columns: 1fr; }" in UI)
check("shared narrow collection search owns row",
      ".inno-search { flex: 1 1 100%; min-width: 100%; }" in UI)
check("shared narrow editor footer wraps",
      ".inno-editor-footer { flex-wrap: wrap; }" in UI)
check("shared very narrow editor footer stacks",
      ".inno-editor-footer { align-items: stretch; flex-direction: column; }" in UI)
check("shared narrow state banner wraps",
      ".inno-state.banner { align-items: flex-start; flex-wrap: wrap; }" in UI)
check("shared tabs retain local horizontal overflow",
      ".inno-surface-tabs {" in UI and "overflow-x: auto;" in UI)
check("wide tables preserve local minimum width",
      ".inno-table-wrap--wide > table { min-width: 760px; }" in UI)
check("xwide tables preserve local minimum width",
      ".inno-table-wrap--xwide > table { min-width: 960px; }" in UI)
check("narrow action column sticks locally",
      ".inno-table-wrap th.action-column { position: sticky; right: 0;" in UI)

print(f"step42_2g_responsive_static_checks={checks}")
print(f"step42_2g_responsive_static_failures={len(fails)}")
if fails:
    for item in fails:
        print("FAILED", item)
    sys.exit(1)
