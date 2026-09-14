/**
 * Símbolo do Protocolo Íris: um olho com um X na pupila (o registro que foi riscado) e quatro
 * cílios. Usa currentColor; o X recorta a pupila com a cor de fundo informada.
 */
export function Logo({ tamanho = 40, corDoX = 'var(--madeira)', className }: { tamanho?: number; corDoX?: string; className?: string }) {
  return (
    <svg className={className} width={tamanho} height={tamanho * 0.8} viewBox="0 0 100 80" role="img" aria-label="Protocolo Íris" fill="none">
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="round">
        <line x1="27" y1="22" x2="19" y2="9" />
        <line x1="42" y1="15" x2="39" y2="1" />
        <line x1="58" y1="15" x2="61" y2="1" />
        <line x1="73" y1="22" x2="81" y2="9" />
        <path d="M6 50 C 26 20, 74 20, 94 50 C 74 80, 26 80, 6 50 Z" strokeLinejoin="round" />
      </g>
      <circle cx="50" cy="50" r="19" fill="currentColor" />
      <g stroke={corDoX} strokeWidth="6" strokeLinecap="round">
        <line x1="42" y1="42" x2="58" y2="58" />
        <line x1="58" y1="42" x2="42" y2="58" />
      </g>
    </svg>
  );
}
