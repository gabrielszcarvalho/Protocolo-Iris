import { useEffect } from 'react';
import { useControlador } from '../controlador';
import { Editor } from '../componentes/Editor';
import { Saida } from '../componentes/Saida';
import { Mapa } from '../componentes/Mapa';
import { Memorando } from '../componentes/Memorando';
import { CaixaDeEntrada } from '../componentes/CaixaDeEntrada';
import { Arvore } from '../componentes/Arvore';
import { Manual } from '../componentes/Manual';
import { Tutorial } from '../componentes/Tutorial';
import { Sobreposicoes } from '../componentes/Sobreposicoes';
import { Menu } from '../componentes/Menu';
import { ARVORE } from '../../game/arvore';
import { Logo } from '../componentes/Logo';
import { PainelTreino } from '../componentes/PainelTreino';
import { PainelExpediente } from '../componentes/PainelExpediente';

export function TelaJogo() {
  const c = useControlador();
  const jogo = c.jogo!;
  const compraveis = ARVORE.filter((n) => jogo.situacaoNo(n) === 'compravel').length;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        c.painel === 'manual' ? c.fecharPainel() : c.abrirPainel('manual');
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        c.painel === 'arvore' ? c.fecharPainel() : c.abrirPainel('arvore');
      } else if (e.key === 'Escape') {
        if (c.fila.length) return;
        if (c.painel) c.fecharPainel();
        else c.abrirPainel('menu');
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [c]);

  const capitulo = jogo.capitulosAbertos.at(-1)!;

  return (
    <div className="tela-jogo">
      <header className="barra">
        <div className="barra-marca">
          <Logo tamanho={34} className="barra-logo" corDoX="#201a15" />
          <div>
            <strong>Protocolo Íris</strong>
            <span>
              Purgatório, 3º subsolo ·{' '}
              {c.modo === 'treino' ? 'Sala de Treino (cópia do arquivo)' : c.modo === 'expediente' ? 'Expediente contra o relógio' : `Capítulo ${capitulo.numero} · ${capitulo.titulo}`}
            </span>
          </div>
        </div>

        <div className="barra-carimbos" data-tutorial="carimbos" title="Carimbos: a moeda da repartição">
          <span className="icone-carimbo" aria-hidden />
          <strong>{jogo.progresso.carimbos}</strong>
          <span>carimbos</span>
        </div>

        <nav className="barra-botoes">
          <button className="botao-barra" data-tutorial="botao-arvore" onClick={() => c.abrirPainel('arvore')}>
            Árvore de Credenciamento
            {compraveis > 0 && <span className="selo-novo">{compraveis}</span>}
            <kbd>Ctrl+B</kbd>
          </button>
          <button className="botao-barra" data-tutorial="botao-manual" onClick={() => c.abrirPainel('manual')}>
            Manual <kbd>Ctrl+K</kbd>
          </button>
          <button className="botao-barra icone" onClick={() => c.abrirPainel('menu')} aria-label="Menu">
            ☰
          </button>
        </nav>
      </header>

      <main className="mesa">
        <section className="coluna-mapa">
          <Mapa />
        </section>

        <section className="coluna-terminal">
          <div className="terminal" data-tutorial="editor">
            <div className="terminal-topo">
              <span className="luzes" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span>iris — terminal do Purgatório, 3º subsolo</span>
            </div>
            <Editor
              aoExecutar={(texto) => c.executar(texto)}
              aoProtocolar={() => c.protocolar()}
              aoMudar={(texto) => c.setTextoEditor(texto)}
              historico={() => c.historico}
              sugestoes={() => c.sugestoes()}
              pedido={c.pedidoEditor}
            />
            <div className="terminal-rodape">
              <span className="atalhos">
                <kbd>Ctrl+Enter</kbd> executa · <kbd>Ctrl+Shift+Enter</kbd> protocola · <kbd>↑</kbd>
                <kbd>↓</kbd> histórico · <kbd>Ctrl+Espaço</kbd> sugestões
              </span>
              <button className="botao-executar" data-tutorial="executar" onClick={() => c.executar()}>
                Executar ▶
              </button>
            </div>
          </div>
          <Saida />
        </section>

        <aside className="coluna-memorando">
          {c.modo === 'treino' && <PainelTreino />}
          {c.modo === 'expediente' && <PainelExpediente />}
          {c.modo === 'campanha' && (
            <>
              <Memorando />
              <CaixaDeEntrada />
            </>
          )}
        </aside>
      </main>

      <div className="toasts" aria-live="polite">
        {c.toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.texto}</span>
            {t.acao && (
              <button
                className="botao pequeno"
                onClick={() => {
                  c.dispensarToast(t.id);
                  c.abrirPainel(t.acao!.painel);
                }}
              >
                {t.acao.rotulo}
              </button>
            )}
            <button className="toast-fechar" onClick={() => c.dispensarToast(t.id)} aria-label="Fechar">
              ×
            </button>
          </div>
        ))}
      </div>

      {c.painel === 'arvore' && <Arvore />}
      {c.painel === 'manual' && <Manual />}
      {c.painel === 'menu' && <Menu />}
      <Sobreposicoes />
      <Tutorial />
    </div>
  );
}
