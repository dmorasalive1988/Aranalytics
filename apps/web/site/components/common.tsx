import type { CSSProperties, ReactNode } from 'react';
import { PlumaSymbol, cn } from '@pluma/ui';

export { Marked } from './marked';

export type Tone = 'tinta' | 'noche' | 'papel';

const TONE_STYLE: Record<Tone, CSSProperties | undefined> = {
  tinta: undefined,
  // En secciones Noche, las tarjetas van en Tinta para separarse del fondo.
  noche: { ['--pl-surface' as string]: 'var(--pl-tinta)', ['--pl-bg' as string]: 'var(--pl-noche)' },
  papel: undefined,
};

/** Sección del home: fondo por tono, ancho máximo y espacio generoso; una sola idea por sección. */
export function Section({ id, tone = 'tinta', labelledBy, className, children }: { id?: string; tone?: Tone; labelledBy?: string; className?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-theme={tone === 'papel' ? 'light' : undefined}
      style={TONE_STYLE[tone]}
      className={cn('scroll-mt-16 overflow-hidden', tone === 'tinta' && 'bg-tinta text-papel', tone === 'noche' && 'bg-noche text-papel', tone === 'papel' && 'bg-papel text-tinta')}
    >
      <div className={cn('mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 lg:py-32', className)}>{children}</div>
    </section>
  );
}

/** Antetítulo con la pluma pequeña como separador. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold tracking-[0.06em] text-accent-fg uppercase">
      <PlumaSymbol size={26} barColor="currentColor" quillColor="currentColor" />
      {children}
    </p>
  );
}

export function H2({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn('font-display text-[40px] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance sm:text-[56px] lg:text-[68px]', className)}>
      {children}
    </h2>
  );
}

/** Aparición suave al hacer scroll (ver Enhancements); sin JavaScript o con movimiento reducido, se ve de inmediato. */
export function Reveal({ children, className, as: Tag = 'div', delay = 0 }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article'; delay?: number }) {
  return (
    <Tag data-reveal className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

/** Rótulo para mockups con datos ficticios. */
export function ExampleTag({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-fg-2">{children}</span>;
}
