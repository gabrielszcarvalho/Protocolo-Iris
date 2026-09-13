/**
 * Etapa 1 — bancada de testes da engine.
 * Um terminal simples ligado à engine, com painel de coleções e log do servidor.
 * A interface definitiva (mapa, memorando, CodeMirror) chega na etapa 2.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Sessao, type LinhaSaida } from '../engine/shell';
import { Database } from '../engine/database';
import { Armazenamento, CHAVES } from '../engine/persist';
import { formatar } from '../engine/format';
import { criarMundoDemo } from './demoMundo';

interface Bloco {
  id: number;
  comando: string;
  saida: LinhaSaida[];
}

const armazenamento = typeof indexedDB !== 'undefined' ? new Armazenamento() : undefined;

export function App() {
  const [sessao, setSessao] = useState<Sessao>();
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [entrada, setEntrada] = useState("db.almas.find({ setor: 'Limbo' }, { nome: 1, _id: 0 })");
  const [historico, setHistorico] = useState<string[]>([]);
  const [posHistorico, setPosHistorico] = useState(-1);
  const [versao, setVersao] = useState(0);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const salvo = await armazenamento?.carregarBanco(CHAVES.sandbox).catch(() => undefined);
      const cmds = await armazenamento?.carregar<string[]>(CHAVES.historicoComandos).catch(() => undefined);
      setSessao(new Sessao(salvo ?? criarMundoDemo()));
      if (cmds) setHistorico(cmds);
    })();
  }, []);

  // Chaves obrigatórias: scrollIntoView pode devolver Promise em navegadores novos, e o React
  // interpretaria o retorno como função de limpeza.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [blocos]);

  if (!sessao) return <main className="bancada carregando">Abrindo o arquivo…</main>;
  const db: Database = sessao.db;

  const executar = () => {
    const comando = entrada.trim();
    if (!comando) return;
    const r = sessao.executar(comando);
    if (r.limparTela) setBlocos([]);
    else setBlocos((b) => [...b, { id: Date.now(), comando, saida: r.saida }]);
    const novoHistorico = [...historico.filter((h) => h !== comando), comando].slice(-200);
    setHistorico(novoHistorico);
    setPosHistorico(-1);
    setEntrada('');
    setVersao((v) => v + 1);
    void armazenamento?.salvarBanco(CHAVES.sandbox, db);
    void armazenamento?.salvar(CHAVES.historicoComandos, novoHistorico);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      executar();
      return;
    }
    const noTopo = e.currentTarget.selectionStart === 0;
    const noFim = e.currentTarget.selectionEnd === entrada.length;
    if (e.key === 'ArrowUp' && noTopo && historico.length) {
      e.preventDefault();
      const pos = posHistorico === -1 ? historico.length - 1 : Math.max(0, posHistorico - 1);
      setPosHistorico(pos);
      setEntrada(historico[pos]);
    } else if (e.key === 'ArrowDown' && noFim && posHistorico !== -1) {
      e.preventDefault();
      const pos = posHistorico + 1;
      if (pos >= historico.length) {
        setPosHistorico(-1);
        setEntrada('');
      } else {
        setPosHistorico(pos);
        setEntrada(historico[pos]);
      }
    }
  };

  const reiniciar = () => {
    const novo = new Sessao(criarMundoDemo());
    setSessao(novo);
    setBlocos([]);
    void armazenamento?.salvarBanco(CHAVES.sandbox, novo.db);
  };

  const colecoes = db.nomesDasColecoes().map((nome) => {
    const col = db.colecao(nome);
    return { nome, total: col.docs.length, validador: col.opcoes.validator, indices: col.definicoesDeIndice().length };
  });

  return (
    <main className="bancada" data-versao={versao}>
      <header className="cabecalho">
        <h1>Protocolo Íris</h1>
        <span className="subtitulo">Departamento de Almas Extraviadas · bancada da engine (etapa 1)</span>
        <button onClick={reiniciar}>Incinerar e reabrir o arquivo</button>
      </header>

      <section className="terminal" aria-label="Terminal">
        <div className="rolagem">
          {blocos.length === 0 && (
            <p className="dica">Digite um comando e pressione Ctrl+Enter. Experimente <code>show collections</code> ou <code>help</code>.</p>
          )}
          {blocos.map((b) => (
            <div key={b.id} className="bloco">
              <pre className="comando">iris&gt; {b.comando}</pre>
              {b.saida.map((l, i) => (
                <div key={i} className={`linha ${l.tipo}`}>
                  <pre>{l.texto}</pre>
                  {l.traducao && <p className="traducao">↳ {l.traducao}</p>}
                </div>
              ))}
            </div>
          ))}
          <div ref={fimRef} />
        </div>
        <div className="prompt">
          <span>iris&gt;</span>
          <textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={aoTeclar}
            spellCheck={false}
            rows={Math.min(10, Math.max(2, entrada.split('\n').length))}
            aria-label="Comando"
            autoFocus
          />
          <button onClick={executar}>Executar</button>
        </div>
      </section>

      <aside className="lateral">
        <h2>Coleções</h2>
        <ul className="colecoes">
          {colecoes.map((c) => (
            <li key={c.nome}>
              <strong>{c.nome}</strong> <span>{c.total} doc(s)</span>
              {c.validador && <span className="selo">validador</span>}
              {c.indices > 0 && <span className="selo">{c.indices} índice(s)</span>}
            </li>
          ))}
        </ul>

        <h2>Log do servidor</h2>
        <ol className="log">
          {db.log.length === 0 && <li className="vazio">sem registros</li>}
          {db.log.slice(-30).reverse().map((l, i) => (
            <li key={i} className={`nivel-${l.s}`}>
              <span className="nivel">{l.s}</span> <span className="componente">{l.c}</span> {l.msg}
              {l.attr !== undefined && <pre>{formatar(l.attr)}</pre>}
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}
