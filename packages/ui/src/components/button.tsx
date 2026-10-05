import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline-ambar' | 'ghost' | 'danger' | 'on-ambar' | 'on-ambar-outline';
export type ButtonSize = 'lg' | 'md';

/** Clases de botón para usar también en enlaces (<Link className={buttonClass(...)}>). */
export function buttonClass({ variant = 'primary', size = 'lg', block = false }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 font-bold no-underline transition-colors select-none',
    'disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40',
    size === 'lg' ? 'h-[52px] rounded-[14px] px-6 text-[15px]' : 'h-11 rounded-xl px-4 text-sm',
    block && 'w-full',
    variant === 'primary' && 'bg-ambar text-tinta hover:bg-ambar-hover',
    variant === 'secondary' && 'border border-stroke bg-transparent text-fg hover:bg-surface',
    variant === 'outline-ambar' && 'border border-ambar bg-transparent text-accent-fg hover:bg-surface',
    variant === 'ghost' && 'bg-transparent text-fg-2 hover:text-fg',
    variant === 'danger' && 'border border-coral bg-transparent text-danger-fg hover:bg-alerta',
    variant === 'on-ambar' && 'bg-tinta text-papel hover:bg-noche',
    variant === 'on-ambar-outline' && 'border-[1.5px] border-tinta bg-transparent text-tinta',
  );
}

export function Button({ variant, size, block, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }) {
  return <button type={type} className={cn(buttonClass({ variant, size, block }), className)} {...rest} />;
}

/** Botón de ícono circular de 44 px. `label` es obligatorio (lector de pantalla). */
export function IconButton({ label, className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type={type} aria-label={label} title={label} className={cn('inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg hover:bg-surface-2', className)} {...rest}>
      {children}
    </button>
  );
}
