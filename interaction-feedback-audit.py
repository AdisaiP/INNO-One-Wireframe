from pathlib import Path
import json,re,sys

ROOT=Path(__file__).resolve().parent
m=json.loads((ROOT/"qa-final-visual/manifest.json").read_text())
pages=sorted(set(m.get("web",{}))|set(m.get("surfaces",{})))
issues=[]
metrics={"pages":len(pages),"confirms":0,"saves":0,"native_dialogs":0}

for fn in pages:
    s=(ROOT/fn).read_text(errors="ignore")
    for pat,label in [(r"\balert\s*\(","alert"),(r"\bconfirm\s*\(","confirm"),(r"\bprompt\s*\(","prompt")]:
        n=len(re.findall(pat,s))
        metrics["native_dialogs"]+=n
        if n: issues.append(f"{fn}: native {label}() found")

    for mm in re.finditer(r"<(?:button|a)\b([^>]*\bdata-inno-confirm\b[^>]*)>",s,re.I|re.S):
        attrs=mm.group(1); metrics["confirms"]+=1
        for req in ["data-inno-title","data-inno-description","data-inno-confirm","data-inno-variant","data-inno-success"]:
            if req not in attrs: issues.append(f"{fn}: data-inno-confirm missing {req}")
        vm=re.search(r'data-inno-variant="([^"]+)"',attrs)
        if vm and vm.group(1) not in {"warning","danger"}: issues.append(f"{fn}: invalid confirm variant {vm.group(1)}")

    for mm in re.finditer(r"<button\b([^>]*\bdata-inno-save\b[^>]*)>",s,re.I|re.S):
        attrs=mm.group(1);metrics["saves"]+=1
        for req in ["data-inno-saving-label","data-inno-saved-label","data-inno-success"]:
            if req not in attrs: issues.append(f"{fn}: data-inno-save missing {req}")

shared=(ROOT/"inno-interactions.js").read_text()
states=(ROOT/"inno-states.js").read_text()
for text,label in [
    ('aria-describedby="innoConfirmText"',"confirm description semantics"),
    ('role","alert"',"validation alert semantics"),
]:
    pass
if 'aria-describedby="innoConfirmText"' not in shared: issues.append("shared confirm dialog missing aria-describedby")
if 'msg.setAttribute("role","alert")' not in shared: issues.append("validation errors missing role=alert")
if 'control.setAttribute("aria-describedby",msg.id)' not in shared: issues.append("validation errors not associated with fields")
if 'aria-busy' not in states: issues.append("save button state missing aria-busy")
if 'if(!b||b.disabled)return;' not in states: issues.append("save simulation does not guard duplicate activation")
if 'const variant=opts.variant||"warning"' not in shared: issues.append("confirm default is not warning")

print(f"canonical_pages={metrics['pages']}")
print(f"confirm_actions={metrics['confirms']}")
print(f"save_actions={metrics['saves']}")
print(f"native_dialogs={metrics['native_dialogs']}")
print(f"issues={len(issues)}")
for x in issues: print(" -",x)
sys.exit(1 if issues else 0)
