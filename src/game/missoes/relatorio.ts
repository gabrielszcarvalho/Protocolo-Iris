/** Peças comuns aos memorandos de relatório (capítulos 8 a 11). */

import { validarConsulta, type OpcoesConsulta } from '../validacao';
import { objetivo, usouMetodo, validarPorObjetivos, type Objetivo } from '../objetivos';

export type Doc = Record<string, unknown>;

export const feitoComAggregate = objetivo('Feito como relatório: db.almas.aggregate([ ... ]).', usouMetodo('aggregate'));

/** Primeiro compara com a referência (para dar o diagnóstico), depois exige cada quadradinho. */
export const relatorio = (objetivos: Objetivo[], opts: Partial<OpcoesConsulta> = {}) =>
  validarPorObjetivos(objetivos, validarConsulta({ colecao: 'almas', ...opts }));

/** Nenhum documento mostra campos além destes (fichas antigas podem não ter todos). */
export const soComCampos = (campos: string[]) => (v: unknown) =>
  Array.isArray(v) && v.length > 0 && (v as Doc[]).every((d) => Object.keys(d).every((k) => campos.includes(k)) && 'nome' in d);

export const lista =(v: unknown): Doc[] => (Array.isArray(v) ? (v as Doc[]) : []);
export const audiencias = (d: Doc) => (Array.isArray(d.audiencias) ? (d.audiencias as { parecer: string; peso: number; data: Date }[]) : []);
export const vinculos = (d: Doc) => (Array.isArray(d.vinculos) ? (d.vinculos as string[]) : []);
