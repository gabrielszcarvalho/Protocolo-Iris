import { useControlador } from '../controlador';
import { CAPITULOS } from '../../game/missoes';

const ICONE = { concluida: '✓', disponivel: '•', 'falta-credencial': '🔒', aguardando: '⏳', fechada: '' } as const;

export function CaixaDeEntrada() {
  const c = useControlador();
  const jogo = c.jogo!;
  const atual = jogo.progresso.missaoAtual;

  return (
    <nav className="caixa papel" data-tutorial="caixa" aria-label="Caixa de entrada">
      <h2>Caixa de entrada</h2>
      {CAPITULOS.map((cap) => {
        const aberto = cap.numero <= jogo.progresso.capitulo;
        const feitas = cap.missoes.filter((m) => jogo.concluida(m)).length;
        return (
          <section key={cap.numero} className={aberto ? '' : 'fechado'}>
            <h3>
              <span>
                {cap.numero}. {cap.titulo}
              </span>
              <span>{aberto ? `${feitas}/${cap.missoes.length}` : '🔒'}</span>
            </h3>
            {aberto && (
              <ol>
                {cap.missoes.map((m) => {
                  const situacao = jogo.situacaoMissao(m);
                  const estrelas = jogo.progresso.concluidas[m.id]?.estrelas ?? 0;
                  return (
                    <li key={m.id}>
                      <button
                        className={`item-missao ${situacao} ${m.id === atual ? 'atual' : ''}`}
                        onClick={() => c.selecionarMissao(m.id)}
                        title={situacao === 'aguardando' ? `Aguardando o memorando ${jogo.aguardandoPor(m).map((x) => x.id).join(', ')}` : undefined}
                      >
                        <span className="item-icone">{ICONE[situacao]}</span>
                        <span className="item-id">{m.id}</span>
                        <span className="item-titulo">{m.titulo}</span>
                        {estrelas > 0 && <span className="item-estrelas">{'★'.repeat(estrelas)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </nav>
  );
}
