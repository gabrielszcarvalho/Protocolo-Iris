import { useEffect, useRef } from 'react';
import { useControlador, type AbaSaida } from '../controlador';
import { formatar } from '../../engine/format';
import { Fichario } from './Fichario';

const ABAS: { id: AbaSaida; rotulo: string }[] = [
  { id: 'resultado', rotulo: 'Resposta do servidor' },
  { id: 'log', rotulo: 'Log do servidor' },
  { id: 'fichario', rotulo: 'Fichário' },
];

export function Saida() {
  const c = useControlador();
  const fim = useRef<HTMLDivElement>(null);
  const log = c.mundo.log;

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [c.blocos, c.aba]);

  return (
    <section className="saida" data-tutorial="saida">
      <div className="abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={c.aba === a.id} className={c.aba === a.id ? 'ativa' : ''} onClick={() => c.mudarAba(a.id)}>
            {a.rotulo}
            {a.id === 'log' && log.some((l) => l.s === 'W') && <span className="ponto-aviso" />}
          </button>
        ))}
      </div>

      <div className="saida-conteudo">
        {c.aba === 'resultado' && (
          <>
            {c.blocos.length === 0 && <p className="saida-vazia">As respostas do servidor aparecem aqui.</p>}
            {c.blocos.map((b) => (
              <div key={b.id} className="bloco">
                <pre className="bloco-comando">
                  <span>iris&gt;</span> {b.comando}
                </pre>
                {b.linhas.length === 0 && <pre className="linha info">(sem resposta)</pre>}
                {b.linhas.map((l, i) => (
                  <div key={i} className={`linha ${l.tipo}`}>
                    <pre>{l.texto}</pre>
                    {l.traducao && <p className="traducao">↳ {l.traducao}</p>}
                  </div>
                ))}
              </div>
            ))}
            <div ref={fim} />
          </>
        )}

        {c.aba === 'log' && (
          <ol className="log">
            {log.length === 0 && <li className="saida-vazia">Nenhum registro. Comandos administrativos e avisos de validação aparecem aqui.</li>}
            {[...log].reverse().map((l, i) => (
              <li key={i} className={`nivel-${l.s}`}>
                <span className="log-nivel">{l.s}</span> <span className="log-componente">{l.c}</span> {l.msg}
                {l.attr !== undefined && <pre>{formatar(l.attr)}</pre>}
              </li>
            ))}
          </ol>
        )}

        {c.aba === 'fichario' && <Fichario />}
      </div>
    </section>
  );
}
