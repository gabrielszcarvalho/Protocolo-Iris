/**
 * Impressão de valores no estilo do mongosh:
 *   { _id: ObjectId('...'), nome: 'Iracema', falecimento: ISODate('1938-04-02T00:00:00.000Z') }
 * Objetos curtos ficam numa linha; longos quebram com indentação de 2 espaços.
 */

import { ObjectId } from './bson';

const LARGURA = 72;
const IDENTIFICADOR = /^[A-Za-z_$][\w$]*$/;

function aspas(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function chave(k: string): string {
  return IDENTIFICADOR.test(k) ? k : aspas(k);
}

function escalar(v: unknown): string | null {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  switch (typeof v) {
    case 'string':
      return aspas(v);
    case 'number':
      return Object.is(v, -0) ? '-0' : String(v);
    case 'boolean':
      return String(v);
    case 'bigint':
      return `Long('${v}')`;
    case 'function':
      return `[Function: ${v.name || 'anonymous'}]`;
  }
  if (v instanceof ObjectId) return `ObjectId('${v.toHexString()}')`;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'Invalid Date' : `ISODate('${v.toISOString()}')`;
  if (v instanceof RegExp) return String(v);
  return null;
}

export function formatar(v: unknown, nivel = 0, vistos = new WeakSet<object>()): string {
  const e = escalar(v);
  if (e !== null) return e;

  const obj = v as object;
  if (vistos.has(obj)) return '[Circular]';
  vistos.add(obj);

  const recuo = '  '.repeat(nivel + 1);
  const recuoFim = '  '.repeat(nivel);
  let partes: string[];
  let abre: string;
  let fecha: string;

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    partes = obj.map((item) => formatar(item, nivel + 1, vistos));
    [abre, fecha] = ['[', ']'];
  } else {
    const entradas = Object.entries(obj);
    if (entradas.length === 0) return '{}';
    partes = entradas.map(([k, val]) => `${chave(k)}: ${formatar(val, nivel + 1, vistos)}`);
    [abre, fecha] = ['{', '}'];
  }
  vistos.delete(obj);

  const umaLinha = `${abre} ${partes.join(', ')} ${fecha}`;
  if (umaLinha.length + nivel * 2 <= LARGURA && !umaLinha.includes('\n')) return umaLinha;
  return `${abre}\n${partes.map((p) => recuo + p).join(',\n')}\n${recuoFim}${fecha}`;
}
