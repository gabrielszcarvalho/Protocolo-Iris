/**
 * Objetivos conferíveis: cada item de "A entregar" no memorando tem sua própria verificação,
 * sempre pelo efeito (o que voltou da consulta ou o que mudou no arquivo), nunca pelo texto.
 * Ao protocolar, o jogador vê quais quadradinhos já estão certos.
 */

import { canonico, ehObjetoSimples, lerCaminho } from '../engine/bson';
import { criarQuery } from '../engine/mingoCtx';
import { validarSchema, type Schema } from '../engine/jsonSchema';
import { estagiosDoPipeline, operadoresDaOperacao } from '../engine/credenciais';
import type { Database, RegistroOperacao } from '../engine/database';
import type { EstadoCluster } from '../engine/cluster';
import { diffColecao, type ContextoValidacao, type ResultadoValidacao, type Validador } from './validacao';

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

/** Validador que exige todos os objetivos; a mensagem lista o que falta. */
export function validarPorObjetivos(objetivos: Objetivo[], antes?: Validador): Validador {
  return (ctx): ResultadoValidacao => {
    if (antes) {
      const r = antes(ctx);
      if (!r.ok) return r;
    }
    const faltando = objetivos.filter((o) => {
      try {
        return !o.conferir(ctx);
      } catch {
        return true;
      }
    });
    if (!faltando.length) return { ok: true };
    return { ok: false, motivo: `Ainda não confere: ${faltando.map((o) => `“${o.texto}”`).join('; ')}.` };
  };
}

// ---------------------------------------------------------------------------
// Leitura do resultado
// ---------------------------------------------------------------------------

function comoLista(valor: unknown): Doc[] | null {
  if (Array.isArray(valor)) return valor.filter(ehObjetoSimples);
  if (ehObjetoSimples(valor) && !('acknowledged' in valor)) return [valor];
  return null;
}

/**
 * Fichas completas que correspondem ao resultado. Com _id, busca no arquivo; sem _id (projeção
 * com _id: 0), refaz o filtro da última consulta — assim dá para conferir "são do Purgatório"
 * mesmo que o campo setor tenha sido escondido. Resultados de aggregate voltam como estão.
 */
function completas(valor: unknown, operacoes: RegistroOperacao[], mundo: Database, colecao: string): Doc[] | null {
  const docs = comoLista(valor);
  if (!docs) return null;
  const arquivo = mundo.colecao(colecao).docs;
  if (docs.every((d) => '_id' in d)) {
    const porId = new Map(arquivo.map((d) => [canonico(d._id), d]));
    return docs.map((d) => porId.get(canonico(d._id)) ?? d);
  }
  const consulta = [...operacoes].reverse().find((o) => (o.metodo === 'find' || o.metodo === 'findOne') && o.colecao === colecao);
  if (!consulta) return docs;
  try {
    const q = criarQuery((consulta.args[0] ?? {}) as Doc);
    const achadas = arquivo.filter((d) => q.test(d));
    return consulta.metodo === 'findOne' ? achadas.slice(0, 1) : achadas;
  } catch {
    return docs;
  }
}

const doJogador = (ctx: ContextoValidacao, colecao: string) => completas(ctx.resultado, ctx.operacoes, ctx.mundo, colecao);

const daReferencia = (ctx: ContextoValidacao, colecao: string) => {
  const ref = ctx.referencia();
  return completas(ref.valor, ref.operacoes, ref.mundo, colecao) ?? [];
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

/** A resposta está na mesma ordem da referência. */
export const ordemComoReferencia: Conferencia = (ctx) => {
  const ref = ctx.referencia().valor;
  return Array.isArray(ref) && Array.isArray(ctx.resultado) && ref.length > 0 && canonico(ref) === canonico(ctx.resultado);
};

export const mesmaQuantidade: Conferencia = (ctx) => {
  const ref = comoLista(ctx.referencia().valor);
  const obt = comoLista(ctx.resultado);
  return !!ref && !!obt && Array.isArray(ctx.resultado) && ref.length === obt.length;
};

/** Voltaram exatamente as fichas (ou grupos) esperados, independente dos campos mostrados. */
export const mesmasFichas = (colecao = 'almas'): Conferencia => (ctx) => {
  const obtidas = doJogador(ctx, colecao);
  if (!obtidas) return false;
  const a = ids(obtidas);
  const b = ids(daReferencia(ctx, colecao));
  return a.size === b.size && [...b].every((id) => a.has(id));
};

/** Nenhuma ficha esperada ficou de fora (pode haver extras). */
export const nenhumaDeFora = (colecao = 'almas'): Conferencia => (ctx) => {
  const obtidas = doJogador(ctx, colecao);
  if (!obtidas) return false;
  const a = ids(obtidas);
  return [...ids(daReferencia(ctx, colecao))].every((id) => a.has(id));
};

/** Voltou pelo menos um documento e todos satisfazem a condição. */
export const todasSao =
  (condicao: (d: Doc) => boolean, colecao = 'almas'): Conferencia =>
  (ctx) => {
    const obtidas = doJogador(ctx, colecao);
    return !!obtidas && obtidas.length > 0 && obtidas.every(condicao);
  };

/** Toda ficha do arquivo que satisfaz a condição está na resposta. */
export const incluiTodasQue =
  (condicao: (d: Doc) => boolean, colecao = 'almas'): Conferencia =>
  (ctx) => {
    const obtidas = doJogador(ctx, colecao);
    if (!obtidas) return false;
    const a = ids(obtidas);
    return ctx.mundo.colecao(colecao).docs.filter(condicao).every((d) => a.has(canonico(d._id)));
  };

export const algumaE =
  (condicao: (d: Doc) => boolean, colecao = 'almas'): Conferencia =>
  (ctx) =>
    !!doJogador(ctx, colecao)?.some(condicao);

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

const ordenarConjuntos = (d: Doc, conjuntos: string[]): Doc => {
  const copia = { ...d };
  for (const c of conjuntos) if (Array.isArray(copia[c])) copia[c] = [...(copia[c] as unknown[])].sort((x, y) => (canonico(x) < canonico(y) ? -1 : 1));
  return copia;
};

/**
 * Para resultados agrupados: cada documento da referência tem um correspondente (mesmo _id) com os
 * mesmos valores nestes campos. Campos em `conjuntos` são comparados sem considerar a ordem.
 */
export const valoresComoReferencia =
  (campos: string[], conjuntos: string[] = []): Conferencia =>
  (ctx) => {
    const ref = comoLista(ctx.referencia().valor) ?? [];
    const obt = comoLista(ctx.resultado);
    if (!obt || !ref.length) return false;
    const porId = new Map(obt.map((d) => [canonico(d._id), ordenarConjuntos(d, conjuntos)]));
    return ref.every((r) => {
      const o = porId.get(canonico(r._id));
      const rOrd = ordenarConjuntos(r, conjuntos);
      return !!o && campos.every((c) => canonico(lerCaminho(o, c)) === canonico(lerCaminho(rOrd, c)));
    });
  };

export const umDocumentoSo: Conferencia = (ctx) => ehObjetoSimples(ctx.resultado) && !('acknowledged' in ctx.resultado);

export const numeroCerto: Conferencia = (ctx) => typeof ctx.resultado === 'number' && ctx.resultado === ctx.referencia().valor;

export const ordenadaPor =
  (campo: string, direcao: 1 | -1, colecao = 'almas'): Conferencia =>
  (ctx) => {
    const obtidas = doJogador(ctx, colecao);
    if (!obtidas || obtidas.length < 2) return false;
    const valor = (d: Doc) => {
      const v = lerCaminho(d, campo);
      return v instanceof Date ? v.getTime() : (v as number | string);
    };
    return obtidas.every((d, i) => i === 0 || (direcao === 1 ? valor(obtidas[i - 1]) <= valor(d) : valor(obtidas[i - 1]) >= valor(d)));
  };

/** A última resposta satisfaz a condição (para formatos específicos). */
export const respostaE =
  (condicao: (valor: unknown) => boolean): Conferencia =>
  (ctx) => {
    try {
      return condicao(ctx.resultado);
    } catch {
      return false;
    }
  };

// ---------------------------------------------------------------------------
// Como a resposta foi obtida (AST das operações)
// ---------------------------------------------------------------------------

const ultimaOperacao = (ctx: ContextoValidacao, metodo?: string) => [...ctx.operacoes].reverse().find((o) => !metodo || o.metodo === metodo);

export const usouMetodo =
  (metodo: string): Conferencia =>
  (ctx) =>
    !!ultimaOperacao(ctx, metodo);

/** O último pipeline tem pelo menos `minimo` estágios com este nome. */
export const usouEstagio =
  (estagio: string, minimo = 1): Conferencia =>
  (ctx) => {
    const op = ultimaOperacao(ctx, 'aggregate');
    return !!op && estagiosDoPipeline(op).filter((e) => e === estagio).length >= minimo;
  };

export const usouOperador =
  (operador: string): Conferencia =>
  (ctx) => {
    const op = ultimaOperacao(ctx);
    return !!op && operadoresDaOperacao(op).includes(operador);
  };

function procurar(valor: unknown, teste: (chave: string, v: unknown, pai: unknown) => boolean, pai?: unknown): boolean {
  if (Array.isArray(valor)) return valor.some((v) => procurar(v, teste, valor));
  if (!ehObjetoSimples(valor)) return false;
  return Object.entries(valor).some(([k, v]) => teste(k, v, pai) || procurar(v, teste, valor));
}

/** $cond escrito na forma pedida: 'objeto' ({ if, then, else }), 'array' ([c, a, b]) ou 'aninhado'. */
export const condNaForma =
  (forma: 'objeto' | 'array' | 'aninhado'): Conferencia =>
  (ctx) => {
    const op = ultimaOperacao(ctx, 'aggregate');
    if (!op) return false;
    return procurar(op.args[0], (k, v) => {
      if (k !== '$cond') return false;
      if (forma === 'objeto') return ehObjetoSimples(v) && 'if' in v;
      if (forma === 'array') return Array.isArray(v);
      return procurar(v, (k2) => k2 === '$cond');
    });
  };

// ---------------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------------

const inseridas = (ctx: ContextoValidacao, colecao: string) => diffColecao(ctx.mundoInicio.colecao(colecao).docs, ctx.mundo.colecao(colecao).docs).inseridos;

/** Alguma ficha registrada desde que o memorando chegou tem todos estes campos com estes valores. */
export const registrou =
  (campos: Doc, colecao = 'almas'): Conferencia =>
  (ctx) =>
    inseridas(ctx, colecao).some((d) => Object.entries(campos).every(([k, v]) => canonico(d[k]) === canonico(v)));

/** Exatamente uma ficha nova, só com estes campos. */
export const umaFichaNovaSoCom =
  (campos: string[], colecao = 'almas'): Conferencia =>
  (ctx) => {
    const novas = inseridas(ctx, colecao);
    return novas.length === 1 && chavesSemId(novas[0]) === [...campos].sort().join(',');
  };

/** Todas as gravações do memorando foram feitas num único comando, com este método. */
export const numUnicoComando =
  (metodo: string, colecao = 'almas'): Conferencia =>
  (ctx) => {
    const gravacoes = ctx.historicoMissao.filter((o) => o.colecao === colecao && /^(insert|update|replace|delete)/.test(o.metodo));
    return gravacoes.length === 1 && gravacoes[0].metodo === metodo;
  };

export const contagemNoArquivo =
  (condicao: (d: Doc) => boolean, quantidade: number, colecao = 'almas'): Conferencia =>
  (ctx) =>
    ctx.mundo.colecao(colecao).docs.filter(condicao).length === quantidade;

/** Existe pelo menos um documento que casa com `quem`, e todos os que casam atendem à condição. */
export const fichasQue =
  (quem: (d: Doc) => boolean, condicao: (d: Doc) => boolean, colecao = 'almas'): Conferencia =>
  (ctx) => {
    const docs = ctx.mundo.colecao(colecao).docs.filter(quem);
    return docs.length > 0 && docs.every(condicao);
  };

/** Nenhum documento do arquivo atende à condição. */
export const nenhumaNoArquivo =
  (condicao: (d: Doc) => boolean, colecao = 'almas'): Conferencia =>
  (ctx) =>
    !ctx.mundo.colecao(colecao).docs.some(condicao);

/**
 * Os documentos que, NO INÍCIO do memorando, atendiam a `quem` estão com os mesmos valores
 * que a solução de referência deixaria nestes campos.
 */
export const camposComoNaReferencia =
  (quem: (d: Doc) => boolean, campos: string[], colecao = 'almas'): Conferencia =>
  (ctx) => {
    const alvos = ctx.mundoInicio.colecao(colecao).docs.filter(quem);
    const ref = new Map(ctx.referencia().mundo.colecao(colecao).docs.map((d) => [canonico(d._id), d]));
    const atual = new Map(ctx.mundo.colecao(colecao).docs.map((d) => [canonico(d._id), d]));
    return (
      alvos.length > 0 &&
      alvos.every((d) => {
        const r = ref.get(canonico(d._id));
        const a = atual.get(canonico(d._id));
        return !!a && campos.every((c) => canonico(lerCaminho(a, c)) === canonico(r ? lerCaminho(r, c) : undefined));
      })
    );
  };

/** Documentos que no início atendiam a `quem` continuam exatamente iguais. */
export const intactas =
  (quem: (d: Doc) => boolean, colecao = 'almas'): Conferencia =>
  (ctx) => {
    const atual = new Map(ctx.mundo.colecao(colecao).docs.map((d) => [canonico(d._id), canonico(d)]));
    return ctx.mundoInicio
      .colecao(colecao)
      .docs.filter(quem)
      .every((d) => atual.get(canonico(d._id)) === canonico(d));
  };

/** Quantos documentos foram removidos desde o início do memorando. */
export const removidas =
  (quantidade: number, colecao = 'almas'): Conferencia =>
  (ctx) =>
    diffColecao(ctx.mundoInicio.colecao(colecao).docs, ctx.mundo.colecao(colecao).docs).removidos.length === quantidade;

export const colecaoExiste =
  (nome: string, existe = true): Conferencia =>
  (ctx) =>
    ctx.mundo.existe(nome) === existe;

export const historicoTem =
  (condicao: (op: RegistroOperacao) => boolean): Conferencia =>
  (ctx) =>
    ctx.historicoMissao.some(condicao);

export const usouUpsert: Conferencia = (ctx) =>
  ctx.historicoMissao.some((o) => /^(update|replace)/.test(o.metodo) && o.args.some((a) => ehObjetoSimples(a) && a.upsert === true));

// ---------------------------------------------------------------------------
// Validação de schema (sondas comportamentais)
// ---------------------------------------------------------------------------

export type ResultadoSonda = 'aceito' | 'recusado' | 'duplicado' | 'aviso';

/** Tenta gravar os documentos numa cópia do mundo e diz o que o servidor fez com o último. */
export function sondar(mundo: Database, colecao: string, docs: Doc[]): ResultadoSonda {
  const copia = mundo.clonar();
  const avisosAntes = copia.log.length;
  let resultado: ResultadoSonda = 'aceito';
  docs.forEach((doc, i) => {
    try {
      copia.colecao(colecao).insertOne(doc);
      if (i === docs.length - 1) resultado = copia.log.slice(avisosAntes).some((l) => l.s === 'W') ? 'aviso' : 'aceito';
    } catch (e) {
      if (i === docs.length - 1) resultado = (e as { code?: number }).code === 11000 ? 'duplicado' : 'recusado';
    }
  });
  return resultado;
}

/** Remoções iguais às da solução de referência (quantidade). */
export const removidasComoNaReferencia =
  (colecao = 'almas'): Conferencia =>
  (ctx) => {
    const inicio = ctx.mundoInicio.colecao(colecao).docs;
    return diffColecao(inicio, ctx.mundo.colecao(colecao).docs).removidos.length === diffColecao(inicio, ctx.referencia().mundo.colecao(colecao).docs).removidos.length;
  };

export const aceita =
  (colecao: string, ...docs: Doc[]): Conferencia =>
  (ctx) =>
    ctx.mundo.existe(colecao) && sondar(ctx.mundo, colecao, docs) === 'aceito';

export const recusa =
  (colecao: string, ...docs: Doc[]): Conferencia =>
  (ctx) =>
    ctx.mundo.existe(colecao) && sondar(ctx.mundo, colecao, docs) === 'recusado';

export const recusaDuplicado =
  (colecao: string, ...docs: Doc[]): Conferencia =>
  (ctx) =>
    ctx.mundo.existe(colecao) && sondar(ctx.mundo, colecao, docs) === 'duplicado';

export const aceitaComAviso =
  (colecao: string, ...docs: Doc[]): Conferencia =>
  (ctx) =>
    ctx.mundo.existe(colecao) && sondar(ctx.mundo, colecao, docs) === 'aviso';

export const opcoesDaColecao =
  (colecao: string, esperado: { validationLevel?: string; validationAction?: string }): Conferencia =>
  (ctx) => {
    if (!ctx.mundo.existe(colecao)) return false;
    const o = ctx.mundo.colecao(colecao).opcoes;
    return (!esperado.validationLevel || o.validationLevel === esperado.validationLevel) && (!esperado.validationAction || o.validationAction === esperado.validationAction);
  };

export const temValidador =
  (colecao: string): Conferencia =>
  (ctx) =>
    ctx.mundo.existe(colecao) && !!ctx.mundo.colecao(colecao).opcoes.validator;

export const indiceUnicoEm =
  (colecao: string, campo: string): Conferencia =>
  (ctx) =>
    ctx.mundo.existe(colecao) && ctx.mundo.colecao(colecao).definicoesDeIndice().some((d) => d.unico && Object.keys(d.chave)[0] === campo);

export const semViolacoes =
  (colecao: string, norma: { $jsonSchema: Schema }): Conferencia =>
  (ctx) =>
    ctx.mundo.colecao(colecao).docs.every((d) => validarSchema(norma.$jsonSchema, d).length === 0);

export const logTem =
  (mensagem: string): Conferencia =>
  (ctx) =>
    ctx.mundo.log.some((l) => l.msg === mensagem);

// ---------------------------------------------------------------------------
// Diretoria (cluster simulado)
// ---------------------------------------------------------------------------

export const noCluster =
  (condicao: (c: EstadoCluster) => boolean): Conferencia =>
  (ctx) => {
    try {
      return condicao(ctx.mundo.cluster);
    } catch {
      return false;
    }
  };
