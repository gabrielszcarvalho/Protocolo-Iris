import { useState } from 'react';
import { motion } from 'framer-motion';
import { useControlador } from '../controlador';
import { ARVORE } from '../../game/arvore';

export function Manual() {
  const c = useControlador();
  const jogo = c.jogo!;
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();

  const nos = ARVORE.filter((n) => n.disponivel)
    .map((n) => ({
      no: n,
      possui: jogo.possui.has(n.id),
      entradas: n.libera.filter((l) => !termo || `${l.chave} ${l.sintaxe} ${l.explicacao} ${n.nome}`.toLowerCase().includes(termo)),
    }))
    .filter((g) => g.entradas.length);

  return (
    <div className="painel-fundo" onClick={() => c.fecharPainel()}>
      <motion.div
        className="painel painel-manual"
        role="dialog"
        aria-modal
        aria-label="Manual"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header className="painel-topo">
          <div>
            <h2>Manual do Arquivista</h2>
            <p>Referência dos comandos. As páginas se desbloqueiam junto com as credenciais.</p>
          </div>
          <input className="busca" placeholder="Buscar comando…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
          <button className="fechar" onClick={() => c.fecharPainel()} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="manual-corpo">
          {nos.length === 0 && <p className="saida-vazia">Nada encontrado para “{busca}”.</p>}
          {nos.map(({ no, possui, entradas }) => (
            <section key={no.id} className={`manual-secao ${possui ? '' : 'bloqueada'}`}>
              <h3>
                {no.nome} <span>{no.ramo}</span>
              </h3>
              {!possui && (
                <p className="manual-bloqueio">
                  🔒 Página lacrada. Credencial “{no.nome}” — {no.custo} carimbos.{' '}
                  <button className="link" onClick={() => c.abrirPainel('arvore', no.id)}>
                    Ver na Árvore
                  </button>
                </p>
              )}
              {entradas.map((l) => (
                <article key={l.chave} className="manual-entrada">
                  <code className="manual-sintaxe">{l.sintaxe}</code>
                  {possui ? (
                    <>
                      <p>{l.explicacao}</p>
                      {l.exemplo && (
                        <div className="manual-exemplo">
                          <pre>{l.exemplo}</pre>
                          <button className="botao pequeno" onClick={() => c.inserirNoEditor(l.exemplo!)}>
                            Levar ao terminal
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="borrado" aria-hidden>
                      {l.explicacao.replace(/\S/g, '▒')}
                    </p>
                  )}
                </article>
              ))}
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
