import { useEffect } from 'react';
import { motion } from 'framer-motion';
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

  // Sem animação de saída: o cartão some na hora. Saídas animadas acumulavam cartões antigos no DOM
  // quando a aba ficava em segundo plano (o navegador pausa os quadros de animação).
  return (
    <>
      {atual && (
        <motion.div key={atual.id} className="sobreposicao-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
            <motion.div className="cartao capitulo epilogo" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <p className="cartao-sobre">Protocolo B-1953-0000 · deferido</p>
              <h2>O relatório de Aurélio</h2>
              <p className="capitulo-texto">
                O Conselho carimbou sua Prova e, no mesmo despacho, encerrou a ficha mais antiga do Limbo: Aurélio Vilaverde, o arquivista
                que morreu em 1953 com um “relatório não entregue”. O relatório era este arquivo — organizado, validado, replicado e
                finalmente legível. Quem o terminou foi você.
              </p>
              <p className="capitulo-texto">
                Aurélio passa pela sua mesa com o chapéu na mão, agradece com um aceno e entra no elevador. A seta acende: ↑ Céu. A sua
                ficha, dizem, também já pode subir. Mas alguém precisa cuidar do arquivo — e os mortos continuam chegando.
              </p>
              <p className="capitulo-meta">
                {Object.keys(jogo.progresso.concluidas).length} memorandos · {jogo.progresso.estatisticas.comandos} comandos ·{' '}
                {jogo.progresso.estatisticas.carimbosGanhos} carimbos ganhos ·{' '}
                {Object.values(jogo.progresso.concluidas).filter((m) => m.estrelas === 3).length} com três estrelas
              </p>
              <p className="creditos">Protocolo Íris · escrito, programado e carimbado por Gabriel de Souza Carvalho · disciplina de Banco de Dados NoSQL</p>
              <div className="epilogo-acoes">
                <button className="botao principal" onClick={() => c.fecharSobreposicao()} autoFocus>
                  Ficar no arquivo
                </button>
                <button
                  className="botao"
                  onClick={() => {
                    c.fecharSobreposicao();
                    c.entrarNoExpediente();
                  }}
                >
                  Expediente contra o relógio
                </button>
                <button
                  className="botao"
                  onClick={() => {
                    c.fecharSobreposicao();
                    c.entrarNoTreino();
                  }}
                >
                  Sala de Treino
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  );
}
