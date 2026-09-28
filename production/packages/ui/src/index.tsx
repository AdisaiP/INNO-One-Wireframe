import type { ButtonHTMLAttributes, ChangeEvent, PropsWithChildren, ReactNode } from 'react';
import { cx } from '@inno/shared';

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
  return (
    <section
      className={cx('inno-state', compact && 'compact', kind !== 'empty' && kind)}
      data-state={kind}
      role={role}
      aria-live={kind === 'loading' ? 'polite' : undefined}
    >
      <span className="inno-state-icon" aria-hidden="true" />
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
  children,
}: PropsWithChildren<{ title: string; eyebrow?: string; description?: ReactNode; actions?: ReactNode }>) {
  return (
    <main className="inno-page">
      <header className="inno-page-head">
        <div className="inno-page-heading">
          {eyebrow ? <div className="inno-eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {description ? <div className="inno-page-sub">{description}</div> : null}
        </div>
        {actions ? <div className="inno-page-actions">{actions}</div> : null}
      </header>
      {children}
    </main>
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
      <span className="inno-search-icon" aria-hidden="true" />
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

export function INNOTableWrap({
  children,
  className,
  width = 'auto',
}: PropsWithChildren<{ className?: string; width?: 'auto' | 'wide' | 'xwide' }>) {
  return (
    <div className={cx('inno-table-wrap', width !== 'auto' && 'inno-table-wrap--' + width, className)} tabIndex={0}>
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
