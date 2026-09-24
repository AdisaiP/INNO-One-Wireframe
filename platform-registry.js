(function(){
const STORAGE="innoone.platform.prototype.v2";
const defaults={
schemaVersion:10,
currentRole:"platform_admin",
modules:{
devices:{id:"devices",name:"Devices",icon:"fa-desktop",route:"devices-overview-v2.html",description:"Endpoint & remote management",version:"1.0.0",installed:true,enabled:true,pinned:true,requiredPermission:"devices.view",permissions:["devices.view","devices.remote","devices.remote.collaborate","devices.remote.consent.manage","devices.alert.view","devices.alert.manage","devices.manage","devices.scope.manage","devices.policy.manage"],dependencies:["identity","rbac","audit"],events:["device.online","device.offline","remote.started","remote.ended","remote.consent.updated","remote.consent.decided","remote.chat.message","remote.file.sent","remote.file.received","device.alert.created","device.alert.acknowledged","device.alert.rule.updated","device.alert.email.sent"]},
helpdesk:{id:"helpdesk",name:"Helpdesk",icon:"fa-headset",route:"helpdesk.html",description:"Tickets, SLA & support",version:"1.0.0",installed:true,enabled:true,pinned:true,requiredPermission:"helpdesk.ticket.view",permissions:["helpdesk.ticket.view","helpdesk.ticket.create","helpdesk.ticket.assign","helpdesk.ticket.resolve","helpdesk.sla.manage","helpdesk.catalog.manage","helpdesk.status.manage","helpdesk.requester_group.manage","helpdesk.kb.manage","helpdesk.notifications.view","helpdesk.notifications.manage","helpdesk.reports.view"],dependencies:["identity","rbac","notifications","devices","assets","audit"],events:["ticket.created","ticket.assigned","ticket.status.changed","ticket.resolved","sla.at_risk","sla.escalated","ticket.email.sent","ticket.email.failed","ticket.notification.rule.updated"]},
meeting:{id:"meeting",name:"Meeting",icon:"fa-microphone-lines",route:"meeting.html",description:"Record, transcript & summary",version:"0.9.0",installed:true,enabled:true,pinned:true,requiredPermission:"meeting.view",permissions:["meeting.view","meeting.create","meeting.record","meeting.summary.generate","meeting.share"],dependencies:["identity","rbac","notifications","audit"],events:["meeting.created","transcript.completed","summary.completed"]},
workflow:{id:"workflow",name:"Workflow",icon:"fa-diagram-project",route:null,description:"Automation & process designer",version:null,installed:false,enabled:false,pinned:false,requiredPermission:"workflow.view",permissions:["workflow.view","workflow.design","workflow.publish"],dependencies:["identity","rbac","audit"],events:["workflow.published","workflow.started","workflow.completed"]},
reports:{id:"reports",name:"Reports",icon:"fa-chart-column",route:"reports-overview.html",description:"Cross-app reports, builder & exports",version:"1.0.0",installed:true,enabled:true,pinned:true,requiredPermission:"reports.view",permissions:["reports.view","reports.create","reports.manage","reports.export.pdf","reports.export.xlsx"],dependencies:["identity","rbac","devices","assets","helpdesk"],events:["report.created","report.exported"]},
assets:{id:"assets",name:"Assets",icon:"fa-boxes-stacked",route:"assets-overview.html",description:"Asset, inventory, licenses & contracts",version:"1.0.0",installed:true,enabled:true,pinned:true,requiredPermission:"assets.view",permissions:["assets.view","assets.manage","assets.baseline.manage","assets.license.manage","assets.contract.manage","assets.qr.print","assets.qr.scan"],dependencies:["identity","rbac","devices","audit","notifications"],events:["asset.changed","baseline.drift","license.overused","contract.expiring","ownership.changed","asset.qr.generated","asset.qr.scanned"]},
forms:{id:"forms",name:"Forms",icon:"fa-file-circle-plus",route:null,description:"Dynamic form builder",version:null,installed:false,enabled:false,pinned:false,requiredPermission:"forms.view",permissions:["forms.view","forms.design"],dependencies:["identity","rbac"],events:[]}
},
roles:{
platform_admin:{name:"Platform Admin",description:"Full platform administration",permissions:["*"]},
support_agent:{name:"Support Agent",description:"Helpdesk and remote support",permissions:["devices.view","devices.remote","devices.remote.collaborate","devices.alert.view","assets.view","assets.qr.scan","helpdesk.ticket.view","helpdesk.ticket.create","helpdesk.ticket.assign","helpdesk.ticket.resolve","helpdesk.notifications.view","helpdesk.reports.view","meeting.view"]},
employee:{name:"Employee",description:"Standard end-user access",permissions:["devices.view","helpdesk.ticket.view","helpdesk.ticket.create","meeting.view","meeting.create"]}
}};
function load(){try{const raw=localStorage.getItem(STORAGE);if(!raw)return structuredClone(defaults);const saved=JSON.parse(raw);const state=structuredClone(defaults);state.currentRole=saved.currentRole||state.currentRole;for(const id in state.modules)Object.assign(state.modules[id],saved.modules?.[id]||{});if((saved.schemaVersion||0)<10){Object.assign(state.modules.devices,defaults.modules.devices);Object.assign(state.modules.helpdesk,defaults.modules.helpdesk);Object.assign(state.modules.assets,defaults.modules.assets);Object.assign(state.modules.reports,defaults.modules.reports);state.schemaVersion=10;localStorage.setItem(STORAGE,JSON.stringify(state))}return state}catch(e){return structuredClone(defaults)}}
function save(s){localStorage.setItem(STORAGE,JSON.stringify(s));window.dispatchEvent(new CustomEvent("innoone:registry-changed",{detail:s}))}
function state(){return load()}
function role(){const s=state();return s.roles[s.currentRole]||s.roles.employee}
function can(p){const ps=role().permissions;return ps.includes("*")||ps.includes(p)}
function visible(m){return !!(m.installed&&m.enabled&&can(m.requiredPermission))}
function setEnabled(id,value){const s=state();if(!s.modules[id])return;s.modules[id].enabled=!!value;if(value)s.modules[id].installed=true;save(s)}
function setInstalled(id,value){const s=state();if(!s.modules[id])return;s.modules[id].installed=!!value;if(!value)s.modules[id].enabled=false;save(s)}
function setPinned(id,value){const s=state();if(!s.modules[id])return;s.modules[id].pinned=!!value;save(s)}
function setRole(id){const s=state();if(!s.roles[id])return;s.currentRole=id;save(s)}
function reset(){localStorage.removeItem(STORAGE);location.reload()}
function syncNavigation(){const s=state();Object.values(s.modules).forEach(m=>{if(!m.route)return;document.querySelectorAll('a[href="'+m.route+'"]').forEach(a=>{if(a.closest("#dynamicApps")||a.closest("#yourApps"))return;a.style.display=visible(m)?"":"none"})})}
window.INNORegistry={defaults,state,role,can,visible,setEnabled,setInstalled,setPinned,setRole,reset,syncNavigation};
document.addEventListener("DOMContentLoaded",syncNavigation);
window.addEventListener("innoone:registry-changed",syncNavigation);
})();