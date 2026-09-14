/** Esquema inferido de uma coleção: quais campos existem, em quantas fichas e com quais tipos. */

import { ehObjetoSimples, tipoBson } from '../engine/bson';

export interface InfoCampo {
  caminho: string;
  presentes: number;
  tipos: Record<string, number>;
}

export function inferirEsquema(docs: Record<string, unknown>[]): InfoCampo[] {
  const campos = new Map<string, InfoCampo>();
  const registrar = (caminho: string, valor: unknown) => {
    let info = campos.get(caminho);
    if (!info) campos.set(caminho, (info = { caminho, presentes: 0, tipos: {} }));
    info.presentes++;
    const tipo = tipoBson(valor);
    info.tipos[tipo] = (info.tipos[tipo] ?? 0) + 1;
  };

  for (const doc of docs) {
    const vistosNoDoc = new Set<string>();
    const uma = (caminho: string, valor: unknown) => {
      if (vistosNoDoc.has(caminho)) return;
      vistosNoDoc.add(caminho);
      registrar(caminho, valor);
    };
    for (const [k, v] of Object.entries(doc)) {
      uma(k, v);
      if (ehObjetoSimples(v)) for (const [k2, v2] of Object.entries(v)) uma(`${k}.${k2}`, v2);
      if (Array.isArray(v)) for (const item of v) if (ehObjetoSimples(item)) for (const [k2, v2] of Object.entries(item)) uma(`${k}.${k2}`, v2);
    }
  }
  return [...campos.values()];
}
