import { useState } from 'react';
import { useControlador } from '../controlador';

export function Menu() {
  const c = useControlador();
  const [confirmar, setConfirmar] = useState(false);
  const e = c.jogo!.progresso.estatisticas;

  return (
    <div className="dialogo-fundo" onClick={() => c.fecharPainel()}>
      <div className="dialogo papel menu" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal aria-label="Menu">
        <h2>Pausa para o café (frio, como tudo aqui)</h2>
        <p className="menu-estatisticas">
          {e.comandos} comandos executados · {e.erros} erros · {e.carimbosGanhos} carimbos ganhos
        </p>
        {!confirmar ? (
          <div className="menu-botoes">
            <button className="botao principal" onClick={() => c.fecharPainel()} autoFocus>
              Voltar ao trabalho
            </button>
            <button className="botao" onClick={() => c.reverTutorial()}>
              Rever o tutorial
            </button>
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
