/**
 * Validação de missões — sempre PELO EFEITO, nunca pelo texto da query.
 *
 *  - Consulta: roda a solução de referência numa cópia do mundo atual e compara os documentos
 *    (como conjunto; a ordem só importa quando o memorando pede ordenação).
 *  - Escrita: compara o que mudou no mundo desde que o memorando chegou com o que a solução de
 *    referência mudaria partindo do mesmo ponto.
 *
 * Toda falha vem com diagnóstico: quantos a mais/a menos e, se possível, o que eles têm em comum.
 */

import { canonico, ehObjetoSimples, tipoBson } from '../engine/bson';
import type { Database, RegistroOperacao } from '../engine/database';
import { Sessao } from '../engine/shell';
import { formatar } from '../engine/format';

type Doc = Record<string, unknown>;

export interface ResultadoValidacao {
  ok: boolean;
  motivo?: string;
}

export interface ContextoValidacao {
  /** Valor devolvido pelo último comando (cursores já materializados). */
  resultado: unknown;
  execucaoOk: boolean;
  operacoes: RegistroOperacao[];
  /** Todas as operações desde que o memorando chegou. */
  historicoMissao: RegistroOperacao[];
  mundoInicio: Database;
  mundo: Database;
  referencia(): { valor: unknown; mundo: Database; operacoes: RegistroOperacao[] };
}

export type Validador = (ctx: ContextoValidacao) => ResultadoValidacao;

export function montarContexto(p: {
  tipo: 'consulta' | 'escrita';
  codigoReferencia: string;
  anexo?: string;
  resultado: unknown;
  execucaoOk: boolean;
  operacoes: RegistroOperacao[];
  historicoMissao: RegistroOperacao[];
  mundoInicio: Database;
  mundo: Database;
}): ContextoValidacao {
  let cache: { valor: unknown; mundo: Database; operacoes: RegistroOperacao[] } | undefined;
  return {
    resultado: p.resultado,
    execucaoOk: p.execucaoOk,
    operacoes: p.operacoes,
    historicoMissao: p.historicoMissao,
    mundoInicio: p.mundoInicio,
    mundo: p.mundo,
    referencia() {
      if (!cache) {
        const base = (p.tipo === 'consulta' ? p.mundo : p.mundoInicio).clonar();
        const sessao = new Sessao(base);
        if (p.anexo) sessao.executar(p.anexo);
        const r = sessao.executar(p.codigoReferencia);
        cache = { valor: r.valor, mundo: base, operacoes: r.operacoes };
      }
      return cache;
    },
  };
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

const fichas = (n: number) => `${n} ficha${n === 1 ? '' : 's'}`;

function multiconjunto(lista: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of lista) {
    const c = canonico(item);
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}

/** Elementos de `a` que sobram depois de descontar `b` (respeitando repetições). */
function diferenca<T>(a: T[], b: T[]): T[] {
  const restante = multiconjunto(b);
  const saida: T[] = [];
  for (const item of a) {
    const c = canonico(item);
    const n = restante.get(c) ?? 0;
    if (n > 0) restante.set(c, n - 1);
    else saida.push(item);
  }
  return saida;
}

function camposDe(docs: unknown[]): string[] {
  const campos = new Set<string>();
  for (const d of docs) if (ehObjetoSimples(d)) Object.keys(d).forEach((k) => campos.add(k));
  return [...campos];
}

function resumoDaFicha(d: unknown): string {
  if (!ehObjetoSimples(d)) return formatar(d);
  if (typeof d.nome === 'string') return d.nome;
  if (typeof d.protocolo === 'string') return d.protocolo;
  return formatar(d);
}

/** Troca documentos projetados pelos completos (via _id), para diagnosticar melhor. */
function completar(docs: unknown[], mundo: Database, colecao: string): Doc[] {
  const porId = new Map(mundo.colecao(colecao).docs.map((d) => [canonico(d._id), d]));
  return docs.filter(ehObjetoSimples).map((d) => ('_id' in d ? porId.get(canonico(d._id)) ?? d : d));
}

const CAMPOS_IDENTIFICADORES = /^(protocolo|nome|endereco\.(rua|numero|cep))$/;

function achatar(doc: Doc): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id') continue;
    m.set(k, v);
    if (ehObjetoSimples(v)) for (const [k2, v2] of Object.entries(v)) m.set(`${k}.${k2}`, v2);
  }
  return m;
}

/**
 * Procura a característica que melhor separa um grupo (extras ou faltantes) do conjunto de
 * referência: um valor, um tipo ou a ausência de um campo.
 */
export function explicarGrupo(grupo: Doc[], referencia: Doc[]): string | undefined {
  if (!grupo.length) return undefined;
  const achatadosG = grupo.map(achatar);
  const achatadosR = referencia.map(achatar);
  const campos = new Set<string>();
  [...achatadosG, ...achatadosR].forEach((m) => m.forEach((_, k) => campos.add(k)));

  type Traco = { frase: (verbo: string) => string; teste: (m: Map<string, unknown>) => boolean };
  const tracos = new Map<string, Traco>();
  for (const m of achatadosG) {
    for (const campo of campos) {
      if (!m.has(campo)) {
        tracos.set(`ausente:${campo}`, { frase: (v) => `não ${v} o campo ${campo}`, teste: (x) => !x.has(campo) });
        continue;
      }
      const valor = m.get(campo);
      const tipo = tipoBson(valor);
      // Campos que identificam uma ficha só não explicam nada ("tem protocolo A-2008-0002").
      // Com poucas fichas no grupo, um texto em comum é coincidência; números (limites de faixa) ainda informam.
      const numerico = tipo === 'int' || tipo === 'double';
      if ((numerico || ((tipo === 'string' || tipo === 'bool') && grupo.length >= 3)) && !CAMPOS_IDENTIFICADORES.test(campo)) {
        const c = canonico(valor);
        tracos.set(`valor:${campo}:${c}`, { frase: (v) => `${v} ${campo}: ${formatar(valor)}`, teste: (x) => x.has(campo) && canonico(x.get(campo)) === c });
      }
      tracos.set(`tipo:${campo}:${tipo}`, { frase: (v) => `${v} ${campo} gravado como ${tipo}`, teste: (x) => x.has(campo) && tipoBson(x.get(campo)) === tipo });
    }
  }

  let melhor: { traco: Traco; pontos: number } | undefined;
  for (const t of tracos.values()) {
    const fracG = achatadosG.filter(t.teste).length / achatadosG.length;
    const fracR = achatadosR.length ? achatadosR.filter(t.teste).length / achatadosR.length : 0;
    const pontos = fracG - fracR;
    if (fracG >= 0.6 && pontos >= 0.4 && (!melhor || pontos > melhor.pontos)) melhor = { traco: t, pontos };
  }
  if (!melhor) return undefined;
  const todos = achatadosG.every((m) => melhor!.traco.teste(m));
  if (!todos) return `A maioria ${melhor.traco.frase('tem')}`;
  return grupo.length === 1 ? `Ela ${melhor.traco.frase('tem')}` : `Todas ${melhor.traco.frase('têm')}`;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export interface OpcoesConsulta {
  colecao: string;
  ordem?: boolean;
  /** Diagnóstico extra específico da missão, para os documentos a mais. */
  explicarExtras?: (extras: Doc[]) => string | undefined;
}

function descrever(v: unknown): string {
  if (v === undefined) return 'nada';
  if (v === null) return 'null (nenhuma ficha)';
  if (typeof v === 'number') return `um número (${v})`;
  if (typeof v === 'string') return `um texto (${formatar(v)})`;
  if (Array.isArray(v)) return `uma lista com ${fichas(v.length)}`;
  if (ehObjetoSimples(v)) return 'uma ficha só';
  return formatar(v);
}

export function compararResultado(obtido: unknown, esperado: unknown, opts: OpcoesConsulta & { mundo: Database }): ResultadoValidacao {
  if (ehObjetoSimples(obtido) && 'acknowledged' in obtido) {
    return { ok: false, motivo: 'O último comando foi uma gravação. Este memorando pede uma CONSULTA — rode o comando que devolve a resposta.' };
  }
  if (obtido === undefined) {
    return { ok: false, motivo: 'Nada para conferir ainda: rode uma consulta que devolva a resposta pedida.' };
  }

  // --- número (contagens)
  if (typeof esperado === 'number') {
    if (obtido === esperado) return { ok: true };
    if (typeof obtido === 'number') return { ok: false, motivo: `Você contou ${obtido}, mas não é esse o número. Revise o filtro.` };
    if (Array.isArray(obtido)) return { ok: false, motivo: `Você devolveu ${descrever(obtido)}. O memorando quer só o NÚMERO — use countDocuments.` };
    return { ok: false, motivo: `Você devolveu ${descrever(obtido)}; esperava um número.` };
  }

  // --- documento único (findOne)
  if (ehObjetoSimples(esperado)) {
    if (Array.isArray(obtido)) {
      if (obtido.length === 1 && canonico(obtido[0]) === canonico(esperado)) {
        return { ok: false, motivo: 'É a ficha certa, mas veio dentro de uma LISTA. O memorando quer o documento em si: findOne devolve a ficha, find devolve uma lista.' };
      }
      return { ok: false, motivo: `Você devolveu ${descrever(obtido)}. O memorando pede UMA ficha — use findOne.` };
    }
    if (!ehObjetoSimples(obtido)) return { ok: false, motivo: `Você devolveu ${descrever(obtido)}; esperava uma ficha.` };
    if (canonico(obtido) === canonico(esperado)) return { ok: true };
    if (canonico(obtido._id) !== canonico(esperado._id)) {
      return { ok: false, motivo: `Essa não é a ficha pedida: veio a de ${resumoDaFicha(obtido)}.` };
    }
    return { ok: false, motivo: `É a ficha certa, mas com campos diferentes. Esperado: ${camposDe([esperado]).join(', ')}. Veio: ${camposDe([obtido]).join(', ')}.` };
  }

  if (esperado === null) {
    return obtido === null ? { ok: true } : { ok: false, motivo: `Você devolveu ${descrever(obtido)}; o esperado é não encontrar nada (null).` };
  }

  // --- lista de documentos
  const lista = esperado as unknown[];
  if (!Array.isArray(obtido)) {
    if (typeof obtido === 'number') return { ok: false, motivo: `Você devolveu um número (${obtido}). O memorando pede as FICHAS, não a contagem.` };
    if (ehObjetoSimples(obtido)) return { ok: false, motivo: 'Você devolveu uma ficha só. O memorando pede TODAS as fichas que atendem ao pedido — use find.' };
    return { ok: false, motivo: `Você devolveu ${descrever(obtido)}; esperava uma lista de fichas.` };
  }

  const extras = diferenca(obtido, lista);
  const faltantes = diferenca(lista, obtido);
  if (!extras.length && !faltantes.length) {
    if (opts.ordem && obtido.some((d, i) => canonico(d) !== canonico(lista[i]))) {
      return { ok: false, motivo: 'As fichas estão certas, mas fora de ordem. Confira o sort: 1 é crescente, -1 é decrescente.' };
    }
    return { ok: true };
  }

  // Mesmas fichas, campos diferentes (erro de projeção).
  const idsObtidos = obtido.filter(ehObjetoSimples).map((d) => canonico(d._id));
  const idsEsperados = lista.filter(ehObjetoSimples).map((d) => canonico(d._id));
  const camposO = camposDe(obtido).sort();
  const camposE = camposDe(lista).sort();
  const mesmosIds = obtido.length === lista.length && idsObtidos.every((id) => id !== undefined) && canonico([...idsObtidos].sort()) === canonico([...idsEsperados].sort());
  if (obtido.length === lista.length && canonico(camposO) !== canonico(camposE) && (mesmosIds || !camposE.includes('_id') || !camposO.includes('_id'))) {
    return {
      ok: false,
      motivo: `A quantidade está certa (${fichas(obtido.length)}), mas os campos não. Esperado: ${camposE.join(', ') || '(nenhum)'}. Veio: ${camposO.join(', ')}.`,
    };
  }

  if (obtido.length === 0) {
    return { ok: false, motivo: `Nenhuma ficha voltou; esperava ${fichas(lista.length)}. Confira a grafia dos valores: maiúsculas, acentos e espaços contam.` };
  }

  if (opts.ordem && obtido.length === lista.length) {
    return {
      ok: false,
      motivo: `Você trouxe ${fichas(obtido.length)}, mas não são as esperadas. Confira o filtro, a direção do sort (1 crescente, −1 decrescente) e o valor do skip.`,
    };
  }

  const partes = [`Você retornou ${fichas(obtido.length)}, esperava ${lista.length}.`];
  const completosE = completar(lista, opts.mundo, opts.colecao);
  if (extras.length) {
    const completos = completar(extras, opts.mundo, opts.colecao);
    const especifico = opts.explicarExtras?.(completos);
    const geral = especifico ?? explicarGrupo(completos, completosE);
    partes.push(`${extras.length} não deveria${extras.length === 1 ? '' : 'm'} estar aí${geral ? `. ${geral}` : ''}.`);
  }
  if (faltantes.length) {
    const completos = completar(faltantes, opts.mundo, opts.colecao);
    const retornados = completar(obtido, opts.mundo, opts.colecao);
    const geral = explicarGrupo(completos, retornados);
    partes.push(`Falt${faltantes.length === 1 ? 'ou' : 'aram'} ${faltantes.length}${geral ? `. ${geral}` : ''}.`);
  }
  if (opts.ordem && extras.length && faltantes.length && extras.length === faltantes.length) {
    partes.push('Numa paginação, isso costuma ser skip ou limit com o valor errado.');
  }
  return { ok: false, motivo: partes.join(' ').replace(/\.\./g, '.') };
}

export function validarConsulta(opts: OpcoesConsulta): Validador {
  return (ctx) => compararResultado(ctx.resultado, ctx.referencia().valor, { ...opts, mundo: ctx.mundo });
}

// ---------------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------------

export interface Diff {
  inseridos: Doc[];
  removidos: Doc[];
  alterados: { antes: Doc; depois: Doc }[];
}

export function diffColecao(antes: Doc[], depois: Doc[]): Diff {
  const mapaAntes = new Map(antes.map((d) => [canonico(d._id), d]));
  const mapaDepois = new Map(depois.map((d) => [canonico(d._id), d]));
  const diff: Diff = { inseridos: [], removidos: [], alterados: [] };
  for (const [id, d] of mapaDepois) {
    const velho = mapaAntes.get(id);
    if (!velho) diff.inseridos.push(d);
    else if (canonico(velho) !== canonico(d)) diff.alterados.push({ antes: velho, depois: d });
  }
  for (const [id, d] of mapaAntes) if (!mapaDepois.has(id)) diff.removidos.push(d);
  return diff;
}

const semId = (d: Doc): Doc => {
  const { _id: _ignorado, ...resto } = d;
  return resto;
};

export interface OpcoesEscrita {
  colecao: string;
  /** Exige um método específico (ex.: "use UM insertMany"), conferido no histórico de operações. */
  exigirMetodo?: { metodo: string; mensagem: string };
}

const RECOMECAR = 'Se o arquivo ficou bagunçado, use “Reiniciar memorando” para voltar ao estado em que ele chegou.';

export function validarEscrita(opts: OpcoesEscrita): Validador {
  return (ctx) => {
    const inicio = ctx.mundoInicio.colecao(opts.colecao).docs;
    const obtido = diffColecao(inicio, ctx.mundo.colecao(opts.colecao).docs);
    const esperado = diffColecao(inicio, ctx.referencia().mundo.colecao(opts.colecao).docs);
    const partes: string[] = [];

    // Inserções: o _id gerado muda a cada execução, então comparamos sem ele.
    const insObtidos = obtido.inseridos.map(semId);
    const insEsperados = esperado.inseridos.map(semId);
    const faltam = diferenca(insEsperados, insObtidos);
    const sobram = diferenca(insObtidos, insEsperados);
    if (insEsperados.length && !insObtidos.length) {
      partes.push(`Nenhuma ficha nova foi registrada ainda; o memorando pede ${fichas(insEsperados.length)}.`);
    } else {
      const explicadas = new Set<Doc>();
      for (const s of sobram) {
        const gemea = faltam.find((f) => f.nome !== undefined && f.nome === s.nome);
        if (gemea) {
          const campos = [...new Set([...Object.keys(s), ...Object.keys(gemea)])].filter((k) => canonico(s[k]) !== canonico(gemea[k]));
          partes.push(`A ficha de ${resumoDaFicha(s)} foi registrada com diferenças em: ${campos.join(', ')}.`);
          explicadas.add(s).add(gemea);
        } else if (insEsperados.some((e) => canonico(e) === canonico(s))) {
          partes.push(`A ficha de ${resumoDaFicha(s)} foi registrada mais de uma vez.`);
          explicadas.add(s);
        }
      }
      const faltamSemExplicacao = faltam.filter((f) => !explicadas.has(f));
      const sobramSemExplicacao = sobram.filter((s) => !explicadas.has(s));
      if (faltamSemExplicacao.length) {
        partes.push(`Falta${faltamSemExplicacao.length === 1 ? '' : 'm'} registrar: ${faltamSemExplicacao.map(resumoDaFicha).join(', ')}.`);
      }
      if (sobramSemExplicacao.length) {
        partes.push(`Há ${fichas(sobramSemExplicacao.length)} registrada${sobramSemExplicacao.length === 1 ? '' : 's'} que o memorando não pediu: ${sobramSemExplicacao.map(resumoDaFicha).join(', ')}.`);
      }
    }

    // Remoções
    const remObtidos = new Set(obtido.removidos.map((d) => canonico(d._id)));
    const remEsperados = new Set(esperado.removidos.map((d) => canonico(d._id)));
    const remFaltam = esperado.removidos.filter((d) => !remObtidos.has(canonico(d._id)));
    const remSobram = obtido.removidos.filter((d) => !remEsperados.has(canonico(d._id)));
    if (remFaltam.length) partes.push(`Ainda falta remover ${fichas(remFaltam.length)}.`);
    if (remSobram.length) partes.push(`${fichas(remSobram.length)} foram removidas sem necessidade: ${remSobram.slice(0, 5).map(resumoDaFicha).join(', ')}.`);

    // Alterações
    const altObtidos = new Map(obtido.alterados.map((a) => [canonico(a.depois._id), canonico(a.depois)]));
    const altEsperados = new Map(esperado.alterados.map((a) => [canonico(a.depois._id), canonico(a.depois)]));
    let altErradas = 0;
    let altFaltam = 0;
    for (const [id, c] of altEsperados) {
      if (!altObtidos.has(id)) altFaltam++;
      else if (altObtidos.get(id) !== c) altErradas++;
    }
    const altSobram = [...altObtidos.keys()].filter((id) => !altEsperados.has(id)).length;
    if (altFaltam) partes.push(`Faltam alterar ${fichas(altFaltam)}.`);
    if (altErradas) partes.push(`${fichas(altErradas)} foram alteradas, mas não do jeito pedido.`);
    if (altSobram) partes.push(`${fichas(altSobram)} foram alteradas sem necessidade.`);

    if (partes.length) return { ok: false, motivo: `${partes.join(' ')} ${RECOMECAR}` };

    if (opts.exigirMetodo && !ctx.historicoMissao.some((o) => o.metodo === opts.exigirMetodo!.metodo && o.colecao === opts.colecao)) {
      return { ok: false, motivo: `${opts.exigirMetodo.mensagem} ${RECOMECAR}` };
    }
    return { ok: true };
  };
}
