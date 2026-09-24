(function(){
"use strict";

const contract={
  name:"INNO.One Design System",
  contractVersion:"1.12.0",
  documentationVersion:"1.18",
  status:"frozen",
  frozenAt:"2026-09-24",
  principles:[
    "One global shell; each app owns its contextual navigation.",
    "One semantic meaning maps to one component, state and icon pattern.",
    "Prefer dense, calm enterprise UI over decorative dashboards.",
    "Every async/data surface defines loading, empty, error and permission behavior.",
    "Accessibility and responsive behavior are part of the component contract, not optional polish.",
    "One screen has one primary job; unrelated create/edit, monitoring, settings and history tasks must not be stacked into one scroll surface."
  ],
  foundations:{
    controlHeight:36,
    tableRowHeight:48,
    radii:{control:8,card:12,dialog:14},
    spacing:[4,8,12,16,24,32],
    colors:{
      primary:"#275FD7",
      text:"#172033",
      canvas:"#F7F8FA",
      success:"#16794B",
      warning:"#A56812",
      danger:"#BB3847"
    }
  },
  surfaces:{
    web:{shell:"platform shell",navigation:"inno-navigation.js",owns:["Workspace","Devices","Assets","Helpdesk","Meeting","Reports","Admin"]},
    agent:{shell:"agent window",navigation:"surface-local",owns:["endpoint request help","ownership confirmation","runtime remote consent"],forbidden:["platform-shell.js","Web contextual sidebar"]},
    mobile:{shell:"mobile client",navigation:"surface-local",owns:["asset QR scanning","mobile asset lookup"],forbidden:["platform-shell.js","Web contextual sidebar"]},
    rule:"Share identity, permissions, APIs, events and design tokens; do not share application navigation across surfaces."
  },
  screenPatterns:{
    P01:{name:"Overview",purpose:"module summary, attention and entry points"},
    P02:{name:"List",purpose:"find/select many records"},
    P03:{name:"Resource Detail",purpose:"inspect one resource with related-data tabs"},
    P04:{name:"Create/Edit",purpose:"edit one resource in a dedicated form"},
    P05:{name:"Settings",purpose:"configure one settings domain at a time"},
    P06:{name:"Builder",purpose:"construct a report/query/workflow with preview/results"},
    P07:{name:"Monitor/Operations",purpose:"watch running/live work and issue commands"},
    P08:{name:"Wizard",purpose:"complete a sequential multi-step operation"},
    P09:{name:"Master-Detail",purpose:"select a resource/hierarchy and inspect the selected item"},
    P10:{name:"History/Log",purpose:"inspect chronological or operational history"},
    rules:["One screen has one primary pattern/job","List pages do not permanently expose unrelated large edit forms","Preview may sit beside an editor only when it previews the exact object being edited","1-5 simple fields may use dialog/sheet","6-12 fields use dedicated edit page","Sequential configuration uses P08 Wizard"]
  },
  shell:{
    globalHeader:["brand","globalSearch","notifications","profile"],
    globalRail:["workspace","apps","devices","assets","reports","helpdesk","meeting","admin"],
    contextualSidebar:"owned by current app",
    detailNavigation:"breadcrumb + logical parent back",
    desktopSidebar:"inline and collapsible",
    compactSidebar:"off-canvas"
  },
  components:{
    INNOButton:{
      implementation:"shadcn/ui Button",
      variants:["primary","secondary","ghost","danger","icon"],
      rules:["One primary action per action area","Destructive actions use confirmation"]
    },
    INNOIcon:{
      implementation:"Lucide",
      source:"semantic tokens from inno-icons.js",
      rules:["Do not couple React code to Font Awesome class names","Icon-only controls require accessible labels"]
    },
    INNODataTable:{
      implementation:"TanStack Table + INNO.One styles",
      capabilities:["search","filters","column visibility","bulk selection","pagination","horizontal overflow"],
      states:["loading","empty","noResults","error","partialFailure"]
    },
    INNOForm:{
      implementation:"React Hook Form + Zod + shadcn/ui fields",
      rules:["Labels stay visible","Validation appears next to owning field","Preserve input after recoverable error"]
    },
    INNOSelect:{
      implementation:"Radix/shadcn Select + INNO.One trigger/list styling",
      usage:"short static choice lists",
      behavior:["keyboard navigation","backing value remains form state","never expose browser-default selector in Web Portal"]
    },
    INNOCombobox:{
      implementation:"Popover + Command pattern",
      usage:"searchable people/templates/categories or longer option sets"
    },
    INNOMultiSelect:{
      implementation:"searchable listbox + selected chips",
      usage:"multiple recipients, scopes, categories or tags"
    },
    INNOResourcePicker:{
      implementation:"searchable resource combobox with icon + metadata",
      usage:"Devices, Assets, Groups, Datasets and other identifiable resources"
    },
    INNOSegmented:{
      implementation:"single-select segmented control backed by form state",
      usage:"2–4 mutually exclusive high-frequency choices"
    },
    INNOTabs:{
      implementation:"shadcn/ui Tabs",
      keyboard:["ArrowLeft","ArrowRight","Home","End"],
      responsive:"single row with horizontal scroll"
    },
    INNODialog:{
      implementation:"shadcn/ui Dialog",
      usage:"blocking confirmation or focused task",
      behavior:["Esc closes","focus trapped","focus returns to trigger","backdrop dismiss only when safe"]
    },
    INNOSheet:{
      implementation:"shadcn/ui Sheet",
      usage:"contextual edit/filter with approximately 3–8 fields",
      responsive:"full width on very narrow screens"
    },
    INNODropdownMenu:{
      implementation:"shadcn/ui DropdownMenu",
      usage:"2–6 secondary actions for one resource or row"
    },
    INNOCommand:{
      implementation:"shadcn/ui Command",
      usage:"global search and command palette",
      shortcut:"Cmd/Ctrl+K"
    },
    INNOToast:{
      implementation:"Sonner via shadcn/ui",
      variants:["success","warning","error","info"],
      usage:"non-blocking operation feedback"
    },
    INNOState:{
      implementation:"INNO.One composed component",
      variants:["loading","empty","noResults","error","permission","offline","disabled","partial"],
      rules:["Permission is not Error","Disabled Module is not Permission","Partial failure shows succeeded and failed counts"]
    },
    INNOChart:{
      implementation:"Apache ECharts",
      usage:["realtime CPU/memory","inventory distribution","SLA","reports"]
    },
    INNOIllustration:{
      implementation:"local SVG asset rendered inside INNO.One visual shell",
      sizes:{hero:"220–280px",section:"160–200px",feature:"100–140px",empty:"120–180px"},
      rules:["Use one illustration family","Decorative SVG uses empty alt text","Do not place decorative art in dense operational screens"]
    },
    INNOWelcomeHero:{
      implementation:"content + contextual metadata + illustration",
      usage:["Workspace Home","high-level app overview"]
    },
    INNOEmptyState:{
      implementation:"illustration + title + explanation + primary action",
      usage:"empty/search/no-data states"
    },
    INNOStepper:{
      implementation:"INNO.One native component",
      usage:"fixed ordered process with approximately 3–8 steps"
    },
    INNOTimeline:{
      implementation:"INNO.One native component",
      usage:"chronological immutable event history"
    },
    INNOStatusStepper:{
      implementation:"INNO.One native component",
      usage:"current lifecycle/status progression"
    },
    INNOTree:{
      implementation:"React Arborist behind INNO.One renderer",
      usage:"nested categories, locations, organization-unit pickers and folder-like structures"
    },
    INNOTreeGrid:{
      implementation:"TanStack Table expandable hierarchical rows + INNO.One styles",
      usage:"hierarchy with multiple data columns"
    },
    INNOOrgChart:{
      implementation:"d3-org-chart behind INNO.One wrapper",
      usage:"actual reporting-line / organization hierarchy only"
    },
    INNOWorkflowCanvas:{
      implementation:"React Flow + ELK.js auto layout",
      usage:"editable branching workflow, conditions, routing and parallel paths"
    },
    INNOBpmnDesigner:{
      implementation:"bpmn-js",
      usage:"only when BPMN 2.0 notation/import/export is an explicit requirement"
    },
    INNOAgentEndpointForm:{
      implementation:"INNO.One Agent surface component",
      usage:["endpoint Request Help","Thai ownership confirmation"],
      rules:["Does not load Web platform shell","Uses shared identity/permission/event contracts"]
    },
    INNOMobileScanner:{
      implementation:"Expo/Android Camera + INNO.One mobile styles",
      states:["ready","scanning","success","invalid","permissionDenied","offline"],
      rules:["Printed QR stores opaque asset token only","Inventory data loads after authentication","Scan events are auditable"]
    },
    INNOEmailNotificationRule:{
      implementation:"Helpdesk lifecycle trigger + template + recipients + delivery status",
      states:["enabled","disabled","queued","delivered","retrying","failed"],
      rules:["Ticket status updates can trigger email automatically","Requester/assignee/watchers/team lead recipients are explicit","Delivery result is written to ticket activity"]
    },
    WorkflowCanvas:{
      implementation:"Alias of INNOWorkflowCanvas",
      usage:"Deprecated prototype name; use INNOWorkflowCanvas for new work"
    }
  },
  responsive:{
    wide:{min:1600,rail:72,sidebar:248},
    desktop:{min:1367,max:1599,rail:64,sidebar:232},
    compact:{min:1181,max:1366,rail:60,sidebar:216},
    tablet:{min:851,max:1180,sidebar:"off-canvas"},
    narrow:{max:850,sidebar:"off-canvas"},
    veryNarrow:{max:680,search:"compact",drawer:"full-width"}
  },
  states:{
    async:["loading","saving","saved","error"],
    data:["empty","noResults","partial"],
    access:["permission","disabled"],
    connectivity:["offline"]
  },
  sourceOfTruth:[
    "design-system.html",
    "inno-design-system.css",
    "inno-design-contract.js",
    "inno-interactions.js",
    "inno-inputs.js",
    "inno-states.js",
    "inno-responsive.js",
    "inno-navigation.js",
    "inno-icons.js",
    "INNO-One-Surface-Boundaries.md",
    "INNO-One-Special-UI-Components.md",
    "INNO-One-UI-Prototype-Summary.md",
    "INNO-One-Screen-Architecture-Refactor-Plan.md",
    "INNO-One-Final-Visual-QA-Baseline.md"
  ],
  changePolicy:{
    patch:"Visual correction that does not change component API or behavior.",
    minor:"Additive component/state/token with backward compatibility.",
    major:"Breaking navigation, component API, interaction or semantic-token change.",
    rule:"After freeze, new module UI must consume the contract instead of inventing a parallel pattern."
  }
};

function expose(){
  window.INNODesignContract=contract;
  document.documentElement.dataset.dsContract=contract.contractVersion;
  document.documentElement.dataset.dsStatus=contract.status;
}
expose();
})();