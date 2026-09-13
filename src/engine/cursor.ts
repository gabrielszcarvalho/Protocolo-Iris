/**
 * Cursores. O de `find` é preguiçoso: `.sort().skip().limit()` só guardam a intenção, e a
 * consulta roda quando alguém itera (o terminal imprime, `toArray`, `forEach`...).
 * Como no MongoDB, a ordem de aplicação é sempre sort → skip → limit, não importa a ordem
 * em que os métodos foram encadeados.
 */

import { ehObjetoSimples } from './bson';
import { erros, MongoInvalidArgumentError, MongoServerError } from './errors';

export type Documento = Record<string, unknown>;

export const TAMANHO_LOTE = 20;

export function validarSort(spec: unknown): asserts spec is Record<string, 1 | -1> {
  if (!ehObjetoSimples(spec) || Object.keys(spec).length === 0) throw erros.sortVazio();
  for (const v of Object.values(spec)) {
    const meta = ehObjetoSimples(v) && v.$meta === 'textScore';
    if (v !== 1 && v !== -1 && !meta) throw erros.ordemSort();
  }
}

export abstract class CursorBase {
  private cache?: Documento[];
  private pos = 0;

  protected abstract calcular(): Documento[];

  protected resultados(): Documento[] {
    if (!this.cache) this.cache = this.calcular();
    return this.cache;
  }

  protected get iniciado(): boolean {
    return this.cache !== undefined;
  }

  /** Todos os resultados, sem mover a posição de leitura (usado pela validação das missões). */
  todos(): Documento[] {
    return this.resultados();
  }

  hasNext(): boolean {
    return this.pos < this.resultados().length;
  }

  next(): Documento | null {
    const r = this.resultados();
    return this.pos < r.length ? r[this.pos++] : null;
  }

  toArray(): Documento[] {
    const r = this.resultados();
    const resto = r.slice(this.pos);
    this.pos = r.length;
    return resto;
  }

  forEach(fn: (doc: Documento) => void): void {
    for (const d of this.toArray()) fn(d);
  }

  map<T>(fn: (doc: Documento) => T): CursorArray {
    return new CursorArray(this.toArray().map(fn) as unknown as Documento[]);
  }

  itcount(): number {
    return this.toArray().length;
  }

  pretty(): this {
    return this;
  }

  /** Usado pelo terminal: imprime de 20 em 20 e o jogador digita `it` para continuar. */
  proximoLote(tamanho = TAMANHO_LOTE): { lote: Documento[]; restantes: number } {
    const r = this.resultados();
    const lote = r.slice(this.pos, this.pos + tamanho);
    this.pos += lote.length;
    return { lote, restantes: r.length - this.pos };
  }
}

export class CursorArray extends CursorBase {
  constructor(private readonly dados: Documento[]) {
    super();
  }
  protected calcular(): Documento[] {
    return this.dados;
  }
}

/** Resultado de aggregate: já calculado, só iterável. */
export class CursorAgregacao extends CursorArray {}

export interface ModificadoresFind {
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
}

export class CursorFind extends CursorBase {
  private readonly mods: ModificadoresFind = {};

  constructor(
    private readonly executor: (mods: ModificadoresFind) => Documento[],
    private readonly aoEncadear: (metodo: string, args: unknown[]) => void,
  ) {
    super();
  }

  protected calcular(): Documento[] {
    return this.executor(this.mods);
  }

  private antesDeModificar(metodo: string, args: unknown[]) {
    this.aoEncadear(metodo, args);
    if (this.iniciado) {
      throw new MongoInvalidArgumentError(
        `Cannot call ${metodo}() on a cursor that has already been iterated`,
        'Encadeie sort/skip/limit antes de ler os resultados.',
      );
    }
  }

  sort(spec: unknown): this {
    this.antesDeModificar('sort', [spec]);
    validarSort(spec);
    this.mods.sort = spec;
    return this;
  }

  skip(n: unknown): this {
    this.antesDeModificar('skip', [n]);
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      throw new MongoServerError(`BSON field 'skip' value must be >= 0, actual value '${String(n)}'`, {
        code: 51024,
        codeName: 'Location51024',
        traducao: 'skip recebe um inteiro não negativo: quantos documentos pular.',
      });
    }
    this.mods.skip = n;
    return this;
  }

  limit(n: unknown): this {
    this.antesDeModificar('limit', [n]);
    if (typeof n !== 'number' || !Number.isInteger(n)) {
      throw new MongoInvalidArgumentError('Operation "limit" requires an integer', 'limit recebe um número inteiro.');
    }
    // limit(0) significa "sem limite"; negativo é tratado como positivo (lote único).
    this.mods.limit = n === 0 ? undefined : Math.abs(n);
    return this;
  }

  /** Obsoleto no mongosh, mas aparece em muito material: conta ignorando skip/limit. */
  count(): number {
    this.aoEncadear('count', []);
    return this.executor({}).length;
  }

  size(): number {
    return this.resultados().length;
  }
}
