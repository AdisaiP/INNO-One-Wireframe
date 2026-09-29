(function(){
const COMMANDS=[
  {group:"Apps",icon:"fa-desktop",title:"Devices",meta:"Endpoint & remote management",href:"devices-overview-v2.html"},
  {group:"Apps",icon:"fa-boxes-stacked",title:"Assets",meta:"Inventory, licenses & contracts",href:"assets-overview.html"},
  {group:"Apps",icon:"fa-headset",title:"Helpdesk",meta:"Tickets, SLA & support",href:"helpdesk.html"},
  {group:"Apps",icon:"fa-chart-column",title:"Reports",meta:"Cross-app reports & exports",href:"reports-overview.html"},
  {group:"Apps",icon:"fa-microphone-lines",title:"Meeting",meta:"Record, transcript & summary",href:"meeting.html"},
  {group:"Quick actions",icon:"fa-plus",title:"Create ticket",meta:"Helpdesk",href:"ticket-new.html"},
  {group:"Quick actions",icon:"fa-satellite-dish",title:"Discover devices",meta:"Devices",href:"device-discovery.html"},
  {group:"Quick actions",icon:"fa-box-open",title:"Deployment jobs",meta:"Devices",href:"deployment-jobs.html"},
  {group:"Quick actions",icon:"fa-shield-halved",title:"Endpoint policies",meta:"Devices",href:"endpoint-policies.html"},
  {group:"Platform",icon:"fa-cubes",title:"Apps & Modules",meta:"Admin Center",href:"modules.html"},
  {group:"Platform",icon:"fa-user-shield",title:"Roles & Permissions",meta:"Admin Center",href:"roles-permissions-v2.html"},
  {group:"Platform",icon:"fa-swatchbook",title:"Design System",meta:"UI foundations & components",href:"design-system.html"}
];

function enhanceRail(file){
  const rail=document.querySelector(".rail");
  if(!rail)return;
  if(!rail.querySelector('a[href="assets-overview.html"]')){
    const devicesLink=rail.querySelector('a[href="devices-overview-v2.html"]');
    const a=document.createElement("a"); a.href="assets-overview.html"; a.title="Assets"; a.innerHTML='<i class="fa-solid fa-boxes-stacked"></i>';
    if(file.startsWith("asset")||file==="software-licenses.html"||file==="contracts-warranty.html")a.classList.add("active");
    if(devicesLink)devicesLink.insertAdjacentElement("afterend",a);else rail.insertBefore(a,rail.querySelector(".spacer"));
  }
  if(!rail.querySelector('a[href="reports-overview.html"]')){
    const assets=rail.querySelector('a[href="assets-overview.html"]');
    const a=document.createElement("a"); a.href="reports-overview.html"; a.title="Reports"; a.innerHTML='<i class="fa-solid fa-chart-column"></i>';
    if(file.startsWith("report"))a.classList.add("active");
    if(assets)assets.insertAdjacentElement("afterend",a);else rail.insertBefore(a,rail.querySelector(".spacer"));
  }
  const railLabels={
    "workspace-v2.html":"Home",
    "app-launcher-v2.html":"Apps",
    "devices-overview-v2.html":"Devices",
    "assets-overview.html":"Assets",
    "reports-overview.html":"Reports",
    "helpdesk.html":"Helpdesk",
    "meeting.html":"Meeting",
    "admin.html":"Admin Center"
  };
  rail.querySelectorAll("a[href]").forEach(a=>{
    const href=(a.getAttribute("href")||"").split("?")[0].split("#")[0];
    const label=a.getAttribute("title")||railLabels[href];
    if(label){a.setAttribute("aria-label",label);if(!a.title)a.title=label}
  });
}

function buildCommandPalette(){
  const wrap=document.createElement("div");
  wrap.className="command-backdrop";
  wrap.id="globalCommandPalette";
  wrap.innerHTML='<div class="command-panel" role="dialog" aria-modal="true" aria-label="Global search">'+
    '<div class="command-search"><i class="fa-solid fa-magnifying-glass"></i><input id="commandInput" autocomplete="off" aria-label="Search apps, devices, tickets and actions" placeholder="Search apps, devices, tickets and actions..."><span class="platform-search-shortcut">ESC</span></div>'+
    '<div class="command-results" id="commandResults"></div>'+
  '</div>';
  document.body.appendChild(wrap);
  const input=wrap.querySelector("#commandInput"), results=wrap.querySelector("#commandResults");
  function render(q=""){
    const needle=q.trim().toLowerCase();
    const rows=COMMANDS.filter(x=>!needle||[x.title,x.meta,x.group].join(" ").toLowerCase().includes(needle));
    const groups=[...new Set(rows.map(x=>x.group))];
    results.innerHTML=groups.map(g=>'<div class="command-group-title">'+g+'</div>'+rows.filter(x=>x.group===g).map(x=>
      '<a class="command-item" href="'+x.href+'"><span class="command-item-icon"><i class="fa-solid '+x.icon+'"></i></span><span><span class="command-item-title">'+x.title+'</span><span class="command-item-meta">'+x.meta+'</span></span><i class="fa-solid fa-arrow-right command-key"></i></a>'
    ).join("")).join("") || '<div class="ds-empty" style="border:0"><i class="fa-solid fa-magnifying-glass"></i><h4>No results</h4><p>Try another keyword.</p></div>';
  }
  function open(prefill=""){wrap.classList.add("open");input.value=prefill;render(prefill);requestAnimationFrame(()=>input.focus())}
  function close(){wrap.classList.remove("open")}
  input.addEventListener("input",()=>render(input.value));
  wrap.addEventListener("mousedown",e=>{if(e.target===wrap)close()});
  document.addEventListener("keydown",e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();open()}
    if(e.key==="Escape"&&wrap.classList.contains("open")){e.preventDefault();close()}
  });
  return {open,close};
}

function buildHeader(){
  const file=(location.pathname.split("/").pop()||"workspace-v2.html");
  enhanceRail(file);
  const palette=buildCommandPalette();
  const header=document.createElement("header");
  header.className="platform-header";
  header.innerHTML=
    '<a class="platform-brand" href="workspace-v2.html" title="INNO.One Home">'+
      '<span class="platform-logo-mark"><i class="fa-solid fa-cube"></i></span>'+
      '<span class="platform-wordmark">INNO<span>.One</span></span>'+
    '</a>'+
    '<div class="platform-search-area"><div class="platform-search-wrap">'+
      '<i class="fa-solid fa-magnifying-glass platform-search-icon"></i>'+
      '<input id="platformGlobalSearch" class="platform-search" type="text" readonly aria-label="Open global search" placeholder="Search across INNO.One...">'+
      '<span class="platform-search-shortcut">⌘ K</span>'+
    '</div></div>'+
    '<div class="platform-header-actions">'+
      '<button class="platform-header-icon" id="headerNotifications" type="button" title="Notifications" aria-label="Notifications"><i class="fa-regular fa-bell"></i><span class="notification-dot"></span></button>'+
      '<button class="platform-user" id="headerProfile" type="button" title="Account menu"><span class="platform-user-avatar">AP</span><span class="platform-user-label">Adisai</span><i class="fa-solid fa-chevron-down"></i></button>'+
    '</div>';
  document.body.prepend(header);
  document.body.classList.add("has-platform-header");

  const search=header.querySelector("#platformGlobalSearch");
  search.addEventListener("click",()=>palette.open());
  search.addEventListener("focus",()=>{search.blur();palette.open()});

  const notifications=document.createElement("div");
  notifications.className="header-popover"; notifications.id="notificationPopover";
  notifications.innerHTML='<div class="popover-head">Notifications <a class="link" href="notifications.html" style="float:right;font-size:10px">View all</a></div>'+
    '<a class="popover-item" href="devices-overview-v2.html"><i class="fa-solid fa-triangle-exclamation"></i><span><b>3 devices need attention</b><span>Devices · 8 min ago</span></span></a>'+
    '<a class="popover-item" href="helpdesk.html"><i class="fa-solid fa-ticket"></i><span><b>Ticket HD-2026-001035 escalated</b><span>Helpdesk · 21 min ago</span></span></a>'+
    '<a class="popover-item" href="contracts-warranty.html"><i class="fa-solid fa-file-contract"></i><span><b>Contract expiring soon</b><span>Assets · Today</span></span></a>';
  document.body.appendChild(notifications);

  const profile=document.createElement("div");
  profile.className="header-popover"; profile.id="profilePopover";
  profile.innerHTML='<div class="popover-head">Adisai <span style="display:block;color:#8a94a4;font-size:10px;font-weight:500;margin-top:2px">Platform Admin</span></div>'+
    '<a class="popover-item" href="profile.html"><i class="fa-regular fa-user"></i><span><b>Profile</b><span>Account & preferences</span></span></a>'+
    '<a class="popover-item" href="admin.html"><i class="fa-solid fa-gear"></i><span><b>Admin Center</b><span>Platform settings</span></span></a>'+
    '<a class="popover-item" href="design-system.html"><i class="fa-solid fa-swatchbook"></i><span><b>Design System</b><span>UI components & tokens</span></span></a>';
  document.body.appendChild(profile);

  function closePopovers(except){[notifications,profile].forEach(x=>{if(x!==except)x.classList.remove("open")})}
  header.querySelector("#headerNotifications").onclick=e=>{e.stopPropagation();const next=!notifications.classList.contains("open");closePopovers();notifications.classList.toggle("open",next)}
  header.querySelector("#headerProfile").onclick=e=>{e.stopPropagation();const next=!profile.classList.contains("open");closePopovers();profile.classList.toggle("open",next)}
  document.addEventListener("click",()=>closePopovers());
  notifications.onclick=e=>e.stopPropagation();profile.onclick=e=>e.stopPropagation();
}
document.addEventListener("DOMContentLoaded",buildHeader);
})();