import type { ButtonHTMLAttributes, ChangeEvent, PropsWithChildren, ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  Blocks,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  ClipboardList,
  Contact,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Grid2X2,
  Hand,
  Headphones,
  History,
  House,
  Info,
  KeyRound,
  Layers3,
  Laptop,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Menu,
  Monitor,
  Package,
  PackageOpen,
  Palette,
  Pencil,
  Pin,
  Plug,
  Plus,
  QrCode,
  Radar,
  RefreshCw,
  Save,
  ScanSearch,
  Search,
  SearchCode,
  SearchX,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Timer,
  Trash2,
  TriangleAlert,
  Unplug,
  Upload,
  User,
  UserCheck,
  Users,
  WandSparkles,
  WifiOff,
  X,
  type LucideIcon as LucideIconType,
} from 'lucide-react';
import { cx } from '@inno/shared';

const INNO_ICON_MAP = {
  'nav.workspace': House,
  'nav.apps': Grid2X2,
  'nav.devices': Monitor,
  'nav.assets': Package,
  'nav.helpdesk': Headphones,
  'nav.admin': Settings,
  'device.desktop': Monitor,
  'device.laptop': Laptop,
  'device.server': Server,
  'device.virtual': Boxes,
  'section.overview': House,
  'section.discovery': Radar,
  'section.groups': Layers3,
  'section.remote': Monitor,
  'section.remoteConsent': Hand,
  'section.query': SearchCode,
  'section.deployment': PackageOpen,
  'section.maintenance': RefreshCw,
  'section.policies': ShieldCheck,
  'section.alerts': TriangleAlert,
  'section.inventory': Boxes,
  'section.licenses': KeyRound,
  'section.contracts': FileText,
  'section.qr': QrCode,
  'section.ownership': Contact,
  'section.tickets': FileText,
  'section.assigned': UserCheck,
  'section.team': Users,
  'section.sla': Timer,
  'section.automation': WandSparkles,
  'section.calendar': CalendarDays,
  'section.customFields': SlidersHorizontal,
  'section.userProfiles': Users,
  'section.submissions': ClipboardList,
  'section.organization': Building2,
  'section.locations': MapPin,
  'section.positions': BriefcaseBusiness,
  'section.users': Users,
  'section.roles': ShieldCheck,
  'section.accessScopes': ScanSearch,
  'section.modules': Blocks,
  'section.integrations': Plug,
  'section.security': Shield,
  'section.audit': ClipboardList,
  'section.branding': Palette,
  'section.settings': Settings,
  'section.continue': History,
  'section.attention': CircleAlert,
  'section.recent': History,
  'section.notifications': Bell,
  'section.profile': User,
  'section.available': Store,
  'action.search': Search,
  'action.menu': Menu,
  'action.add': Plus,
  'action.edit': Pencil,
  'action.delete': Trash2,
  'action.more': Ellipsis,
  'action.filter': ListFilter,
  'action.save': Save,
  'action.export': Download,
  'action.upload': Upload,
  'action.refresh': RefreshCw,
  'action.back': ArrowLeft,
  'action.close': X,
  'action.view': Eye,
  'action.disconnect': Unplug,
  'action.collapse': ChevronLeft,
  'action.expand': ChevronRight,
  'action.next': ChevronRight,
  'status.success': CircleCheck,
  'status.warning': TriangleAlert,
  'status.error': CircleX,
  'status.info': Info,
  'status.offline': WifiOff,
  'status.empty': CircleDashed,
  'status.noResults': SearchX,
  'status.loading': LoaderCircle,
} satisfies Record<string, LucideIconType>;

export type INNOIconToken = keyof typeof INNO_ICON_MAP;

export function INNOIcon({
  token,
  size = 16,
  strokeWidth = 1.9,
  className,
}: {
  token: INNOIconToken;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = INNO_ICON_MAP[token];
  return (
    <Icon
      className={cx('inno-icon', token === 'status.loading' && 'is-spinning', className)}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      data-icon-token={token}
    />
  );
}

export type INNOButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function INNOButton({
  variant = 'primary',
  className,
  busy = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: INNOButtonVariant; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx('inno-btn', 'inno-btn--' + variant, busy && 'is-loading', className)}
    >
      {busy ? <span className="inno-btn-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export type INNOStateKind = 'empty' | 'no-results' | 'loading' | 'error' | 'permission' | 'disabled' | 'offline' | 'partial';

export function INNOState({
  title,
  description,
  action,
  meta,
  kind = 'empty',
  compact = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
  kind?: INNOStateKind;
  compact?: boolean;
}) {
  const role = kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined;
  const iconToken: INNOIconToken =
    kind === 'loading' ? 'status.loading'
      : kind === 'error' ? 'status.error'
        : kind === 'permission' || kind === 'disabled' ? 'status.warning'
          : kind === 'offline' ? 'status.offline'
            : kind === 'partial' ? 'status.warning'
              : kind === 'no-results' ? 'status.noResults'
                : 'status.empty';
  return (
    <section
      className={cx('inno-state', compact && 'compact', kind !== 'empty' && kind)}
      data-state={kind}
      role={role}
      aria-live={kind === 'loading' ? 'polite' : undefined}
    >
      <span className="inno-state-icon" aria-hidden="true"><INNOIcon token={iconToken} size={18} /></span>
      <div>
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="inno-state-meta">{meta}</div> : null}
      </div>
      {action ? <div className="inno-state-actions">{action}</div> : null}
    </section>
  );
}

export function INNOPage({
  title,
  eyebrow,
  description,
  actions,
  breadcrumb,
  illustration,
  children,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  illustration?: ReactNode;
}>) {
  const header = (
    <header className="inno-page-head">
      <div className="inno-page-heading">
        {eyebrow ? <div className="inno-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <div className="inno-page-sub">{description}</div> : null}
      </div>
      {actions ? <div className="inno-page-actions">{actions}</div> : null}
    </header>
  );

  return (
    <main className="inno-page">
      {breadcrumb ? <nav className="inno-page-breadcrumb" aria-label="Breadcrumb">{breadcrumb}</nav> : null}
      {illustration ? (
        <section className="inno-page-hero">
          <div className="inno-page-hero-copy">{header}</div>
          <div className="inno-page-illustration" aria-hidden="true">{illustration}</div>
        </section>
      ) : header}
      {children}
    </main>
  );
}

export function INNOSurfaceTabs({
  items,
  activeId,
  onChange,
  ariaLabel = 'Sections',
}: {
  items: Array<{ id: string; label: ReactNode }>;
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="inno-surface-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === activeId}
          className={item.id === activeId ? 'active' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export type INNOStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function INNOStatus({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: INNOStatusTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cx('inno-status', 'inno-status--' + tone, dot && 'inno-status--dot', className)}>
      {children}
    </span>
  );
}

export function INNOCollection({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <section className={cx('inno-collection', className)}>{children}</section>;
}

export function INNOCollectionHeader({
  title,
  description,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="inno-collection-head">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {meta ? <div className="inno-collection-meta">{meta}</div> : null}
    </div>
  );
}

export function INNOCollectionToolbar({
  children,
}: PropsWithChildren) {
  return <div className="inno-collection-toolbar">{children}</div>;
}

export function INNOSearchField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cx('inno-search', className)}>
      <span className="inno-sr-only">{label}</span>
      <span className="inno-search-icon" aria-hidden="true"><INNOIcon token="action.search" size={14} /></span>
      <input
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function INNOSelectField({
  label,
  value,
  onChange,
  children,
  className,
}: PropsWithChildren<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}>) {
  return (
    <label className={cx('inno-select', className)}>
      <span className="inno-sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

export function INNOToolbarSpacer() {
  return <span className="inno-toolbar-spacer" aria-hidden="true" />;
}

export function INNOToolbarMeta({ children }: PropsWithChildren) {
  return <span className="inno-toolbar-meta">{children}</span>;
}

export function INNOTableWrap({
  children,
  className,
  width = 'auto',
  stickyAction = false,
}: PropsWithChildren<{ className?: string; width?: 'auto' | 'wide' | 'xwide'; stickyAction?: boolean }>) {
  return (
    <div className={cx('inno-table-wrap', width !== 'auto' && 'inno-table-wrap--' + width, stickyAction && 'inno-table-wrap--sticky-action', className)} tabIndex={0}>
      {children}
    </div>
  );
}

export function INNOEditorFooter({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <footer className={cx('inno-editor-footer', className)}>{children}</footer>;
}

export function INNOEditorFooterStart({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cx('inno-editor-footer-start', className)}>{children}</div>;
}

export function INNOEditorFooterEnd({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cx('inno-editor-footer-end', className)}>{children}</div>;
}

export function INNOEditorFooterNote({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <span className={cx('inno-editor-footer-note', className)}>{children}</span>;
}

export function INNOResourceHeader({
  title,
  icon,
  status,
  meta,
  actions,
}: {
  title: ReactNode;
  icon?: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {

  return (
    <header className="inno-resource-head">
      <div className="inno-resource-identity">
        {icon ? <div className="inno-resource-icon" aria-hidden="true">{icon}</div> : null}
        <div>
          <div className="inno-resource-title-row">
            <div className="inno-resource-title">{title}</div>
            {status}
          </div>
          {meta ? <div className="inno-resource-meta">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="inno-resource-actions">{actions}</div> : null}
    </header>
  );
}

export function INNOResourceSummary({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cx('inno-resource-summary', className)}>{children}</div>;
}

export function INNOResourceSummaryItem({
  label,
  value,
  detail,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="inno-resource-summary-item">
      <span>{label}</span>
      <b>{value}</b>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function INNOPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {

  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const safePages = Math.max(totalPages, 1);
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);
  return (
    <div className="inno-pagination" data-inno-empty={totalItems === 0 || undefined}>
      <span>Showing {start}–{end} of {totalItems}</span>
      <div className="inno-pagination-actions">
        <INNOButton variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </INNOButton>
        <span>Page {page} of {safePages}</span>
        <INNOButton variant="secondary" disabled={page >= safePages} onClick={() => onPageChange(page + 1)}>
          Next
        </INNOButton>
      </div>
    </div>
  );
}
