import { useControlador } from '../controlador';
import { TextoRico } from './TextoRico';

function Estrelas({ n }: { n: number }) {
  return (
    <span className="estrelas" aria-label={`${n} de 3 estrelas`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? 'cheia' : ''}>
          ★
        </i>
      ))}
    </span>
  );
}

export function Memorando() {
  const c = useControlador();
  const jogo = c.jogo!;
  const missao = jogo.missaoAtual;

  if (!missao) {
    return (
      <article className="memorando papel vazio" data-tutorial="memorando">
        <h2>Caixa vazia</h2>
        <p>Todos os memorandos desta versão foram despachados. A Diretoria prepara os próximos capítulos — sem pressa, ninguém aqui vai a lugar nenhum.</p>
      </article>
    );
  }

  const capitulo = jogo.capituloDe(missao);
  const situacao = jogo.situacaoMissao(missao);
  const faltando = jogo.credenciaisFaltando(missao);
  const dicas = jogo.dicasReveladas(missao);
  const estrelas = jogo.estrelasPara(missao);
  const concluida = situacao === 'concluida';
  const conferencia = c.conferencia?.missaoId === missao.id ? c.conferencia : undefined;

  return (
    <article className="memorando papel" data-tutorial="memorando">
      <header className="memorando-cabecalho">
        <span>Memorando nº {missao.id.replace('.', '-')}/1953</span>
        <span>
          Cap. {capitulo.numero} · {capitulo.titulo}
        </span>
      </header>
      <dl className="memorando-campos">
        <dt>De</dt>
        <dd>Diretoria do Purgatório</dd>
        <dt>Para</dt>
        <dd>Arquivista-Chefe (falecido)</dd>
        <dt>Assunto</dt>
        <dd>{missao.assunto}</dd>
      </dl>

      <h2>{missao.titulo}</h2>
      <p className="memorando-corpo">
        <TextoRico texto={missao.corpo} />
      </p>

      <section className={`memorando-objetivos ${conferencia?.desatualizada ? 'desatualizada' : ''}`} data-tutorial="objetivos">
        <h3>A entregar</h3>
        <ul>
          {missao.objetivos.map((o, i) => {
            const marca = concluida ? true : conferencia?.marcas[i];
            const classe = marca === undefined ? '' : marca ? 'certo' : 'errado';
            return (
              <li key={i} className={classe}>
                <span className="caixinha" aria-label={marca === undefined ? 'não conferido' : marca ? 'certo' : 'ainda não'}>
                  {marca === undefined ? '' : marca ? '✓' : '✗'}
                </span>
                <span>
                  <TextoRico texto={o.texto} />
                </span>
              </li>
            );
          })}
        </ul>
        {conferencia?.desatualizada && <p className="nota-conferencia">Marcas do último protocolo. Protocole de novo para conferir a resposta atual.</p>}
      </section>

      {missao.anexo && (
        <details className="memorando-anexo" data-tutorial="anexo" open>
          <summary>
            📎 Anexo — variável <code>{missao.anexo.variavel}</code>, já carregada no terminal
          </summary>
          <pre>{missao.anexo.codigo}</pre>
        </details>
      )}

      {faltando.length > 0 && (
        <div className="aviso-credencial">
          <span>
            🔒 Exige a credencial {faltando.map((n) => `“${n.nome}”`).join(' e ')} ({faltando.reduce((s, n) => s + n.custo, 0)} carimbos)
          </span>
          <button className="botao pequeno" onClick={() => c.abrirPainel('arvore', faltando[0].id)}>
            Abrir Árvore
          </button>
        </div>
      )}

      {concluida && (
        <div className="parecer deferido">
          <strong>Deferido.</strong> <Estrelas n={jogo.progresso.concluidas[missao.id].estrelas} /> {missao.licao}
        </div>
      )}

      {!concluida && c.parecer && (
        <div className="parecer indeferido" role="status">
          <strong>Indeferido.</strong> {c.parecer.motivo}
        </div>
      )}

      {!concluida && (
        <section className="memorando-dicas">
          {dicas.map((d, i) => (
            <div key={i} className="dica">
              <span className="dica-nivel">Dica {i + 1}</span>
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

      {!concluida && (
        <footer className="memorando-acoes">
          <p className="memorando-instrucao">Rode a consulta, analise a resposta e só então protocole.</p>
          <button
            className="botao principal"
            data-tutorial="protocolar"
            onClick={() => c.protocolar()}
            disabled={faltando.length > 0}
            title="Envia a ÚLTIMA resposta do terminal para a Diretoria (Ctrl+Shift+Enter)"
          >
            Protocolar resposta
          </button>
          {dicas.length < 3 && (
            <button className="botao" onClick={() => c.revelarDica()}>
              {dicas.length === 0 ? 'Pedir dica' : 'Mais uma dica'}
            </button>
          )}
          <button className="botao discreto" onClick={() => c.reiniciarMissao()} title="Volta o arquivo ao estado em que este memorando chegou">
            Reiniciar
          </button>
          <span className="memorando-valendo" title="Dicas e protocolos recusados reduzem as estrelas">
            Valendo <Estrelas n={estrelas} /> {missao.recompensa + estrelas - 1} carimbos
          </span>
        </footer>
      )}
    </article>
  );
}
