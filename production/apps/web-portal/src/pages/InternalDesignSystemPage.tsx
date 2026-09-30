import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionToolbar,
  INNOEditorFooter,
  INNOIcon,
  INNOPagination,
  INNOSearchField,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOTableWrap,
  type INNOIconToken,
} from '@inno/ui';
import './InternalDesignSystemPage.css';

type DSSectionProps = {
  id: string;
  title: string;
  description: string;
  badge?: ReactNode;
  children: ReactNode;
};

function DSSection({ id, title, description, badge, children }: DSSectionProps) {
  return (
    <section className="internal-ds-section" id={id}>
      <div className="internal-ds-section-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function DSCard({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <article className={'internal-ds-card' + (className ? ' ' + className : '')}>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function RuleRows({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="internal-ds-rules">
      {items.map(([label, description]) => (
        <div className="internal-ds-rule" key={label}>
          <b>{label}</b>
          <span>{description}</span>
        </div>
      ))}
    </div>
  );
}

const frozenItems = [
  'Foundations — colors, spacing, radius, density and elevation',
  'Platform Shell — global header, Rail and contextual sidebar ownership',
  'Actions — button hierarchy, menus, confirmation and toast feedback',
  'Inputs — Select, Combobox, Multi-select, Segmented and Resource Picker',
  'Data — table, search, filters, columns, bulk actions and pagination',
  'Hierarchy — INNOTree, INNOTreeGrid and INNOOrgChart selection rules',
  'States — loading, empty, error, permission, offline, disabled and partial failure',
  'Navigation — Rail, contextual active state, breadcrumb, deep link and logical back',
  'Responsive and semantic icon behavior',
  'Language ownership and canonical product terminology',
  'Interaction & feedback consistency',
  'Table / list data density consistency',
];

const sourceFiles = [
  'design-system.html',
  'inno-design-system.css',
  'inno-design-contract.js',
  'inno-interactions.js',
  'inno-inputs.js',
  'inno-states.js',
  'inno-responsive.js',
  'inno-navigation.js',
  'inno-icons.js',
  'INNO-One-Design-System-V1-Frozen.md',
  'INNO-One-Final-Visual-QA-Baseline.md',
  'INNO-One-Action-Layout-Contract.md',
  'INNO-One-Accessibility-Contract.md',
  'INNO-One-Availability-Contract.md',
  'INNO-One-Language-Terminology-Contract.md',
  'INNO-One-Interaction-Feedback-Contract.md',
  'INNO-One-Table-List-Density-Contract.md',
  'INNO-One-State-Coverage-Contract.md',
];

const sampleRows = [
  { id: '10.20.3.14', name: 'DESKTOP-HR-014', user: 'Somchai P.', os: 'Windows 11', state: 'Online', seen: 'Now' },
  { id: '10.20.1.33', name: 'NOTEBOOK-IT-003', user: 'Narin S.', os: 'Windows 11', state: 'Online', seen: '2m ago' },
  { id: '10.20.4.21', name: 'PC-FIN-021', user: 'Ploy K.', os: 'Windows 10', state: 'Offline', seen: '3h ago' },
];

const iconRows: Array<[INNOIconToken, string, string]> = [
  ['nav.workspace', 'Workspace', 'Global workspace destination'],
  ['nav.apps', 'Apps', 'Application launcher'],
  ['nav.devices', 'Devices', 'Managed endpoint inventory'],
  ['nav.assets', 'Assets', 'Asset inventory'],
  ['nav.helpdesk', 'Helpdesk', 'Support workspace'],
  ['nav.admin', 'Admin', 'Administration'],
  ['action.search', 'Search', 'Search/find'],
  ['action.filter', 'Filter', 'Filter collection'],
  ['action.add', 'Add', 'Create/add'],
  ['action.edit', 'Edit', 'Modify'],
  ['action.delete', 'Delete', 'Destructive removal'],
  ['action.more', 'More', 'Compact action menu'],
  ['status.success', 'Success', 'Healthy/complete'],
  ['status.warning', 'Warning', 'Risk/pending'],
  ['status.error', 'Error', 'Failure/destructive'],
  ['status.offline', 'Offline', 'Connectivity'],
];

const implementationRows = [
  ['Buttons / Actions', 'INNOButton + shared confirmation/toast behavior'],
  ['Input / Select', 'Native semantic control + shared field contract'],
  ['Search / Filters', 'INNOSearchField / INNOSelectField'],
  ['Primary table', 'INNOCollection + INNOTableWrap + INNOPagination'],
  ['States', 'INNOState with page vs compact ownership'],
  ['Resource detail', 'INNOResourceHeader + INNOSurfaceTabs + flat sections'],
  ['Editor actions', 'INNOEditorFooter owned by the editor'],
  ['Icons', 'INNOIcon semantic tokens mapped to Lucide'],
  ['Branching workflow', 'INNOWorkflowCanvas → React Flow + ELK only when graph behavior exists'],
];

export function InternalDesignSystemPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [partialResolved, setPartialResolved] = useState(false);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sampleRows.filter((row) => {
      const matchesState = stateFilter === 'all' || row.state.toLowerCase() === stateFilter;
      const matchesSearch = !needle || [row.name, row.user, row.os, row.id]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesState && matchesSearch;
    });
  }, [search, stateFilter]);

  const pageSize = 3;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function copyPattern() {
    try {
      await navigator.clipboard?.writeText('INNO.One Design System V1.26 · UI Contract 1.20.0');
      setFeedback('Pattern copied');
    } catch {
      setFeedback('Copy pattern reference ready');
    }
  }

  return (
    <main className="internal-ds-page">
      <header className="internal-ds-page-head">
        <div>
          <div className="internal-ds-eyebrow">INNO.ONE UI FOUNDATION</div>
          <div className="internal-ds-title-row">
            <h1>Design System V1.26</h1>
            <INNOStatus tone="success">Frozen</INNOStatus>
          </div>
          <p>Shared UI standards for Devices, Assets, Helpdesk, Reports, Meeting, and Admin, with enterprise workspace density, accessibility, and component reuse.</p>
        </div>
        <div className="internal-ds-page-actions">
          <INNOButton type="button" variant="secondary" onClick={() => navigate('/devices')}>View Pilot Page</INNOButton>
          <INNOButton type="button" onClick={() => void copyPattern()}>Copy Pattern</INNOButton>
        </div>
      </header>

      <div className="internal-ds-freeze-banner">
        <span className="internal-ds-freeze-icon"><INNOIcon token="section.security" size={17} /></span>
        <div className="internal-ds-grow">
          <b>UI Contract 1.20.0 is frozen</b>
          <span>Core component APIs, navigation, states, icon semantics and responsive behavior are now the implementation baseline. Future changes follow semantic versioning.</span>
        </div>
        <a className="inno-btn inno-btn--secondary" href="#freeze">View Contract</a>
      </div>

      <div className="internal-ds-alert">
        <INNOIcon token="status.info" size={15} />
        <div>
          <b>Implementation direction</b>
          <p>This React page consumes the frozen contract while preserving Web, Endpoint Agent, and Android Mobile surface boundaries. Use the component that matches the data model instead of forcing every workflow into a node canvas.</p>
        </div>
      </div>
      <DSSection
        id="freeze"
        title="Frozen UI contract"
        description="The prototype patterns below are now the baseline for React implementation and future modules."
        badge={<INNOStatus tone="success">Contract 1.20.0 · Frozen</INNOStatus>}
      >
        <div className="internal-ds-freeze-grid">
          <DSCard title="What is frozen">
            <div className="internal-ds-freeze-list">
              {frozenItems.map((item) => (
                <div key={item}>
                  <INNOIcon token="status.success" size={13} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </DSCard>
          <DSCard title="Source of truth">
            <div className="internal-ds-file-list">
              {sourceFiles.map((file) => <code key={file}>{file}</code>)}
            </div>
            <div className="internal-ds-alert internal-ds-alert--inside">
              <INNOIcon token="section.settings" size={15} />
              <div>
                <b>React consumes the contract, not prototype internals.</b>
                <p>HTML uses prototype helpers only for prototype infrastructure; Production React uses the frozen component ownership below.</p>
              </div>
            </div>
          </DSCard>
        </div>

        <div className="internal-ds-freeze-table">
          <div className="internal-ds-freeze-table-head"><span>Change type</span><span>Allowed after freeze</span><span>Version impact</span></div>
          <div><b>Visual correction</b><span>Spacing / alignment / accessibility fix without API or behavior change</span><INNOStatus tone="neutral">Patch</INNOStatus></div>
          <div><b>Compatible addition</b><span>New optional component behavior that preserves existing ownership</span><INNOStatus tone="info">Minor</INNOStatus></div>
          <div><b>Breaking contract change</b><span>Moves ownership or changes established component behavior</span><INNOStatus tone="warning">Major</INNOStatus></div>
        </div>
      </DSSection>

      <DSSection
        id="foundations"
        title="Foundations"
        description="Neutral surfaces, one primary accent, semantic states, restrained elevation."
        badge={<INNOStatus tone="success">Approved V1</INNOStatus>}
      >
        <div className="internal-ds-grid">
          <DSCard title="Color tokens">
            <div className="internal-ds-swatch-list">
              {[
                ['#275FD7', 'Primary', 'actions / active nav / focus'],
                ['#172033', 'Text', 'primary content'],
                ['#F7F8FA', 'Canvas', 'application background'],
                ['#16794B', 'Success', 'healthy / complete / online'],
                ['#A56812', 'Warning', 'risk / pending'],
                ['#BB3847', 'Danger', 'destructive / critical'],
              ].map(([value, label, use]) => (
                <div className="internal-ds-swatch" key={label}>
                  <span style={{ background: value }} />
                  <div><b>{label}</b><small>{value} · {use}</small></div>
                </div>
              ))}
            </div>
          </DSCard>

          <DSCard title="Typography">
            <div className="internal-ds-type-list">
              <div><small>Page title</small><strong className="internal-ds-type-page">Devices</strong></div>
              <div><small>Section title</small><strong className="internal-ds-type-section">Device health</strong></div>
              <div><small>Body</small><span className="internal-ds-type-body">Managed endpoints and inventory</span></div>
              <div><small>Metadata</small><span className="internal-ds-type-meta">Last seen 2 minutes ago</span></div>
              <div><small>Label</small><span className="internal-ds-type-label">WORKSPACE</span></div>
            </div>
          </DSCard>

          <DSCard title="Spacing & radius">
            <div className="internal-ds-chip-row">
              {[4, 8, 12, 16, 24, 32].map((value) => <span key={value}>{value}</span>)}
            </div>
            <p className="internal-ds-card-note">Default control 36px · row 48px · radius 8px · card 12px · dialog 14px</p>
          </DSCard>

          <DSCard title="Elevation rule">
            <div className="internal-ds-elevation-stack">
              <div className="internal-ds-elevation internal-ds-elevation--flat">Surface</div>
              <div className="internal-ds-elevation">Raised card</div>
              <div className="internal-ds-elevation internal-ds-elevation--overlay">Overlay only</div>
            </div>
            <p className="internal-ds-card-note">Tables and page sections use borders as the primary separation; heavy shadows are reserved for overlays.</p>
          </DSCard>
        </div>
      </DSSection>

      <DSSection
        id="buttons"
        title="Actions & status"
        description="One primary action per area; destructive actions never look like the default action."
      >
        <div className="internal-ds-grid">
          <DSCard title="Buttons">
            <div className="internal-ds-stack">
              <INNOButton type="button" onClick={() => setFeedback('Primary action')}>Primary</INNOButton>
              <INNOButton type="button" variant="secondary" onClick={() => setFeedback('Secondary action')}>Secondary</INNOButton>
              <INNOButton type="button" variant="ghost" onClick={() => setFeedback('Ghost action')}>Ghost</INNOButton>
              <INNOButton type="button" variant="danger" onClick={() => setFeedback('Delete confirmation pattern')}>Delete</INNOButton>
              <button className="internal-ds-icon-button" type="button" aria-label="More row actions" onClick={() => setMenuOpen((open) => !open)}>
                <INNOIcon token="action.more" size={15} />
              </button>
            </div>
          </DSCard>

          <DSCard title="Badges & status">
            <div className="internal-ds-stack">
              <INNOStatus tone="success" dot>Online</INNOStatus>
              <INNOStatus tone="warning" dot>Offline</INNOStatus>
              <INNOStatus tone="success">Completed</INNOStatus>
              <INNOStatus tone="warning">At risk</INNOStatus>
              <INNOStatus tone="danger">Critical</INNOStatus>
              <INNOStatus>Draft</INNOStatus>
            </div>
          </DSCard>
        </div>

        <DSCard title="Action placement contract" className="internal-ds-card--spaced">
          <p className="internal-ds-card-note">Action placement follows page type; do not move Save/Create/Schedule between header, section and footer on a page-by-page basis.</p>
          <RuleRows items={[
            ['Overview / List', 'New/Create belongs in Page Header. Filters, Columns and Export belong to the table toolbar.'],
            ['Resource Detail', 'Resource operations belong in Resource Actions next to the resource identity.'],
            ['Create / Edit / Settings', 'Cancel/Discard and Save/Create/Schedule belong in the owning INNOActionFooter.'],
            ['Builder / Wizard', 'Navigation or Run/Save actions remain in the owning builder/wizard footer.'],
          ]} />
          <div className="internal-ds-footer-demo">
            <INNOEditorFooter>
              <INNOButton type="button" variant="secondary" onClick={() => setFeedback('Discard action')}>Discard</INNOButton>
              <INNOButton type="button" onClick={() => setFeedback('Save changes')}>Save changes</INNOButton>
            </INNOEditorFooter>
          </div>
          <p className="internal-ds-card-note">Long editors dock this footer to the viewport while preserving the owning editor pane width and bottom safe space.</p>
        </DSCard>
      </DSSection>

      <DSSection
        id="forms"
        title="Forms"
        description="Compact labels, clear focus ring, predictable error placement."
      >
        <div className="internal-ds-grid">
          <DSCard title="Input System">
            <div className="internal-ds-form">
              <label><span>Device name</span><input defaultValue="DESKTOP-HR-014" /></label>
              <label><span>Status · Select</span><select defaultValue="online"><option value="online">Online</option><option value="offline">Offline</option></select></label>
              <label><span>Owner · Combobox</span><select defaultValue="somchai"><option value="somchai">Somchai Prasert</option><option value="ploy">Ploy K.</option><option value="narin">Narin S.</option><option value="none">Unassigned</option></select></label>
              <label><span>Device · Resource Picker</span><select defaultValue="hr"><option value="hr">DESKTOP-HR-014 · Online</option><option value="it">NOTEBOOK-IT-003 · Online</option><option value="fin">PC-FIN-021 · Offline</option></select></label>
              <label><span>Urgency · Segmented</span><select defaultValue="normal"><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            </div>
          </DSCard>

          <DSCard title="Validation / selection">
            <div className="internal-ds-form">
              <label>
                <span>Email</span>
                <input className="internal-ds-input-error" defaultValue="somchai@" aria-invalid="true" aria-describedby="ds-email-error" />
                <small className="internal-ds-error" id="ds-email-error">Enter a valid email address</small>
              </label>
              <label className="internal-ds-check"><input type="checkbox" defaultChecked /> <span>Enable email notifications</span></label>
              <label className="internal-ds-check"><input type="checkbox" /> <span>Require user consent</span></label>
              <div className="internal-ds-toggle-row"><button className="internal-ds-toggle active" type="button" role="switch" aria-checked="true"><span /></button><span>Policy enabled</span></div>
            </div>
          </DSCard>
        </div>
      </DSSection>

      <DSSection
        id="data"
        title="Data Table"
        description="Standard pattern for Devices, Assets, Tickets, Licenses, Contracts and Audit."
      >
        <INNOCollection>
          <INNOCollectionToolbar>
            <INNOSearchField
              label="Search devices"
              value={search}
              placeholder="Search devices..."
              onChange={(value) => { setSearch(value); setPage(1); }}
            />
            <INNOSelectField
              label="Status"
              value={stateFilter}
              onChange={(value) => { setStateFilter(value); setPage(1); }}
            >
              <option value="all">Status: All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </INNOSelectField>
            <INNOButton type="button" variant="secondary" onClick={() => setFilterOpen((open) => !open)}>
              Filters
            </INNOButton>
            <span className="internal-ds-toolbar-spacer" />
            <INNOButton type="button" variant="secondary" onClick={() => setColumnsOpen((open) => !open)}>Columns</INNOButton>
            <INNOButton type="button" onClick={() => setFeedback('Add Device')}>Add Device</INNOButton>
          </INNOCollectionToolbar>

          {filterOpen ? <div className="internal-ds-inline-popover">Filter drawer demo · Status · OS · Location</div> : null}
          {columnsOpen ? <div className="internal-ds-inline-popover">Column selector demo · Device · Status · User · OS · Last Seen</div> : null}

          {visibleRows.length ? (
            <INNOTableWrap>
              <table>
                <thead><tr><th><input type="checkbox" aria-label="Select all rows" /></th><th>Device</th><th>Status</th><th>User</th><th>OS</th><th>Last Seen</th><th aria-label="Action" /></tr></thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.name}>
                      <td><input type="checkbox" aria-label={'Select ' + row.name} /></td>
                      <td><b>{row.name}</b><small className="internal-ds-cell-meta">{row.id}</small></td>
                      <td><INNOStatus tone={row.state === 'Online' ? 'success' : 'warning'} dot>{row.state}</INNOStatus></td>
                      <td>{row.user}</td>
                      <td>{row.os}</td>
                      <td>{row.seen}</td>
                      <td><button className="internal-ds-icon-button" type="button" aria-label={'More actions for ' + row.name}><INNOIcon token="action.more" size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
          ) : (
            <INNOState compact kind="no-results" title="No matching devices" description="Clear search or filters to restore the collection." />
          )}

          <INNOPagination page={safePage} totalPages={totalPages} totalItems={filteredRows.length} pageSize={pageSize} onPageChange={setPage} />
        </INNOCollection>
      </DSSection>
      <DSSection
        id="hierarchy"
        title="Hierarchy components"
        description="Choose Tree, TreeGrid or Org Chart from the data model instead of drawing hierarchy ad hoc."
        badge={<INNOStatus tone="success">Shared primitives</INNOStatus>}
      >
        <div className="internal-ds-grid">
          <DSCard title="INNOTree">
            <p className="internal-ds-card-note">Nested data without columns. Supports expand/collapse, selection, search and Arrow-key navigation.</p>
            <div className="internal-ds-tree-search"><INNOIcon token="action.search" size={13} /><span>Search organization...</span></div>
            <div className="internal-ds-tree">
              <div><span>▾</span><b>Innovations Solutions</b></div>
              <div className="level-1"><span>▾</span><b>Digital Technology</b></div>
              <div className="level-2 active"><span>•</span><b>IT Operations</b></div>
              <div className="level-2"><span>•</span><span>Application Engineering</span></div>
              <div className="level-1"><span>›</span><span>Finance</span></div>
              <div className="level-1"><span>›</span><span>Human Resources</span></div>
            </div>
          </DSCard>

          <DSCard title="INNOOrgChart">
            <p className="internal-ds-card-note">Relationship-oriented structure. Use for reporting lines, not generic navigation.</p>
            <div className="internal-ds-org-chart">
              <div className="root"><b>Chief Executive</b><small>Executive Office</small></div>
              <span className="internal-ds-org-line" />
              <div className="children">
                <div><b>Digital Technology</b><small>Division</small></div>
                <div><b>Finance</b><small>Division</small></div>
              </div>
            </div>
          </DSCard>

          <DSCard title="INNOTreeGrid">
            <p className="internal-ds-card-note">Hierarchy plus columns. Use when nested records need status, owner or operational metadata.</p>
            <INNOTableWrap>
              <table className="internal-ds-treegrid">
                <thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td><b>▾ Bangkok</b></td><td>Site</td><td><INNOStatus tone="success">Active</INNOStatus></td></tr>
                  <tr><td><span className="indent">↳ Office 01</span></td><td>Location</td><td><INNOStatus tone="success">Active</INNOStatus></td></tr>
                  <tr><td><span className="indent">↳ Lab</span></td><td>Location</td><td><INNOStatus tone="warning">Review</INNOStatus></td></tr>
                </tbody>
              </table>
            </INNOTableWrap>
          </DSCard>

          <DSCard title="Selection rule">
            <RuleRows items={[
              ['Tree', 'Choose when users navigate nested data without tabular columns.'],
              ['TreeGrid', 'Choose when hierarchy and column comparison are both required.'],
              ['Org Chart', 'Choose only when relationships/reporting lines are the primary meaning.'],
              ['Workflow Canvas', 'Choose only for real editable branching flow, not simple forms or queues.'],
            ]} />
          </DSCard>
        </div>
      </DSSection>

      <DSSection
        id="states"
        title="Component states"
        description="Every data view and workflow must define loading, empty, error, access, connectivity and progress states."
      >
        <div className="internal-ds-grid">
          <DSCard title="Saving / Saved">
            <div className="internal-ds-stack">
              <INNOButton type="button" busy>Saving</INNOButton>
              <INNOStatus tone="success">Saved</INNOStatus>
              <span className="internal-ds-small-muted">Prevent duplicate submit while busy; return to stable feedback afterward.</span>
            </div>
          </DSCard>

          <DSCard title="Partial failure">
            <INNOState
              banner
              kind="partial"
              title={partialResolved ? 'Retry completed' : '8 succeeded, 2 failed'}
              description={partialResolved
                ? 'The failed items were retried without repeating the 8 successful updates.'
                : 'Successful work is preserved. Retry only the 2 failed devices.'}
              meta={partialResolved ? '10 of 10 devices updated' : '8 of 10 devices updated'}
              action={!partialResolved ? (
                <INNOButton
                  type="button"
                  variant="secondary"
                  onClick={() => { setPartialResolved(true); setFeedback('Retry completed'); }}
                >
                  Retry failed
                </INNOButton>
              ) : undefined}
            />
          </DSCard>

          <DSCard title="State usage rules">
            <RuleRows items={[
              ['Empty', 'The collection truly contains no records yet.'],
              ['No Results', 'Search or filters matched nothing; preserve toolbar context.'],
              ['Loading', 'Keep the owning layout stable while data is loading.'],
              ['Error', 'Explain failure and expose retry only when meaningful.'],
              ['Permission', 'Access restriction is not an application error.'],
              ['Module Disabled', 'Explain that an administrator must enable the module and provide a safe route away.'],
              ['Offline', 'Keep cached resource detail visible under connectivity status when possible.'],
              ['Partial Failure', 'Preserve successful work and retry only failed items when retry is supported.'],
            ]} />
          </DSCard>

          <DSCard title="Canonical state previews">
            <div className="internal-ds-state-preview-grid">
              <INNOState compact kind="empty" title="Nothing here yet" description="New records will appear here when they exist." />
              <INNOState compact kind="no-results" title="No results" description="Change search or clear the filters." />
              <INNOState compact kind="loading" title="Loading content" description="Please wait while the latest data loads." />
              <INNOState compact kind="error" title="Unable to load content" description="Try again when the service is available." action={<INNOButton type="button" variant="secondary" onClick={() => setFeedback('Retry requested')}>Try again</INNOButton>} />
              <INNOState compact kind="permission" title="You do not have access" description="Your current role does not include permission to view this resource." />
              <INNOState compact kind="disabled" title="Module is not available" description="An administrator must enable this module before it can be used." />
              <INNOState compact kind="offline" title="Resource offline" description="Cached information remains visible while live-only actions are unavailable." />
              <INNOState compact kind="partial" title="8 succeeded, 2 failed" description="Preserve successful work and retry only failed items." />
            </div>
          </DSCard>
        </div>
      </DSSection>

      <DSSection
        id="interactions"
        title="Interaction standards"
        description="Shared behavior for menus, filters, confirmation, columns, toast, tabs and keyboard dismissal."
      >
        <div className="internal-ds-interaction-grid">
          <DSCard title="Context menu">
            <div className="internal-ds-interaction-demo">
              <INNOButton type="button" variant="secondary" onClick={() => setMenuOpen((open) => !open)}>More actions</INNOButton>
              {menuOpen ? (
                <div className="internal-ds-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setFeedback('Open'); setMenuOpen(false); }}>Open</button>
                  <button type="button" role="menuitem" onClick={() => { setFeedback('Edit'); setMenuOpen(false); }}>Edit</button>
                  <button type="button" role="menuitem" onClick={() => { setFeedback('Delete'); setMenuOpen(false); }}>Delete</button>
                </div>
              ) : null}
            </div>
          </DSCard>

          <DSCard title="Filter drawer">
            <p className="internal-ds-card-note">Search remains first. Additional filters open from one predictable control.</p>
            <INNOButton type="button" variant="secondary" onClick={() => setFilterOpen((open) => !open)}>Filters</INNOButton>
          </DSCard>

          <DSCard title="Column selector">
            <p className="internal-ds-card-note">Column visibility belongs to the collection toolbar and never becomes page-level settings.</p>
            <INNOButton type="button" variant="secondary" onClick={() => setColumnsOpen((open) => !open)}>Columns</INNOButton>
          </DSCard>

          <DSCard title="Destructive confirmation">
            <p className="internal-ds-card-note">Confirmation is reserved for destructive, interruptive or high-impact actions.</p>
            <INNOButton type="button" variant="danger" onClick={() => setDialogOpen(true)}>Delete item</INNOButton>
          </DSCard>

          <DSCard title="Toast feedback">
            <p className="internal-ds-card-note">Use toast for short-lived result feedback after an action completes.</p>
            <INNOButton type="button" onClick={() => setFeedback('Changes saved successfully')}>Show success feedback</INNOButton>
          </DSCard>

          <DSCard title="Keyboard behavior">
            <RuleRows items={[
              ['Esc', 'Dismiss menu, dialog, drawer or contextual overlay.'],
              ['Enter / Space', 'Activate focused native controls.'],
              ['Arrow keys', 'Navigate composite controls when the component contract owns arrow navigation.'],
            ]} />
          </DSCard>
        </div>

        <DSCard title="Pattern selection rules" className="internal-ds-card--spaced">
          <RuleRows items={[
            ['Dialog', 'Decision, confirmation or focused task that temporarily blocks the parent surface.'],
            ['Sheet', 'Contextual edit or inspect task that should preserve page context.'],
            ['Toast', 'Short-lived result feedback that does not require another decision.'],
            ['Inline state', 'Feedback owned by a collection, form field or section remains inside that owner.'],
          ]} />
        </DSCard>
      </DSSection>

      <DSSection
        id="overlays"
        title="Dialog & overlays"
        description="Dialog for decisions, Sheet for contextual edit, Command palette for navigation."
      >
        <div className="internal-ds-grid">
          <DSCard title="Dialog">
            <p className="internal-ds-card-note">Use for focused decisions or destructive confirmation. Restore focus to the invoker after dismissal.</p>
            <INNOButton type="button" onClick={() => setDialogOpen(true)}>Open Dialog</INNOButton>
          </DSCard>

          <DSCard title="Sheet">
            <p className="internal-ds-card-note">Use for contextual inspect/edit when preserving the parent page is valuable.</p>
            <INNOButton type="button" variant="secondary" onClick={() => setSheetOpen(true)}>Open Sheet</INNOButton>
          </DSCard>
        </div>

        <DSCard title="Command palette" className="internal-ds-card--spaced">
          <div className="internal-ds-stack">
            <INNOButton type="button" variant="secondary" onClick={() => setFeedback('Command palette pattern')}>Open Command Palette</INNOButton>
            <span className="internal-ds-small-muted">Shortcut contract: Ctrl/⌘ K</span>
          </div>
        </DSCard>
      </DSSection>
      <DSSection
        id="responsive"
        title="Responsive behavior"
        description="Layout rules for 1920, 1440, 1366, compact laptop and tablet-size workspaces."
        badge={<INNOStatus tone="success">Viewport</INNOStatus>}
      >
        <div className="internal-ds-responsive-table">
          <div className="internal-ds-responsive-head"><span>Viewport</span><span>Rail</span><span>Context sidebar</span><span>Content behavior</span></div>
          <div><b>≥ 1600</b><span>72px</span><span>248px inline</span><span>Wide enterprise workspace</span></div>
          <div><b>1367–1599</b><span>64px</span><span>232px inline</span><span>Desktop baseline</span></div>
          <div><b>1181–1366</b><span>60px</span><span>216px inline · collapsible</span><span>Compact laptop</span></div>
          <div><b>851–1180</b><span>58px</span><span>Off-canvas</span><span>Labeled contextual hamburger</span></div>
          <div><b>≤ 850</b><span>56px</span><span>Off-canvas</span><span>Stack forms and preserve table scroll</span></div>
          <div><b>≤ 680</b><span>52px</span><span>Full-width drawer</span><span>Compact search and action wrapping</span></div>
        </div>

        <div className="internal-ds-grid internal-ds-grid--spaced">
          <DSCard title="Sidebar behavior">
            <RuleRows items={[
              ['Desktop', 'The collapse control lives inside the contextual sidebar header, next to the app name. It never appears in the global header.'],
              ['Collapsed Desktop', 'A compact reopen control appears on the left edge of page content and restores the remembered sidebar preference.'],
              ['Compact / Tablet', 'A labeled hamburger such as “Meeting” appears above page content and opens the contextual sidebar as an off-canvas drawer.'],
              ['Global Header', 'Reserved for INNO.One logo, global search, notifications and profile only.'],
              ['Dismiss', 'Backdrop click, navigation selection and Esc all close the overlay sidebar.'],
            ]} />
          </DSCard>

          <DSCard title="Dense content behavior">
            <RuleRows items={[
              ['Tables', '6+ columns retain readable minimum widths and scroll horizontally instead of crushing cells.'],
              ['Forms', 'Two-column field groups stack to one column on narrow screens.'],
              ['Tabs', 'Tabs remain one row and scroll horizontally when needed.'],
              ['Overlays', 'Drawers become full width on very narrow screens; dialogs respect viewport height.'],
            ]} />
          </DSCard>
        </div>
      </DSSection>

      <DSSection
        id="navigation"
        title="Navigation architecture"
        description="Global rail, contextual sidebar and resource breadcrumb must always tell the user where they are and how to go back."
        badge={<INNOStatus tone="success">Standardized</INNOStatus>}
      >
        <div className="internal-ds-grid">
          <DSCard title="Global navigation">
            <div className="internal-ds-nav-preview">
              <div className="internal-ds-nav-rail">
                <INNOIcon token="nav.workspace" />
                <INNOIcon token="nav.apps" />
                <INNOIcon token="nav.devices" />
                <INNOIcon token="nav.assets" />
                <INNOIcon token="nav.helpdesk" />
                <span />
                <INNOIcon token="nav.admin" />
              </div>
              <div className="internal-ds-nav-side">
                <b>Devices</b>
                <span className="active">Overview</span>
                <span>Discovery</span>
                <span>Device Groups</span>
                <span>Agent Deployment</span>
              </div>
              <div className="internal-ds-nav-content">
                <small>Devices / DESKTOP-HR-014</small>
                <b>DESKTOP-HR-014</b>
                <span>Resource detail keeps logical back and local context.</span>
              </div>
            </div>
          </DSCard>

          <DSCard title="Canonical hierarchy">
            <pre className="internal-ds-codebox">{"INNO.One\n├─ Workspace\n├─ Apps\n├─ Devices\n│  ├─ Overview\n│  ├─ Discovery\n│  ├─ Device Groups\n│  └─ Agent Deployment\n├─ Assets\n├─ Helpdesk\n└─ Admin Center"}</pre>
            <p className="internal-ds-card-note">Global Rail chooses the application. Context Sidebar chooses the job within that application. Breadcrumb identifies the current resource/path.</p>
          </DSCard>
        </div>
      </DSSection>

      <DSSection
        id="icons"
        title="Icon vocabulary"
        description="One semantic meaning = one icon. Font Awesome is used in the HTML prototype; React implementation maps the same tokens to Lucide."
        badge={<INNOStatus tone="success">Standardized</INNOStatus>}
      >
        <div className="internal-ds-icon-grid">
          {iconRows.map(([token, label, description]) => (
            <div className="internal-ds-icon-item" key={token}>
              <span><INNOIcon token={token} size={17} /></span>
              <div><b>{label}</b><small>{description}</small><code>{token}</code></div>
            </div>
          ))}
        </div>

        <DSCard title="Usage rules" className="internal-ds-card--spaced">
          <RuleRows items={[
            ['Navigation', 'Keep the same icon for the same destination across Rail, Sidebar and launcher surfaces.'],
            ['Actions', 'Use icon + label for primary/secondary actions. Icon-only controls are reserved for universally understood compact actions.'],
            ['Accessibility', 'Decorative icons are hidden from assistive technology. Icon-only controls expose an accessible label.'],
            ['Brands', 'Brand icons are used only for real brands. Hardware concepts use normal product icons.'],
            ['React migration', 'Consume semantic tokens, not Font Awesome class names. Lucide is the implementation library while meaning stays unchanged.'],
            ['Size', 'Rail 15px · Sidebar 13px · Buttons 11px · Header controls 13px · Resource icon 17px.'],
          ]} />
        </DSCard>
      </DSSection>

      <DSSection
        id="guidelines"
        title="Implementation map"
        description="Frozen component ownership for the React implementation."
        badge={<INNOStatus tone="success">Contract 1.20.0</INNOStatus>}
      >
        <div className="internal-ds-implementation-table">
          <div className="internal-ds-implementation-head"><span>Pattern</span><span>Production implementation</span></div>
          {implementationRows.map(([pattern, implementation]) => (
            <div key={pattern}><b>{pattern}</b><span>{implementation}</span></div>
          ))}
        </div>

        <div className="internal-ds-grid internal-ds-grid--spaced">
          <DSCard title="Definition of UI-complete">
            <div className="internal-ds-freeze-list">
              {[
                'Uses Platform Shell and semantic icons',
                'Correct Rail / Sidebar active state and logical back',
                'Loading / Empty / Error / Permission states defined',
                'Keyboard behavior supported for interactive primitives',
                'Responsive QA at 1920 / 1440 / 1366 / 1024 / 768',
                'No page-level horizontal overflow',
                'No duplicate parallel UI pattern introduced',
              ].map((item) => (
                <div key={item}><INNOIcon token="status.success" size={13} /><span>{item}</span></div>
              ))}
            </div>
          </DSCard>

          <DSCard title="Implementation handoff">
            <p className="internal-ds-card-note">The frozen written specification is stored next to the prototype for development handoff.</p>
            <pre className="internal-ds-codebox">{"INNO-One-Design-System-V1-Frozen.md\nINNO-One-Final-Visual-QA-Baseline.md\nINNO-One-Action-Layout-Contract.md\ndesign-system.html"}</pre>
            <div className="internal-ds-alert internal-ds-alert--inside">
              <INNOIcon token="status.info" size={15} />
              <div><b>Prototype → backend completion</b><p>The frozen contract defines UI behavior and component ownership only. It does not imply APIs, persistence, permissions or integrations are implemented.</p></div>
            </div>
          </DSCard>
        </div>
      </DSSection>

      {feedback ? (
        <div className="internal-ds-feedback" role="status">
          <span>{feedback}</span>
        </div>
      ) : null}

      {dialogOpen ? (
        <div className="internal-ds-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDialogOpen(false); }}>
          <div className="internal-ds-dialog" role="dialog" aria-modal="true" aria-labelledby="ds-dialog-title">
            <header>
              <h3 id="ds-dialog-title">Move devices to group</h3>
              <p>This pattern becomes the shared React dialog implementation.</p>
            </header>
            <div className="internal-ds-dialog-body">
              <label className="internal-ds-dialog-field"><span>Destination group</span><select defaultValue="hr"><option value="hr">HR / Bangkok</option><option value="finance">Finance</option><option value="it">IT Operations</option></select></label>
            </div>
            <footer>
              <INNOButton type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</INNOButton>
              <INNOButton type="button" onClick={() => { setDialogOpen(false); setFeedback('Devices moved successfully'); }}>Move Devices</INNOButton>
            </footer>
          </div>
        </div>
      ) : null}

      {sheetOpen ? (
        <>
          <button className="internal-ds-sheet-backdrop" type="button" aria-label="Close sheet" onClick={() => setSheetOpen(false)} />
          <aside className="internal-ds-sheet" aria-label="Edit resource sheet">
            <header><div><h3>Edit device owner</h3><p>Contextual edit keeps the parent page visible.</p></div><button className="internal-ds-icon-button" type="button" aria-label="Close sheet" onClick={() => setSheetOpen(false)}><INNOIcon token="action.close" /></button></header>
            <div className="internal-ds-sheet-body">
              <label><span>Owner</span><select defaultValue="somchai"><option value="somchai">Somchai Prasert</option><option value="ploy">Ploy K.</option></select></label>
              <label><span>Reason</span><textarea rows={4} defaultValue="Ownership correction" /></label>
            </div>
            <footer>
              <INNOButton type="button" variant="secondary" onClick={() => setSheetOpen(false)}>Cancel</INNOButton>
              <INNOButton type="button" onClick={() => { setSheetOpen(false); setFeedback('Owner updated'); }}>Save changes</INNOButton>
            </footer>
          </aside>
        </>
      ) : null}
    </main>
  );
}
