(function(){
"use strict";

const tokens={
  "nav.workspace":{fa:"fa-house",lucide:"House"},
  "nav.apps":{fa:"fa-table-cells-large",lucide:"Grid2X2"},
  "nav.devices":{fa:"fa-desktop",lucide:"Monitor"},
  "nav.assets":{fa:"fa-boxes-stacked",lucide:"Package"},
  "nav.reports":{fa:"fa-chart-column",lucide:"ChartColumn"},
  "nav.helpdesk":{fa:"fa-headset",lucide:"Headphones"},
  "nav.meeting":{fa:"fa-microphone-lines",lucide:"Mic"},
  "nav.admin":{fa:"fa-gear",lucide:"Settings"},

  "section.overview":{fa:"fa-house",lucide:"LayoutDashboard"},
  "section.discovery":{fa:"fa-satellite-dish",lucide:"Radar"},
  "section.groups":{fa:"fa-layer-group",lucide:"Layers3"},
  "section.remote":{fa:"fa-display",lucide:"MonitorSmartphone"},
  "section.remoteConsent":{fa:"fa-hand",lucide:"Hand"},
  "section.query":{fa:"fa-magnifying-glass",lucide:"SearchCode"},
  "section.deployment":{fa:"fa-box-open",lucide:"PackageOpen"},
  "section.maintenance":{fa:"fa-arrows-rotate",lucide:"RefreshCw"},
  "section.policies":{fa:"fa-shield-halved",lucide:"ShieldCheck"},
  "section.alerts":{fa:"fa-triangle-exclamation",lucide:"TriangleAlert"},
  "section.inventory":{fa:"fa-boxes-stacked",lucide:"Boxes"},
  "section.licenses":{fa:"fa-key",lucide:"KeyRound"},
  "section.contracts":{fa:"fa-file-contract",lucide:"FileText"},
  "section.qr":{fa:"fa-qrcode",lucide:"QrCode"},
  "section.ownership":{fa:"fa-user-tag",lucide:"Contact"},
  "section.tickets":{fa:"fa-ticket",lucide:"Ticket"},
  "section.assigned":{fa:"fa-user-check",lucide:"UserCheck"},
  "section.team":{fa:"fa-users",lucide:"Users"},
  "section.clientRequest":{fa:"fa-laptop-medical",lucide:"Laptop"},
  "section.sla":{fa:"fa-stopwatch",lucide:"Timer"},
  "section.knowledge":{fa:"fa-book-open",lucide:"BookOpen"},
  "section.configuration":{fa:"fa-sliders",lucide:"SlidersHorizontal"},
  "section.automation":{fa:"fa-wand-magic-sparkles",lucide:"WandSparkles"},
  "section.upcoming":{fa:"fa-calendar",lucide:"CalendarDays"},
  "section.record":{fa:"fa-circle-recording",lucide:"CircleDot"},
  "section.meetings":{fa:"fa-list",lucide:"List"},
  "section.shared":{fa:"fa-share-nodes",lucide:"Share2"},
  "section.templates":{fa:"fa-copy",lucide:"Copy"},
  "section.organization":{fa:"fa-building",lucide:"Building2"},
  "section.users":{fa:"fa-users",lucide:"Users"},
  "section.roles":{fa:"fa-user-shield",lucide:"ShieldCheck"},
  "section.accessScopes":{fa:"fa-crosshairs",lucide:"ScanSearch"},
  "section.modules":{fa:"fa-cubes",lucide:"Blocks"},
  "section.integrations":{fa:"fa-plug",lucide:"Plug"},
  "section.security":{fa:"fa-shield",lucide:"Shield"},
  "section.audit":{fa:"fa-clipboard-list",lucide:"ClipboardList"},
  "section.branding":{fa:"fa-palette",lucide:"Palette"},
  "section.designSystem":{fa:"fa-swatchbook",lucide:"SwatchBook"},
  "section.settings":{fa:"fa-gear",lucide:"Settings"},
  "section.icons":{fa:"fa-icons",lucide:"Shapes"},
  "section.freeze":{fa:"fa-lock",lucide:"LockKeyhole"},
  "section.continue":{fa:"fa-clock-rotate-left",lucide:"History"},
  "section.attention":{fa:"fa-circle-exclamation",lucide:"CircleAlert"},
  "section.recent":{fa:"fa-clock",lucide:"Clock3"},
  "section.notifications":{fa:"fa-bell",lucide:"Bell"},
  "section.profile":{fa:"fa-user",lucide:"User"},
  "section.pinned":{fa:"fa-thumbtack",lucide:"Pin"},
  "section.available":{fa:"fa-store",lucide:"Store"},
  "section.recentlyUsed":{fa:"fa-clock-rotate-left",lucide:"History"},
  "section.foundations":{fa:"fa-swatchbook",lucide:"SwatchBook"},
  "section.actions":{fa:"fa-square",lucide:"MousePointerClick"},
  "section.forms":{fa:"fa-list-check",lucide:"ListChecks"},
  "section.dataTable":{fa:"fa-table",lucide:"Table2"},
  "section.states":{fa:"fa-circle-info",lucide:"Info"},
  "section.interactions":{fa:"fa-hand-pointer",lucide:"Pointer"},
  "section.overlays":{fa:"fa-window-restore",lucide:"PanelsTopLeft"},
  "section.responsive":{fa:"fa-display",lucide:"Monitor"},
  "section.navigation":{fa:"fa-route",lucide:"Route"},
  "section.implementation":{fa:"fa-code",lucide:"Code2"},
  "section.builder":{fa:"fa-wand-magic-sparkles",lucide:"WandSparkles"},
  "section.hardware":{fa:"fa-microchip",lucide:"Cpu"},
  "section.software":{fa:"fa-box-open",lucide:"PackageOpen"},
  "section.saved":{fa:"fa-bookmark",lucide:"Bookmark"},
  "section.schedules":{fa:"fa-clock",lucide:"Clock3"},

  "action.search":{fa:"fa-magnifying-glass",lucide:"Search"},
  "action.add":{fa:"fa-plus",lucide:"Plus"},
  "action.edit":{fa:"fa-pen",lucide:"Pencil"},
  "action.delete":{fa:"fa-trash",lucide:"Trash2"},
  "action.more":{fa:"fa-ellipsis",lucide:"Ellipsis"},
  "action.filter":{fa:"fa-filter",lucide:"ListFilter"},
  "action.columns":{fa:"fa-table-columns",lucide:"Columns3"},
  "action.save":{fa:"fa-floppy-disk",lucide:"Save"},
  "action.export":{fa:"fa-download",lucide:"Download"},
  "action.upload":{fa:"fa-upload",lucide:"Upload"},
  "action.download":{fa:"fa-download",lucide:"Download"},
  "action.refresh":{fa:"fa-arrows-rotate",lucide:"RefreshCw"},
  "action.back":{fa:"fa-arrow-left",lucide:"ArrowLeft"},
  "action.close":{fa:"fa-xmark",lucide:"X"},
  "action.copy":{fa:"fa-copy",lucide:"Copy"},
  "action.share":{fa:"fa-share-nodes",lucide:"Share2"},
  "action.print":{fa:"fa-print",lucide:"Printer"},
  "action.scan":{fa:"fa-qrcode",lucide:"ScanLine"},
  "action.openExternal":{fa:"fa-arrow-up-right-from-square",lucide:"ExternalLink"},
  "action.send":{fa:"fa-paper-plane",lucide:"Send"},
  "action.attach":{fa:"fa-paperclip",lucide:"Paperclip"},
  "action.control":{fa:"fa-arrow-pointer",lucide:"MousePointer2"},
  "action.view":{fa:"fa-eye",lucide:"Eye"},
  "action.keyboard":{fa:"fa-keyboard",lucide:"Keyboard"},
  "action.clipboard":{fa:"fa-clipboard",lucide:"Clipboard"},
  "action.fullscreen":{fa:"fa-expand",lucide:"Maximize2"},
  "action.disconnect":{fa:"fa-plug-circle-xmark",lucide:"Unplug"},
  "action.chat":{fa:"fa-comments",lucide:"MessagesSquare"},
  "action.fileTransfer":{fa:"fa-cloud-arrow-up",lucide:"CloudUpload"},

  "status.success":{fa:"fa-circle-check",lucide:"CircleCheck"},
  "status.warning":{fa:"fa-triangle-exclamation",lucide:"TriangleAlert"},
  "status.error":{fa:"fa-circle-exclamation",lucide:"CircleX"},
  "status.info":{fa:"fa-circle-info",lucide:"Info"},
  "status.offline":{fa:"fa-plug-circle-xmark",lucide:"WifiOff"},
  "status.disabled":{fa:"fa-toggle-off",lucide:"ToggleLeft"}
};

const labelTokens={
  "Home":"nav.workspace",
  "Apps":"nav.apps",
  "All Apps":"nav.apps",
  "Overview":"section.overview",
  "Devices":"nav.devices",
  "Assets":"nav.assets",
  "Helpdesk":"nav.helpdesk",
  "Discovery":"section.discovery",
  "Device Groups":"section.groups",
  "Remote Operations":"section.remote",
  "Remote Consent":"section.remoteConsent",
  "Inventory Query":"section.query",
  "Deployment Jobs":"section.deployment",
  "Agent Maintenance":"section.maintenance",
  "Policies":"section.policies",
  "Alerts":"section.alerts",
  "Asset Inventory":"section.inventory",
  "Software Licenses":"section.licenses",
  "Contracts & Warranty":"section.contracts",
  "QR Labels":"section.qr",
  "Ownership & Users":"section.ownership",
  "Reports":"nav.reports",
  "Report Builder":"section.builder",
  "Hardware":"section.hardware",
  "Software":"section.software",
  "Saved Reports":"section.saved",
  "Schedules":"section.schedules",
  "Tickets":"section.tickets",
  "Assigned to Me":"section.assigned",
  "Team Queue":"section.team",
  "Client Request":"section.clientRequest",
  "SLA & Escalation":"section.sla",
  "Knowledge Base":"section.knowledge",
  "Configuration":"section.configuration",
  "Automation":"section.automation",
  "Upcoming":"section.upcoming",
  "Record / Upload":"section.record",
  "My Meetings":"section.meetings",
  "Shared With Me":"section.shared",
  "Templates":"section.templates",
  "Organization":"section.organization",
  "Users":"section.users",
  "Roles & Permissions":"section.roles",
  "Access Scopes":"section.accessScopes",
  "Apps & Modules":"section.modules",
  "Manage Apps":"section.modules",
  "Integrations":"section.integrations",
  "Security":"section.security",
  "Audit":"section.audit",
  "Branding":"section.branding",
  "Design System":"section.designSystem",
  "Settings":"section.settings",
  "Icons":"section.icons",
  "Frozen Contract":"section.freeze",
  "Continue Working":"section.continue",
  "Needs Attention":"section.attention",
  "Recent":"section.recent",
  "Notifications":"section.notifications",
  "Profile":"section.profile",
  "Profile & Settings":"section.profile",
  "Pinned":"section.pinned",
  "Available Modules":"section.available",
  "Recently Used":"section.recentlyUsed",
  "Foundations":"section.foundations",
  "Actions":"section.actions",
  "Forms":"section.forms",
  "Data Table":"section.dataTable",
  "States":"section.states",
  "Interactions":"section.interactions",
  "Dialog & Sheet":"section.overlays",
  "Responsive":"section.responsive",
  "Navigation":"section.navigation",
  "Implementation Map":"section.implementation"
};

const railTokens={
  "workspace-v2.html":"nav.workspace",
  "app-launcher-v2.html":"nav.apps",
  "devices-overview-v2.html":"nav.devices",
  "assets-overview.html":"nav.assets",
  "reports-overview.html":"nav.reports",
  "helpdesk.html":"nav.helpdesk",
  "meeting.html":"nav.meeting",
  "admin.html":"nav.admin"
};

const actionTokens=[
  [/^(Filter|Filters)/i,"action.filter"],
  [/^Columns$/i,"action.columns"],
  [/^(Save|Save Draft|Save Report|Save Policy|Save Dynamic Group)/i,"action.save"],
  [/^(Export|Export PDF|Export Excel)/i,"action.export"],
  [/^(Upload|Upload Audio|Upload & Process)/i,"action.upload"],
  [/^Download/i,"action.download"],
  [/^Refresh/i,"action.refresh"],
  [/^(Add|New|Create)/i,"action.add"],
  [/^Edit$/i,"action.edit"],
  [/^(Delete|Remove)/i,"action.delete"],
  [/^Share$/i,"action.share"],
  [/^Copy$/i,"action.copy"],
  [/^Print$/i,"action.print"],
  [/^(Scan|Scan another|Scan again)$/i,"action.scan"],
  [/^Send/i,"action.send"],
  [/^Control$/i,"action.control"],
  [/^View only$/i,"action.view"],
  [/^Ctrl\+Alt\+Del$/i,"action.keyboard"],
  [/^Clipboard$/i,"action.clipboard"],
  [/^(Fullscreen|Exit fullscreen)$/i,"action.fullscreen"],
  [/^Disconnect$/i,"action.disconnect"]
];

function cleanText(el){
  return (el.textContent||"").replace(/\s+/g," ").trim();
}
function cleanHref(href){
  return (href||"").split("?")[0].split("#")[0];
}
function iconOf(el){
  return el?.querySelector?.("i.fa-solid,i.fa-regular,i.fa-brands")||null;
}
function setIcon(el,token){
  const spec=tokens[token],icon=iconOf(el);
  if(!spec||!icon)return;
  icon.className="fa-solid "+spec.fa;
  icon.dataset.iconToken=token;
  icon.dataset.lucide=spec.lucide;
  icon.setAttribute("aria-hidden","true");
}

function normalizeRail(){
  document.querySelectorAll(".rail a").forEach(a=>{
    const token=railTokens[cleanHref(a.getAttribute("href"))];
    if(token)setIcon(a,token);
  });
}
function normalizeSidebar(){
  document.querySelectorAll(".side a").forEach(a=>{
    const token=labelTokens[cleanText(a)];
    if(token)setIcon(a,token);
  });
}
function normalizeActions(){
  document.querySelectorAll("button,a.btn").forEach(el=>{
    const text=cleanText(el);
    for(const [re,token] of actionTokens){
      if(re.test(text)){setIcon(el,token);break}
    }
  });
  document.querySelectorAll('[data-inno-menu]').forEach(el=>setIcon(el,"action.more"));
  document.querySelectorAll('[data-inno-filter]').forEach(el=>setIcon(el,"action.filter"));
  document.querySelectorAll('[data-inno-columns]').forEach(el=>setIcon(el,"action.columns"));
  document.querySelectorAll(".breadcrumb-back").forEach(el=>setIcon(el,"action.back"));
}
function normalizeSpecials(){
  document.querySelectorAll("i.fa-brands.fa-usb").forEach(i=>{i.className="fa-solid fa-usb";i.dataset.iconToken="device.usb";i.dataset.lucide="Usb"});
  document.querySelectorAll("i.fa-file-export").forEach(i=>{i.classList.remove("fa-file-export");i.classList.add("fa-download");i.dataset.iconToken="action.export";i.dataset.lucide="Download"});
}
function improveA11y(){
  document.querySelectorAll("button,a").forEach(el=>{
    const icon=iconOf(el);if(!icon)return;
    icon.setAttribute("aria-hidden","true");
    const text=cleanText(el);
    if(!text&&!el.getAttribute("aria-label")){
      const label=el.getAttribute("title")||icon.dataset.iconToken||"Action";
      el.setAttribute("aria-label",label);
    }
  });
}

function apply(){
  normalizeRail();normalizeSidebar();normalizeActions();normalizeSpecials();improveA11y();
}
function emitMetrics(){
  const html=document.documentElement;
  const tagged=document.querySelectorAll("[data-icon-token]");
  const missingLabels=[...document.querySelectorAll(".side a")].filter(a=>iconOf(a)&&!iconOf(a).dataset.iconToken);
  const unlabeled=[...document.querySelectorAll("button,a")].filter(el=>iconOf(el)&&!cleanText(el)&&!el.getAttribute("aria-label"));
  html.dataset.iconTagged=String(tagged.length);
  html.dataset.iconUnmappedNav=String(missingLabels.length);
  html.dataset.iconUnlabeledControls=String(unlabeled.length);
}
function init(){
  apply();emitMetrics();
  new MutationObserver(()=>{apply();emitMetrics()}).observe(document.body,{subtree:true,childList:true});
}

window.INNOIcons={tokens,labelTokens,railTokens,apply,get:(token)=>tokens[token]||null};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();