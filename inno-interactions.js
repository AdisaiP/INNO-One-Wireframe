(function(){
"use strict";

const state={menu:null,drawer:null,dialog:null,lastTrigger:null};

const menus={
  "device-resource":[
    {icon:"fa-arrows-rotate",label:"Refresh inventory",action:"refresh-device"},
    {icon:"fa-layer-group",label:"Move to group",action:"move-device"},
    {icon:"fa-cloud-arrow-down",label:"Update agent",action:"update-agent"},
    {separator:true},
    {icon:"fa-trash",label:"Remove from management",action:"remove-device",danger:true}
  ],
  "ticket-resource":[
    {icon:"fa-note-sticky",label:"Add internal note",action:"internal-note"},
    {icon:"fa-copy",label:"Duplicate ticket",action:"duplicate-ticket"},
    {icon:"fa-print",label:"Print ticket",action:"print"},
    {separator:true},
    {icon:"fa-trash",label:"Delete ticket",action:"delete-ticket",danger:true}
  ],
  "meeting-resource":[
    {icon:"fa-pen",label:"Rename meeting",action:"rename-meeting"},
    {icon:"fa-copy",label:"Duplicate meeting",action:"duplicate-meeting"},
    {icon:"fa-share-nodes",label:"Copy share link",action:"share-meeting"},
    {separator:true},
    {icon:"fa-trash",label:"Delete meeting",action:"delete-meeting",danger:true}
  ],
  "table-row":[
    {icon:"fa-arrow-up-right-from-square",label:"Open",action:"open-row"},
    {icon:"fa-copy",label:"Duplicate",action:"duplicate-row"},
    {icon:"fa-download",label:"Export",action:"export-row"},
    {separator:true},
    {icon:"fa-trash",label:"Delete",action:"delete-row",danger:true}
  ]
};

const filterDefs={
  devices:{
    title:"Device filters",
    description:"Narrow the fleet without changing the saved view.",
    fields:[
      ["Status","select",["All","Online","Offline","Needs attention"]],
      ["Operating system","select",["All","Windows 11","Windows 10","Windows Server"]],
      ["Device type","select",["All","Desktop","Notebook","Server","Virtual"]],
      ["Group","select",["All groups","HR / Bangkok","Finance","IT Operations","Data Center"]],
      ["Last seen","select",["Any time","Last 15 minutes","Today","More than 24 hours","More than 7 days"]]
    ]
  },
  assets:{
    title:"Asset filters",
    description:"Filter inventory by assignment, category and lifecycle.",
    fields:[
      ["Category","select",["All","Computer","Notebook","Monitor","Printer","Network"]],
      ["Status","select",["All","In use","Stock","Repair"]],
      ["Owner","select",["Any owner","Assigned","Unassigned"]],
      ["Location","select",["All locations","Bangkok · F3","Bangkok · F4","Storage A"]],
      ["Source","select",["All","Device sync","Manual","CSV import"]]
    ]
  },
  helpdesk:{
    title:"Ticket filters",
    description:"Filter queue by service context and SLA state.",
    fields:[
      ["Status","select",["Open","In Progress","Waiting","Resolved","All"]],
      ["Priority","select",["All","P1 Critical","P2 High","P3 Normal"]],
      ["Category","select",["All","Network","Hardware","Software","Account & Access"]],
      ["Department","select",["All","HR","Finance","IT","Marketing"]],
      ["Assignee","select",["Anyone","Me","Unassigned","IT Support","Application Team"]],
      ["SLA","select",["All","On track","At risk","Breached"]]
    ]
  },
  activity:{
    title:"Activity filters",
    description:"Filter system events shown in this view.",
    fields:[
      ["Event type","select",["All events","Assignment","Status change","Reply","Remote action"]],
      ["Actor","select",["Anyone","Me","System","Support Team"]],
      ["Date","select",["Any time","Today","Last 7 days","Last 30 days"]]
    ]
  },
  meeting:{
    title:"Meeting filters",
    description:"Filter meetings by state, source and date.",
    fields:[
      ["Status","select",["All","Summary ready","Transcript only","Processing"]],
      ["Source","select",["All","Agent","Upload"]],
      ["Language","select",["All","Thai","English"]],
      ["Date","select",["Any time","Today","This week","This month"]]
    ]
  }
};

const columnDefs={
  devices:["Device","Type","Status","User","OS","Group","IP address","Serial","Last Seen"],
  assets:["Asset","Category","Brand / Model","Serial","Owner","Location","Registered","Source","Status"],
  helpdesk:["Ticket","Subject","Category","Priority","Urgency","Department","Status","Assignee","SLA"]
};

function ensureUI(){
  if(document.getElementById("innoInteractionRoot"))return;
  const root=document.createElement("div");
  root.id="innoInteractionRoot";
  root.innerHTML=
    '<div class="inno-toast-stack" id="innoToastStack" aria-live="polite"></div>'+
    '<div class="inno-menu" id="innoContextMenu" role="menu"></div>'+
    '<div class="inno-confirm-backdrop" id="innoConfirmBackdrop" aria-hidden="true">'+
      '<div class="inno-confirm" role="dialog" aria-modal="true" aria-labelledby="innoConfirmTitle">'+
        '<div class="inno-confirm-icon" id="innoConfirmIcon"><i class="fa-solid fa-triangle-exclamation"></i></div>'+
        '<div class="inno-confirm-copy"><h3 id="innoConfirmTitle"></h3><p id="innoConfirmText"></p></div>'+
        '<div class="inno-confirm-actions"><button class="btn secondary" id="innoConfirmCancel">Cancel</button><button class="btn danger" id="innoConfirmOk">Confirm</button></div>'+
      '</div>'+
    '</div>'+
    '<div class="drawer-backdrop inno-generated-drawer" id="innoFilterDrawer" aria-hidden="true">'+
      '<aside class="drawer"><div class="drawer-head"><div class="resource-icon" style="width:36px;height:36px;font-size:14px"><i class="fa-solid fa-filter"></i></div><div class="grow"><h3 id="innoFilterTitle">Filters</h3><p id="innoFilterDescription"></p></div><button class="platform-header-icon" data-inno-close-drawer><i class="fa-solid fa-xmark"></i></button></div>'+
      '<div class="drawer-body"><div class="form" id="innoFilterFields"></div></div>'+
      '<div class="drawer-foot"><button class="btn ghost" id="innoFilterReset">Reset</button><span class="grow"></span><button class="btn secondary" data-inno-close-drawer>Cancel</button><button class="btn" id="innoFilterApply">Apply Filters</button></div></aside>'+
    '</div>';
  document.body.appendChild(root);
}

function toast(message,type="success",opts={}){
  ensureUI();
  const stack=document.getElementById("innoToastStack");
  const icons={success:"fa-circle-check",warning:"fa-triangle-exclamation",error:"fa-circle-xmark",info:"fa-circle-info"};
  const t=document.createElement("div");
  t.className="inno-toast "+type;
  const urgent=type==="error"||type==="warning";
  t.setAttribute("role",urgent?"alert":"status");t.setAttribute("aria-live",urgent?"assertive":"polite");
  t.innerHTML='<i class="fa-solid '+(icons[type]||icons.info)+'"></i><div class="grow"><b>'+(opts.title||({success:"Success",warning:"Attention",error:"Something went wrong",info:"Information"}[type]))+'</b><span>'+message+'</span></div><button class="platform-header-icon" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
  t.querySelector("button").onclick=()=>dismissToast(t);
  stack.appendChild(t);
  while(stack.children.length>4)stack.firstElementChild?.remove();
  requestAnimationFrame(()=>t.classList.add("show"));
  setTimeout(()=>dismissToast(t),opts.duration||2800);
}
function dismissToast(t){if(!t||!t.isConnected)return;t.classList.remove("show");setTimeout(()=>t.remove(),180)}

function confirmAction(opts={}){
  ensureUI();
  const b=document.getElementById("innoConfirmBackdrop"),ok=document.getElementById("innoConfirmOk"),cancel=document.getElementById("innoConfirmCancel"),icon=document.getElementById("innoConfirmIcon");
  document.getElementById("innoConfirmTitle").textContent=opts.title||"Confirm action";
  document.getElementById("innoConfirmText").textContent=opts.description||"Are you sure you want to continue?";
  ok.textContent=opts.confirmLabel||"Confirm";
  ok.className="btn "+(opts.variant==="danger"?"danger":"");
  icon.className="inno-confirm-icon "+(opts.variant==="danger"?"danger":"");
  state.dialog=b;state.lastTrigger=document.activeElement;
  b.classList.add("open");b.setAttribute("aria-hidden","false");
  const close=()=>{b.classList.remove("open");b.setAttribute("aria-hidden","true");state.dialog=null;setTimeout(()=>state.lastTrigger?.focus?.(),0)};
  cancel.onclick=close;
  ok.onclick=()=>{close();if(typeof opts.onConfirm==="function")opts.onConfirm()};
  b.onmousedown=e=>{if(e.target===b)close()};
  setTimeout(()=>cancel.focus(),0);
  return close;
}

function openDialog(target,trigger=document.activeElement){
  const d=typeof target==="string"?document.querySelector(target):target;if(!d)return null;
  state.dialog=d;state.lastTrigger=trigger;d.hidden=false;d.classList.add("open");d.setAttribute("aria-hidden","false");
  const focusable=[...d.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]")];setTimeout(()=>focusable[0]?.focus?.(),0);
  return ()=>closeDialog(d);
}
function closeDialog(target=state.dialog){
  const d=typeof target==="string"?document.querySelector(target):target;if(!d)return;d.classList.remove("open");d.setAttribute("aria-hidden","true");if(state.dialog===d)state.dialog=null;setTimeout(()=>state.lastTrigger?.focus?.(),0);
}

function closeMenu(){
  const menu=document.getElementById("innoContextMenu");
  if(menu){menu.classList.remove("open");menu.innerHTML=""}
  if(state.lastTrigger?.matches?.("[data-inno-menu],[data-inno-columns]"))state.lastTrigger.setAttribute("aria-expanded","false");
  state.menu=null;
}
function openMenu(trigger,key){
  ensureUI();closeMenu();
  const list=menus[key]||menus["table-row"],menu=document.getElementById("innoContextMenu");
  state.menu=menu;state.lastTrigger=trigger;trigger.setAttribute("aria-haspopup","menu");trigger.setAttribute("aria-expanded","true");
  menu.innerHTML=list.map(item=>item.separator?'<div class="inno-menu-separator"></div>':'<button class="inno-menu-item '+(item.danger?'danger':'')+'" role="menuitem" data-action="'+item.action+'"><i class="fa-solid '+item.icon+'"></i><span>'+item.label+'</span></button>').join("");
  const r=trigger.getBoundingClientRect(),w=210;
  menu.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.right-w))+"px";
  menu.style.top=Math.min(window.innerHeight-12,r.bottom+6)+"px";
  menu.classList.add("open");
  menu.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{const action=b.dataset.action;closeMenu();runMenuAction(action,trigger)});
  menu.onkeydown=e=>{const items=[...menu.querySelectorAll("button:not([disabled])")];if(!items.length)return;let i=items.indexOf(document.activeElement);if(e.key==="ArrowDown"){e.preventDefault();items[(i+1+items.length)%items.length].focus()}if(e.key==="ArrowUp"){e.preventDefault();items[(i-1+items.length)%items.length].focus()}if(e.key==="Home"){e.preventDefault();items[0].focus()}if(e.key==="End"){e.preventDefault();items[items.length-1].focus()}if(e.key==="Escape"){e.preventDefault();closeMenu();trigger.focus()}if(e.key==="Tab")closeMenu()};
  setTimeout(()=>menu.querySelector("button")?.focus(),0);
}
function runMenuAction(action,trigger){
  const row=trigger.closest("tr,.queue-row,.meeting-row,.activity-item");
  const label=(row?.querySelector("b,.queue-subject")?.textContent||"item").trim();
  const destructive={
    "remove-device":["Remove device from management?","The endpoint will stop being managed by INNO.One.","Remove device"],
    "delete-ticket":["Delete this ticket?","This prototype demonstrates the destructive confirmation pattern.","Delete ticket"],
    "delete-meeting":["Delete this meeting?","The meeting, transcript and generated summary would be removed.","Delete meeting"],
    "delete-row":["Delete "+label+"?","This action cannot be undone.","Delete"]
  };
  if(destructive[action]){
    const [title,description,confirmLabel]=destructive[action];
    return confirmAction({title,description,confirmLabel,variant:"danger",onConfirm:()=>toast(confirmLabel+" completed","success")});
  }
  const messages={
    "refresh-device":"Inventory refresh requested",
    "move-device":"Move-to-group drawer would open",
    "update-agent":"Agent update queued",
    "internal-note":"Internal note composer opened",
    "duplicate-ticket":"Ticket duplicated",
    "print":"Print preview opened",
    "rename-meeting":"Rename form opened",
    "duplicate-meeting":"Meeting duplicated",
    "share-meeting":"Share link copied",
    "open-row":"Item opened",
    "duplicate-row":"Item duplicated",
    "export-row":"Export prepared"
  };
  toast(messages[action]||"Action completed","success");
}

function openFilterDrawer(key,trigger){
  ensureUI();
  const def=filterDefs[key]||filterDefs.activity,d=document.getElementById("innoFilterDrawer");
  document.getElementById("innoFilterTitle").textContent=def.title;
  document.getElementById("innoFilterDescription").textContent=def.description;
  document.getElementById("innoFilterFields").innerHTML=def.fields.map((f,i)=>'<div class="field"><label>'+f[0]+'</label><select data-filter-field="'+i+'">'+f[2].map(v=>'<option>'+v+'</option>').join("")+'</select></div>').join("");
  let applied=[];
  try{applied=JSON.parse(trigger.dataset.innoFilterValues||"[]")}catch(e){applied=[]}
  d.querySelectorAll("select").forEach((s,i)=>{if(Number.isInteger(applied[i])&&applied[i]>=0&&applied[i]<s.options.length)s.selectedIndex=applied[i]});
  state.drawer=d;state.lastTrigger=trigger;
  d.classList.add("open");d.setAttribute("aria-hidden","false");
  const commit=(values,kind)=>{
    trigger.dataset.innoFilterValues=JSON.stringify(values);
    const count=values.filter(v=>v>0).length,badge=trigger.querySelector(".tag");if(badge)badge.textContent=String(count);
    trigger.dispatchEvent(new CustomEvent("inno:filters-applied",{bubbles:true,detail:{key,values,count,reset:kind==="reset"}}));
    document.documentElement.dataset.uiFilterCount=String(count);
    toast(kind==="reset"?"Filters reset":count?count+" filters applied":"Showing all results",kind==="reset"?"info":"success");
  };
  document.getElementById("innoFilterReset").onclick=()=>{const values=[...d.querySelectorAll("select")].map(s=>(s.selectedIndex=0));commit(values,"reset")};
  document.getElementById("innoFilterApply").onclick=()=>{const values=[...d.querySelectorAll("select")].map(s=>s.selectedIndex);commit(values,"apply");closeDrawer(d)};
  d.querySelectorAll("[data-inno-close-drawer]").forEach(b=>b.onclick=()=>closeDrawer(d));
  d.onmousedown=e=>{if(e.target===d)closeDrawer(d)};
  setTimeout(()=>d.querySelector("select")?.focus(),0);
}
function closeDrawer(d=state.drawer){
  if(!d)return;d.classList.remove("open");d.setAttribute("aria-hidden","true");state.drawer=null;setTimeout(()=>state.lastTrigger?.focus?.(),0);
}

function openColumns(trigger,key){
  ensureUI();closeMenu();
  const table=trigger.closest(".panel,.card")?.querySelector("table")||document.querySelector("table");
  let columns=[];
  if(table){columns=[...table.querySelectorAll("thead th")].map((th,i)=>({label:th.textContent.trim()||"Selection",index:i,visible:th.style.display!=="none"})).filter(x=>x.label!=="Selection")}
  if(!columns.length)columns=(columnDefs[key]||columnDefs.devices).map((label,index)=>({label,index,visible:index<7}));
  const menu=document.getElementById("innoContextMenu");
  menu.innerHTML='<div class="inno-menu-title">Visible columns</div>'+columns.map(c=>'<label class="inno-menu-check"><input type="checkbox" data-col-index="'+c.index+'" '+(c.visible?'checked':'')+'><span>'+c.label+'</span></label>').join("")+'<div class="inno-menu-separator"></div><button class="inno-menu-item" data-column-apply><i class="fa-solid fa-check"></i><span>Apply columns</span></button>';
  const r=trigger.getBoundingClientRect(),w=230;
  menu.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.right-w))+"px";menu.style.top=Math.min(window.innerHeight-12,r.bottom+6)+"px";menu.classList.add("open");state.menu=menu;state.lastTrigger=trigger;trigger.setAttribute("aria-haspopup","menu");trigger.setAttribute("aria-expanded","true");
  menu.querySelector("[data-column-apply]").onclick=()=>{const checks=[...menu.querySelectorAll("[data-col-index]")];if(table){checks.forEach(c=>{const idx=Number(c.dataset.colIndex);[...table.rows].forEach(row=>{if(row.cells[idx])row.cells[idx].style.display=c.checked?"":"none"})})}const n=checks.filter(c=>c.checked).length;closeMenu();toast(n+" columns visible","success")};
}

function enhanceDialogs(){
  document.querySelectorAll(".ds-dialog-backdrop").forEach(d=>{if(d.dataset.innoEnhanced)return;d.dataset.innoEnhanced="1";d.setAttribute("aria-hidden",d.classList.contains("open")?"false":"true");d.addEventListener("mousedown",e=>{if(e.target===d){if(state.dialog===d)closeDialog(d);else{d.classList.remove("open");d.setAttribute("aria-hidden","true")}}})})
}
function enhanceDrawers(){
  document.querySelectorAll(".drawer-backdrop").forEach(d=>{
    if(d.dataset.innoEnhanced)return;d.dataset.innoEnhanced="1";
    d.setAttribute("aria-hidden",d.classList.contains("open")?"false":"true");
    d.addEventListener("mousedown",e=>{if(e.target===d){d.classList.remove("open");d.setAttribute("aria-hidden","true")}});
  });
}
function enhanceTabs(){
  document.querySelectorAll(".surface-tabs,.detail-tabs,.asset-tabs").forEach(tablist=>{
    if(tablist.dataset.innoEnhanced)return;tablist.dataset.innoEnhanced="1";tablist.setAttribute("role","tablist");
    const tabs=[...tablist.querySelectorAll("button")];tabs.forEach((b,i)=>{b.setAttribute("role","tab");b.setAttribute("aria-selected",b.classList.contains("active")?"true":"false");b.tabIndex=b.classList.contains("active")?0:-1;b.addEventListener("click",()=>tabs.forEach(x=>{x.setAttribute("aria-selected",x.classList.contains("active")?"true":"false");x.tabIndex=x.classList.contains("active")?0:-1}));b.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();let j=i;if(e.key==="ArrowRight")j=(i+1)%tabs.length;if(e.key==="ArrowLeft")j=(i-1+tabs.length)%tabs.length;if(e.key==="Home")j=0;if(e.key==="End")j=tabs.length-1;tabs[j].focus();tabs[j].click()})});
  });
}
function enhancePagination(){
  document.querySelectorAll(".ds-pages").forEach(group=>{
    group.addEventListener("click",e=>{const b=e.target.closest(".ds-page");if(!b||!/^\d+$/.test(b.textContent.trim()))return;group.querySelectorAll(".ds-page").forEach(x=>x.classList.remove("active"));b.classList.add("active");toast("Page "+b.textContent.trim()+" loaded","info",{duration:1600})});
  });
}
function enhanceSearch(){
  document.querySelectorAll(".ds-search input,.filterbar input,.launch-search,[data-inno-search-target]").forEach(input=>{
    if(input.dataset.innoEnhanced)return;input.dataset.innoEnhanced="1";
    const apply=()=>{
      const sel=input.dataset.innoSearchTarget;if(!sel)return;
      const target=document.querySelector(sel);if(!target)return;
      const q=String(input.value||"").trim().toLowerCase();
      [...target.children].forEach(row=>{
        if(row.classList.contains("inno-state-row")||row.classList.contains("inno-search-empty"))return;
        const hay=(row.dataset.search||row.textContent||"").toLowerCase();
        row.style.display=!q||hay.includes(q)?"":"none";
      });
      document.documentElement.dataset.uiSearchQuery=q;
    };
    input.addEventListener("input",apply);
    input.addEventListener("keydown",e=>{if(e.key==="Escape"&&input.value){input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));toast("Search cleared","info",{duration:1300})}});
    apply();
  });
}
function wireDataActions(){
  document.addEventListener("click",e=>{
    const menu=e.target.closest("[data-inno-menu]");if(menu){e.preventDefault();e.stopPropagation();openMenu(menu,menu.dataset.innoMenu);return}
    const filter=e.target.closest("[data-inno-filter]");if(filter){e.preventDefault();openFilterDrawer(filter.dataset.innoFilter,filter);return}
    const cols=e.target.closest("[data-inno-columns]");if(cols){e.preventDefault();openColumns(cols,cols.dataset.innoColumns);return}
    const c=e.target.closest("[data-inno-confirm]");if(c){e.preventDefault();const variant=c.dataset.innoVariant||"danger";confirmAction({title:c.dataset.innoTitle||"Confirm action",description:c.dataset.innoDescription||"Are you sure you want to continue?",confirmLabel:c.dataset.innoConfirm||"Confirm",variant,onConfirm:()=>toast(c.dataset.innoSuccess||"Action completed","success")});return}
  });
  document.addEventListener("mousedown",e=>{const menu=document.getElementById("innoContextMenu");if(menu?.classList.contains("open")&&!menu.contains(e.target)&&!e.target.closest("[data-inno-menu],[data-inno-columns]"))closeMenu()});
}

const dirtyScopes=new Set();

function scopeFor(node){
  if(!node)return document.querySelector(".content")||document.body;
  return node.closest?.(".ds-dialog,.drawer,.arch-editor,.form-layout,.builder-grid,.settings-layout,.notification-grid,.content")||document.querySelector(".content")||document.body;
}
function ensureSaveState(scope){
  if(!scope)return null;
  let indicator=scope.querySelector(":scope > .editor-save-state,[data-inno-save-state]");
  if(indicator)return indicator;
  const save=scope.querySelector("[data-inno-save]");
  if(!save)return null;
  const area=save.closest(".arch-editor-actions,.form-footer,.editor-footer,.sticky-actions,.actions,.ds-dialog-foot")||save.parentElement;
  if(!area)return null;
  indicator=document.createElement("span");
  indicator.className="editor-save-state";
  indicator.dataset.innoSaveState="1";
  indicator.textContent="No changes";
  area.insertBefore(indicator,save);
  return indicator;
}
function refreshActionDocks(){
  requestAnimationFrame(()=>document.querySelectorAll(".inno-editor-footer:not([data-inno-dock-disabled])").forEach(f=>f.__innoDockUpdate?.()));
}
function setDirtyState(scopeOrNode,status="unsaved"){
  const scope=scopeOrNode?.matches?.(".content,.arch-editor,.form-layout,.builder-grid,.settings-layout,.notification-grid,.ds-dialog,.drawer")?scopeOrNode:scopeFor(scopeOrNode);
  if(!scope)return;
  const indicator=ensureSaveState(scope);
  if(indicator){
    indicator.classList.remove("is-unsaved","is-saving","is-saved","is-error");
    const labels={unsaved:"Unsaved changes",saving:"Saving…",saved:"Saved",error:"Save failed",clean:"No changes"};
    if(status!=="clean")indicator.classList.add("is-"+status);
    indicator.textContent=labels[status]||labels.clean;
  }
  if(status==="unsaved"||status==="error"){scope.dataset.innoDirty="true";dirtyScopes.add(scope)}
  if(status==="clean"||status==="saved"){delete scope.dataset.innoDirty;dirtyScopes.delete(scope)}
  document.documentElement.dataset.uiDirtyCount=String(dirtyScopes.size);
  refreshActionDocks();
}
function markClean(scopeOrNode,opts={}){
  const scope=scopeOrNode?.dataset?.innoDirty!==undefined||scopeOrNode?.querySelector?.("[data-inno-save]")?scopeOrNode:scopeFor(scopeOrNode);
  if(!scope)return;
  setDirtyState(scope,opts.saved?"saved":"clean");
  if(opts.saved)setTimeout(()=>{if(!scope.dataset.innoDirty)setDirtyState(scope,"clean")},opts.restoreAfter||1600);
}
function markDirty(node){
  const scope=scopeFor(node);
  if(!scope?.querySelector?.("[data-inno-save]"))return;
  setDirtyState(scope,"unsaved");
}
function isDirty(scopeOrNode){
  const scope=scopeOrNode?scopeFor(scopeOrNode):null;
  return scope?scope.dataset.innoDirty==="true":dirtyScopes.size>0;
}
function clearValidation(control){
  if(!control)return;
  control.removeAttribute("aria-invalid");
  const field=control.closest(".field");
  field?.classList.remove("is-invalid");
  field?.querySelector(":scope > .field-error")?.remove();
}
function validateScope(scopeOrNode){
  const scope=scopeOrNode?.querySelectorAll?scopeOrNode:scopeFor(scopeOrNode);
  if(!scope)return true;
  const controls=[...scope.querySelectorAll("input[required],select[required],textarea[required],[data-inno-required]")].filter(c=>!c.disabled&&!c.closest("[hidden]"));
  let first=null;
  controls.forEach(control=>{
    let valid=true;
    if(control.type==="checkbox")valid=control.checked;
    else if(control.type==="radio"){
      const name=control.name;
      valid=name?[...scope.querySelectorAll('input[type="radio"][name="'+CSS.escape(name)+'"]')].some(x=>x.checked):control.checked;
    }else if(typeof control.checkValidity==="function")valid=control.checkValidity();
    else valid=String(control.value||"").trim()!=="";
    if(valid){clearValidation(control);return}
    control.setAttribute("aria-invalid","true");
    const field=control.closest(".field");
    if(field){
      field.classList.add("is-invalid");
      if(!field.querySelector(":scope > .field-error")){
        const msg=document.createElement("div");msg.className="field-error";msg.textContent=control.dataset.innoRequiredMessage||"This field is required.";field.appendChild(msg);
      }
    }
    if(!first)first=control;
  });
  if(first){first.focus();toast("Check the highlighted fields and try again.","error",{title:"Validation error"});return false}
  return true;
}
function enhanceDirtyTracking(){
  document.querySelectorAll("[data-inno-save]").forEach(save=>{
    if(save.dataset.innoDirtyPrepared)return;
    save.dataset.innoDirtyPrepared="1";
    ensureSaveState(scopeFor(save));
  });
}
function enhanceBulkSelection(){
  document.querySelectorAll("[data-inno-bulkbar]").forEach(bar=>{
    if(bar.dataset.innoBulkBound)return;bar.dataset.innoBulkBound="1";
    const host=bar.closest(".card,.panel")||bar.parentElement?.parentElement||document;
    const all=host.querySelector("[data-inno-select-all]");
    const rows=[...host.querySelectorAll("[data-inno-select-row]")];
    const count=bar.querySelector("[data-inno-selected-count]");
    const update=()=>{
      const n=rows.filter(x=>x.checked).length;
      if(count)count.textContent=String(n);
      bar.classList.toggle("show",n>0);
      rows.forEach(x=>x.closest("tr")?.setAttribute("aria-selected",x.checked?"true":"false"));
      if(all){all.checked=n===rows.length&&n>0;all.indeterminate=n>0&&n<rows.length}
      document.documentElement.dataset.uiBulkSelected=String(n);
    };
    rows.forEach(x=>x.addEventListener("change",update));
    all?.addEventListener("change",()=>{rows.forEach(x=>x.checked=all.checked);update()});
    update();
  });
}
function confirmDiscard(scope,onDiscard){
  confirmAction({title:"Discard unsaved changes?",description:"Changes made on this screen have not been saved.",confirmLabel:"Discard changes",variant:"danger",onConfirm:()=>{markClean(scope);onDiscard?.()}});
}
function bindInteractionConsistency(){
  if(document.documentElement.dataset.innoInteractionConsistency)return;
  document.documentElement.dataset.innoInteractionConsistency="1";
  document.documentElement.dataset.uiDirtyCount=String(dirtyScopes.size);
  document.addEventListener("input",e=>{
    const c=e.target.closest?.("input,select,textarea,[contenteditable=true]");if(!c)return;
    clearValidation(c);
    if(c.closest(".ds-search,.filterbar,.inno-generated-drawer")||c.matches("[data-inno-ignore-dirty]"))return;
    markDirty(c);
  });
  document.addEventListener("change",e=>{
    const c=e.target.closest?.("input,select,textarea");if(!c)return;
    clearValidation(c);
    if(c.closest(".ds-search,.filterbar,.inno-generated-drawer")||c.matches(".ds-checkbox,[data-inno-ignore-dirty]"))return;
    markDirty(c);
  });
  document.addEventListener("click",e=>{
    const dirtyToggle=e.target.closest?.("[data-inno-dirty],button[data-mode],.scope-type-toggle button,.field-chip,.toggle");
    if(dirtyToggle)markDirty(dirtyToggle);
  });
  document.addEventListener("click",e=>{
    const trigger=e.target.closest?.("a[href],button");if(!trigger||trigger.matches("[data-inno-save]")||trigger.closest("#innoInteractionRoot"))return;
    const text=(trigger.textContent||"").trim();
    const cancel=trigger.matches("[data-inno-cancel]")||/^Cancel$/i.test(text);
    const href=trigger.matches("a[href]")?trigger.getAttribute("href"):null;
    const externalNav=href&&href!=="#"&&!href.startsWith("javascript:")&&!href.startsWith("#")&&!trigger.hasAttribute("download");
    const scope=scopeFor(trigger);
    const targetScope=scope?.dataset?.innoDirty==="true"?scope:[...dirtyScopes][0];
    if(!targetScope||(!cancel&&!externalNav))return;
    if(externalNav&&href&&new URL(href,location.href).href===location.href)return;
    e.preventDefault();e.stopImmediatePropagation();
    confirmDiscard(targetScope,()=>{
      if(externalNav)location.href=href;
      else{
        const dialog=trigger.closest(".ds-dialog-backdrop");if(dialog)closeDialog(dialog);
        const drawer=trigger.closest(".drawer-backdrop");if(drawer)closeDrawer(drawer);
      }
    });
  },true);
  window.addEventListener("beforeunload",e=>{if(!dirtyScopes.size)return;e.preventDefault();e.returnValue=""});
}

function handleEscape(){
  document.addEventListener("keydown",e=>{
    if(e.key==="Tab"&&state.dialog?.classList.contains("open")){
      const focusable=[...state.dialog.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]")];
      if(focusable.length){const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
      return;
    }
    if(e.key!=="Escape")return;
    if(state.dialog?.classList.contains("open")){if(state.dialog.id==="innoConfirmBackdrop")document.getElementById("innoConfirmCancel")?.click();else closeDialog(state.dialog);return}
    if(state.drawer?.classList.contains("open")){closeDrawer();return}
    const openDrawer=[...document.querySelectorAll(".drawer-backdrop.open")].pop();if(openDrawer){openDrawer.classList.remove("open");openDrawer.setAttribute("aria-hidden","true");return}
    const openDialog=[...document.querySelectorAll(".ds-dialog-backdrop.open")].pop();if(openDialog){openDialog.classList.remove("open");openDialog.setAttribute("aria-hidden","true");return}
    if(state.menu?.classList.contains("open")){closeMenu();state.lastTrigger?.focus?.()}
  });
}

function enhanceComponentSemantics(){
  document.querySelectorAll(".section-subnav").forEach(nav=>{
    if(!nav.hasAttribute("aria-label"))nav.setAttribute("aria-label","Section navigation");
    nav.querySelectorAll("a").forEach(a=>{if(a.classList.contains("active"))a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  });
  document.querySelectorAll(".field").forEach((field,index)=>{
    const label=field.querySelector(":scope > label"),control=field.querySelector(":scope > input,:scope > select,:scope > textarea");
    if(!label||!control)return;
    if(!control.id)control.id="inno-field-"+index;
    if(!label.htmlFor)label.htmlFor=control.id;
    if(control.required)field.classList.add("required");
  });
  document.querySelectorAll(".table-wrap").forEach((wrap,index)=>{
    if(!wrap.getAttribute("role"))wrap.setAttribute("role","region");
    if(!wrap.getAttribute("aria-label")){
      const title=wrap.closest(".panel,.card")?.querySelector(".panel-head h3,.section-title h3")?.textContent?.trim();
      wrap.setAttribute("aria-label",(title||"Data")+" table");
    }
  });
  document.querySelectorAll(".table thead th").forEach(th=>{if(!th.hasAttribute("scope"))th.setAttribute("scope","col")});
  document.querySelectorAll(".ds-dialog-backdrop .ds-dialog,.drawer-backdrop .drawer").forEach(panel=>{panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true")});
  document.querySelectorAll(".icon-btn,.platform-header-icon").forEach(b=>{if(!b.getAttribute("aria-label")&&b.title)b.setAttribute("aria-label",b.title)});
  const head=document.querySelector(".page-head");
  if(head){
    const buttons=[...head.querySelectorAll(".actions .btn")];
    document.documentElement.dataset.uiHeadPrimary=String(buttons.filter(b=>![...b.classList].some(x=>["secondary","ghost","danger"].includes(x))).length);
    document.documentElement.dataset.uiHeadSecondary=String(buttons.filter(b=>[...b.classList].some(x=>["secondary","ghost","danger"].includes(x))).length);
  }
  document.documentElement.dataset.uiSubnavActive=String(document.querySelectorAll(".section-subnav a.active").length);
  document.documentElement.dataset.uiFieldLabels=String(document.querySelectorAll(".field>label[for]").length);
  document.documentElement.dataset.uiTableRegions=String(document.querySelectorAll(".table-wrap[role=\"region\"]").length);
}

function enhanceActionDock(){
  const selector=".inno-editor-footer:not([data-inno-dock-disabled])";
  const footers=[...document.querySelectorAll(selector)];
  if(!footers.length)return;

  footers.forEach(footer=>{
    if(footer.dataset.innoDockBound)return;
    footer.dataset.innoDockBound="1";
    const owner=footer.parentElement;
    if(!owner)return;
    owner.classList.add("inno-action-dock-owner");
    const placeholder=document.createElement("div");
    placeholder.className="inno-action-dock-placeholder";
    footer.parentNode.insertBefore(placeholder,footer);

    const update=()=>{
      if(!footer.isConnected||!owner.isConnected)return;
      const wasDocked=footer.classList.contains("is-docked");
      if(wasDocked){
        footer.classList.remove("is-docked");
        footer.style.left="";
        footer.style.width="";
        placeholder.classList.remove("active");
        placeholder.style.height="";
        owner.classList.remove("has-docked-actions");
      }

      const natural=footer.getBoundingClientRect();
      const ownerRect=owner.getBoundingClientRect();
      const footerHeight=Math.max(58,Math.round(natural.height));
      const dockBottom=window.innerHeight-(window.innerWidth<=850?6:10);
      const scope=scopeFor(footer);
      const isDirty=scope?.dataset?.innoDirty==="true";
      const needsDock=isDirty && natural.bottom>dockBottom && ownerRect.top<dockBottom-footerHeight && ownerRect.bottom>72;

      if(needsDock){
        placeholder.style.height=footerHeight+"px";
        placeholder.classList.add("active");
        owner.classList.add("has-docked-actions");
        footer.classList.add("is-docked");
        const currentOwner=owner.getBoundingClientRect();
        footer.style.left=Math.round(currentOwner.left)+"px";
        footer.style.width=Math.round(currentOwner.width)+"px";
      }
    };

    footer.__innoDockUpdate=update;
    requestAnimationFrame(update);
  });

  if(!document.documentElement.dataset.innoActionDock){
    document.documentElement.dataset.innoActionDock="1";
    let raf=0;
    const refresh=()=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>document.querySelectorAll(selector).forEach(f=>f.__innoDockUpdate?.()));
    };
    window.addEventListener("scroll",refresh,{passive:true});
    window.addEventListener("resize",refresh);
    if(window.ResizeObserver)new ResizeObserver(refresh).observe(document.querySelector(".main")||document.body);
  }
}

function init(){
  ensureUI();wireDataActions();enhanceDialogs();enhanceDrawers();enhanceTabs();enhancePagination();enhanceSearch();enhanceComponentSemantics();enhanceDirtyTracking();enhanceBulkSelection();bindInteractionConsistency();handleEscape();enhanceActionDock();
  if(typeof window.showToast==="function")window.showToast=(message,type="success")=>toast(message,type);
  document.querySelectorAll("[data-inno-menu],[data-inno-columns]").forEach(x=>{x.setAttribute("aria-haspopup","menu");x.setAttribute("aria-expanded","false")});
  document.querySelectorAll("[data-inno-filter],[data-inno-confirm]").forEach(x=>x.setAttribute("aria-haspopup","dialog"));
  const obs=new MutationObserver(()=>{enhanceDialogs();enhanceDrawers();enhanceTabs();enhanceSearch();enhanceComponentSemantics();enhanceDirtyTracking();enhanceBulkSelection();enhanceActionDock()});obs.observe(document.body,{childList:true,subtree:true});
}
window.INNOInteractions={toast,confirm:confirmAction,dialog:openDialog,closeDialog,menu:openMenu,filters:openFilterDrawer,columns:openColumns,closeDrawer,scopeFor,validateScope,markDirty,markClean,setDirtyState,isDirty,confirmDiscard};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();