(()=>{"use strict";
const state={open:null,trigger:null,native:null,control:null,popover:null,options:[],search:null};
let seq=0;

function isWebSurface(){
  const s=document.body?.dataset?.innoSurface;
  return s!=="agent"&&s!=="mobile";
}
function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function labelParts(option){
  const raw=(option.textContent||"").trim();
  const bits=raw.split(" · ");
  return {title:bits.shift()||raw,meta:bits.join(" · ")};
}
function currentLabel(select){
  if(select.multiple){
    const selected=[...select.selectedOptions];
    if(!selected.length)return select.dataset.innoPlaceholder||"Select options";
    if(selected.length===1)return selected[0].textContent.trim();
    return selected.length+" selected";
  }
  const opt=select.options[select.selectedIndex];
  return opt?opt.textContent.trim():(select.dataset.innoPlaceholder||"Select");
}
function closePopover(focus=false){
  if(!state.popover)return;
  state.popover.remove();
  if(state.trigger)state.trigger.setAttribute("aria-expanded","false");
  const trigger=state.trigger;
  state.open=state.trigger=state.native=state.control=state.popover=state.search=null;
  state.options=[];
  if(focus)trigger?.focus();
}
function positionPopover(){
  if(!state.popover||!state.trigger)return;
  const r=state.trigger.getBoundingClientRect();
  const vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
  const width=Math.max(r.width,Math.min(Number(state.native?.dataset?.innoPopoverWidth||320),vw-24));
  state.popover.style.width=width+"px";
  state.popover.style.left=Math.max(12,Math.min(r.left,vw-width-12))+"px";
  const h=Math.min(state.popover.scrollHeight,360);
  const roomBelow=vh-r.bottom-12,roomAbove=r.top-12;
  const top=roomBelow>=Math.min(h,240)||roomBelow>=roomAbove?r.bottom+6:Math.max(12,r.top-h-6);
  state.popover.style.top=top+"px";
}
function dispatchNative(select){
  select.dispatchEvent(new Event("input",{bubbles:true}));
  select.dispatchEvent(new Event("change",{bubbles:true}));
  select.dispatchEvent(new CustomEvent("inno:select-change",{bubbles:true,detail:{value:select.value,values:[...select.selectedOptions].map(x=>x.value)}}));
}
function optionIcon(select){
  return select.dataset.innoResourceIcon||select.dataset.innoIcon||"fa-circle";
}
function buildOptionButton(select,option,index){
  const parts=labelParts(option),isResource=select.hasAttribute("data-inno-resource-picker");
  const button=document.createElement("button");
  button.type="button";
  button.className="inno-picker-option"+(isResource?" resource":"");
  button.setAttribute("role","option");
  button.dataset.index=String(index);
  button.dataset.value=option.value;
  button.setAttribute("aria-selected",option.selected?"true":"false");
  if(option.disabled){button.disabled=true;button.setAttribute("aria-disabled","true")}
  const check=select.multiple?'<i class="fa-solid fa-check inno-picker-check"></i>':"";
  const icon=isResource?'<span class="inno-picker-option-icon"><i class="fa-solid '+escapeHtml(option.dataset.icon||optionIcon(select))+'"></i></span>':"";
  button.innerHTML=icon+'<span class="inno-picker-option-copy"><b>'+escapeHtml(parts.title)+'</b>'+(parts.meta?'<small>'+escapeHtml(parts.meta)+'</small>':"")+'</span>'+check;
  button.addEventListener("click",()=>{
    if(select.multiple){
      option.selected=!option.selected;
      button.setAttribute("aria-selected",option.selected?"true":"false");
      syncControl(select);
      dispatchNative(select);
    }else{
      select.selectedIndex=index;
      syncControl(select);
      dispatchNative(select);
      closePopover(true);
    }
  });
  return button;
}
function openPopover(control,select,trigger){
  if(select.disabled)return;
  if(state.trigger===trigger){closePopover(true);return}
  closePopover(false);
  const pop=document.createElement("div");
  pop.className="inno-picker-popover"+(select.hasAttribute("data-inno-resource-picker")?" resource":"");
  pop.setAttribute("role","presentation");
  const searchable=select.hasAttribute("data-inno-combobox")||select.hasAttribute("data-inno-resource-picker")||select.options.length>8;
  if(searchable){
    const search=document.createElement("div");
    search.className="inno-picker-search";
    search.innerHTML='<i class="fa-solid fa-magnifying-glass"></i><input type="text" autocomplete="off" placeholder="'+escapeHtml(select.dataset.innoSearchPlaceholder||"Search options...")+'">';
    pop.appendChild(search);
    state.search=search.querySelector("input");
  }
  const list=document.createElement("div");
  list.className="inno-picker-list";
  list.setAttribute("role","listbox");
  if(select.multiple)list.setAttribute("aria-multiselectable","true");
  [...select.options].forEach((opt,i)=>list.appendChild(buildOptionButton(select,opt,i)));
  pop.appendChild(list);
  if(select.multiple){
    const foot=document.createElement("div");foot.className="inno-picker-foot";
    foot.innerHTML='<button type="button" class="btn secondary" data-inno-picker-clear>Clear</button><button type="button" class="btn" data-inno-picker-done>Done</button>';
    foot.querySelector("[data-inno-picker-clear]").onclick=()=>{[...select.options].forEach(x=>x.selected=false);dispatchNative(select);syncControl(select);[...list.children].forEach(x=>x.setAttribute("aria-selected","false"))};
    foot.querySelector("[data-inno-picker-done]").onclick=()=>closePopover(true);
    pop.appendChild(foot);
  }
  document.body.appendChild(pop);
  state.open=control;state.trigger=trigger;state.native=select;state.control=control;state.popover=pop;
  state.options=[...list.querySelectorAll(".inno-picker-option")];
  trigger.setAttribute("aria-expanded","true");
  positionPopover();
  if(state.search){
    state.search.addEventListener("input",()=>{
      const q=state.search.value.trim().toLowerCase();
      state.options.forEach(b=>{b.hidden=q&&!b.textContent.toLowerCase().includes(q)});
    });
    requestAnimationFrame(()=>state.search.focus());
  }else{
    requestAnimationFrame(()=>state.options.find(x=>x.getAttribute("aria-selected")==="true"&&!x.disabled)?.focus()||state.options.find(x=>!x.disabled)?.focus());
  }
}
function buildSegmented(select){
  const control=document.createElement("div");
  control.className="inno-segmented";
  control.setAttribute("role","group");
  control.dataset.innoFor=select.id;
  [...select.options].forEach((opt,index)=>{
    const b=document.createElement("button");
    b.type="button";b.className="inno-segment";b.textContent=opt.textContent.trim();b.dataset.value=opt.value;
    b.setAttribute("aria-pressed",opt.selected?"true":"false");
    b.disabled=opt.disabled;
    b.onclick=()=>{select.selectedIndex=index;syncControl(select);dispatchNative(select)};
    control.appendChild(b);
  });
  select.insertAdjacentElement("afterend",control);
  select.classList.add("inno-native-select");
  select.dataset.innoEnhanced="segmented";
  wireLabel(select,control.querySelector("button"),control);
  return control;
}
function buildStandard(select){
  const control=document.createElement("div");
  control.className="inno-select-control"+(select.multiple?" multi":"")+(select.hasAttribute("data-inno-resource-picker")?" resource":"");
  control.dataset.innoFor=select.id;
  const trigger=document.createElement("button");
  trigger.type="button";trigger.className="inno-select-trigger";
  trigger.setAttribute("aria-haspopup","listbox");trigger.setAttribute("aria-expanded","false");
  trigger.id=select.id+"-trigger";
  trigger.innerHTML='<span class="inno-select-value"></span><i class="fa-solid fa-chevron-down inno-select-chevron"></i>';
  control.appendChild(trigger);
  select.insertAdjacentElement("afterend",control);
  select.classList.add("inno-native-select");
  select.dataset.innoEnhanced="select";
  trigger.onclick=()=>openPopover(control,select,trigger);
  trigger.onkeydown=e=>{
    if(["ArrowDown","ArrowUp","Enter"," "].includes(e.key)){e.preventDefault();openPopover(control,select,trigger)}
  };
  wireLabel(select,trigger);
  return control;
}
function wireLabel(select,trigger,group=null){
  const label=select.closest(".field")?.querySelector(":scope > label");
  if(label&&trigger){
    if(!label.id)label.id="inno-label-"+select.id;
    if(group)group.setAttribute("aria-labelledby",label.id);
    else{
      const value=trigger.querySelector(".inno-select-value");
      if(value&&!value.id)value.id=select.id+"-value";
      trigger.setAttribute("aria-labelledby",value?label.id+" "+value.id:label.id);
    }
    label.addEventListener("click",e=>{if(e.target===label){e.preventDefault();trigger.focus();trigger.click()}});
  }
}
function wireFieldLabels(root=document){
  root.querySelectorAll?.(".field").forEach(field=>{
    const label=field.querySelector(":scope > label:not([for])");
    if(!label)return;
    const controls=[...field.querySelectorAll("input,select,textarea")].filter(x=>x.type!=="hidden"&&!x.closest("label"));
    if(controls.length!==1)return;
    const control=controls[0];
    if(!control.id)control.id="inno-field-"+(++seq);
    label.htmlFor=control.id;
  });
}
function ensureAccessibleNames(root=document){
  root.querySelectorAll?.("input,textarea").forEach(control=>{
    if(control.type==="hidden"||control.labels?.length||control.hasAttribute("aria-label")||control.hasAttribute("aria-labelledby"))return;
    let name="";
    if(["checkbox","radio"].includes(control.type)&&control.closest("table")){
      const cell=control.closest("th,td");
      if(cell?.tagName==="TH")name="Select all rows";
      else{
        const row=control.closest("tr");
        const resource=[...row?.querySelectorAll("td")||[]].map(x=>x.textContent.trim()).find(Boolean);
        name=resource?"Select "+resource:"Select row";
      }
    }
    if(!name&&["checkbox","radio"].includes(control.type)&&control.closest(".action-task")){
      const task=control.closest(".action-task").querySelector("b")?.textContent?.trim();
      name=task?"Toggle action item: "+task:"Toggle action item";
    }
    if(!name)name=control.parentElement?.querySelector(":scope > .ux-condition-label")?.textContent?.trim()||"";
    if(!name)name=control.closest(".ux-sla-target")?.querySelector(":scope > span")?.textContent?.trim()||"";
    if(!name)name=control.getAttribute("placeholder")?.trim()||"";
    if(name)control.setAttribute("aria-label",name);
  });
  root.querySelectorAll?.("button,a[href]").forEach(control=>{
    if(control.hasAttribute("aria-label")||control.hasAttribute("aria-labelledby")||control.textContent.trim())return;
    const title=control.getAttribute("title")?.trim();
    if(title)control.setAttribute("aria-label",title);
  });
}
function syncControl(select){
  const control=select.nextElementSibling;
  if(!control)return;
  if(select.dataset.innoEnhanced==="segmented"){
    control.querySelectorAll(".inno-segment").forEach(b=>b.setAttribute("aria-pressed",b.dataset.value===select.value?"true":"false"));
    return;
  }
  const value=control.querySelector(".inno-select-value");
  if(value){
    if(select.multiple){
      const selected=[...select.selectedOptions];
      value.innerHTML=selected.length&&selected.length<=3?selected.map(x=>'<span class="inno-select-chip">'+escapeHtml(labelParts(x).title)+'</span>').join(""):'<span>'+escapeHtml(currentLabel(select))+'</span>';
    }else if(select.hasAttribute("data-inno-resource-picker")){
      const opt=select.options[select.selectedIndex],parts=opt?labelParts(opt):{title:"Select",meta:""};
      value.innerHTML='<span class="inno-select-leading"><i class="fa-solid '+escapeHtml(opt?.dataset?.icon||optionIcon(select))+'"></i></span><span class="inno-select-copy"><b>'+escapeHtml(parts.title)+'</b>'+(parts.meta?'<small>'+escapeHtml(parts.meta)+'</small>':"")+'</span>';
    }else value.textContent=currentLabel(select);
  }
  const trigger=control.querySelector(".inno-select-trigger");
  if(trigger){trigger.disabled=select.disabled;trigger.classList.toggle("placeholder",select.selectedIndex<0)}
}
function enhanceSelect(select){
  if(!isWebSurface()||select.dataset.innoEnhanced||select.hasAttribute("data-inno-native")||select.closest(".mock-desktop,.android-phone"))return;
  if(!select.id)select.id="inno-select-"+(++seq);
  const control=select.dataset.innoDisplay==="segmented"?buildSegmented(select):buildStandard(select);
  syncControl(select);
  select.addEventListener("change",()=>syncControl(select));
  const observer=new MutationObserver(()=>syncControl(select));
  observer.observe(select,{attributes:true,childList:true,subtree:true,attributeFilter:["disabled","selected"]});
  return control;
}
function enhanceAll(root=document){
  wireFieldLabels(root);
  ensureAccessibleNames(root);
  root.querySelectorAll?.("select").forEach(enhanceSelect);
}
function refresh(root=document){
  root.querySelectorAll?.("select[data-inno-enhanced]").forEach(syncControl);
}
document.addEventListener("click",e=>{
  if(state.popover&&!state.popover.contains(e.target)&&e.target!==state.trigger&&!state.control?.contains(e.target))closePopover(false);
});
document.addEventListener("keydown",e=>{
  if(!state.popover)return;
  if(e.key==="Escape"){e.preventDefault();closePopover(true);return}
  if(!["ArrowDown","ArrowUp","Home","End","Enter"].includes(e.key))return;
  const visible=state.options.filter(x=>!x.hidden&&!x.disabled);if(!visible.length)return;
  const at=visible.indexOf(document.activeElement);
  if(e.key==="Enter"&&document.activeElement?.classList.contains("inno-picker-option")){e.preventDefault();document.activeElement.click();return}
  let next=at;
  if(e.key==="ArrowDown")next=Math.min(visible.length-1,Math.max(0,at+1));
  if(e.key==="ArrowUp")next=Math.max(0,at<=0?0:at-1);
  if(e.key==="Home")next=0;if(e.key==="End")next=visible.length-1;
  e.preventDefault();visible[next].focus();
});
window.addEventListener("resize",positionPopover);
window.addEventListener("scroll",positionPopover,true);

function init(){
  if(!isWebSurface())return;
  enhanceAll(document);
  const obs=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.("select"))enhanceSelect(n);enhanceAll(n)}})));
  obs.observe(document.body,{childList:true,subtree:true});
  document.documentElement.dataset.innoInputSystem="1";
  document.documentElement.dataset.innoEnhancedSelects=String(document.querySelectorAll("select[data-inno-enhanced]").length);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.INNOInputs={enhanceAll,enhanceSelect,refresh,close:closePopover};
})();