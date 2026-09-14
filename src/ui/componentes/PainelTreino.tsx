import { useControlador } from '../controlador';

export function PainelTreino() {
  const c = useControlador();
  const treino = c.treino!;
  const mundo = c.mundo;

  return (
    <article className="memorando papel painel-modo" data-tutorial="memorando">
      <header className="memorando-cabecalho">
        <span>Sala de Treino</span>
        <span>fora do expediente · não vale carimbo</span>
      </header>
      <h2>Sala de Treino</h2>
      <p className="memorando-corpo">
        Uma cópia do seu arquivo, só para você. Consulte, apague, recrie coleções, teste validadores — nada daqui chega à campanha. Quando
        quiser começar de novo, restaure a cópia.
      </p>

      <label className="alternador">
        <input type="checkbox" checked={treino.todasAsCredenciais} onChange={() => c.alternarTodasCredenciais()} />
        <span>
          <strong>Liberar todas as credenciais</strong>
          <small>Modo estudo: todos os comandos do Manual funcionam aqui, mesmo os que você ainda não comprou.</small>
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
          Restaurar a cópia
        </button>
        <button className="botao principal" onClick={() => c.voltarACampanha()}>
          Voltar aos memorandos
        </button>
      </footer>
    </article>
  );
}
