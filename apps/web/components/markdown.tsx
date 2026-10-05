import { Fragment, type ReactNode } from 'react';

/** Markdown mínimo y seguro para textos legales propios (títulos, negritas, listas, citas). Sin HTML. */
export function SimpleMarkdown({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <strong key={i} className="font-bold text-fg">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-fg-3">
      {blocks.map((b, i) => {
        if (b.startsWith('# ')) return <h2 key={i} className="font-display text-xl font-extrabold text-fg">{b.slice(2)}</h2>;
        if (b.startsWith('> ')) return <p key={i} className="rounded-xl border border-stroke px-3 py-2 text-sm text-fg-2">{inline(b.slice(2))}</p>;
        if (/^\d+\. /m.test(b)) {
          return (
            <ol key={i} className="flex list-decimal flex-col gap-2 pl-5 marker:font-bold marker:text-accent-fg">
              {b.split('\n').map((li, j) => <li key={j}>{inline(li.replace(/^\d+\.\s*/, ''))}</li>)}
            </ol>
          );
        }
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}
