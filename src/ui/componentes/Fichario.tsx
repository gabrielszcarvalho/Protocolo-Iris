import { useMemo } from 'react';
import { useControlador } from '../controlador';
import { inferirEsquema } from '../inferencia';

export function Fichario() {
  const c = useControlador();
  const docs = c.jogo!.mundo.colecao('almas').docs;
  const versao = c.versaoAtual();
  const esquema = useMemo(() => inferirEsquema(docs), [docs, versao]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fichario">
      <p className="fichario-intro">
        Coleção <code>almas</code> · {docs.length} fichas. Campos encontrados, em quantas fichas aparecem e com que tipos. Clique num campo
        para levá-lo ao terminal.
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
