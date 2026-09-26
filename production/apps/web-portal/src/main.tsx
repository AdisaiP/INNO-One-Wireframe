import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { contractVersions, moduleRoutes } from '@inno/contracts';
import { INNOPage, INNOState } from '@inno/ui';
import '@inno/ui/styles.css';
import './shell.css';

const modules = [
  ['Workspace', moduleRoutes.workspace],
  ['Apps', moduleRoutes.apps],
  ['Devices', moduleRoutes.devices],
  ['Assets', moduleRoutes.assets],
  ['Helpdesk', moduleRoutes.helpdesk],
  ['Meeting', moduleRoutes.meeting],
  ['Reports', moduleRoutes.reports],
  ['Admin', moduleRoutes.admin],
] as const;

function Shell() {
  return (
    <div className="production-shell">
      <header className="production-header">
        <strong>INNO.<span>One</span></strong>
        <div className="production-contract">Implementation Contract {contractVersions.implementation}</div>
      </header>
      <div className="production-body">
        <nav className="production-nav" aria-label="Production module skeleton">
          {modules.map(([label, href]) => (
            <NavLink key={label} to={href} end={href === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <Routes>
          <Route path="/" element={<ModulePage name="Workspace" />} />
          <Route path="/apps/*" element={<ModulePage name="Apps" />} />
          <Route path="/devices/*" element={<ModulePage name="Devices" />} />
          <Route path="/assets/*" element={<ModulePage name="Assets" />} />
          <Route path="/helpdesk/*" element={<ModulePage name="Helpdesk" />} />
          <Route path="/meeting/*" element={<ModulePage name="Meeting" />} />
          <Route path="/reports/*" element={<ModulePage name="Reports" />} />
          <Route path="/admin/*" element={<ModulePage name="Admin Center" />} />
          <Route path="*" element={<ModulePage name="Not Found" />} />
        </Routes>
      </div>
    </div>
  );
}

function ModulePage({ name }: { name: string }) {
  return (
    <INNOPage eyebrow="Production skeleton" title={name}>
      <INNOState
        title={name + ' boundary is wired'}
        description="Step 14 establishes routing and package boundaries only. Frozen V1.26 screens are ported in later vertical slices without inventing parallel UI patterns."
      />
    </INNOPage>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  </React.StrictMode>,
);
