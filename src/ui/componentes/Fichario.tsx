import { useMemo, useState } from 'react';
import { useControlador } from '../controlador';
import { inferirEsquema } from '../inferencia';

export function Fichario() {
  const c = useControlador();
  const mundo = c.mundo;
  const nomes = mundo.nomesDasColecoes();
  const [escolhida, setEscolhida] = useState('almas');
  const colecao = nomes.includes(escolhida) ? escolhida : (nomes[0] ?? 'almas');
  const docs = mundo.colecao(colecao).docs;
  const versao = c.versaoAtual();
  const esquema = useMemo(() => inferirEsquema(docs), [docs, versao]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fichario">
      {nomes.length > 1 && (
        <div className="fichario-colecoes" role="tablist" aria-label="Coleções">
          {nomes.map((n) => (
            <button key={n} role="tab" aria-selected={n === colecao} className={n === colecao ? 'ativa' : ''} onClick={() => setEscolhida(n)}>
              {n} <small>{mundo.colecao(n).docs.length}</small>
            </button>
          ))}
        </div>
      )}
      <p className="fichario-intro">
        Coleção <code>{colecao}</code> · {docs.length} documentos. Campos encontrados, em quantos documentos aparecem e com que tipos. Clique
        num campo para levá-lo ao terminal.
      </p>
      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Presente em</th>
            <th>Tipos</th>
          </tr>
        </thead>
        <tbody>
          {esquema.map((campo) => (
            <tr key={campo.caminho}>
              <td>
                <button className="campo" onClick={() => c.inserirNoEditor(`${c.textoEditor}${campo.caminho.includes('.') ? `'${campo.caminho}'` : campo.caminho}`)}>
                  {campo.caminho}
                </button>
              </td>
              <td>
                <span className="barra-presenca">
                  <i style={{ width: `${Math.round((campo.presentes / Math.max(1, docs.length)) * 100)}%` }} />
                </span>
                {campo.caminho.includes('.') && !docs.every((d) => campo.caminho.split('.')[0] in d) ? campo.presentes : `${campo.presentes}/${docs.length}`}
              </td>
              <td>
                {Object.entries(campo.tipos).map(([tipo, n]) => (
                  <span key={tipo} className={`tipo tipo-${tipo}`} title={`${n} valor(es)`}>
                    {tipo}
                    {Object.keys(campo.tipos).length > 1 ? ` ${n}` : ''}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
