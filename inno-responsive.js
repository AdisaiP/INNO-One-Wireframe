(function(){
"use strict";

const STORAGE="inno.ui.sidebar.collapsed";
const OVERLAY_MAX=1180;
let side,header,content,sideToggle,revealToggle,backdrop,lastMode="";

function modeFor(w){
  if(w>=1600)return"wide";
  if(w>=1367)return"desktop";
  if(w>=1181)return"compact";
  if(w>=851)return"tablet";
  return"narrow";
}
function isOverlay(){return window.innerWidth<=OVERLAY_MAX}

function ensureControls(){
  header=document.querySelector(".platform-header");
  side=document.querySelector(".side");
  content=document.querySelector(".content");
  if(!header||!side||!content)return false;

  // Clean up the old header hamburger wrapper if an older runtime created it.
  const oldZone=header.querySelector(".platform-nav-zone");
  if(oldZone){
    const brand=oldZone.querySelector(".platform-brand");
    if(brand)header.insertBefore(brand,oldZone);
    oldZone.remove();
  }

  side.id=side.id||"contextSidebar";
  const appName=(side.querySelector(".side-title")?.textContent||"Navigation").trim();

  if(!sideToggle){
    sideToggle=document.createElement("button");
    sideToggle.className="context-side-collapse";
    sideToggle.type="button";
    sideToggle.setAttribute("aria-controls",side.id);
    sideToggle.innerHTML='<i class="fa-solid fa-chevron-left"></i>';
    side.appendChild(sideToggle);
  }

  if(!revealToggle){
    revealToggle=document.createElement("button");
    revealToggle.className="context-nav-reveal";
    revealToggle.type="button";
    revealToggle.setAttribute("aria-controls",side.id);
    revealToggle.innerHTML='<i class="fa-solid fa-bars"></i><span>'+appName+'</span>';
    content.insertBefore(revealToggle,content.firstChild);
  }

  if(!backdrop){
    backdrop=document.createElement("div");
    backdrop.className="context-nav-backdrop";
    backdrop.setAttribute("aria-hidden","true");
    document.body.appendChild(backdrop);
  }
  return true;
}

function setDesktopCollapsed(collapsed,persist=true){
  document.body.classList.toggle("side-collapsed",collapsed);
  document.body.classList.remove("side-open");
  if(persist)localStorage.setItem(STORAGE,collapsed?"1":"0");
  syncControls();
}

function setOverlayOpen(open,restoreFocus=false){
  document.body.classList.toggle("side-open",open);
  backdrop?.classList.toggle("open",open);
  backdrop?.setAttribute("aria-hidden",open?"false":"true");
  syncControls();
  if(open)setTimeout(()=>{const target=side?.querySelector("a.active")||side?.querySelector("a:not(.nav-disabled)");target?.focus()},190);
  else if(restoreFocus)setTimeout(()=>revealToggle?.focus(),0);
}

function syncControls(){
  if(!sideToggle||!revealToggle)return;
  const overlay=isOverlay();
  const open=overlay
    ?document.body.classList.contains("side-open")
    :!document.body.classList.contains("side-collapsed");

  sideToggle.hidden=!open;
  revealToggle.hidden=open;

  sideToggle.setAttribute("aria-expanded",open?"true":"false");
  revealToggle.setAttribute("aria-expanded",open?"true":"false");

  if(overlay){
    sideToggle.setAttribute("aria-label","Close contextual navigation");
    sideToggle.title="Close navigation";
    sideToggle.innerHTML='<i class="fa-solid fa-xmark"></i>';
    revealToggle.setAttribute("aria-label","Open contextual navigation");
    revealToggle.title="Open navigation";
    revealToggle.innerHTML='<i class="fa-solid fa-bars"></i><span>'+(side.querySelector(".side-title")?.textContent.trim()||"Navigation")+'</span>';
  }else{
    sideToggle.setAttribute("aria-label","Collapse contextual navigation");
    sideToggle.title="Collapse sidebar";
    sideToggle.innerHTML='<i class="fa-solid fa-chevron-left"></i>';
    revealToggle.setAttribute("aria-label","Expand contextual navigation");
    revealToggle.title="Expand sidebar";
    revealToggle.innerHTML='<i class="fa-solid fa-chevron-right"></i><span>'+(side.querySelector(".side-title")?.textContent.trim()||"Navigation")+'</span>';
  }

  if(side){
    side.setAttribute("aria-hidden",open?"false":"true");
    side.inert=!open;
  }
}

function applyLayout(){
  if(!ensureControls())return;
  const mode=modeFor(window.innerWidth);
  document.body.dataset.viewport=mode;
  document.body.classList.toggle("responsive-overlay",isOverlay());

  if(isOverlay()){
    document.body.classList.remove("side-collapsed");
    if(lastMode&&lastMode!=="tablet"&&lastMode!=="narrow")setOverlayOpen(false);
  }else{
    setOverlayOpen(false);
    const pref=localStorage.getItem(STORAGE)==="1";
    document.body.classList.toggle("side-collapsed",pref);
  }

  lastMode=mode;
  syncControls();
  refreshTables();
}

function updateTableWrap(wrap){
  const table=wrap.querySelector("table");if(!table)return;
  const cols=table.querySelectorAll("thead th").length;
  table.classList.toggle("inno-table-wide",cols>=6);
  table.classList.toggle("inno-table-xwide",cols>=8);
  const overflow=wrap.scrollWidth>wrap.clientWidth+2;
  wrap.classList.toggle("is-scrollable",overflow);
  if(overflow){
    wrap.tabIndex=0;
    wrap.setAttribute("role","region");
    wrap.setAttribute("aria-label","Scrollable data table");
    const end=wrap.scrollWidth-wrap.clientWidth;
    wrap.classList.toggle("at-start",wrap.scrollLeft<=2);
    wrap.classList.toggle("at-end",wrap.scrollLeft>=end-2);
  }else{
    wrap.removeAttribute("tabindex");
    wrap.classList.remove("at-start","at-end");
  }
}
function refreshTables(){document.querySelectorAll(".table-wrap").forEach(updateTableWrap)}
function enhanceTables(){
  document.querySelectorAll(".table-wrap").forEach(w=>{
    if(w.dataset.responsiveBound)return;
    w.dataset.responsiveBound="1";
    w.addEventListener("scroll",()=>updateTableWrap(w),{passive:true});
  });
  refreshTables();
}
function enhanceHorizontalTabs(){
  document.querySelectorAll(".surface-tabs,.detail-tabs,.asset-tabs,.tabs,.section-subnav").forEach(t=>{
    if(t.dataset.responsiveBound)return;
    t.dataset.responsiveBound="1";
    t.addEventListener("wheel",e=>{
      if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&t.scrollWidth>t.clientWidth){
        t.scrollLeft+=e.deltaY;e.preventDefault();
      }
    },{passive:false});
  });
}

function emitQAMetrics(){
  const html=document.documentElement;
  const wraps=[...document.querySelectorAll(".table-wrap")];
  html.dataset.qaViewport=String(window.innerWidth);
  html.dataset.qaDocumentWidth=String(html.scrollWidth);
  html.dataset.qaPageOverflow=html.scrollWidth>window.innerWidth+2?"true":"false";
  html.dataset.qaMode=document.body.dataset.viewport||"";
  html.dataset.qaScrollableTables=String(wraps.filter(w=>w.scrollWidth>w.clientWidth+2).length);
  html.dataset.qaSidebar=isOverlay()?"overlay":document.body.classList.contains("side-collapsed")?"collapsed":"inline";
  html.dataset.qaSideDisplay=side?getComputedStyle(side).display:"none";
  html.dataset.qaGrid=document.querySelector(".shell")?getComputedStyle(document.querySelector(".shell")).gridTemplateColumns:"";
  html.dataset.qaHeaderToggle=header?.querySelector(".platform-nav-toggle")?"present":"absent";
  html.dataset.qaRevealHidden=revealToggle?.hidden?"true":"false";
  html.dataset.qaSideTop=side?String(Math.round(side.getBoundingClientRect().top)):"";
  html.dataset.qaSideHeight=side?String(Math.round(side.getBoundingClientRect().height)):"";
  const rail=document.querySelector(".rail");html.dataset.qaRailTop=rail?String(Math.round(rail.getBoundingClientRect().top)):"";
  html.dataset.qaContentTop=content?String(Math.round(content.getBoundingClientRect().top)):"";
  html.dataset.qaContentWidth=content?String(Math.round(content.getBoundingClientRect().width)):"";
  html.dataset.qaContentMaxWidth=content?getComputedStyle(content).maxWidth:"";
  html.dataset.qaBodyLineHeight=getComputedStyle(document.body).lineHeight;
  const main=document.querySelector(".main"), hero=document.querySelector(".workspace-hero"), reveal=document.querySelector(".context-nav-reveal");
  html.dataset.qaMainLeft=main?String(Math.round(main.getBoundingClientRect().left)):"";
  html.dataset.qaContentLeft=content?String(Math.round(content.getBoundingClientRect().left)):"";
  html.dataset.qaHeroLeft=hero?String(Math.round(hero.getBoundingClientRect().left)):"";
  html.dataset.qaRevealLeft=reveal?String(Math.round(reveal.getBoundingClientRect().left)):"";
}

function init(){
  if(!ensureControls())return;

  sideToggle.onclick=()=>isOverlay()
    ?setOverlayOpen(false,true)
    :setDesktopCollapsed(true);

  revealToggle.onclick=()=>isOverlay()
    ?setOverlayOpen(true)
    :setDesktopCollapsed(false);

  backdrop.onclick=()=>setOverlayOpen(false,true);
  side.addEventListener("click",e=>{if(isOverlay()&&e.target.closest("a"))setOverlayOpen(false)});
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&document.body.classList.contains("side-open")){
      e.preventDefault();setOverlayOpen(false,true);
    }
  });

  enhanceTables();enhanceHorizontalTabs();applyLayout();

  const qa=new URLSearchParams(location.search);
  if(isOverlay()&&qa.get("nav")==="open")setOverlayOpen(true);
  if(!isOverlay()&&qa.get("side")==="collapsed")setDesktopCollapsed(true,false);
  if(qa.has("qaMetrics")){emitQAMetrics();setTimeout(emitQAMetrics,120);}

  let raf=0;
  window.addEventListener("resize",()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      applyLayout();enhanceTables();
      if(qa.has("qaMetrics"))emitQAMetrics();
    });
  });

  if(window.ResizeObserver)new ResizeObserver(()=>refreshTables()).observe(document.querySelector(".main")||document.body);
  new MutationObserver(()=>{enhanceTables();enhanceHorizontalTabs()}).observe(document.body,{subtree:true,childList:true});
}

window.INNOResponsive={applyLayout,refreshTables,setOverlayOpen,setDesktopCollapsed};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();