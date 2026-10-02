from pathlib import Path
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
SRC=ROOT/"production/apps/web-portal/src"
PAGES=SRC/"pages"
checks=0
failures=[]

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

def read(path):
    return path.read_text(encoding="utf-8")

shell=read(SRC/"app/AppShell.tsx")
root=read(SRC/"app/AppRoot.tsx")
ownership=read(PAGES/"AssetOwnershipPage.tsx")
owners=read(PAGES/"AssetOwnersPage.tsx")
owner_detail=read(PAGES/"AssetOwnerDetailPage.tsx")
admin_users=read(PAGES/"AdminUsersPage.tsx")
check("ownership nav label is explicit", ">Ownership Overview<" in shell)
check("asset owners nav label is explicit", ">Asset Owners<" in shell)
check("generic user profiles label removed from Assets navigation", '>User Profiles<' not in shell)
check("ownership deferred route label is canonical", 'name="Asset Ownership"' in root)
check("asset owners deferred route label retained", 'name="Asset Owners"' in root)

check("ownership page title is canonical", 'title="Asset Ownership"' in ownership)
check("ownership page points identity administration to Admin Center", "User identity remains administered in Admin Center." in ownership)
check("ownership overview names Asset Owners", "<h3>Asset Owners</h3>" in ownership)
check("ownership overview identity fields are read-only", "read-only here and remain administered in Admin Center" in ownership)
check("ownership history remains present", 'title="Recent ownership changes"' in ownership)

check("owners page title is Asset Owners", 'title="Asset Owners"' in owners)
check("owners collection is ownership-specific", 'title="Asset owners"' in owners)
check("owners loading and empty states use owner terminology", "Loading asset owners" in owners and "No asset owners" in owners)
check("owners table uses Asset owner column", "<th>Asset owner</th>" in owners)
check("owners page does not present generic User Profiles", "User Profiles" not in owners)
check("owner detail breadcrumb is Asset Owners", '>Asset Owners</Link>' in owner_detail)
check("owner detail uses ownership profile terminology", "<h3>Ownership profile</h3>" in owner_detail)
check("owner detail states Admin Center owns user administration", "user administration remains in Admin Center" in owner_detail)
check("owned assets remain a dedicated detail section", 'title="Owned Assets"' in owner_detail)
check("identity fields remain visible as read-only context", all(x in owner_detail for x in ["Employee ID", "Email", "Organization", "Location"]))

check("Admin Users remains platform identity surface", 'title="Users"' in admin_users)
check("Admin Users route remains present", 'to="/admin/users"' in shell)
check("Asset Owners route remains separate", 'to="/assets/owners"' in shell)

step44a=read(ROOT/"step44a-screen-interaction-architecture-audit.py")
check("Step44A still models Assets IA gap detector", "assets-user-profiles-ia" in step44a)

print("step44f_checks="+str(checks))
print("step44f_failures="+str(len(failures)))
for name, detail in failures:
    print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
