import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const control = 'w-full rounded-xl border border-field-stroke bg-field px-4 text-[16px] text-fg placeholder:text-fg-2 outline-none focus:border-ambar focus:ring-2 focus:ring-ambar/40 aria-[invalid=true]:border-coral';

/** Campo con etiqueta real encima, ayuda y error asociados por aria. */
export function Field({ id, label, hint, error, children, optional }: { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; optional?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-fg-3">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-fg-2">{optional}</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs leading-relaxed text-fg-2">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs font-medium text-danger-fg">{error}</p>}
    </div>
  );
}

const describedBy = (id: string | undefined, hint?: boolean, error?: boolean) =>
  [error && id && `${id}-error`, hint && id && `${id}-hint`].filter(Boolean).join(' ') || undefined;

export function Input({ className, invalid, hasHint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; hasHint?: boolean }) {
  return <input className={cn(control, 'h-12', className)} aria-invalid={invalid || undefined} aria-describedby={describedBy(rest.id, hasHint, invalid)} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cn(control, 'min-h-28 py-3 leading-relaxed', className)} aria-invalid={invalid || undefined} aria-describedby={describedBy(rest.id, false, invalid)} {...rest} />;
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cn(control, 'h-12 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A8A6B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}

/** Chip de filtro u opción: 40 px, radio 20; activo Ámbar con texto Tinta. */
export function chipClass(active: boolean) {
  return cn(
    'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[20px] px-4 text-[13px] font-bold transition-colors',
    active ? 'bg-ambar text-tinta' : 'border border-stroke bg-transparent text-fg hover:bg-surface',
  );
}
