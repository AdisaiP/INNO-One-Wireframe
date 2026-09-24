(function(){
"use strict";

const file=()=>location.pathname.split("/").pop()||"workspace-v2.html";
const cleanHref=v=>(v||"").split("?")[0];

const appRoutes={
  workspace:["workspace-v2.html","notifications.html","profile.html"],
  apps:["app-launcher-v2.html"],
  devices:["devices-overview-v2.html","device-detail-v2.html","device-add.html","device-discovery.html","device-groups.html","remote-operations.html","remote-session.html","remote-consent.html","remote-consent-policy.html","remote-consent-message.html","remote-consent-rules.html","remote-consent-history.html","device-query.html","deployment-jobs.html","deployment-new.html","deployment-job-detail.html","agent-maintenance.html","agent-updates.html","agent-rollout-new.html","software-maintenance.html","software-maintenance-new.html","restart-operations.html","restart-schedule.html","maintenance-history.html","endpoint-policies.html","device-alerts.html","device-alert-rules.html","device-alert-rule.html","device-alert-channels.html","device-alert-history.html"],
  assets:["assets-overview.html","asset-inventory.html","asset-detail.html","asset-ownership.html","asset-users.html","asset-user-detail.html","asset-ownership-submissions.html","asset-custom-fields.html","asset-qr.html","software-licenses.html","contracts-warranty.html"],
  reports:["reports-overview.html","report-builder.html"],
  helpdesk:["helpdesk.html","ticket-detail.html","ticket-new.html","helpdesk-sla.html","helpdesk-settings.html","helpdesk-categories.html","helpdesk-statuses.html","helpdesk-requester-groups.html","helpdesk-calendar.html","helpdesk-notifications.html","helpdesk-notification-rule.html","helpdesk-notification-templates.html","helpdesk-notification-template.html","helpdesk-notification-delivery.html","helpdesk-notification-settings.html","knowledge-base.html","helpdesk-reports.html"],
  meeting:["meeting.html","meeting-detail.html","meeting-new.html"],
  admin:["admin.html","modules.html","roles-permissions-v2.html","access-scopes.html","access-scope-edit.html","access-scope-browser.html","access-scope-evaluate.html","design-system.html"]
};

const railTargets={
  workspace:"workspace-v2.html",
  apps:"app-launcher-v2.html",
  devices:"devices-overview-v2.html",
  assets:"assets-overview.html",
  reports:"reports-overview.html",
  helpdesk:"helpdesk.html",
  meeting:"meeting.html",
  admin:"admin.html"
};

const sideTargetByFile={
  "workspace-v2.html":"workspace-v2.html",
  "notifications.html":"notifications.html",
  "profile.html":"profile.html",
  "app-launcher-v2.html":"app-launcher-v2.html",
  "devices-overview-v2.html":"devices-overview-v2.html",
  "device-detail-v2.html":"devices-overview-v2.html#devices",
  "device-add.html":"deployment-jobs.html",
  "device-discovery.html":"device-discovery.html",
  "device-groups.html":"device-groups.html",
  "remote-operations.html":"remote-operations.html",
  "remote-session.html":"remote-operations.html",
  "remote-consent.html":"remote-consent.html",
  "remote-consent-policy.html":"remote-consent.html",
  "remote-consent-message.html":"remote-consent.html",
  "remote-consent-rules.html":"remote-consent.html",
  "remote-consent-history.html":"remote-consent.html",
  "device-query.html":"device-query.html",
  "deployment-jobs.html":"deployment-jobs.html",
  "deployment-new.html":"deployment-jobs.html",
  "deployment-job-detail.html":"deployment-jobs.html",
  "agent-maintenance.html":"agent-maintenance.html",
  "agent-updates.html":"agent-maintenance.html",
  "agent-rollout-new.html":"agent-maintenance.html",
  "software-maintenance.html":"agent-maintenance.html",
  "software-maintenance-new.html":"agent-maintenance.html",
  "restart-operations.html":"agent-maintenance.html",
  "restart-schedule.html":"agent-maintenance.html",
  "maintenance-history.html":"agent-maintenance.html",
  "endpoint-policies.html":"endpoint-policies.html",
  "device-alerts.html":"device-alerts.html",
  "device-alert-rules.html":"device-alerts.html",
  "device-alert-rule.html":"device-alerts.html",
  "device-alert-channels.html":"device-alerts.html",
  "device-alert-history.html":"device-alerts.html",
  "assets-overview.html":"assets-overview.html",
  "asset-inventory.html":"asset-inventory.html",
  "asset-detail.html":"asset-inventory.html",
  "asset-ownership.html":"asset-ownership.html",
  "asset-users.html":"asset-ownership.html",
  "asset-user-detail.html":"asset-ownership.html",
  "asset-ownership-submissions.html":"asset-ownership.html",
  "asset-custom-fields.html":"asset-ownership.html",
  "asset-qr.html":"asset-qr.html",
  "software-licenses.html":"software-licenses.html",
  "contracts-warranty.html":"contracts-warranty.html",
  "reports-overview.html":"reports-overview.html",
  "report-builder.html":"report-builder.html",
  "helpdesk.html":"helpdesk.html",
  "ticket-detail.html":"helpdesk.html#tickets",
  "ticket-new.html":"helpdesk.html#tickets",
  "helpdesk-sla.html":"helpdesk-sla.html",
  "helpdesk-settings.html":"helpdesk-settings.html",
  "helpdesk-categories.html":"helpdesk-settings.html",
  "helpdesk-statuses.html":"helpdesk-settings.html",
  "helpdesk-requester-groups.html":"helpdesk-settings.html",
  "helpdesk-calendar.html":"helpdesk-settings.html",
  "helpdesk-notifications.html":"helpdesk-notifications.html",
  "helpdesk-notification-rule.html":"helpdesk-notifications.html",
  "helpdesk-notification-templates.html":"helpdesk-notifications.html",
  "helpdesk-notification-template.html":"helpdesk-notifications.html",
  "helpdesk-notification-delivery.html":"helpdesk-notifications.html",
  "helpdesk-notification-settings.html":"helpdesk-notifications.html",
  "knowledge-base.html":"knowledge-base.html",
  "helpdesk-reports.html":"helpdesk-reports.html",
  "meeting.html":"meeting.html",
  "meeting-detail.html":"meeting.html#meetings",
  "meeting-new.html":"meeting-new.html",
  "admin.html":"admin.html",
  "modules.html":"modules.html",
  "roles-permissions-v2.html":"roles-permissions-v2.html",
  "access-scopes.html":"access-scopes.html",
  "access-scope-edit.html":"access-scopes.html",
  "access-scope-browser.html":"access-scopes.html",
  "access-scope-evaluate.html":"access-scopes.html",
  "design-system.html":"#foundations"
};

const hashTargets={
  "workspace-v2.html":{"#continue":"#continue","#attention":"#attention","#recent":"#recent"},
  "devices-overview-v2.html":{"#devices":"#devices"},
  "helpdesk.html":{"#tickets":"#tickets","#assigned":"#assigned","#team":"#team"},
  "meeting.html":{"#upcoming":"meeting.html#upcoming","#meetings":"meeting.html#meetings"},
  "reports-overview.html":{"#hardware":"#hardware","#software":"#software","#assets":"#assets"},
  "design-system.html":{"#foundations":"#foundations","#buttons":"#buttons","#forms":"#forms","#data":"#data","#states":"#states","#interactions":"#interactions","#overlays":"#overlays","#responsive":"#responsive","#freeze":"#freeze","#navigation":"#navigation","#icons":"#icons","#guidelines":"#guidelines"}
};

const parentRoutes={
  "device-detail-v2.html":{href:"devices-overview-v2.html#devices",label:"Back to Devices"},
  "remote-session.html":{href:"remote-operations.html?tab=sessions",label:"Back to Remote Operations"},
  "asset-detail.html":{href:"asset-inventory.html",label:"Back to Asset Inventory"},
  "ticket-detail.html":{href:"helpdesk.html#tickets",label:"Back to Tickets"},
  "ticket-new.html":{href:"helpdesk.html#tickets",label:"Back to Tickets"},
  "meeting-detail.html":{href:"meeting.html#meetings",label:"Back to My Meetings"},
  "meeting-new.html":{href:"meeting.html",label:"Back to Meeting"},
  "helpdesk-notification-rule.html":{href:"helpdesk-notifications.html",label:"Back to Notification Rules"},
  "helpdesk-notification-template.html":{href:"helpdesk-notification-templates.html",label:"Back to Email Templates"},
  "device-alert-rule.html":{href:"device-alert-rules.html",label:"Back to Alert Rules"},
  "deployment-new.html":{href:"deployment-jobs.html",label:"Back to Deployment Jobs"},
  "deployment-job-detail.html":{href:"deployment-jobs.html",label:"Back to Deployment Jobs"},
  "agent-rollout-new.html":{href:"agent-updates.html",label:"Back to Agent Updates"},
  "software-maintenance-new.html":{href:"software-maintenance.html",label:"Back to Software Maintenance"},
  "restart-schedule.html":{href:"restart-operations.html",label:"Back to Restart Operations"},
  "asset-user-detail.html":{href:"asset-users.html",label:"Back to User Profiles"},
  "access-scope-edit.html":{href:"access-scopes.html",label:"Back to Access Scopes"},
  "report-builder.html":{href:"reports-overview.html",label:"Back to Reports"},
  "modules.html":{href:"admin.html",label:"Back to Admin Center"},
  "roles-permissions-v2.html":{href:"admin.html",label:"Back to Admin Center"}
};

function currentApp(){
  const f=file();
  return Object.keys(appRoutes).find(k=>appRoutes[k].includes(f))||"";
}

function normalizeTarget(href){
  if(!href)return"";
  if(href.startsWith("#"))return href;
  return href.split("?")[0];
}

function findSideLink(target){
  const links=[...document.querySelectorAll(".side a")];
  if(!target)return null;
  let hit=links.find(a=>normalizeTarget(a.getAttribute("href"))===target);
  if(hit)return hit;
  if(target.startsWith("#")){
    hit=links.find(a=>{
      const h=a.getAttribute("href")||"";
      return h===target||h.endsWith(target);
    });
  }
  return hit||null;
}

function activeSideTarget(){
  const f=file(),hash=location.hash||"";
  return hashTargets[f]?.[hash]||sideTargetByFile[f]||"";
}

function setRailActive(){
  const target=railTargets[currentApp()];
  const links=[...document.querySelectorAll(".rail a")];
  links.forEach(a=>{a.classList.remove("active");a.removeAttribute("aria-current")});
  if(!target)return;
  const active=links.find(a=>cleanHref(a.getAttribute("href"))===target);
  if(active){active.classList.add("active");active.setAttribute("aria-current","page")}
}

function setSideActive(){
  const links=[...document.querySelectorAll(".side a")];
  links.forEach(a=>{a.classList.remove("active");a.removeAttribute("aria-current")});
  const active=findSideLink(activeSideTarget());
  if(active&&!active.classList.contains("nav-disabled")){
    active.classList.add("active");
    active.setAttribute("aria-current","page");
  }
}

function upgradeKnownLinks(){
  const sideTitle=(document.querySelector(".side-title")?.textContent||"").trim();
  if(sideTitle==="Admin Center"&&!document.querySelector('.side a[href="admin.html"]')){
    const title=document.querySelector(".side-title"), section=document.createElement("div"), link=document.createElement("a");
    section.className="side-section nav-injected-section";section.textContent="Workspace";
    link.href="admin.html";link.innerHTML='<i class="fa-solid fa-house"></i>Overview';
    title.insertAdjacentElement("afterend",link);title.insertAdjacentElement("afterend",section);
  }
  document.querySelectorAll(".side a").forEach(a=>{
    const label=a.textContent.trim().replace(/\s+/g," ");
    if(a.getAttribute("href")==="#"&&label==="Reports"&&(sideTitle==="Devices"||sideTitle==="Assets")){
      a.href="reports-overview.html";
      a.title="Open cross-app Reports";
    }
  });
}

function disablePlaceholderLinks(){
  document.querySelectorAll('a[href="#"]').forEach(a=>{
    if(a.hasAttribute("onclick")||a.dataset.keepPlaceholder==="true")return;
    if(a.classList.contains("nav-disabled"))return;
    a.classList.add("nav-disabled");
    a.setAttribute("aria-disabled","true");
    a.setAttribute("tabindex","-1");
    const label=(a.textContent||"This item").trim().replace(/\s+/g," ");
    a.title=label+" · Coming soon";
    a.addEventListener("click",e=>{
      e.preventDefault();
      window.INNOInteractions?.toast?.(label+" is not available in this prototype yet","info");
    });
  });
}

function enhanceBreadcrumb(){
  const crumb=document.querySelector(".resource-breadcrumb");
  if(!crumb)return;
  crumb.setAttribute("aria-label","Breadcrumb");
  const last=crumb.querySelector("span:last-child");
  if(last)last.setAttribute("aria-current","page");
  const parent=parentRoutes[file()];
  if(!parent||crumb.querySelector(".breadcrumb-back"))return;
  const back=document.createElement("a");
  back.className="breadcrumb-back";
  back.href=parent.href;
  back.title=parent.label;
  back.setAttribute("aria-label",parent.label);
  back.innerHTML='<i class="fa-solid fa-arrow-left"></i>';
  crumb.insertBefore(back,crumb.firstChild);
}

function enhanceRailLabels(){
  const labels={
    "workspace-v2.html":"Home",
    "app-launcher-v2.html":"Apps",
    "devices-overview-v2.html":"Devices",
    "assets-overview.html":"Assets",
    "reports-overview.html":"Reports",
    "helpdesk.html":"Helpdesk",
    "meeting.html":"Meeting",
    "admin.html":"Admin Center"
  };
  document.querySelectorAll(".rail a").forEach(a=>{
    const h=cleanHref(a.getAttribute("href"));
    if(labels[h])a.title=labels[h];
  });
}

function smoothLocalAnchor(){
  document.addEventListener("click",e=>{
    const a=e.target.closest('.side a[href^="#"]:not([href="#"])');
    if(!a)return;
    const id=a.getAttribute("href");
    const target=document.querySelector(id);
    if(!target)return;
    setTimeout(()=>target.scrollIntoView({behavior:"smooth",block:"start"}),0);
  });
}

function emitMetrics(){
  const html=document.documentElement;
  html.dataset.navApp=currentApp();
  html.dataset.navRailActive=String(document.querySelectorAll(".rail a.active").length);
  html.dataset.navSideActive=String(document.querySelectorAll(".side a.active").length);
  html.dataset.navDisabled=String(document.querySelectorAll("a.nav-disabled").length);
  html.dataset.navRawPlaceholders=String([...document.querySelectorAll('a[href="#"]')].filter(a=>!a.classList.contains("nav-disabled")).length);
  html.dataset.navBreadcrumbBack=String(document.querySelectorAll(".breadcrumb-back").length);
  html.dataset.navSideTarget=activeSideTarget();
}

function applyNavigation(){
  upgradeKnownLinks();
  disablePlaceholderLinks();
  enhanceRailLabels();
  setRailActive();
  setSideActive();
  enhanceBreadcrumb();
  emitMetrics();
}

function init(){
  applyNavigation();
  smoothLocalAnchor();
  window.addEventListener("hashchange",()=>{setSideActive();emitMetrics()});
  new MutationObserver(()=>{upgradeKnownLinks();disablePlaceholderLinks();enhanceRailLabels();setRailActive()})
    .observe(document.body,{subtree:true,childList:true});
}

window.INNONavigation={apply:applyNavigation,currentApp,activeSideTarget,setRailActive,setSideActive};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();