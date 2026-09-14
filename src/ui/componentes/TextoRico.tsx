/** Texto com trechos entre `crases` renderizados como código. */
export function TextoRico({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(`[^`]+`)/g).map((parte, i) =>
        parte.startsWith('`') && parte.endsWith('`') ? <code key={i}>{parte.slice(1, -1)}</code> : <span key={i}>{parte}</span>,
      )}
    </>
  );
}
