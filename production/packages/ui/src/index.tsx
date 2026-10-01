import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  banner = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
  kind?: INNOStateKind;
  compact?: boolean;
  banner?: boolean;
}) {
  const role = kind === 'error' ? 'alert' : 'status';
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
      className={cx('inno-state', compact && 'compact', banner && 'banner', kind !== 'empty' && kind)}
      data-state={kind}
      role={role}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      aria-label={kind === 'loading' ? 'Loading content' : undefined}
      aria-busy={kind === 'loading' || undefined}
    >
      {kind === 'loading' ? <span className="inno-sr-only">Loading content</span> : null}
      <span className="inno-state-icon" aria-hidden="true"><INNOIcon token={iconToken} size={18} /></span>
      <div className="inno-state-copy">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="inno-state-meta">{meta}</div> : null}
      </div>
      {action ? <div className="inno-state-actions">{action}</div> : null}
    </section>
  );
}

export function INNOCollectionState({
  title,
  description,
  action,
  meta,
  kind = 'empty',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
  kind?: Extract<INNOStateKind, 'empty' | 'no-results' | 'loading' | 'error' | 'permission'>;
}) {
  return (
    <div className="inno-collection-state">
      <INNOState compact kind={kind} title={title} description={description} action={action} meta={meta} />
      {kind === 'no-results' ? (
        <div className="inno-pagination inno-pagination--state" data-inno-empty="true">
          <span>0 matching results</span>
        </div>
      ) : null}
    </div>
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

export type INNORowActionItem = {
  id: string;
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
};

export function INNORowActions({
  items,
  ariaLabel = 'Row actions',
}: {
  items: INNORowActionItem[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const enabledItems = items.filter((item) => !item.disabled && !item.busy);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    setMenuPosition({
      top: triggerRect.bottom + 4,
      right: Math.max(8, window.innerWidth - triggerRect.right),
    });

    function closeAndRestoreFocus() {
      setOpen(false);
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeAndRestoreFocus();
    }

    function onViewportChange() {
      setOpen(false);
    }

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !menuPosition || !menuRef.current || !triggerRef.current) return;

    const firstItem = menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    const frame = window.requestAnimationFrame(() => firstItem?.focus());

    const menuRect = menuRef.current.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight - 8) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const nextTop = Math.max(8, triggerRect.top - menuRect.height - 4);
      if (Math.abs(nextTop - menuPosition.top) > 1) {
        setMenuPosition((current) => current ? { ...current, top: nextTop } : current);
      }
    }

    return () => window.cancelAnimationFrame(frame);
  }, [open, menuPosition]);

  if (!items.length) return null;

  if (items.length === 1) {
    const item = items[0];
    const contextualLabel = ariaLabel === 'Row actions' ? item.label : ariaLabel + ': ' + item.label;
    return (
      <button
        type="button"
        className={cx('inno-row-action', item.tone === 'danger' && 'is-danger')}
        disabled={item.disabled || item.busy}
        aria-busy={item.busy || undefined}
        aria-label={contextualLabel}
        onClick={item.onSelect}
      >
        {item.busy ? <span className="inno-btn-spinner" aria-hidden="true" /> : item.icon}
        <span>{item.label}</span>
      </button>
    );
  }

  function select(item: INNORowActionItem) {
    setOpen(false);
    triggerRef.current?.focus();
    item.onSelect();
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    const focusable = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    if (!focusable.length) return;
    event.preventDefault();
    const current = focusable.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Home') focusable[0]?.focus();
    else if (event.key === 'End') focusable[focusable.length - 1]?.focus();
    else if (event.key === 'ArrowDown') focusable[(current + 1 + focusable.length) % focusable.length]?.focus();
    else focusable[(current - 1 + focusable.length) % focusable.length]?.focus();
  }

  const menu = open && menuPosition ? createPortal(
    <div
      ref={menuRef}
      className="inno-row-actions-menu"
      role="menu"
      aria-label={ariaLabel}
      style={{ top: menuPosition.top, right: menuPosition.right }}
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={cx('inno-row-actions-item', item.tone === 'danger' && 'is-danger')}
          disabled={item.disabled || item.busy}
          aria-busy={item.busy || undefined}
          onClick={() => select(item)}
        >
          {item.busy ? <span className="inno-btn-spinner" aria-hidden="true" /> : item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div className="inno-row-actions">
      <button
        ref={triggerRef}
        type="button"
        className="inno-row-actions-trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <INNOIcon token="action.more" size={16} />
      </button>
      {menu}
      <span className="inno-sr-only">{enabledItems.length} available actions</span>
    </div>
  );
}

function useOverlayFocus(
  open: boolean,
  rootRef: { current: HTMLElement | null },
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      const autofocus = root?.querySelector<HTMLElement>('[data-autofocus]');
      const firstFocusable = root?.querySelector<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      (autofocus ?? firstFocusable ?? root)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      const root = rootRef.current;
      if (!root) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((item) => item.getClientRects().length > 0);

      if (!focusable.length) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, rootRef]);
}

type INNOOverlayProps = PropsWithChildren<{
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}>;

function INNOOverlayFrame({
  kind,
  open,
  title,
  description,
  onClose,
  footer,
  closeLabel = 'Close',
  closeOnBackdrop = true,
  size = 'md',
  className,
  children,
}: INNOOverlayProps & { kind: 'dialog' | 'drawer' }) {
  const rootRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useOverlayFocus(open, rootRef, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className={cx('inno-overlay', 'inno-overlay--' + kind)}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={rootRef}
        className={cx('inno-overlay-panel', 'inno-' + kind, 'inno-' + kind + '--' + size, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="inno-overlay-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button type="button" className="inno-overlay-close" aria-label={closeLabel} onClick={onClose}>
            <INNOIcon token="action.close" size={16} />
          </button>
        </header>
        <div className="inno-overlay-body">{children}</div>
        {footer ? <footer className="inno-overlay-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export function INNODialog(props: INNOOverlayProps) {
  return <INNOOverlayFrame {...props} kind="dialog" />;
}

export function INNODrawer(props: INNOOverlayProps) {
  return <INNOOverlayFrame {...props} kind="drawer" />;
}

export function INNOPurposeNote({
  title,
  description,
  actions,
  tone = 'neutral',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'info' | 'warning';
  className?: string;
}) {
  return (
    <aside className={cx('inno-purpose-note', 'inno-purpose-note--' + tone, className)}>
      <div className="inno-purpose-note-copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="inno-purpose-note-actions">{actions}</div> : null}
    </aside>
  );
}

export function INNOInfoCallout(props: Omit<Parameters<typeof INNOPurposeNote>[0], 'tone'>) {
  return <INNOPurposeNote {...props} tone="info" />;
}

export function INNOEditorFooter({
  children,
  className,
  docked = false,
}: PropsWithChildren<{ className?: string; docked?: boolean }>) {
  return (
    <footer className={cx('inno-editor-footer', docked && 'is-docked', className)}>
      {children}
    </footer>
  );
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
      <span>{totalItems === 0 ? '0 matching results' : `Showing ${start}–${end} of ${totalItems}`}</span>
      {totalItems > 0 ? (
        <div className="inno-pagination-actions">
          <INNOButton variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </INNOButton>
          <span>Page {page} of {safePages}</span>
          <INNOButton variant="secondary" disabled={page >= safePages} onClick={() => onPageChange(page + 1)}>
            Next
          </INNOButton>
        </div>
      ) : null}
    </div>
  );
}
