import { useMemo } from 'react';
import { useControlador } from '../controlador';
import { FASES, SETORES, type Setor } from '../../game/mundo';

const DESCRICAO: Record<Setor, string> = {
  Limbo: 'Mortos aguardando julgamento',
  Purgatório: 'Cumprindo pena, com senha',
  'Ante-Sala': 'Fila para a porta do Céu',
  'Arquivo Morto': 'Fichas que nem os mortos leem',
  Correspondência: 'Recados que nunca chegaram aos vivos',
};

export function Mapa() {
  const c = useControlador();
  const jogo = c.jogo!;
  const docs = c.mundo.colecao('almas').docs;
  const abertos = new Set(FASES[jogo.progresso.fase - 1].setoresAbertos);
  const { encontrados, inseridos, alterados } = c.destaque;
  const marcas = useMemo(
    () => ({ encontrados: new Set(encontrados), inseridos: new Set(inseridos), alterados: new Set(alterados) }),
    [encontrados, inseridos, alterados],
  );

  const porSetor = new Map<string, typeof docs>();
  for (const d of docs) {
    const setor = SETORES.includes(d.setor as Setor) ? (d.setor as string) : 'Triagem';
    porSetor.set(setor, [...(porSetor.get(setor) ?? []), d]);
  }
  const triagem = porSetor.get('Triagem') ?? [];
  const destinos = { ceu: docs.filter((d) => d.destino === 'Céu').length, inferno: docs.filter((d) => d.destino === 'Inferno').length };
  const algumDestaque = marcas.encontrados.size + marcas.inseridos.size + marcas.alterados.size > 0;

  return (
    <div className="mapa" data-tutorial="mapa">
      <header className="mapa-topo">
        <h2>Planta do Departamento</h2>
        <span>
          {docs.length} fichas · fase “{FASES[jogo.progresso.fase - 1].titulo}”
        </span>
      </header>

      <div className="portal portal-ceu">
        <span>↑ Céu{destinos.ceu > 0 && ` · ${destinos.ceu} a caminho`}</span>
        <small>saída exclusiva para fichas deferidas</small>
      </div>

      <div className={`planta ${algumDestaque ? 'com-destaque' : ''}`}>
        {SETORES.map((setor) => {
          const fichas = porSetor.get(setor) ?? [];
          const aberto = abertos.has(setor);
          const achados = fichas.filter((d) => marcas.encontrados.has(String(d._id))).length;
          return (
            <section key={setor} className={`sala sala-${setor.normalize('NFD').replace(/[^\w]/g, '').toLowerCase()} ${aberto ? '' : 'interditada'}`}>
              <header>
                <strong>{setor}</strong>
                <span>{aberto ? (achados ? `${achados} de ${fichas.length}` : fichas.length) : 'interditado'}</span>
              </header>
              {aberto ? (
                <>
                  <p className="sala-descricao">{DESCRICAO[setor]}</p>
                  <div className="fichas">
                    {fichas.map((d) => {
                      const id = String(d._id);
                      const classes = ['ficha', marcas.encontrados.has(id) && 'encontrada', marcas.inseridos.has(id) && 'nova', marcas.alterados.has(id) && 'alterada', d.ativo === false && 'inativa']
                        .filter(Boolean)
                        .join(' ');
                      return <span key={id} className={classes} title={`${String(d.nome ?? '(sem nome)')} · ${String(d.protocolo ?? 'sem protocolo')}`} />;
                    })}
                  </div>
                </>
              ) : (
                <div className="faixa-interdicao">Interditado desde o incêndio</div>
              )}
            </section>
          );
        })}

        {triagem.length > 0 && (
          <section className="sala sala-triagem">
            <header>
              <strong>Mesa de Triagem</strong>
              <span>{triagem.length}</span>
            </header>
            <p className="sala-descricao">Fichas sem setor válido</p>
            <div className="fichas">
              {triagem.map((d) => {
                const id = String(d._id);
                return (
                  <span
                    key={id}
                    className={['ficha', marcas.encontrados.has(id) && 'encontrada', marcas.inseridos.has(id) && 'nova', marcas.alterados.has(id) && 'alterada'].filter(Boolean).join(' ')}
                    title={`${String(d.nome ?? '(sem nome)')} · setor: ${JSON.stringify(d.setor)}`}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="portal portal-inferno">
        <span>↓ Inferno{destinos.inferno > 0 && ` · ${destinos.inferno} condenadas`}</span>
        <small>não perturbe as caldeiras</small>
      </div>

      <footer className="mapa-legenda">
        <span>
          <i className="ficha" /> ficha
        </span>
        <span>
          <i className="ficha encontrada" /> na resposta
        </span>
        <span>
          <i className="ficha nova" /> registrada agora
        </span>
        <span>
          <i className="ficha alterada" /> alterada
        </span>
      </footer>
    </div>
  );
}
