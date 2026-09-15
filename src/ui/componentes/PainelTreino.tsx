import { useState } from 'react';
import { useControlador } from '../controlador';
import { TextoRico } from './TextoRico';
import { ASSUNTOS_TREINO, type AssuntoTreino } from '../../game/gerador';
import type { MesaDeMemorando } from '../../game/treino';

function MemorandoDeTreino({ mesa }: { mesa: MesaDeMemorando }) {
  const c = useControlador();
  const { missao } = mesa;
  const dicas = missao.dicas.slice(0, mesa.dicas);

  return (
    <>
      <p className="treino-assunto">
        {missao.id} · {missao.assunto}
      </p>
      <h2>{missao.titulo}</h2>
      <p className="memorando-corpo">
        <TextoRico texto={missao.corpo} />
      </p>

      <section className="memorando-objetivos" data-tutorial="objetivos">
        <h3>A entregar</h3>
        <ul>
          {missao.objetivos.map((o, i) => {
            const marca = mesa.deferido ? true : mesa.marcas?.[i];
            return (
              <li key={i} className={marca === undefined ? '' : marca ? 'certo' : 'errado'}>
                <span className="caixinha">{marca === undefined ? '' : marca ? '✓' : '✗'}</span>
                <span>
                  <TextoRico texto={o.texto} />
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {mesa.deferido ? (
        <div className="parecer deferido">
          <strong>Deferido.</strong> {missao.licao}
        </div>
      ) : (
        mesa.parecer && (
          <div className="parecer indeferido" role="status">
            <strong>Indeferido.</strong> {mesa.parecer.motivo}
          </div>
        )
      )}

      {dicas.length > 0 && (
        <section className="memorando-dicas">
          {dicas.map((d, i) => (
            <div key={i} className="dica">
              <span className="dica-nivel">{i === 2 ? 'Solução' : `Dica ${i + 1}`}</span>
              <p>{d}</p>
              {i === 2 && (
                <button className="botao pequeno" onClick={() => c.inserirNoEditor(d)}>
                  Levar ao terminal
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <footer className="memorando-acoes" data-tutorial="treino-acoes">
        {!mesa.deferido && (
          <button className="botao principal" onClick={() => c.protocolar()} title="Ctrl+Shift+Enter" data-tutorial="protocolar">
            Protocolar resposta
          </button>
        )}
        {!mesa.deferido && dicas.length < 3 && (
          <button className="botao" onClick={() => c.revelarDicaTreino()}>
            {dicas.length === 0 ? 'Pedir dica' : dicas.length === 1 ? 'Mais uma dica' : 'Ver solução'}
          </button>
        )}
        <button className="botao" onClick={() => c.pularMemorandoTreino()} title="Troca por outro memorando do mesmo assunto">
          {mesa.deferido ? 'Outro do mesmo assunto' : 'Pular'}
        </button>
        <button className="botao discreto" onClick={() => c.reiniciarTreino()} title="Volta só o arquivo deste memorando ao estado em que ele chegou">
          Restaurar este arquivo
        </button>
        <button className="botao discreto" onClick={() => c.descartarMemorandoTreino(missao.id)}>
          Descartar
        </button>
      </footer>
    </>
  );
}

export function PainelTreino() {
  const c = useControlador();
  const treino = c.treino!;
  const mundo = c.mundo;
  const [assunto, setAssunto] = useState<AssuntoTreino | ''>('');
  const ativo = treino.ativo;

  return (
    <article className="memorando papel painel-modo" data-tutorial="memorando">
      <header className="memorando-cabecalho">
        <span>Sala de Treino</span>
        <span>fora do expediente · não vale carimbo</span>
      </header>

      <div className="treino-gerar" data-tutorial="treino-gerar">
        <select value={assunto} onChange={(e) => setAssunto(e.target.value as AssuntoTreino | '')} aria-label="Assunto do memorando">
          <option value="">Qualquer assunto</option>
          {ASSUNTOS_TREINO.map((a) => (
            <option key={a.id} value={a.id}>
              {a.rotulo}
            </option>
          ))}
        </select>
        <button className="botao principal" onClick={() => c.gerarMemorandoTreino(assunto || undefined)}>
          Gerar memorando
        </button>
      </div>

      <nav className="treino-abas" aria-label="Arquivos abertos" data-tutorial="treino-abas">
        <button className={`treino-aba ${ativo ? '' : 'ativa'}`} onClick={() => c.abrirArquivoTreino(null)}>
          Terminal livre
        </button>
        {treino.memorandos.map((m) => (
          <span key={m.missao.id} className={`treino-aba ${m === ativo ? 'ativa' : ''} ${m.deferido ? 'deferida' : ''}`}>
            <button onClick={() => c.abrirArquivoTreino(m.missao.id)} title={m.missao.titulo}>
              {m.deferido ? '✓ ' : ''}
              {m.missao.id}
            </button>
            <button className="treino-fechar" onClick={() => c.descartarMemorandoTreino(m.missao.id)} aria-label={`Descartar ${m.missao.id}`}>
              ×
            </button>
          </span>
        ))}
      </nav>
      <p className="treino-nota">Cada aba tem o seu próprio arquivo: o que você fizer numa nunca aparece nas outras.</p>

      {ativo ? (
        <MemorandoDeTreino mesa={ativo} />
      ) : (
        <>
          <h2>Terminal livre</h2>
          <p className="memorando-corpo">
            Uma cópia do seu arquivo, só para você. Consulte, apague, recrie coleções, teste validadores — nada daqui chega à campanha nem aos
            memorandos de treino.
          </p>

          <label className="alternador" data-tutorial="treino-livre">
            <input type="checkbox" checked={treino.todasAsCredenciais} onChange={() => c.alternarTodasCredenciais()} />
            <span>
              <strong>Liberar todas as credenciais</strong>
              <small>Modo estudo: todos os comandos do Manual funcionam na Sala, e o gerador pode sortear qualquer assunto.</small>
            </span>
          </label>

          <section className="memorando-objetivos">
            <h3>Coleções nesta cópia</h3>
            <ul className="lista-colecoes">
              {mundo.nomesDasColecoes().map((nome) => (
                <li key={nome}>
                  <button className="campo" onClick={() => c.inserirNoEditor(`db.${nome}.find()`)}>
                    db.{nome}
                  </button>
                  <span>{mundo.colecao(nome).docs.length} documentos</span>
                </li>
              ))}
            </ul>
          </section>

          <footer className="memorando-acoes">
            <button className="botao" onClick={() => c.reiniciarTreino()}>
              Restaurar este arquivo
            </button>
            <button className="botao principal" onClick={() => c.voltarACampanha()}>
              Voltar aos memorandos
            </button>
          </footer>
        </>
      )}
    </article>
  );
}
