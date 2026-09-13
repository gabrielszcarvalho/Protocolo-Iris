/**
 * Tipos BSON simulados.
 *
 * Decisão didática sobre números: seguimos o mongosh moderno (que usa o driver Node).
 * Um número JS inteiro dentro da faixa de 32 bits é gravado como `int`; inteiros maiores
 * viram `long`; qualquer número com parte fracionária é `double`. Por isso, no jogo e no
 * mongosh real, `{ creditos: 500 }` é `int` e `{ creditos: 500.5 }` é `double` — e um
 * validador com `bsonType: "double"` rejeita o 500. Essa é uma pegadinha real de prova.
 */

export type TipoBson =
  | 'double'
  | 'string'
  | 'object'
  | 'array'
  | 'objectId'
  | 'bool'
  | 'date'
  | 'null'
  | 'regex'
  | 'int'
  | 'long'
  | 'undefined';

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

// ---------------------------------------------------------------------------
// ObjectId
// ---------------------------------------------------------------------------

let contadorObjectId = Math.floor(Math.random() * 0xffffff);
const aleatorioProcesso = Array.from({ length: 5 }, () =>
  Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
).join('');

export class ObjectId {
  private readonly hex: string;

  constructor(valor?: string | ObjectId) {
    if (valor instanceof ObjectId) {
      this.hex = valor.hex;
      return;
    }
    if (valor === undefined) {
      // 4 bytes de timestamp + 5 bytes aleatórios do "processo" + 3 bytes de contador,
      // exatamente a anatomia de um ObjectId real.
      const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
      contadorObjectId = (contadorObjectId + 1) % 0x1000000;
      this.hex = ts + aleatorioProcesso + contadorObjectId.toString(16).padStart(6, '0');
      return;
    }
    if (typeof valor !== 'string' || !/^[0-9a-fA-F]{24}$/.test(valor)) {
      throw new BSONError(
        'input must be a 24 character hex string, 12 byte Uint8Array, or an integer',
      );
    }
    this.hex = valor.toLowerCase();
  }

  toHexString(): string {
    return this.hex;
  }

  // O mingo compara objetos de classe pelo toString(), então isto é o que garante
  // que dois ObjectId com o mesmo hex sejam considerados iguais em filtros e $group.
  toString(): string {
    return this.hex;
  }

  toJSON(): string {
    return this.hex;
  }

  equals(outro: unknown): boolean {
    return outro instanceof ObjectId && outro.hex === this.hex;
  }

  getTimestamp(): Date {
    return new Date(parseInt(this.hex.slice(0, 8), 16) * 1000);
  }
}

export class BSONError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'BSONError';
  }
}

// ---------------------------------------------------------------------------
// Construtores disponíveis no terminal
// ---------------------------------------------------------------------------

export function ISODate(entrada?: string | number | Date): Date {
  if (entrada === undefined) return new Date();
  const d = new Date(entrada);
  if (Number.isNaN(d.getTime())) {
    throw new BSONError(`${JSON.stringify(entrada)} is not a valid ISODate`);
  }
  return d;
}

/** Trunca para inteiro de 32 bits, como o NumberInt do shell. */
export function NumberInt(valor: number | string = 0): number {
  const n = Number(valor);
  if (Number.isNaN(n)) throw new BSONError(`NumberInt: valor inválido ${JSON.stringify(valor)}`);
  return n | 0;
}

/** Inteiro de 64 bits. Na simulação vira number inteiro (limite: 2^53). */
export function NumberLong(valor: number | string = 0): number {
  const n = Number(valor);
  if (Number.isNaN(n)) throw new BSONError(`NumberLong: valor inválido ${JSON.stringify(valor)}`);
  return Math.trunc(n);
}

export function NumberDecimal(valor: number | string = 0): number {
  const n = Number(valor);
  if (Number.isNaN(n)) throw new BSONError(`NumberDecimal: valor inválido ${JSON.stringify(valor)}`);
  return n;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export function ehObjetoSimples(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function tipoBson(v: unknown): TipoBson {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  switch (typeof v) {
    case 'boolean':
      return 'bool';
    case 'string':
      return 'string';
    case 'number':
      if (Number.isInteger(v)) return v >= INT32_MIN && v <= INT32_MAX ? 'int' : 'long';
      return 'double';
  }
  if (Array.isArray(v)) return 'array';
  if (v instanceof Date) return 'date';
  if (v instanceof RegExp) return 'regex';
  if (v instanceof ObjectId) return 'objectId';
  return 'object';
}

/** Códigos numéricos e aliases aceitos por $type e bsonType. */
const ALIAS_TIPO: Record<string, TipoBson[]> = {
  '1': ['double'],
  '2': ['string'],
  '3': ['object'],
  '4': ['array'],
  '7': ['objectId'],
  '8': ['bool'],
  '9': ['date'],
  '10': ['null'],
  '11': ['regex'],
  '16': ['int'],
  '18': ['long'],
  '19': ['double'], // decimal não é distinguido na simulação
  double: ['double'],
  string: ['string'],
  object: ['object'],
  array: ['array'],
  objectId: ['objectId'],
  bool: ['bool'],
  date: ['date'],
  null: ['null'],
  regex: ['regex'],
  int: ['int'],
  long: ['long'],
  decimal: ['double'],
  number: ['double', 'int', 'long'],
};

export function aliasDeTipoValido(alias: unknown): boolean {
  return (typeof alias === 'string' || typeof alias === 'number') && String(alias) in ALIAS_TIPO;
}

/** true se o valor (não-array) é de algum dos tipos pedidos. */
export function valorEhDoTipo(v: unknown, alias: string | number): boolean {
  const aceitos = ALIAS_TIPO[String(alias)];
  if (!aceitos) return false;
  return aceitos.includes(tipoBson(v));
}

// ---------------------------------------------------------------------------
// Clonagem e serialização
// ---------------------------------------------------------------------------

export function clonar<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (v instanceof RegExp) return new RegExp(v.source, v.flags) as T;
  if (v instanceof ObjectId) return v; // imutável
  if (Array.isArray(v)) return v.map(clonar) as T;
  const saida: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) saida[k] = clonar(val);
  return saida as T;
}

/** Converte para Extended JSON (formato usado na persistência em IndexedDB). */
export function paraEJSON(v: unknown): unknown {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) return { $numberDouble: String(v) };
    return v;
  }
  if (v instanceof Date) return { $date: v.toISOString() };
  if (v instanceof RegExp) return { $regularExpression: { pattern: v.source, options: v.flags } };
  if (v instanceof ObjectId) return { $oid: v.toHexString() };
  if (Array.isArray(v)) return v.map(paraEJSON);
  const saida: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) saida[k] = paraEJSON(val);
  return saida;
}

export function deEJSON(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(deEJSON);
  const o = v as Record<string, unknown>;
  const chaves = Object.keys(o);
  if (chaves.length === 1) {
    if (typeof o.$oid === 'string') return new ObjectId(o.$oid);
    if (typeof o.$date === 'string') return new Date(o.$date);
    if (typeof o.$numberDouble === 'string') return Number(o.$numberDouble);
    const re = o.$regularExpression as { pattern: string; options: string } | undefined;
    if (re && typeof re.pattern === 'string') return new RegExp(re.pattern, re.options);
  }
  const saida: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(o)) saida[k] = deEJSON(val);
  return saida;
}

/**
 * Representação canônica e estável (chaves ordenadas) para comparar documentos
 * independentemente da ordem dos campos — usada nos diffs de mundo e na validação de missões.
 */
export function canonico(v: unknown): string {
  return JSON.stringify(ordenarChaves(paraEJSON(v)));
}

function ordenarChaves(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(ordenarChaves);
  const o = v as Record<string, unknown>;
  const saida: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) saida[k] = ordenarChaves(o[k]);
  return saida;
}

// ---------------------------------------------------------------------------
// Caminhos com dot notation
// ---------------------------------------------------------------------------

/** Lê um caminho "a.b.c". Retorna undefined se algum trecho não existir (sem expandir arrays). */
export function lerCaminho(doc: unknown, caminho: string): unknown {
  let atual: unknown = doc;
  for (const parte of caminho.split('.')) {
    if (atual === null || typeof atual !== 'object') return undefined;
    if (Array.isArray(atual)) {
      if (!/^\d+$/.test(parte)) return undefined;
      atual = atual[Number(parte)];
    } else {
      atual = (atual as Record<string, unknown>)[parte];
    }
  }
  return atual;
}

/**
 * Lê um caminho expandindo arrays no meio do caminho, como o MongoDB faz para índices
 * multikey: { a: [ {b:1}, {b:2} ] } no caminho "a.b" produz [1, 2].
 */
export function lerCaminhoExpandido(doc: unknown, caminho: string): unknown[] {
  const partes = caminho.split('.');
  const resultado: unknown[] = [];
  const visitar = (valor: unknown, i: number) => {
    if (i === partes.length) {
      resultado.push(valor);
      return;
    }
    if (Array.isArray(valor)) {
      if (/^\d+$/.test(partes[i])) {
        visitar(valor[Number(partes[i])], i + 1);
        return;
      }
      for (const item of valor) visitar(item, i);
      return;
    }
    if (valor === null || typeof valor !== 'object') {
      resultado.push(undefined);
      return;
    }
    visitar((valor as Record<string, unknown>)[partes[i]], i + 1);
  };
  visitar(doc, 0);
  return resultado;
}
