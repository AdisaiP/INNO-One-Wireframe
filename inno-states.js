(function(){
"use strict";

const icons={
  empty:"fa-inbox",
  noResults:"fa-magnifying-glass",
  error:"fa-circle-exclamation",
  permission:"fa-lock",
  offline:"fa-plug-circle-xmark",
  disabled:"fa-toggle-off",
  partial:"fa-triangle-exclamation",
  loading:"fa-circle-notch"
};

const defaults={
  empty:{title:"Nothing here yet",description:"There is no data to show in this view."},
  noResults:{title:"No results found",description:"Try changing your search or filters."},
  error:{title:"Could not load this content",description:"Something went wrong while loading this section."},
  permission:{title:"You do not have access",description:"Your current role does not include permission for this area."},
  offline:{title:"This resource is offline",description:"Live actions are unavailable until the connection is restored."},
  disabled:{title:"This module is disabled",description:"An administrator must enable the module before it can be used."},
  partial:{title:"Completed with some failures",description:"Some items succeeded while others need attention."}
};

function el(target){
  return typeof target==="string"?document.querySelector(target):target;
}

function actionHtml(actions=[]){
  return actions.map(a=>a.href
    ?'<a class="btn '+(a.variant||"secondary")+'" href="'+a.href+'">'+(a.icon?'<i class="fa-solid '+a.icon+'"></i>':'')+a.label+'</a>'
    :'<button class="btn '+(a.variant||"secondary")+'" type="button" data-state-action="'+(a.id||"")+'">'+(a.icon?'<i class="fa-solid '+a.icon+'"></i>':'')+a.label+'</button>'
  ).join("");
}

function stateMarkup(type,opts={}){
  const d={...(defaults[type]||defaults.empty),...opts};
  const compact=opts.compact?" compact":"";
  return '<div class="inno-state '+type+compact+'" role="'+(type==="error"?"alert":"status")+'">'+
    '<div class="inno-state-icon"><i class="fa-solid '+(opts.icon||icons[type]||icons.empty)+'"></i></div>'+
    '<div class="inno-state-copy"><h4>'+d.title+'</h4><p>'+d.description+'</p>'+
    (opts.meta?'<div class="inno-state-meta">'+opts.meta+'</div>':'')+
    (opts.actions?.length?'<div class="inno-state-actions">'+actionHtml(opts.actions)+'</div>':'')+
    '</div></div>';
}

function render(target,type,opts={}){
  const node=el(target);if(!node)return null;
  const old=node.innerHTML;
  node.dataset.innoPrevious=opts.preserve===false?"":encodeURIComponent(old);
  node.innerHTML=stateMarkup(type,opts);
  bindStateActions(node,opts.actions||[]);
  return node;
}

function restore(target){
  const node=el(target);if(!node||!node.dataset.innoPrevious)return;
  try{node.innerHTML=decodeURIComponent(node.dataset.innoPrevious)}catch(e){}
  delete node.dataset.innoPrevious;
}

function bindStateActions(scope,actions){
  actions.forEach(a=>{
    if(!a.id||typeof a.onClick!=="function")return;
    scope.querySelectorAll('[data-state-action="'+a.id+'"]').forEach(b=>b.onclick=a.onClick);
  });
}

function skeleton(target,opts={}){
  const node=el(target);if(!node)return;
  const rows=opts.rows||5,cols=opts.cols||4;
  let html='<div class="inno-skeleton-block" aria-label="Loading"><div class="inno-skeleton-toolbar"><span></span><span></span><span></span></div>';
  for(let r=0;r<rows;r++){
    html+='<div class="inno-skeleton-row">';
    for(let c=0;c<cols;c++)html+='<span style="width:'+(c===0?"74":c===cols-1?"48":"62")+'%"></span>';
    html+='</div>';
  }
  html+='</div>';
  if(opts.preserve===true)node.dataset.innoPrevious=encodeURIComponent(node.innerHTML);
  node.innerHTML=html;
}

function pageState(type,opts={}){
  const content=document.querySelector(".content");if(!content)return;
  render(content,type,{...opts,preserve:opts.preserve===true});
}

function banner(target,type,opts={}){
  const node=el(target);if(!node)return;
  const d={...(defaults[type]||defaults.error),...opts};
  const b=document.createElement("div");
  b.className="inno-state-banner "+type;
  b.innerHTML='<div class="inno-state-banner-icon"><i class="fa-solid '+(opts.icon||icons[type]||icons.error)+'"></i></div><div class="grow"><b>'+d.title+'</b><span>'+d.description+'</span></div>'+(opts.actionLabel?'<button class="btn secondary" type="button">'+opts.actionLabel+'</button>':'');
  if(opts.actionLabel&&typeof opts.onAction==="function")b.querySelector("button").onclick=opts.onAction;
  node.prepend(b);return b;
}

function partial(target,opts={}){
  const node=el(target);if(!node)return null;
  const succeeded=opts.succeeded??8,failed=opts.failed??2;
  node.dataset.innoPrevious=opts.preserve===false?"":encodeURIComponent(node.innerHTML);
  node.innerHTML='<div class="inno-partial-state"><div class="inno-partial-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div><b>'+(opts.title||"Completed with some failures")+'</b><span>'+(opts.description||"Some items succeeded while others need attention.")+'</span><div class="inno-partial-metrics"><span><strong data-inno-partial-success>'+succeeded+'</strong> succeeded</span><span><strong data-inno-partial-failed>'+failed+'</strong> failed</span></div></div><button class="btn secondary" type="button" data-inno-retry><i class="fa-solid fa-rotate-right"></i>Retry failed</button></div>';
  enhanceRetry();
  return node;
}

function setButtonState(button,state,opts={}){
  const b=el(button);if(!b)return;
  if(!b.dataset.innoOriginalHtml)b.dataset.innoOriginalHtml=b.innerHTML;
  if(state==="saving"||state==="loading"){
    b.disabled=true;b.classList.add("is-loading");b.classList.remove("is-saved");
    b.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i>'+(opts.label||"Saving...");
  }else if(state==="saved"||state==="success"){
    b.disabled=false;b.classList.remove("is-loading");b.classList.add("is-saved");
    b.innerHTML='<i class="fa-solid fa-check"></i>'+(opts.label||"Saved");
  }else if(state==="error"){
    b.disabled=false;b.classList.remove("is-loading","is-saved");b.classList.add("is-error");
    b.innerHTML='<i class="fa-solid fa-circle-exclamation"></i>'+(opts.label||"Try again");
  }else{
    b.disabled=false;b.classList.remove("is-loading","is-saved","is-error");b.innerHTML=b.dataset.innoOriginalHtml;
  }
}

function simulateSave(button,opts={}){
  const b=el(button);if(!b||b.disabled)return;
  const scope=opts.scope||window.INNOInteractions?.scopeFor?.(b);
  window.INNOInteractions?.setDirtyState?.(scope,"saving");
  setButtonState(b,"saving",{label:opts.savingLabel||"Saving..."});
  setTimeout(()=>{
    if(opts.fail){
      setButtonState(b,"error",{label:opts.errorLabel||"Try again"});
      window.INNOInteractions?.setDirtyState?.(scope,"error");
      window.INNOInteractions?.toast?.(opts.errorMessage||"Could not save changes","error");
      setTimeout(()=>setButtonState(b,"idle"),1400);
      return;
    }
    setButtonState(b,"saved",{label:opts.savedLabel||"Saved"});
    window.INNOInteractions?.markClean?.(scope,{saved:true,restoreAfter:opts.restoreAfter||1600});
    window.INNOInteractions?.toast?.(opts.successMessage||"Changes saved","success");
    if(typeof opts.onSaved==="function")opts.onSaved();
    setTimeout(()=>setButtonState(b,"idle"),opts.restoreAfter||1400);
  },opts.delay||650);
}

function refreshSearchState(input){
  const targetSel=input.dataset.innoSearchTarget;if(!targetSel)return;
  const target=document.querySelector(targetSel);if(!target)return;
  const isTable=target.tagName==="TBODY";
  const rows=[...target.children].filter(x=>!x.classList.contains("inno-state-row")&&!x.classList.contains("inno-search-empty"));
  const visible=rows.filter(r=>getComputedStyle(r).display!=="none");
  let holder=target.querySelector(":scope > .inno-search-empty");
  if(visible.length===0){
    if(holder)return;
    if(isTable){
      const colspan=target.closest("table")?.querySelectorAll("thead th").length||1;
      holder=document.createElement("tr");holder.className="inno-state-row inno-search-empty";holder.dataset.search="";
      holder.innerHTML='<td colspan="'+colspan+'">'+stateMarkup("noResults",{compact:true,title:input.dataset.innoEmptyTitle||"No results found",description:input.dataset.innoEmptyDescription||"Try another keyword or clear your filters.",actions:input.value?[{label:"Clear Search",id:"clear-search",icon:"fa-xmark"}]:[]})+'</td>';
    }else{
      holder=document.createElement("div");holder.className="inno-search-empty";
      holder.innerHTML=stateMarkup("noResults",{compact:true,title:input.dataset.innoEmptyTitle||"No results found",description:input.dataset.innoEmptyDescription||"Try another keyword or clear your filters.",actions:input.value?[{label:"Clear Search",id:"clear-search",icon:"fa-xmark"}]:[]});
    }
    target.appendChild(holder);
    const clear=holder.querySelector('[data-state-action="clear-search"]');if(clear)clear.onclick=()=>{input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));input.focus()};
  }else if(holder)holder.remove();
}

function enhanceSearchEmpty(){
  document.querySelectorAll("[data-inno-search-target]").forEach(input=>{
    if(input.dataset.innoStateBound)return;input.dataset.innoStateBound="1";
    input.addEventListener("input",()=>requestAnimationFrame(()=>refreshSearchState(input)));
    refreshSearchState(input);
  });
}

function enhanceSaveButtons(){
  document.querySelectorAll("[data-inno-save]").forEach(b=>{
    if(b.dataset.innoSaveBound)return;b.dataset.innoSaveBound="1";
    b.addEventListener("click",e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const scope=window.INNOInteractions?.scopeFor?.(b)||b.closest(".content")||document.body;
      if(window.INNOInteractions?.validateScope&&!window.INNOInteractions.validateScope(scope))return;
      simulateSave(b,{
        scope,
        savingLabel:b.dataset.innoSavingLabel,
        savedLabel:b.dataset.innoSavedLabel,
        successMessage:b.dataset.innoSuccess,
        errorMessage:b.dataset.innoError,
        fail:b.dataset.innoSaveFail==="true",
        onSaved:()=>{
          const closeTarget=b.dataset.innoCloseTarget;
          if(closeTarget)window.INNOInteractions?.closeDialog?.(closeTarget);
          const navigate=b.dataset.innoNavigate;
          if(navigate)setTimeout(()=>location.href=navigate,380);
        }
      });
    });
  });
}

function enhanceRetry(){
  document.querySelectorAll("[data-inno-retry]").forEach(b=>{
    if(b.dataset.innoRetryBound)return;b.dataset.innoRetryBound="1";
    b.onclick=()=>{
      const scope=b.closest(".inno-partial-state,.inno-state-banner,.panel");
      setButtonState(b,"loading",{label:"Retrying..."});
      setTimeout(()=>{
        setButtonState(b,"success",{label:"Retried"});
        if(scope){
          scope.classList.add("resolved");
          const failed=scope.querySelector("[data-inno-partial-failed]");if(failed)failed.textContent="0";
        }
        window.INNOInteractions?.toast?.("Failed items were retried","success");
        setTimeout(()=>{setButtonState(b,"idle");if(scope?.classList.contains("resolved"))b.disabled=true},1400);
      },650);
    };
  });
}


function applyPreviewState(){
  const q=new URLSearchParams(location.search),type=q.get("uiState");if(!type)return;
  const content=document.querySelector(".content");if(!content)return;
  if(type==="offline"){
    const name=q.get("device")||document.querySelector(".resource-title")?.textContent||"This device";
    const title=document.querySelector(".resource-title");if(title&&q.get("device"))title.textContent=q.get("device");
    const crumb=[...document.querySelectorAll(".resource-breadcrumb span")].pop();if(crumb&&q.get("device"))crumb.textContent=q.get("device");
    const st=document.querySelector(".resource-title-row .status");if(st){st.className="status offline";st.textContent="Offline"}
    banner(content,"offline",{title:name+" is offline",description:"Showing the last cached inventory. Remote, terminal, file and power actions are unavailable until the Agent reconnects."});
    document.querySelectorAll("[data-live-action]").forEach(b=>{b.disabled=true;b.setAttribute("aria-disabled","true");b.title="Unavailable while device is offline"});
    return;
  }
  if(type==="loading"){skeleton(content,{rows:7,cols:4,preserve:false});return}
  if(type==="partial")return partial(content,{preserve:false,succeeded:Number(q.get("succeeded")||8),failed:Number(q.get("failed")||2),title:"Completed with some failures",description:"Successful items are kept. Retry only the failed items."});
  if(type==="permission")return pageState("permission",{title:"You do not have access",description:"Your current role does not include permission for this page.",actions:[{label:"Back to Workspace",href:"workspace-v2.html",icon:"fa-arrow-left"}]});
  if(type==="disabled")return pageState("disabled",{title:"This module is disabled",description:"The module is installed but disabled for this organization.",actions:[{label:"Open App Launcher",href:"app-launcher-v2.html",icon:"fa-table-cells-large"}]});
  if(type==="error")return pageState("error",{title:"Could not load this page",description:"The prototype is showing the standard full-page error state.",actions:[{label:"Reload",id:"reload",icon:"fa-rotate-right",onClick:()=>location.reload()}]});
}
function init(){
  applyPreviewState();enhanceSearchEmpty();enhanceSaveButtons();enhanceRetry();
  const obs=new MutationObserver(()=>{enhanceSearchEmpty();enhanceSaveButtons();enhanceRetry()});
  obs.observe(document.body,{subtree:true,childList:true});
}
window.INNOStates={render,restore,skeleton,pageState,banner,partial,setButtonState,simulateSave,refreshSearchState,stateMarkup};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();