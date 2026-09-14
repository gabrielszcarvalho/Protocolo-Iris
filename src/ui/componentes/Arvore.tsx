import { useState } from 'react';
import { motion } from 'framer-motion';
import { useControlador } from '../controlador';
import { ARVORE, NO_POR_ID, RAMOS, type SituacaoNo } from '../../game/arvore';

const ROTULO: Record<SituacaoNo, string> = {
  possui: 'Concedida',
  compravel: 'Disponível',
  'sem-carimbos': 'Carimbos insuficientes',
  bloqueado: 'Requer outra credencial',
  lacrado: 'Em breve',
};

export function Arvore() {
  const c = useControlador();
  const jogo = c.jogo!;
  const primeiraCompravel = ARVORE.find((n) => jogo.situacaoNo(n) === 'compravel');
  const [selecionado, setSelecionado] = useState(c.credencialEmFoco ?? primeiraCompravel?.id ?? ARVORE[0].id);
  const [erro, setErro] = useState<string>();
  const no = NO_POR_ID.get(selecionado)!;
  const situacao = jogo.situacaoNo(no);

  const comprar = () => {
    const r = c.comprar(no.id);
    if (r && !r.ok) setErro(r.motivo);
  };

  return (
    <div className="painel-fundo" onClick={() => c.fecharPainel()}>
      <motion.div
        className="painel painel-arvore"
        role="dialog"
        aria-modal
        aria-label="Árvore de Credenciamento"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header className="painel-topo">
          <div>
            <h2>Árvore de Credenciamento</h2>
            <p>Troque carimbos por credenciais. Cada credencial libera comandos novos no terminal.</p>
          </div>
          <div className="saldo">
            <span className="icone-carimbo" aria-hidden />
            <strong>{jogo.progresso.carimbos}</strong> carimbos
          </div>
          <button className="fechar" onClick={() => c.fecharPainel()} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="arvore-corpo">
          <div className="ramos">
            {RAMOS.map((ramo) => (
              <section key={ramo} className="ramo">
                <h3>{ramo}</h3>
                {ARVORE.filter((n) => n.ramo === ramo).map((n) => {
                  const s = jogo.situacaoNo(n);
                  return (
                    <button
                      key={n.id}
                      className={`no no-${s} ${n.id === selecionado ? 'selecionado' : ''}`}
                      onClick={() => {
                        setSelecionado(n.id);
                        setErro(undefined);
                      }}
                    >
                      <span className="no-nome">{n.nome}</span>
                      <span className="no-chaves">{n.libera.map((l) => l.chave.replace('@agregacao', '')).join(' ')}</span>
                      <span className="no-rodape">{s === 'possui' ? '✓ concedida' : s === 'lacrado' ? (n.disponivel ? `abre no cap. ${n.capitulo}` : 'em breve') : `${n.custo} carimbos`}</span>
                    </button>
                  );
                })}
              </section>
            ))}
          </div>

          <aside className="no-detalhe papel">
            <p className="no-ramo">{no.ramo}</p>
            <h3>{no.nome}</h3>
            <p className={`no-situacao s-${situacao}`}>{situacao === 'lacrado' && no.disponivel ? `Abre no Capítulo ${no.capitulo} · ${no.custo} carimbos` : ROTULO[situacao]}</p>
            <p>{no.descricao}</p>
            {no.requer.length > 0 && (
              <p className="no-requer">
                Requer:{' '}
                {no.requer.map((r) => (
                  <span key={r} className={jogo.possui.has(r) ? 'ok' : 'falta'}>
                    {NO_POR_ID.get(r)!.nome}
                  </span>
                ))}
              </p>
            )}
            <h4>Libera</h4>
            <ul className="no-libera">
              {no.libera.map((l) => (
                <li key={l.chave}>
                  <code>{l.sintaxe}</code>
                  {no.disponivel && <p>{l.explicacao}</p>}
                </li>
              ))}
            </ul>
            {situacao !== 'possui' && situacao !== 'lacrado' && (
              <button className="botao principal largo" onClick={comprar} disabled={situacao !== 'compravel'}>
                {situacao === 'compravel' ? `Comprar por ${no.custo} carimbos` : situacao === 'sem-carimbos' ? `Faltam ${no.custo - jogo.progresso.carimbos} carimbos` : 'Compre a credencial anterior'}
              </button>
            )}
            {erro && <p className="erro-compra">{erro}</p>}
          </aside>
        </div>
      </motion.div>
    </div>
  );
}
