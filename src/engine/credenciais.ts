/**
 * Credenciamento: cada operador pertence a um capítulo. Usar algo de um capítulo à frente
 * gera CredencialError ANTES de executar.
 *
 * A mesma varredura (`operadoresDaOperacao`) serve para as missões inspecionarem o "AST"
 * do que o jogador rodou — ex.: conferir que um pipeline tem dois $match — sem olhar a string.
 */

import { CredencialError } from './errors';
import { ehObjetoSimples } from './bson';

export interface Operacao {
  colecao?: string;
  metodo: string;
  args: unknown[];
}

/** Contexto muda o significado: $sort dentro de $push (cap. 5) x estágio $sort (cap. 8). */
type Contexto = 'crud' | 'agregacao';

const COMUM: Record<string, number> = {
  // Cap. 1 — Admissão
  find: 1, findOne: 1, insertOne: 1, insertMany: 1, countDocuments: 1, estimatedDocumentCount: 1,
  getCollectionNames: 1, getCollection: 1, ordered: 1, toArray: 1, forEach: 1, itcount: 1, pretty: 1,
  hasNext: 1, next: 1, size: 1, count: 1, map: 1,
  // Cap. 2 — Triagem
  $eq: 2, $ne: 2, $gt: 2, $gte: 2, $lt: 2, $lte: 2, $and: 2, $or: 2, $nor: 2, $in: 2, $nin: 2,
  $exists: 2, $type: 2, sort: 2, limit: 2, skip: 2, distinct: 2,
  // Cap. 3 — Inventário
  $all: 3, $size: 3, $elemMatch: 3,
  // Cap. 4 — Retificação
  updateOne: 4, updateMany: 4, replaceOne: 4, deleteOne: 4, deleteMany: 4, drop: 4,
  $set: 4, $unset: 4, $inc: 4, $mul: 4, $rename: 4, $currentDate: 4, $setOnInsert: 4, upsert: 4,
  // Cap. 5 — Anexos
  $push: 5, $each: 5, $position: 5, $pull: 5, $pullAll: 5, $pop: 5, arrayFilters: 5,
  '$ (posicional)': 5, '$[]': 5, '$[<apelido>]': 5,
  // Cap. 6 — Grafologia
  $regex: 6, $options: 6, $not: 6,
  // Cap. 7 — O Regulamento
  createCollection: 7, runCommand: 7, collMod: 7, createIndex: 7, getIndexes: 7, dropIndex: 7,
  getCollectionInfos: 7, $jsonSchema: 7, validator: 7, validationLevel: 7, validationAction: 7,
  // Cap. 8 — Relatórios I
  aggregate: 8, $concat: 8,
  // Cap. 9 — Relatórios II
  $group: 9, $sum: 9, $avg: 9, $first: 9, $last: 9, $count: 9, $lookup: 9,
  // Cap. 10 — Desdobramento
  $unwind: 10, $year: 10, $month: 10, $dayOfMonth: 10,
  // Cap. 11 — Parecer
  $cond: 11, $switch: 11, $expr: 11, $arrayToObject: 11, $objectToArray: 11, $ifNull: 11,
};

const POR_CONTEXTO: Record<Contexto, Record<string, number>> = {
  crud: { $sort: 5, $slice: 5, $addToSet: 5, $min: 4, $max: 4 },
  agregacao: {
    $match: 8, $project: 8, $sort: 8, $limit: 8, $skip: 8, $addFields: 8, $set: 8, $unset: 8,
    $addToSet: 9, $push: 9, $min: 9, $max: 9, $size: 11, $slice: 11,
  },
};

export function capituloDoOperador(nome: string, contexto: Contexto): number {
  return POR_CONTEXTO[contexto][nome] ?? COMUM[nome] ?? 0;
}

/** Caminhos de update com $, $[] ou $[apelido]. */
function operadoresDeCaminho(caminho: string): string[] {
  const achados: string[] = [];
  for (const parte of caminho.split('.')) {
    if (parte === '$') achados.push('$ (posicional)');
    else if (parte === '$[]') achados.push('$[]');
    else if (/^\$\[\w+\]$/.test(parte)) achados.push('$[<apelido>]');
  }
  return achados;
}

function varrer(valor: unknown, achados: string[]): void {
  if (valor instanceof RegExp) {
    achados.push('$regex');
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) varrer(item, achados);
    return;
  }
  if (!ehObjetoSimples(valor)) return;
  for (const [k, v] of Object.entries(valor)) {
    if (k.startsWith('$') && !k.startsWith('$[')) achados.push(k);
    else if (k.includes('$')) achados.push(...operadoresDeCaminho(k));
    varrer(v, achados);
  }
}

/** Lista (com repetição, na ordem em que aparecem) tudo o que a operação usa. */
export function operadoresDaOperacao(op: Operacao): string[] {
  const achados = [op.metodo];
  if (op.metodo === 'runCommand' && ehObjetoSimples(op.args[0])) {
    achados.push(...Object.keys(op.args[0]).filter((k) => k in COMUM));
  }
  for (const arg of op.args) {
    if (ehObjetoSimples(arg)) {
      for (const opcao of ['ordered', 'upsert', 'arrayFilters', 'validator', 'validationLevel', 'validationAction']) {
        if (opcao in arg) achados.push(opcao);
      }
    }
    varrer(arg, achados);
  }
  return achados;
}

/** Estágios de um pipeline, na ordem — o "AST" usado por missões como "use DOIS $match". */
export function estagiosDoPipeline(op: Operacao): string[] {
  if (op.metodo !== 'aggregate' || !Array.isArray(op.args[0])) return [];
  return (op.args[0] as unknown[]).map((e) => (ehObjetoSimples(e) ? Object.keys(e)[0] ?? '?' : '?'));
}

export function verificarCredencial(op: Operacao, capituloAtual: number): void {
  const contexto: Contexto = op.metodo === 'aggregate' ? 'agregacao' : 'crud';
  for (const nome of operadoresDaOperacao(op)) {
    const cap = capituloDoOperador(nome, contexto);
    if (cap > capituloAtual) throw new CredencialError(nome, cap);
  }
}

export const CAPITULO_SANDBOX = 99;
