/**
 * Objetivos conferíveis: cada item de "A entregar" no memorando tem sua própria verificação,
 * sempre pelo efeito (o que voltou da consulta ou o que mudou no arquivo), nunca pelo texto.
 * Ao protocolar, o jogador vê quais quadradinhos já estão certos.
 */

import { canonico, ehObjetoSimples, lerCaminho } from '../engine/bson';
import { criarQuery } from '../engine/mingoCtx';
import type { Database, RegistroOperacao } from '../engine/database';
import { diffColecao, type ContextoValidacao } from './validacao';

type Doc = Record<string, unknown>;

export type Conferencia = (ctx: ContextoValidacao) => boolean;

export interface Objetivo {
  texto: string;
  conferir: Conferencia;
}

export const objetivo = (texto: string, conferir: Conferencia): Objetivo => ({ texto, conferir });

/** Todas as conferências precisam passar. */
export const todas =
  (...conferencias: Conferencia[]): Conferencia =>
  (ctx) =>
    conferencias.every((c) => c(ctx));

// ---------------------------------------------------------------------------
// Leitura do resultado
// ---------------------------------------------------------------------------

const COLECAO = 'almas';

function comoLista(valor: unknown): Doc[] | null {
  if (Array.isArray(valor)) return valor.filter(ehObjetoSimples);
  if (ehObjetoSimples(valor) && !('acknowledged' in valor)) return [valor];
  return null;
}

/**
 * Fichas completas que correspondem ao resultado. Com _id, busca no arquivo; sem _id (projeção
 * com _id: 0), refaz o filtro da última consulta — assim dá para conferir "são do Purgatório"
 * mesmo que o campo setor tenha sido escondido.
 */
function completas(valor: unknown, operacoes: RegistroOperacao[], mundo: Database): Doc[] | null {
  const docs = comoLista(valor);
  if (!docs) return null;
  const arquivo = mundo.colecao(COLECAO).docs;
  if (docs.every((d) => '_id' in d)) {
    const porId = new Map(arquivo.map((d) => [canonico(d._id), d]));
    return docs.map((d) => porId.get(canonico(d._id)) ?? d);
  }
  const consulta = [...operacoes].reverse().find((o) => (o.metodo === 'find' || o.metodo === 'findOne') && o.colecao === COLECAO);
  if (!consulta) return docs;
  try {
    const q = criarQuery((consulta.args[0] ?? {}) as Doc);
    const achadas = arquivo.filter((d) => q.test(d));
    return consulta.metodo === 'findOne' ? achadas.slice(0, 1) : achadas;
  } catch {
    return docs;
  }
}

const doJogador = (ctx: ContextoValidacao) => completas(ctx.resultado, ctx.operacoes, ctx.mundo);

const daReferencia = (ctx: ContextoValidacao) => {
  const ref = ctx.referencia();
  return completas(ref.valor, ref.operacoes, ref.mundo) ?? [];
};

const ids = (docs: Doc[]) => new Set(docs.map((d) => canonico(d._id)));

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** A resposta é idêntica à da solução de referência (ignorando a ordem). */
export const respostaCompleta: Conferencia = (ctx) => {
  const ref = ctx.referencia().valor;
  if (!Array.isArray(ref) || !Array.isArray(ctx.resultado)) return canonico(ref) === canonico(ctx.resultado);
  return canonico(ref.map(canonico).sort()) === canonico(ctx.resultado.map(canonico).sort());
};

/** Voltaram exatamente as fichas esperadas (independente dos campos mostrados). */
export const mesmasFichas: Conferencia = (ctx) => {
  const obtidas = doJogador(ctx);
  if (!obtidas) return false;
  const a = ids(obtidas);
  const b = ids(daReferencia(ctx));
  return a.size === b.size && [...b].every((id) => a.has(id));
};

/** Nenhuma ficha esperada ficou de fora (pode haver extras). */
export const nenhumaDeFora: Conferencia = (ctx) => {
  const obtidas = doJogador(ctx);
  if (!obtidas) return false;
  const a = ids(obtidas);
  return [...ids(daReferencia(ctx))].every((id) => a.has(id));
};

/** Voltou pelo menos uma ficha e todas satisfazem a condição. */
export const todasSao =
  (condicao: (d: Doc) => boolean): Conferencia =>
  (ctx) => {
    const obtidas = doJogador(ctx);
    return !!obtidas && obtidas.length > 0 && obtidas.every(condicao);
  };

/** Toda ficha do arquivo que satisfaz a condição está na resposta. */
export const incluiTodasQue =
  (condicao: (d: Doc) => boolean): Conferencia =>
  (ctx) => {
    const obtidas = doJogador(ctx);
    if (!obtidas) return false;
    const a = ids(obtidas);
    return ctx.mundo.colecao(COLECAO).docs.filter(condicao).every((d) => a.has(canonico(d._id)));
  };

export const algumaE =
  (condicao: (d: Doc) => boolean): Conferencia =>
  (ctx) =>
    !!doJogador(ctx)?.some(condicao);

const chavesSemId = (d: Doc) =>
  Object.keys(d)
    .filter((k) => k !== '_id')
    .sort()
    .join(',');

/** Os documentos mostram exatamente estes campos (o _id é conferido à parte). */
export const somenteCampos =
  (campos: string[]): Conferencia =>
  (ctx) => {
    const docs = comoLista(ctx.resultado);
    const esperado = [...campos].sort().join(',');
    return !!docs && docs.length > 0 && docs.every((d) => chavesSemId(d) === esperado);
  };

export const semCampo =
  (campo: string): Conferencia =>
  (ctx) => {
    const docs = comoLista(ctx.resultado);
    return !!docs && docs.length > 0 && docs.every((d) => !(campo in d));
  };

/** Os campos mostrados são os mesmos da solução de referência. */
export const camposComoReferencia: Conferencia = (ctx) => {
  const docs = comoLista(ctx.resultado);
  const ref = comoLista(ctx.referencia().valor) ?? [];
  if (!docs?.length || !ref.length) return false;
  const chaves = (d: Doc) => Object.keys(d).sort().join(',');
  const a = new Set(docs.map(chaves));
  const b = new Set(ref.map(chaves));
  return a.size === b.size && [...b].every((k) => a.has(k));
};

export const umDocumentoSo: Conferencia = (ctx) => ehObjetoSimples(ctx.resultado) && !('acknowledged' in ctx.resultado);

export const numeroCerto: Conferencia = (ctx) => typeof ctx.resultado === 'number' && ctx.resultado === ctx.referencia().valor;

export const ordenadaPor =
  (campo: string, direcao: 1 | -1): Conferencia =>
  (ctx) => {
    const obtidas = doJogador(ctx);
    if (!obtidas || obtidas.length < 2) return false;
    const valor = (d: Doc) => {
      const v = lerCaminho(d, campo);
      return v instanceof Date ? v.getTime() : (v as number | string);
    };
    return obtidas.every((d, i) => i === 0 || (direcao === 1 ? valor(obtidas[i - 1]) <= valor(d) : valor(obtidas[i - 1]) >= valor(d)));
  };

// ---------------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------------

const inseridas = (ctx: ContextoValidacao) => diffColecao(ctx.mundoInicio.colecao(COLECAO).docs, ctx.mundo.colecao(COLECAO).docs).inseridos;

/** Alguma ficha registrada desde que o memorando chegou tem todos estes campos com estes valores. */
export const registrou =
  (campos: Doc): Conferencia =>
  (ctx) =>
    inseridas(ctx).some((d) => Object.entries(campos).every(([k, v]) => canonico(d[k]) === canonico(v)));

/** Exatamente uma ficha nova, só com estes campos. */
export const umaFichaNovaSoCom =
  (campos: string[]): Conferencia =>
  (ctx) => {
    const novas = inseridas(ctx);
    return novas.length === 1 && chavesSemId(novas[0]) === [...campos].sort().join(',');
  };

/** Todas as gravações do memorando foram feitas num único comando, com este método. */
export const numUnicoComando =
  (metodo: string): Conferencia =>
  (ctx) => {
    const gravacoes = ctx.historicoMissao.filter((o) => o.colecao === COLECAO && /^(insert|update|replace|delete)/.test(o.metodo));
    return gravacoes.length === 1 && gravacoes[0].metodo === metodo;
  };

export const contagemNoArquivo =
  (condicao: (d: Doc) => boolean, quantidade: number): Conferencia =>
  (ctx) =>
    ctx.mundo.colecao(COLECAO).docs.filter(condicao).length === quantidade;
