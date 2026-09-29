import { useMemo, useState } from 'react';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionToolbar,
  INNOEditorFooter,
  INNOIcon,
  INNOPage,
  INNOPagination,
  INNOResourceHeader,
  INNOSearchField,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOSurfaceTabs,
  INNOTableWrap,
} from '@inno/ui';
import './InternalDesignSystemPage.css';

const colors = [
  { name: 'Primary', value: '#275FD7', token: '--ds-primary' },
  { name: 'Text', value: '#172033', token: '--ds-text' },
  { name: 'Canvas', value: '#F7F8FA', token: '--ds-bg' },
  { name: 'Success', value: '#16794B', token: '--ds-success' },
  { name: 'Warning', value: '#A56812', token: '--ds-warning' },
  { name: 'Danger', value: '#BB3847', token: '--ds-danger' },
];

const sampleRows = [
  { id: 'DEV-001', name: 'FIN-LT-014', owner: 'Finance', location: 'Bangkok Office', state: 'Online' },
  { id: 'DEV-002', name: 'HR-LT-022', owner: 'Human Resources', location: 'Bangkok Office', state: 'Online' },
  { id: 'DEV-003', name: 'OPS-WS-008', owner: 'Digital Technology', location: 'Bangkok Office', state: 'Offline' },
  { id: 'DEV-004', name: 'LAB-VM-011', owner: 'Digital Technology', location: 'Data Center', state: 'Online' },
];

export function InternalDesignSystemPage() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detailTab, setDetailTab] = useState('overview');
  const [demoName, setDemoName] = useState('Bangkok Office');
  const [demoCode, setDemoCode] = useState('BKK');
  const [message, setMessage] = useState('Ready');

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sampleRows.filter((row) => {
      const matchesState = stateFilter === 'all' || row.state.toLowerCase() === stateFilter;
      const matchesSearch = !needle || [row.name, row.owner, row.location, row.id]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesState && matchesSearch;
    });
  }, [search, stateFilter]);

  const pageSize = 2;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <INNOPage
      eyebrow="Internal reference · Production UI"
      title="Production Design System"
      description="React implementation baseline for the frozen INNO.One Design System V1.26 and UI Contract 1.20.0."
      actions={(
        <div className="internal-ds-head-status">
          <INNOStatus tone="success">Frozen</INNOStatus>
          <INNOStatus tone="info">UI Contract 1.20.0</INNOStatus>
        </div>
      )}
    >
      <section className="internal-ds-freeze" aria-label="Frozen baseline">
        <span className="internal-ds-freeze-icon"><INNOIcon token="section.security" size={18} /></span>
        <div>
          <b>Frozen reference is versioned in Production</b>
          <p>
            Prototype snapshot: <code>production/design-system/frozen/v1.26</code>. React code must not import
            prototype HTML, CSS or JavaScript from that folder.
          </p>
        </div>
      </section>

      <nav className="internal-ds-jump" aria-label="Design system sections">
        <a href="#foundations">Foundations</a>
        <a href="#actions">Actions</a>
        <a href="#forms">Forms</a>
        <a href="#data">Data</a>
        <a href="#states">States</a>
        <a href="#patterns">Patterns</a>
        <a href="#navigation">Navigation</a>
        <a href="#responsive">Responsive</a>
      </nav>

      <section className="internal-ds-section" id="foundations">
        <div className="internal-ds-section-head">
          <div>
            <span>01</span>
            <div><h2>Foundations</h2><p>Frozen tokens for color, spacing, radius and density.</p></div>
          </div>
          <INNOStatus tone="neutral">V1.26</INNOStatus>
        </div>

        <div className="internal-ds-grid internal-ds-grid--colors">
          {colors.map((color) => (
            <article className="internal-ds-token-card" key={color.name}>
              <span className="internal-ds-color" style={{ background: color.value }} />
              <div><b>{color.name}</b><code>{color.value}</code><small>{color.token}</small></div>
            </article>
          ))}
        </div>

        <div className="internal-ds-foundation-row">
          <article><b>Spacing</b><span>4 · 8 · 12 · 16 · 24 · 32 px</span></article>
          <article><b>Control height</b><span>36 px</span></article>
          <article><b>Table row</b><span>48 px target</span></article>
          <article><b>Radius</b><span>8 control · 12 card · 14 dialog</span></article>
        </div>
      </section>

      <section className="internal-ds-section" id="actions">
        <div className="internal-ds-section-head">
          <div><span>02</span><div><h2>Actions & status</h2><p>Use one primary action per action area.</p></div></div>
        </div>
        <div className="internal-ds-demo-row">
          <INNOButton type="button" onClick={() => setMessage('Primary action')}>Primary</INNOButton>
          <INNOButton type="button" variant="secondary" onClick={() => setMessage('Secondary action')}>Secondary</INNOButton>
          <INNOButton type="button" variant="ghost" onClick={() => setMessage('Ghost action')}>Ghost</INNOButton>
          <INNOButton type="button" variant="danger" onClick={() => setMessage('Danger action')}>Danger</INNOButton>
          <INNOButton type="button" busy>Saving</INNOButton>
        </div>
        <div className="internal-ds-demo-row">
          <INNOStatus>Neutral</INNOStatus>
          <INNOStatus tone="success">Success</INNOStatus>
          <INNOStatus tone="warning">Warning</INNOStatus>
          <INNOStatus tone="danger">Danger</INNOStatus>
          <INNOStatus tone="info">Info</INNOStatus>
          <INNOStatus tone="success" dot>Online</INNOStatus>
        </div>
        <div className="internal-ds-demo-feedback" role="status">Demo feedback: {message}</div>
      </section>

      <section className="internal-ds-section" id="forms">
        <div className="internal-ds-section-head">
          <div><span>03</span><div><h2>Forms</h2><p>Labels stay visible. Validation and help text belong to the owning field.</p></div></div>
        </div>
        <div className="internal-ds-form-grid">
          <label className="field-block">
            <span>Name</span>
            <input value={demoName} onChange={(event) => setDemoName(event.target.value)} />
          </label>
          <label className="field-block">
            <span>Code</span>
            <input value={demoCode} onChange={(event) => setDemoCode(event.target.value)} />
            <small>Short stable identifier.</small>
          </label>
          <label className="field-block">
            <span>Type</span>
            <select defaultValue="office">
              <option value="office">Office</option>
              <option value="warehouse">Warehouse</option>
            </select>
          </label>
          <label className="field-block">
            <span>Description</span>
            <textarea defaultValue="Primary office for Bangkok operations." rows={3} />
          </label>
        </div>
      </section>

      <section className="internal-ds-section" id="data">
        <div className="internal-ds-section-head">
          <div><span>04</span><div><h2>Primary collection</h2><p>Heading → toolbar → table → footer. Collection-local states stay inside this surface.</p></div></div>
        </div>
        <INNOCollection>
          <INNOCollectionHeader
            title="Managed devices"
            description="Production collection anatomy using shared React primitives."
            meta={<INNOStatus tone="neutral">{filteredRows.length} records</INNOStatus>}
          />
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
              <option value="all">All status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </INNOSelectField>
          </INNOCollectionToolbar>

          {visibleRows.length ? (
            <INNOTableWrap>
              <table>
                <thead><tr><th>Device</th><th>Owner</th><th>Location</th><th>Status</th></tr></thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td><b>{row.name}</b><small className="internal-ds-cell-meta">{row.id}</small></td>
                      <td>{row.owner}</td>
                      <td>{row.location}</td>
                      <td><INNOStatus tone={row.state === 'Online' ? 'success' : 'warning'} dot>{row.state}</INNOStatus></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
          ) : (
            <INNOState
              compact
              kind="no-results"
              title="No matching devices"
              description="Clear search or filters to see the collection again."
              action={<INNOButton type="button" variant="secondary" onClick={() => { setSearch(''); setStateFilter('all'); setPage(1); }}>Clear filters</INNOButton>}
            />
          )}

          <INNOPagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filteredRows.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </INNOCollection>
      </section>

      <section className="internal-ds-section" id="states">
        <div className="internal-ds-section-head">
          <div><span>05</span><div><h2>State hierarchy</h2><p>Use full states for a whole page and compact states inside an existing collection or panel.</p></div></div>
        </div>
        <div className="internal-ds-state-grid">
          <INNOState kind="empty" title="No devices yet" description="New devices appear here after enrollment." />
          <INNOState kind="no-results" title="No results" description="Current search or filters matched nothing." />
          <INNOState kind="loading" title="Loading devices" description="Keep the owning layout stable while data is loading." />
          <INNOState kind="error" title="Unable to load devices" description="Preserve context and provide retry when meaningful." />
          <INNOState kind="permission" title="Permission required" description="Restricted data is not an application error." />
          <INNOState kind="offline" title="Device offline" description="Keep cached read-only information visible when possible." />
          <INNOState kind="partial" title="Completed with some failures" description="Preserve successful work and retry only failures." />
        </div>
      </section>

      <section className="internal-ds-section" id="patterns">
        <div className="internal-ds-section-head">
          <div><span>06</span><div><h2>Screen patterns</h2><p>These are the target anatomies used by the next UI-structure pass.</p></div></div>
        </div>

        <div className="internal-ds-pattern-grid">
          <article className="internal-ds-pattern">
            <header><INNOStatus tone="info">P02</INNOStatus><div><b>List</b><small>Find and select many records</small></div></header>
            <div className="internal-ds-pattern-stack">
              <div className="internal-ds-wire-block">Page header + Create/New</div>
              <div className="internal-ds-wire-block">Collection heading</div>
              <div className="internal-ds-wire-block">Search · Filters · Columns · Export</div>
              <div className="internal-ds-wire-block internal-ds-wire-block--grow">Table / operational list</div>
              <div className="internal-ds-wire-block">Pagination / collection state</div>
            </div>
          </article>

          <article className="internal-ds-pattern">
            <header><INNOStatus tone="info">P03</INNOStatus><div><b>Resource Detail</b><small>Inspect one resource</small></div></header>
            <div className="internal-ds-pattern-stack">
              <div className="internal-ds-wire-block">Breadcrumb + logical back</div>
              <div className="internal-ds-wire-block">Resource identity + resource actions</div>
              <div className="internal-ds-wire-block">Status / summary</div>
              <div className="internal-ds-wire-block">Tabs</div>
              <div className="internal-ds-wire-block internal-ds-wire-block--grow">Flat detail sections / related collection</div>
            </div>
          </article>

          <article className="internal-ds-pattern">
            <header><INNOStatus tone="info">P04</INNOStatus><div><b>Create / Edit</b><small>Edit one resource in a dedicated form</small></div></header>
            <div className="internal-ds-pattern-stack">
              <div className="internal-ds-wire-block">Page header · no duplicate Save</div>
              <div className="internal-ds-wire-block internal-ds-wire-block--grow">Editor sections + fields</div>
              <div className="internal-ds-wire-block">Owning action footer: Cancel · Save/Create</div>
            </div>
          </article>
        </div>

        <div className="internal-ds-live-pattern">
          <div className="internal-ds-live-label">Production primitive preview · P03</div>
          <INNOResourceHeader
            icon={<INNOIcon token="nav.devices" size={20} />}
            title="FIN-LT-014"
            status={<INNOStatus tone="success" dot>Online</INNOStatus>}
            meta={<><span>Windows 11</span><span>Bangkok Office</span><span>Assigned to Finance</span></>}
            actions={<INNOButton type="button" variant="secondary" onClick={() => setMessage('Resource action')}>More actions</INNOButton>}
          />
          <INNOSurfaceTabs
            ariaLabel="Detail preview"
            activeId={detailTab}
            onChange={setDetailTab}
            items={[
              { id: 'overview', label: 'Overview' },
              { id: 'software', label: 'Software' },
              { id: 'activity', label: 'Activity' },
            ]}
          />
          <div className="internal-ds-detail-section">
            <h3>{detailTab === 'overview' ? 'General information' : detailTab === 'software' ? 'Installed software' : 'Recent activity'}</h3>
            <dl>
              <div><dt>Owner</dt><dd>Finance</dd></div>
              <div><dt>Location</dt><dd>Bangkok Office</dd></div>
              <div><dt>Last seen</dt><dd>2 minutes ago</dd></div>
            </dl>
          </div>
        </div>

        <div className="internal-ds-live-pattern internal-ds-editor-preview">
          <div className="internal-ds-live-label">Production primitive preview · P04</div>
          <div className="internal-ds-editor-body">
            <div>
              <h3>Location details</h3>
              <p>Keep form sections flat and group only related fields.</p>
            </div>
            <div className="internal-ds-form-grid">
              <label className="field-block"><span>Name</span><input value={demoName} onChange={(event) => setDemoName(event.target.value)} /></label>
              <label className="field-block"><span>Code</span><input value={demoCode} onChange={(event) => setDemoCode(event.target.value)} /></label>
            </div>
          </div>
          <INNOEditorFooter>
            <INNOButton type="button" variant="secondary" onClick={() => { setDemoName('Bangkok Office'); setDemoCode('BKK'); setMessage('Editor reset'); }}>Cancel</INNOButton>
            <INNOButton type="button" onClick={() => setMessage('Editor saved')}>Save changes</INNOButton>
          </INNOEditorFooter>
        </div>
      </section>

      <section className="internal-ds-section" id="navigation">
        <div className="internal-ds-section-head">
          <div><span>07</span><div><h2>Navigation ownership</h2><p>One global shell. Each app owns its contextual navigation.</p></div></div>
        </div>
        <div className="internal-ds-shell-preview" aria-label="Shell structure preview">
          <div className="internal-ds-shell-header">Global Header · Brand · Search · Notifications · Profile</div>
          <div className="internal-ds-shell-body">
            <div className="internal-ds-shell-rail">
              <INNOIcon token="nav.workspace" />
              <INNOIcon token="nav.apps" />
              <INNOIcon token="nav.devices" />
              <INNOIcon token="nav.assets" />
              <INNOIcon token="nav.helpdesk" />
            </div>
            <div className="internal-ds-shell-side">
              <b>Context Sidebar</b>
              <span className="active">Overview</span>
              <span>Devices</span>
              <span>Groups</span>
              <span>Deployment</span>
            </div>
            <div className="internal-ds-shell-content">
              <b>Main Content</b>
              <span>Desktop: inline sidebar · collapsible</span>
              <span>Tablet/Narrow: off-canvas sidebar · labeled menu trigger</span>
              <span>Main content owns page scrolling after the shell reset.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="internal-ds-section" id="responsive">
        <div className="internal-ds-section-head">
          <div><span>08</span><div><h2>Responsive contract</h2><p>Use these breakpoints as the reference before page-local overrides.</p></div></div>
        </div>
        <div className="internal-ds-breakpoints">
          <article><b>Wide</b><span>≥ 1600</span><small>Rail 72 · Sidebar 248</small></article>
          <article><b>Desktop</b><span>1367–1599</span><small>Rail 64 · Sidebar 232</small></article>
          <article><b>Compact</b><span>1181–1366</span><small>Rail 60 · Sidebar 216 · collapsible</small></article>
          <article><b>Tablet</b><span>851–1180</span><small>Sidebar off-canvas</small></article>
          <article><b>Narrow</b><span>≤ 850</span><small>Sidebar off-canvas · stacked forms</small></article>
          <article><b>Very narrow</b><span>≤ 680</span><small>Compact search · full-width drawer</small></article>
        </div>
      </section>

      <section className="internal-ds-source">
        <INNOIcon token="section.audit" size={16} />
        <div>
          <b>Source of truth</b>
          <p>
            Frozen prototype and contracts live in <code>production/design-system/frozen/v1.26</code>.
            This route is the React implementation reference and is intentionally absent from normal navigation.
          </p>
        </div>
      </section>
    </INNOPage>
  );
}
