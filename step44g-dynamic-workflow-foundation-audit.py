from pathlib import Path
import json, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
UI=ROOT/"production/packages/ui"
WEB=ROOT/"production/apps/web-portal/src"
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

ui_package=json.loads(read(UI/"package.json"))
ui_index=read(UI/"src/index.tsx")
workflow=read(UI/"src/workflow.tsx")
workflow_css=read(UI/"src/workflow.css")
styles=read(UI/"src/styles.css")
design=read(WEB/"pages/InternalDesignSystemPage.tsx")
design_css=read(WEB/"pages/InternalDesignSystemPage.css")
shell=read(WEB/"app/AppShell.tsx")
automation=read(WEB/"pages/AutomationRulePage.tsx")
deps=ui_package.get("dependencies", {})
check("@xyflow/react dependency installed", "@xyflow/react" in deps, deps)
check("elkjs dependency installed", "elkjs" in deps, deps)
check("workflow subpath exported", "./workflow" in ui_package.get("exports", {}))
check("workflow css subpath exported", "./workflow.css" in ui_package.get("exports", {}))
check("workflow stays out of root bundle", "export * from './workflow';" not in ui_index)
check("workflow module uses React Flow", "ReactFlow" in workflow and "ReactFlowProvider" in workflow)
check("workflow module uses ELK layout", "new ELK()" in workflow and "elk.layout" in workflow)
check("React Flow base styles are workflow scoped", "@xyflow/react/dist/style.css" in workflow_css and "@xyflow/react/dist/style.css" not in styles)

for kind in ["trigger","action","condition","branch","approval","assignment","wait","notification","ai","subflow","end"]:
    check("node kind "+kind, "'"+kind+"'" in workflow)

check("domain node contract is exported", "export type INNOWorkflowNode =" in workflow)
check("domain edge contract is exported", "export type INNOWorkflowEdge =" in workflow)
check("definition persistence contract is exported", "export type INNOWorkflowDefinition =" in workflow)
check("execution snapshot is separate", "export type INNOWorkflowExecutionSnapshot =" in workflow)
check("React Flow types do not leak into public props", "Node<" not in workflow.split("export type INNOWorkflowCanvasProps =",1)[1].split("type WorkflowFlowData",1)[0])
check("layout metadata is library independent", "layout?: { x: number; y: number }" in workflow)
check("workflow canvas supports controlled selection", "selectedNodeId?: string | null" in workflow and "onSelectedNodeChange?" in workflow)
check("workflow canvas supports connect mutation", "onConnect?:" in workflow)
check("workflow canvas supports node deletion", "onDeleteNodes?:" in workflow)
check("workflow canvas supports edge deletion", "onDeleteEdges?:" in workflow)
check("workflow canvas supports read only mode", "readOnly?: boolean" in workflow)
check("workflow canvas supports auto layout", "autoLayout?: boolean" in workflow)
check("workflow canvas supports horizontal and vertical orientation", "'horizontal' | 'vertical'" in workflow)
check("workflow canvas has accessible label", "ariaLabel: string" in workflow and "aria-label={ariaLabel}" in workflow)

check("design system imports workflow subpath", "from '@inno/ui/workflow'" in design and "import '@inno/ui/workflow.css'" in design)
check("design system imports live workflow canvas", "INNOWorkflowCanvas" in design)
check("design system renders workflow section", 'id="workflow"' in design)
check("design system renders node palette", "Workflow node palette" in design)
check("design system renders properties pane", "Selected workflow node properties" in design)
check("design system demonstrates branching edges", "edge-condition-approval" in design and "edge-condition-assignment" in design)
check("design system documents persistence boundary", "never React Flow internal objects" in design)
check("design system documents execution boundary", "the canvas does not execute workflows" in design)
check("design system workflow has responsive rules", ".internal-ds-workflow-layout" in design_css and "@media (max-width: 850px)" in design_css)
check("design system navigation exposes workflow anchor", 'href="#workflow"' in shell)
check("simple Helpdesk automation remains non-canvas", "INNOWorkflowCanvas" not in automation)
check("simple Helpdesk automation still Trigger Condition Action", all(x in automation for x in ["Trigger", "Condition", "Action"]))

step44a=read(ROOT/"step44a-screen-interaction-architecture-audit.py")
check("Step44A still models workflow gap detector", "workflow-canvas-missing" in step44a)

print("step44g_checks="+str(checks))
print("step44g_failures="+str(len(failures)))
for name, detail in failures:
    print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
