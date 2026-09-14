import { useState } from 'react';
import { useControlador } from '../controlador';

export function Menu() {
  const c = useControlador();
  const [confirmar, setConfirmar] = useState(false);
  const progresso = c.jogo!.progresso;
  const e = progresso.estatisticas;
  const deferidas = c.consultasDeferidas.length;

  return (
    <div className="dialogo-fundo" onClick={() => c.fecharPainel()}>
      <div className="dialogo papel menu" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal aria-label="Menu">
        <h2>Pausa para o café (frio, como tudo aqui)</h2>
        <p className="menu-estatisticas">
          {e.comandos} comandos executados · {e.erros} erros · {e.carimbosGanhos} carimbos ganhos
          {progresso.recordeExpediente > 0 && ` · recorde no Expediente: ${progresso.recordeExpediente}`}
        </p>
        {!confirmar ? (
          <div className="menu-botoes">
            <button className="botao principal" onClick={() => c.fecharPainel()} autoFocus>
              Voltar ao trabalho
            </button>
            {c.modo === 'campanha' ? (
              <>
                <button className="botao" onClick={() => c.entrarNoTreino()} title="Terminal livre numa cópia do arquivo">
                  Sala de Treino
                </button>
                <button
                  className="botao"
                  onClick={() => c.entrarNoExpediente()}
                  disabled={deferidas < 3}
                  title={deferidas < 3 ? `Defira pelo menos 3 memorandos de consulta (faltam ${3 - deferidas})` : 'Consultas já deferidas, contra o relógio'}
                >
                  Expediente contra o relógio
                </button>
              </>
            ) : (
              <button className="botao" onClick={() => c.voltarACampanha()}>
                Voltar aos memorandos
              </button>
            )}
            {c.modo === 'campanha' && (
              <button className="botao" onClick={() => c.reverTutorial()}>
                Rever o tutorial
              </button>
            )}
            <button className="botao" onClick={() => c.alternarSom()}>
              Som: {c.somLigado ? 'ligado' : 'desligado'}
            </button>
            <button className="botao" onClick={() => c.voltarAoTitulo()}>
              Tela inicial
            </button>
            <button className="botao perigo" onClick={() => setConfirmar(true)}>
              Apagar progresso
            </button>
          </div>
        ) : (
          <>
            <p>Isso apaga carimbos, credenciais e memorandos cumpridos. Não dá para desfazer.</p>
            <div className="dialogo-acoes">
              <button className="botao" onClick={() => setConfirmar(false)} autoFocus>
                Cancelar
              </button>
              <button className="botao perigo" onClick={() => void c.apagarProgresso()}>
                Apagar tudo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
