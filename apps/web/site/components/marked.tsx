/** Muestra el texto y resalta los marcadores pendientes ([verificar], [dato a verificar]…) para que nadie los pase por alto. */
export function Marked({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter(Boolean);
  if (parts.length === 1 && !parts[0]!.startsWith('[')) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[') ? (
          <mark key={i} className="rounded-md bg-transparent px-1 font-medium text-danger-fg outline-1 outline-current outline-dashed">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
