import { useEffect, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useControlador } from '../controlador';


interface Retangulo {
  top: number;
  left: number;
  width: number;
  height: number;
}

const LARGURA_CAIXA = 340;
const MARGEM = 14;

export function Tutorial() {
  const c = useControlador();
  const passo = c.tutorial !== null ? c.passosTutorial[c.tutorial] : c.aviso;
  const alvo = passo?.alvo ?? null;
  const [ret, setRet] = useState<Retangulo | null>(null);
  const [tela, setTela] = useState({ w: window.innerWidth, h: window.innerHeight });

  useLayoutEffect(() => {
    if (!alvo) {
      setRet(null);
      return;
    }
    const medir = () => {
      const el = document.querySelector(`[data-tutorial="${alvo}"]`);
      const r = el?.getBoundingClientRect();
      setRet(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
      setTela({ w: window.innerWidth, h: window.innerHeight });
    };
    medir();
    const intervalo = setInterval(medir, 250);
    window.addEventListener('resize', medir);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('resize', medir);
    };
  }, [alvo, c.tutorial]);

  useEffect(() => {
    if (!passo || c.fila.length || c.painel) return;
    const semEspera = c.tutorial === null || !c.passosTutorial[c.tutorial].espera;
    const tecla = (e: KeyboardEvent) => {
      const noEditor = (e.target as HTMLElement).closest?.('.cm-editor');
      if (e.key === 'Enter' && semEspera && !noEditor && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        c.tutorial !== null ? c.avancarTutorial() : c.fecharAviso();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [passo, c]);

  if (!passo || c.fila.length || c.painel) return null;

  const ehTutorial = c.tutorial !== null;
  const passoTutorial = ehTutorial ? c.passosTutorial[c.tutorial!] : undefined;

  // Posição da caixa: abaixo do alvo se couber; senão acima; senão ao lado.
  let top = tela.h / 2 - 110;
  let left = tela.w / 2 - LARGURA_CAIXA / 2;
  let seta: 'cima' | 'baixo' | 'esquerda' | 'direita' | null = null;
  if (ret) {
    const alturaEstimada = 230;
    if (ret.top + ret.height + alturaEstimada + MARGEM < tela.h) {
      top = ret.top + ret.height + MARGEM;
      left = ret.left + ret.width / 2 - LARGURA_CAIXA / 2;
      seta = 'cima';
    } else if (ret.top - alturaEstimada - MARGEM > 0) {
      top = ret.top - alturaEstimada - MARGEM;
      left = ret.left + ret.width / 2 - LARGURA_CAIXA / 2;
      seta = 'baixo';
    } else if (ret.left - LARGURA_CAIXA - MARGEM > 0) {
      top = ret.top + 20;
      left = ret.left - LARGURA_CAIXA - MARGEM;
      seta = 'direita';
    } else {
      top = ret.top + 20;
      left = ret.left + ret.width + MARGEM;
      seta = 'esquerda';
    }
    left = Math.max(MARGEM, Math.min(tela.w - LARGURA_CAIXA - MARGEM, left));
    top = Math.max(MARGEM, Math.min(tela.h - alturaEstimada, top));
  }

  return (
    <div className="tutorial" aria-live="polite">
      {ret ? (
        <div className="tutorial-foco" style={{ top: ret.top - 6, left: ret.left - 6, width: ret.width + 12, height: ret.height + 12 }} />
      ) : (
        <div className="tutorial-escuro" />
      )}
      <motion.div
        key={`${c.tutorial}-${passo.titulo}`}
        className={`tutorial-caixa ${seta ? `seta-${seta}` : ''}`}
        style={{ top, left, width: LARGURA_CAIXA }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        role="dialog"
        aria-label={passo.titulo}
      >
        <p className="tutorial-contador">{ehTutorial ? `Tutorial · ${c.tutorial! + 1} de ${c.passosTutorial.length}` : 'Dica do Departamento'}</p>
        <h3>{passo.titulo}</h3>
        <p>{passo.texto}</p>
        {passoTutorial?.codigo && <code className="tutorial-codigo">{passoTutorial.codigo}</code>}
        <div className="tutorial-acoes">
          {ehTutorial && c.tutorial! < c.passosTutorial.length - 1 && (
            <button className="link" onClick={() => c.pularTutorial()}>
              Pular tutorial
            </button>
          )}
          {passoTutorial?.espera ? (
            <span className="tutorial-aguardando">{passoTutorial.aguardando}</span>
          ) : (
            <button className="botao principal pequeno" onClick={() => (ehTutorial ? c.avancarTutorial() : c.fecharAviso())} autoFocus>
              {passoTutorial?.botao ?? (ehTutorial ? 'Próximo' : 'Entendi')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
