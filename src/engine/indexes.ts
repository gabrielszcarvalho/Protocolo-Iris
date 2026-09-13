/**
 * Índices simulados. Só a parte que importa para o jogo:
 *  - unicidade (com o erro E11000 real);
 *  - saber se um campo tem índice, para o "explain" simplificado.
 *
 * Detalhe didático: num índice único, documento SEM o campo conta como `null`. Então só um
 * documento pode ficar sem o campo — o segundo gera E11000. (Índices parciais/sparse resolvem
 * isso no MongoDB real, mas não fazem parte do conteúdo da disciplina.)
 */

import { canonico, lerCaminhoExpandido } from './bson';

export type Documento = Record<string, unknown>;

export interface DefinicaoIndice {
  nome: string;
  chave: Record<string, 1 | -1>;
  unico: boolean;
}

export function nomeDoIndice(chave: Record<string, unknown>): string {
  return Object.entries(chave)
    .map(([k, v]) => `${k}_${v}`)
    .join('_');
}

export class Indice {
  readonly def: DefinicaoIndice;
  private readonly campos: string[];
  // chave canônica -> documentos que a possuem
  private readonly entradas = new Map<string, Set<Documento>>();

  constructor(def: DefinicaoIndice) {
    this.def = def;
    this.campos = Object.keys(def.chave);
  }

  /**
   * Todas as chaves que o documento gera. Arrays viram várias entradas (índice multikey).
   * Um documento com o mesmo valor repetido no array gera a chave uma vez só.
   */
  chavesDe(doc: Documento): { canonica: string; valores: Record<string, unknown> }[] {
    let combinacoes: Record<string, unknown>[] = [{}];
    for (const campo of this.campos) {
      const brutos = lerCaminhoExpandido(doc, campo).flatMap((v) => (Array.isArray(v) ? (v.length ? v : [undefined]) : [v]));
      const valores = brutos.length ? brutos : [undefined];
      const novas: Record<string, unknown>[] = [];
      for (const c of combinacoes) {
        for (const v of valores) novas.push({ ...c, [campo]: v === undefined ? null : v });
      }
      combinacoes = novas;
    }
    const vistas = new Map<string, Record<string, unknown>>();
    for (const c of combinacoes) vistas.set(canonico(c), c);
    return [...vistas].map(([canonica, valores]) => ({ canonica, valores }));
  }

  /** Retorna os valores da primeira chave que colidiria, ou null se não houver conflito. */
  conflito(doc: Documento, ignorar?: Documento): Record<string, unknown> | null {
    if (!this.def.unico) return null;
    for (const { canonica, valores } of this.chavesDe(doc)) {
      const donos = this.entradas.get(canonica);
      if (!donos) continue;
      for (const dono of donos) if (dono !== ignorar && dono !== doc) return valores;
    }
    return null;
  }

  adicionar(doc: Documento): void {
    for (const { canonica } of this.chavesDe(doc)) {
      let donos = this.entradas.get(canonica);
      if (!donos) this.entradas.set(canonica, (donos = new Set()));
      donos.add(doc);
    }
  }

  remover(doc: Documento): void {
    for (const { canonica } of this.chavesDe(doc)) {
      const donos = this.entradas.get(canonica);
      if (!donos) continue;
      donos.delete(doc);
      if (!donos.size) this.entradas.delete(canonica);
    }
  }

  cobreCampo(campo: string): boolean {
    return this.campos[0] === campo;
  }
}
