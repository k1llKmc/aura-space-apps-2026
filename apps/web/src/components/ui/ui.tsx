'use client';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <button {...props} className={`button button-${variant} ${className}`} />
  );
}
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="muted mt-2 max-w-3xl">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
export function Badge({
  value,
  label,
}: {
  value?: string | null;
  label?: string;
}) {
  return (
    <span className={`badge badge-${(value || 'unknown').toLowerCase()}`}>
      {label || value?.replaceAll('_', ' ') || 'Not assessed'}
    </span>
  );
}
export function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: string;
}) {
  return (
    <article className="panel metric-card">
      <p className="muted text-sm">{label}</p>
      <div className={`metric-value ${tone || ''}`}>{value}</div>
      {detail && <div className="muted mt-2 text-xs">{detail}</div>}
    </article>
  );
}
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="panel state-panel" role="status" aria-live="polite">
      <span className="loading-dot" />
      {label}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-panel" role="alert">
      <p>{message}</p>
      {retry && <Button onClick={retry}>Retry</Button>}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel state-panel flex-col items-start">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  caption: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pagination({
  offset,
  total,
  limit = 20,
  onChange,
}: {
  offset: number;
  total: number;
  limit?: number;
  onChange: (offset: number) => void;
}) {
  if (!total && !offset) return null;
  return (
    <nav aria-label="Pagination" className="pagination">
      <p className="muted text-sm">
        {total
          ? `${Math.min(offset + 1, total)}–${Math.min(offset + limit, total)} of ${total}`
          : 'No results'}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={!offset}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
export function Modal({
  open,
  title,
  children,
  onClose,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onClose();
      }}
      className="modal"
    >
      <div className="modal-content">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <Button disabled={busy} onClick={onClose} aria-label="Close dialog">
            ×
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function AccessNotice({ children }: { children: ReactNode }) {
  return <div className="panel state-panel text-slate-300">{children}</div>;
}
