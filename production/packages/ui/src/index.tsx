import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { cx } from '@inno/shared';

export type INNOButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function INNOButton({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: INNOButtonVariant }) {
  return <button {...props} className={cx('inno-btn', 'inno-btn--' + variant, className)} />;
}

export function INNOState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="inno-state" aria-live="polite">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </section>
  );
}

export function INNOPage({
  title,
  eyebrow,
  children,
}: PropsWithChildren<{ title: string; eyebrow?: string }>) {
  return (
    <main className="inno-page">
      <header className="inno-page-head">
        {eyebrow ? <div className="inno-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  );
}
