from pathlib import Path
import json,re,sys

ROOT=Path(__file__).resolve().parent
m=json.loads((ROOT/"qa-final-visual"/"manifest.json").read_text())
issues=[]
metrics={
    "web_routes":len(m.get("web",{})),
    "canonical_states":0,
    "state_snapshots":len(m.get("states",{})),
}
states_js=(ROOT/"inno-states.js").read_text()
css=(ROOT/"inno-design-system.css").read_text()

required_runtime={
    "empty":'type==="empty"',
    "loading":'type==="loading"',
    "error":'type==="error"',
    "permission":'type==="permission"',
    "disabled":'type==="disabled"',
    "offline":'type==="offline"',
    "partial":'type==="partial"',
    "noResults":'stateMarkup("noResults"',
}
for state,token in required_runtime.items():
    if token not in states_js:
        issues.append(f"shared state runtime missing {state}")
    else:
        metrics["canonical_states"]+=1

for token,label in [
    ('role="status" aria-live="polite" aria-label="Loading content"',"loading live semantics"),
    ('syncCollectionMeta',"no-results collection metadata sync"),
    ('"0 matching results"',"no-results count state"),
    ('pages.hidden=true',"no-results pagination suppression"),
    ('Retry completed',"partial retry resolution"),
    ('searchParams.delete("uiState")',"error retry leaves preview error state"),
]:
    if token not in states_js: issues.append(f"shared state runtime missing {label}")

for token,label in [
    (".sr-only","screen-reader-only utility"),
    ('.ds-pagination[data-inno-empty="true"]',"empty pagination styling"),
    (".inno-partial-state.resolved .inno-partial-icon","resolved partial styling"),
]:
    if token not in css: issues.append(f"shared CSS missing {label}")

required_snapshots={"empty","loading","error","permission","disabled","offline","partial","no-results","validation","unsaved-confirm"}
missing=required_snapshots-set(m.get("states",{}))
for state in sorted(missing): issues.append(f"frozen visual state missing {state}")

print(f"web_routes={metrics['web_routes']}")
print(f"canonical_states={metrics['canonical_states']}/{len(required_runtime)}")
print(f"frozen_state_snapshots={metrics['state_snapshots']}")
print(f"issues={len(issues)}")
for x in issues: print(" -",x)
sys.exit(1 if issues else 0)
