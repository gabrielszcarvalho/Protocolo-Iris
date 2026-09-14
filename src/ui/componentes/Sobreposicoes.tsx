import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useControlador } from '../controlador';

export function Sobreposicoes() {
  const c = useControlador();
  const atual = c.fila[0];
  const jogo = c.jogo!;

  useEffect(() => {
    if (!atual) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        c.fecharSobreposicao();
      }
    };
    // pequeno atraso: o Ctrl+Enter que concluiu a missão não pode fechar o cartão na hora
    const t = setTimeout(() => window.addEventListener('keydown', tecla, true), 400);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', tecla, true);
    };
  }, [atual, c]);

  return (
    <AnimatePresence>
      {atual && (
        <motion.div key={`${atual.tipo}-${c.versaoAtual()}`} className="sobreposicao-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {atual.tipo === 'conclusao' && (
            <motion.div className="cartao papel conclusao" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
              <p className="cartao-sobre">
                Memorando {atual.missao.id} · {atual.missao.titulo}
              </p>
              <motion.div
                className="carimbo-grande"
                initial={{ scale: 2.8, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              >
                Deferido
              </motion.div>
              <div className="estrelas grandes">
                {[1, 2, 3].map((i) => (
                  <motion.i
                    key={i}
                    className={i <= atual.estrelas ? 'cheia' : ''}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.35 + i * 0.15, type: 'spring' }}
                  >
                    ★
                  </motion.i>
                ))}
              </div>
              <p className="ganho">+{atual.carimbos} carimbos</p>
              <div className="licao">
                <h3>O que ficou</h3>
                <p>{atual.missao.licao}</p>
              </div>
              <button className="botao principal largo" onClick={() => c.fecharSobreposicao()} autoFocus>
                {jogo.missaoAtual ? `Próximo memorando: ${jogo.missaoAtual.titulo}` : 'Continuar'}
              </button>
            </motion.div>
          )}

          {atual.tipo === 'capitulo' && (
            <motion.div className="cartao capitulo" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="cartao-sobre">Capítulo {atual.capitulo.numero}</p>
              <h2>{atual.capitulo.titulo}</h2>
              <p className="capitulo-texto">{atual.capitulo.abertura}</p>
              <p className="capitulo-meta">{atual.capitulo.missoes.length} memorandos na caixa de entrada</p>
              <button className="botao principal largo" onClick={() => c.fecharSobreposicao()} autoFocus>
                Abrir o expediente
              </button>
            </motion.div>
          )}

          {atual.tipo === 'credencial' && (
            <motion.div className="cartao papel credencial" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <p className="cartao-sobre">Credencial concedida</p>
              <h2>{atual.no.nome}</h2>
              <p>{atual.no.descricao}</p>
              <ul className="credencial-lista">
                {atual.no.libera.map((l) => (
                  <li key={l.chave}>
                    <code>{l.sintaxe}</code>
                    <p>{l.explicacao}</p>
                    {l.exemplo && <pre>{l.exemplo}</pre>}
                  </li>
                ))}
              </ul>
              <p className="dica-rodape">Tudo isso fica no Manual (Ctrl+K).</p>
              <button className="botao principal largo" onClick={() => c.fecharSobreposicao()} autoFocus>
                Entendido
              </button>
            </motion.div>
          )}

          {atual.tipo === 'fim' && (
            <motion.div className="cartao capitulo" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
              <p className="cartao-sobre">Fim do expediente desta versão</p>
              <h2>O arquivo agradece</h2>
              <p className="capitulo-texto">
                Você cumpriu todos os memorandos disponíveis. A Diretoria está preparando a Retificação, os Anexos, o Regulamento e os
                Relatórios. Até lá, o arquivo segue aberto para consultas.
              </p>
              <p className="capitulo-meta">
                {jogo.progresso.estatisticas.comandos} comandos · {jogo.progresso.estatisticas.carimbosGanhos} carimbos ganhos
              </p>
              <button className="botao principal largo" onClick={() => c.fecharSobreposicao()} autoFocus>
                Continuar no arquivo
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
