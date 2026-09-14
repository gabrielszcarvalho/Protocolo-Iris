import { useEffect, useState } from 'react';
import { useControlador } from '../controlador';
import { TextoRico } from './TextoRico';

const relogio = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function PainelExpediente() {
  const c = useControlador();
  const exp = c.expediente!;
  const [, tique] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      tique((n) => n + 1);
      if (exp.restanteMs() === 0) c.encerrarExpediente();
    }, 500);
    return () => clearInterval(id);
  }, [c, exp]);

  const resumo = c.resumoExpediente;
  if (resumo) {
    return (
      <article className="memorando papel painel-modo" data-tutorial="memorando">
        <header className="memorando-cabecalho">
          <span>Expediente contra o relógio</span>
          <span>ponto batido</span>
        </header>
        <h2>Fim do expediente</h2>
        <p className="placar-grande">
          <strong>{resumo.deferidos}</strong> memorando{resumo.deferidos === 1 ? '' : 's'} deferido{resumo.deferidos === 1 ? '' : 's'}
        </p>
        <p className="memorando-corpo">
          {resumo.recorde
            ? 'Novo recorde da repartição! O Diretor mandou emoldurar sua folha de ponto.'
            : `Recorde atual: ${c.jogo!.progresso.recordeExpediente}. ${resumo.pulados ? `Você pulou ${resumo.pulados}.` : ''}`}
        </p>
        <footer className="memorando-acoes">
          <button className="botao principal" onClick={() => c.entrarNoExpediente()} autoFocus>
            Outro expediente
          </button>
          <button className="botao" onClick={() => c.voltarACampanha()}>
            Voltar aos memorandos
          </button>
        </footer>
      </article>
    );
  }

  const missao = exp.missao!;
  const restante = exp.restanteMs();
  const parecer = c.parecerExpediente?.missaoId === missao.id ? c.parecerExpediente : undefined;

  return (
    <article className="memorando papel painel-modo" data-tutorial="memorando">
      <header className="memorando-cabecalho">
        <span>Expediente contra o relógio</span>
        <span>
          Memorando {missao.id} · {exp.deferidos} deferido{exp.deferidos === 1 ? '' : 's'}
        </span>
      </header>
      <div className={`relogio ${restante < 30_000 ? 'acabando' : ''}`} role="timer" aria-label="Tempo restante">
        {relogio(restante)}
      </div>

      <h2>{missao.titulo}</h2>
      <p className="memorando-corpo">
        <TextoRico texto={missao.corpo} />
      </p>

      <section className="memorando-objetivos">
        <h3>A entregar</h3>
        <ul>
          {missao.objetivos.map((o, i) => {
            const marca = parecer?.marcas[i];
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

      {missao.anexo && (
        <details className="memorando-anexo" open>
          <summary>
            📎 Anexo — variável <code>{missao.anexo.variavel}</code>, já carregada no terminal
          </summary>
          <pre>{missao.anexo.codigo}</pre>
        </details>
      )}

      {parecer && (
        <div className="parecer indeferido" role="status">
          <strong>Indeferido.</strong> {parecer.validacao.motivo}
        </div>
      )}

      <footer className="memorando-acoes">
        <p className="memorando-instrucao">Sem dicas e sem carimbos: só você, o terminal e o relógio. Recorde: {c.jogo!.progresso.recordeExpediente}.</p>
        <button className="botao principal" onClick={() => c.protocolar()} title="Ctrl+Shift+Enter">
          Protocolar resposta
        </button>
        <button className="botao" onClick={() => c.pularDesafio()}>
          Pular
        </button>
        <button className="botao discreto" onClick={() => c.encerrarExpediente()}>
          Bater o ponto
        </button>
      </footer>
    </article>
  );
}
