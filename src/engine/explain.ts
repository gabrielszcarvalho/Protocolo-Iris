/**
 * "Explain" simplificado, usado para dar carimbos de eficiência.
 *
 * Regra: se algum campo de igualdade/intervalo do filtro (no nível de cima, ou dentro de um
 * $and) tem índice, o servidor só "examina" os documentos que batem com aquele trecho
 * (IXSCAN). Senão, examina a coleção inteira (COLLSCAN). Não é o planejador real,
 * mas ensina a intuição certa: índice reduz documentos examinados.
 */

import type { Indice } from './indexes';
import { criarQuery } from './mingoCtx';

type Documento = Record<string, unknown>;

export interface Plano {
  estagio: 'COLLSCAN' | 'IXSCAN';
  indice?: string;
  docsExaminados: number;
}

const OPERADORES_INDEXAVEIS = new Set(['$eq', '$in', '$gt', '$gte', '$lt', '$lte']);

function trechoIndexavel(valor: unknown): boolean {
  if (valor === null || typeof valor !== 'object' || valor instanceof Date || valor instanceof RegExp) return true;
  if (Array.isArray(valor)) return true;
  const chaves = Object.keys(valor);
  if (chaves.length && chaves.every((k) => k.startsWith('$'))) return chaves.some((k) => OPERADORES_INDEXAVEIS.has(k));
  return true; // igualdade com subdocumento
}

function candidatos(filtro: Documento): [string, unknown][] {
  const lista: [string, unknown][] = [];
  for (const [k, v] of Object.entries(filtro)) {
    if (k === '$and' && Array.isArray(v)) {
      for (const sub of v) lista.push(...candidatos(sub as Documento));
    } else if (!k.startsWith('$') && trechoIndexavel(v)) {
      lista.push([k, v]);
    }
  }
  return lista;
}

export function planejar(docs: Documento[], filtro: Documento, indices: Iterable<Indice>): Plano {
  const lista = candidatos(filtro);
  let melhor: Plano = { estagio: 'COLLSCAN', docsExaminados: docs.length };
  for (const indice of indices) {
    for (const [campo, valor] of lista) {
      if (!indice.cobreCampo(campo)) continue;
      const q = criarQuery({ [campo]: valor });
      const n = docs.reduce((acc, d) => acc + (q.test(d) ? 1 : 0), 0);
      if (melhor.estagio === 'COLLSCAN' || n < melhor.docsExaminados) {
        melhor = { estagio: 'IXSCAN', indice: indice.def.nome, docsExaminados: n };
      }
    }
  }
  return melhor;
}
