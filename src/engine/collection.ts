/**
 * Coleção simulada: CRUD, aggregate e índices, aplicando validador e unicidade com a mesma
 * semântica do servidor (inclusive a falta de atomicidade do updateMany/insertMany).
 */

import { update as aplicarModificador } from 'mingo/updater';
import { ObjectId, canonico, clonar, ehObjetoSimples, lerCaminho, lerCaminhoExpandido, tipoBson } from './bson';
import {
  ErroShell,
  MongoBulkWriteError,
  MongoInvalidArgumentError,
  MongoServerError,
  erros,
  normalizarErro,
  type ResumoBulk,
} from './errors';
import { Indice, nomeDoIndice, type DefinicaoIndice } from './indexes';
import { criarAggregator, criarQuery, opcoesMingo, type ResolvedorColecao } from './mingoCtx';
import { explicarFalhas, validarSchema, type Schema } from './jsonSchema';
import { planejar } from './explain';
import { formatar } from './format';
import { CursorAgregacao, CursorFind, validarSort, type Documento, type ModificadoresFind } from './cursor';
import type { Database, RegistroOperacao } from './database';

export type NivelValidacao = 'strict' | 'moderate' | 'off';
export type AcaoValidacao = 'error' | 'warn';

export interface OpcoesColecao {
  validator?: Documento;
  validationLevel: NivelValidacao;
  validationAction: AcaoValidacao;
}

const OPERADORES_UPDATE = new Set([
  '$set', '$unset', '$inc', '$mul', '$rename', '$currentDate', '$min', '$max', '$setOnInsert',
  '$push', '$addToSet', '$pull', '$pullAll', '$pop', '$bit',
]);

const ESTAGIOS_UPDATE = new Set(['$addFields', '$set', '$project', '$unset', '$replaceRoot', '$replaceWith']);

// ---------------------------------------------------------------------------
// Validações de argumentos
// ---------------------------------------------------------------------------

function exigirObjeto(valor: unknown, nome: string): asserts valor is Documento {
  if (!ehObjetoSimples(valor)) {
    throw new MongoInvalidArgumentError(
      `Argument "${nome}" must be an object`,
      `O argumento "${nome}" precisa ser um objeto entre chaves { ... }.`,
    );
  }
}

export function validarProjecao(projecao: unknown): void {
  if (projecao === undefined) return;
  exigirObjeto(projecao, 'projection');
  let tipo: 'inclusao' | 'exclusao' | undefined;
  for (const [campo, v] of Object.entries(projecao)) {
    if (campo === '_id') continue;
    const atual = v === 0 || v === false ? 'exclusao' : 'inclusao';
    if (!tipo) tipo = atual;
    else if (tipo !== atual) throw erros.projecaoMista(campo, tipo === 'inclusao');
  }
}

function set(doc: Documento, caminho: string, valor: unknown) {
  const partes = caminho.split('.');
  let atual = doc;
  for (const p of partes.slice(0, -1)) {
    if (!ehObjetoSimples(atual[p])) atual[p] = {};
    atual = atual[p] as Documento;
  }
  atual[partes[partes.length - 1]] = clonar(valor);
}

/** Campos de igualdade do filtro viram o documento-base de um upsert. */
function igualdadesDoFiltro(filtro: Documento): Documento {
  const base: Documento = {};
  const visitar = (f: Documento) => {
    for (const [k, v] of Object.entries(f)) {
      if (k === '$and' && Array.isArray(v)) v.forEach((sub) => ehObjetoSimples(sub) && visitar(sub));
      if (k.startsWith('$')) continue;
      if (ehObjetoSimples(v) && Object.keys(v).some((c) => c.startsWith('$'))) {
        if ('$eq' in v) set(base, k, v.$eq);
      } else if (!(v instanceof RegExp)) {
        set(base, k, v);
      }
    }
  };
  visitar(filtro);
  return base;
}

function traduzirErroMingo(e: unknown): ErroShell {
  if (e instanceof ErroShell) return e;
  const msg = e instanceof Error ? e.message : String(e);
  let m: RegExpExecArray | null;
  if ((m = /updating the path '(.+?)' would create a conflict at '(.+?)'/i.exec(msg))) return erros.conflitoDeCaminho(m[1], m[2]);
  if (/include the array field for '\.\$'/.test(msg)) return erros.posicionalSemMatch();
  if (/\$concat expression must resolve to array of string/.test(msg)) {
    return new MongoServerError('PlanExecutor error during aggregation :: caused by :: $concat only supports strings', {
      code: 16702,
      codeName: 'Location16702',
      traducao: 'Todos os argumentos do $concat precisam ser texto. Converta números com { $toString: "$campo" }.',
    });
  }
  if (/\$size expression must resolve to/.test(msg)) {
    return new MongoServerError('PlanExecutor error during aggregation :: caused by :: The argument to $size must be an array', {
      code: 17124,
      codeName: 'Location17124',
      traducao: '$size só funciona com arrays. Algum documento tem esse campo ausente ou de outro tipo — use $ifNull ou filtre antes.',
    });
  }
  return normalizarErro(e);
}

// ---------------------------------------------------------------------------
// Coleção
// ---------------------------------------------------------------------------

export class Colecao {
  docs: Documento[] = [];
  readonly indices = new Map<string, Indice>();
  opcoes: OpcoesColecao = { validationLevel: 'strict', validationAction: 'error' };
  private validadorCompilado?: { test(d: unknown): boolean };

  constructor(
    readonly nome: string,
    private readonly db: Database,
  ) {
    this.criarIndiceInterno({ nome: '_id_', chave: { _id: 1 }, unico: true });
  }

  get ns(): string {
    return `${this.db.nome}.${this.nome}`;
  }

  private get resolver(): ResolvedorColecao {
    return (nome) => this.db.colecao(nome).docs;
  }

  private registrar(metodo: string, args: unknown[]): RegistroOperacao {
    while (args.length && args[args.length - 1] === undefined) args = args.slice(0, -1);
    return this.db.inspecionar({ colecao: this.nome, metodo, args });
  }

  // --- infraestrutura -------------------------------------------------------

  private criarIndiceInterno(def: DefinicaoIndice) {
    const idx = new Indice(def);
    this.docs.forEach((d) => idx.adicionar(d));
    this.indices.set(def.nome, idx);
  }

  definirOpcoes(opcoes: OpcoesColecao) {
    this.opcoes = opcoes;
    this.validadorCompilado = opcoes.validator ? criarQuery(opcoes.validator) : undefined;
  }

  private detalhesValidacao(doc: Documento): unknown {
    const validator = this.opcoes.validator!;
    const schema = validator.$jsonSchema as Schema | undefined;
    const details = schema
      ? { operatorName: '$jsonSchema', schemaRulesNotSatisfied: validarSchema(schema, doc) }
      : { operatorName: '$and', specifiedAs: validator, reason: 'query did not match' };
    return { failingDocumentId: doc._id, details };
  }

  /** Aplica validationLevel/validationAction. `antigo` existe quando é update/replace. */
  private verificarValidador(novo: Documento, antigo?: Documento) {
    const { validationLevel, validationAction } = this.opcoes;
    const v = this.validadorCompilado;
    if (!v || validationLevel === 'off') return;
    // moderate: documentos que JÁ eram inválidos podem ser atualizados livremente (legado).
    if (antigo && validationLevel === 'moderate' && !v.test(antigo)) return;
    if (v.test(novo)) return;

    const errInfo = this.detalhesValidacao(novo);
    const schema = this.opcoes.validator!.$jsonSchema as Schema | undefined;
    const explicacao = schema ? explicarFalhas(validarSchema(schema, novo)) : [];

    if (validationAction === 'warn') {
      this.db.registrarLog('W', 'STORAGE', 'Document would fail validation', {
        namespace: this.ns,
        document: { _id: novo._id },
        errInfo,
        explicacao,
      });
      return;
    }
    const erro = erros.falhaValidacao(errInfo);
    if (explicacao.length) erro.traducao += '\n' + explicacao.map((l) => `  • ${l}`).join('\n');
    throw erro;
  }

  private verificarUnicos(novo: Documento, antigo?: Documento) {
    for (const idx of this.indices.values()) {
      const valores = idx.conflito(novo, antigo);
      if (valores) throw erros.chaveDuplicada(this.ns, idx.def.nome, valores, formatar);
    }
  }

  private inserirInterno(doc: unknown): unknown {
    exigirObjeto(doc, 'doc');
    const novo: Documento = '_id' in doc ? clonar(doc) : { _id: new ObjectId(), ...clonar(doc) };
    this.verificarValidador(novo);
    this.verificarUnicos(novo);
    this.db.garantirRegistro(this);
    this.docs.push(novo);
    this.indices.forEach((idx) => idx.adicionar(novo));
    return novo._id;
  }

  private substituirInterno(posicao: number, novo: Documento) {
    const antigo = this.docs[posicao];
    this.verificarValidador(novo, antigo);
    this.verificarUnicos(novo, antigo);
    this.indices.forEach((idx) => idx.remover(antigo));
    this.docs[posicao] = novo;
    this.indices.forEach((idx) => idx.adicionar(novo));
  }

  private posicoesQueCasam(filtro: Documento, apenasUma: boolean): number[] {
    const q = this.compilarFiltro(filtro);
    const posicoes: number[] = [];
    for (let i = 0; i < this.docs.length; i++) {
      if (q.test(this.docs[i])) {
        posicoes.push(i);
        if (apenasUma) break;
      }
    }
    return posicoes;
  }

  private compilarFiltro(filtro: Documento) {
    try {
      return criarQuery(filtro, this.resolver);
    } catch (e) {
      throw traduzirErroMingo(e);
    }
  }

  private anotarPlano(registro: RegistroOperacao, filtro: Documento) {
    registro.plano = planejar(this.docs, filtro, this.indices.values());
  }

  // --- leitura ---------------------------------------------------------------

  find(filtro: unknown = {}, projecao?: unknown): CursorFind {
    const registro = this.registrar('find', [filtro, projecao]);
    exigirObjeto(filtro, 'filter');
    validarProjecao(projecao);
    const q = this.compilarFiltro(filtro);
    this.anotarPlano(registro, filtro);

    const executor = (mods: ModificadoresFind): Documento[] => {
      try {
        let docs = this.docs.filter((d) => q.test(d));
        if (mods.sort) docs = criarAggregator([{ $sort: mods.sort }]).run(docs) as Documento[];
        if (mods.skip) docs = docs.slice(mods.skip);
        if (mods.limit !== undefined) docs = docs.slice(0, mods.limit);
        if (projecao !== undefined) {
          docs = criarQuery({}, this.resolver).find(docs, projecao as Documento).all() as Documento[];
        }
        registro.resultado = docs.length;
        return docs.map(clonar);
      } catch (e) {
        throw traduzirErroMingo(e);
      }
    };
    return new CursorFind(executor, (metodo, args) => {
      this.db.inspecionar({ colecao: this.nome, metodo, args });
      registro.encadeamento = [...(registro.encadeamento ?? []), { metodo, args: clonar(args) }];
    });
  }

  findOne(filtro: unknown = {}, projecao?: unknown): Documento | null {
    const registro = this.registrar('findOne', [filtro, projecao]);
    exigirObjeto(filtro, 'filter');
    validarProjecao(projecao);
    this.anotarPlano(registro, filtro);
    const [pos] = this.posicoesQueCasam(filtro, true);
    if (pos === undefined) return null;
    const doc = this.docs[pos];
    if (projecao === undefined) return clonar(doc);
    return clonar(criarQuery({}).find([doc], projecao as Documento).all()[0] as Documento);
  }

  countDocuments(filtro: unknown = {}, opcoes: { skip?: number; limit?: number } = {}): number {
    const registro = this.registrar('countDocuments', [filtro, opcoes]);
    exigirObjeto(filtro, 'filter');
    this.anotarPlano(registro, filtro);
    let n = this.posicoesQueCasam(filtro, false).length;
    if (opcoes.skip) n = Math.max(0, n - opcoes.skip);
    if (opcoes.limit) n = Math.min(n, opcoes.limit);
    return n;
  }

  estimatedDocumentCount(): number {
    this.registrar('estimatedDocumentCount', []);
    return this.docs.length;
  }

  distinct(campo: unknown, filtro: unknown = {}): unknown[] {
    const registro = this.registrar('distinct', [campo, filtro]);
    if (typeof campo !== 'string') {
      throw new MongoInvalidArgumentError('Argument "key" must be a string', 'distinct recebe o nome do campo como texto: distinct("setor").');
    }
    exigirObjeto(filtro, 'filter');
    this.anotarPlano(registro, filtro);
    const vistos = new Map<string, unknown>();
    for (const pos of this.posicoesQueCasam(filtro, false)) {
      for (const v of lerCaminhoExpandido(this.docs[pos], campo)) {
        for (const item of Array.isArray(v) ? v : [v]) {
          if (item !== undefined) vistos.set(canonico(item), item);
        }
      }
    }
    const valores = [...vistos.values()].map(clonar);
    return criarAggregator([{ $sort: { v: 1 } }]).run(valores.map((v) => ({ v }))).map((d) => (d as Documento).v);
  }

  aggregate(pipeline: unknown, opcoes?: unknown): CursorAgregacao {
    const registro = this.registrar('aggregate', [pipeline, opcoes]);
    if (!Array.isArray(pipeline)) throw erros.pipelineNaoArray();

    pipeline.forEach((estagio) => {
      if (!ehObjetoSimples(estagio) || Object.keys(estagio).length !== 1) throw erros.estagioMalFormado();
      const [nome, valor] = Object.entries(estagio)[0];
      switch (nome) {
        case '$sort':
          validarSort(valor);
          break;
        case '$project':
          validarProjecao(valor);
          break;
        case '$limit':
          if (typeof valor !== 'number' || valor <= 0) {
            throw new MongoServerError('the limit must be positive', { code: 15958, codeName: 'Location15958', traducao: '$limit recebe um inteiro maior que zero.' });
          }
          break;
        case '$unwind': {
          const caminho = ehObjetoSimples(valor) ? valor.path : valor;
          if (typeof caminho !== 'string' || !caminho.startsWith('$')) {
            throw new MongoServerError(
              `path option to $unwind stage should be prefixed with a '$': ${String(caminho)}`,
              { code: 28818, codeName: 'Location28818', traducao: 'No $unwind o campo leva $ na frente: { $unwind: "$audiencias" }.' },
            );
          }
          break;
        }
        case '$out':
        case '$merge':
          throw new MongoServerError(`${nome} is not supported in this simulation`, {
            traducao: `${nome} grava o resultado em outra coleção. O arquivo do Departamento não permite isso — use insertMany com o resultado.`,
          });
      }
    });

    const primeiro = pipeline[0] as Documento | undefined;
    registro.plano =
      primeiro && ehObjetoSimples(primeiro.$match)
        ? planejar(this.docs, primeiro.$match, this.indices.values())
        : { estagio: 'COLLSCAN', docsExaminados: this.docs.length };

    try {
      const resultado = criarAggregator(pipeline as Documento[], this.resolver).run(this.docs) as Documento[];
      registro.resultado = resultado.length;
      return new CursorAgregacao(resultado.map(clonar));
    } catch (e) {
      throw traduzirErroMingo(e);
    }
  }

  // --- escrita ---------------------------------------------------------------

  insertOne(doc: unknown) {
    this.registrar('insertOne', [doc]);
    if (Array.isArray(doc)) {
      throw new MongoInvalidArgumentError('Argument "doc" must be an object', 'insertOne recebe UM documento. Para uma lista, use insertMany.');
    }
    const insertedId = this.inserirInterno(doc);
    return { acknowledged: true, insertedId };
  }

  insertMany(docs: unknown, opcoes: unknown = {}) {
    this.registrar('insertMany', [docs, opcoes]);
    if (!Array.isArray(docs)) {
      throw new MongoInvalidArgumentError(
        'Argument "docs" must be an array of documents',
        'insertMany recebe uma LISTA: insertMany([ {...}, {...} ]). Para um só documento, use insertOne.',
      );
    }
    exigirObjeto(opcoes, 'options');
    const ordenado = opcoes.ordered !== false;
    const resumo: ResumoBulk = { insertedCount: 0, insertedIds: {}, writeErrors: [] };
    let primeiroErro: ErroShell | undefined;

    for (let i = 0; i < docs.length; i++) {
      try {
        resumo.insertedIds[i] = this.inserirInterno(docs[i]);
        resumo.insertedCount++;
      } catch (e) {
        const erro = traduzirErroMingo(e);
        primeiroErro ??= erro;
        resumo.writeErrors.push({ index: i, code: erro.code ?? 2, errmsg: erro.message });
        // ordered (padrão): para no primeiro erro. ordered:false: tenta todos.
        if (ordenado) break;
      }
    }
    if (primeiroErro) throw new MongoBulkWriteError(primeiroErro, resumo);
    return { acknowledged: true, insertedIds: resumo.insertedIds };
  }

  private validarModificador(modificador: unknown, opcoes: Documento): Documento[] | Documento {
    if (Array.isArray(modificador)) {
      for (const estagio of modificador) {
        if (!ehObjetoSimples(estagio) || Object.keys(estagio).length !== 1) throw erros.estagioMalFormado();
        const nome = Object.keys(estagio)[0];
        if (!ESTAGIOS_UPDATE.has(nome)) {
          throw new MongoServerError(`${nome} is not allowed to be used within an update`, {
            code: 40324,
            codeName: 'Location40324',
            traducao: 'Update com pipeline aceita só $set/$addFields, $unset, $project, $replaceRoot e $replaceWith.',
          });
        }
      }
      return modificador as Documento[];
    }
    if (!ehObjetoSimples(modificador) || Object.keys(modificador).length === 0 || Object.keys(modificador).some((k) => !k.startsWith('$'))) {
      throw erros.updateSemOperador();
    }
    for (const [op, campos] of Object.entries(modificador)) {
      if (!OPERADORES_UPDATE.has(op)) {
        throw new MongoServerError(
          `Unknown modifier: ${op}. Expected a valid update modifier or pipeline-style update specified as an array`,
          { code: 9, codeName: 'FailedToParse', traducao: `${op} não é um operador de update. Os válidos: $set, $unset, $inc, $push...` },
        );
      }
      if (!ehObjetoSimples(campos)) {
        throw new MongoServerError(`Modifiers operate on fields but we found type ${tipoBson(campos)} instead.`, {
          code: 9,
          codeName: 'FailedToParse',
          traducao: `${op} recebe um objeto: { ${op}: { campo: valor } }.`,
        });
      }
    }

    // arrayFilters: todo $[apelido] precisa de filtro e todo filtro precisa ser usado.
    const usados = new Set<string>();
    for (const campos of Object.values(modificador)) {
      for (const caminho of Object.keys(campos as Documento)) {
        for (const m of caminho.matchAll(/\$\[(\w+)\]/g)) usados.add(m[1]);
        for (const m of caminho.matchAll(/\$\[(\w+)\]/g)) {
          const definidos = ((opcoes.arrayFilters as Documento[] | undefined) ?? []).map((f) => Object.keys(f)[0]?.split('.')[0]);
          if (!definidos.includes(m[1])) throw erros.arrayFilterAusente(m[1], caminho);
        }
      }
    }
    for (const f of (opcoes.arrayFilters as Documento[] | undefined) ?? []) {
      const id = Object.keys(f)[0]?.split('.')[0];
      if (id && !usados.has(id)) {
        throw new MongoServerError(`The array filter for identifier '${id}' was not used in the update`, {
          code: 9,
          codeName: 'FailedToParse',
          traducao: `Você definiu o apelido "${id}" em arrayFilters, mas não usou $[${id}] em nenhum caminho.`,
        });
      }
    }
    return modificador;
  }

  /** Aplica o update num clone e devolve o novo documento (sem gravar). */
  private calcularUpdate(antigo: Documento, modificador: Documento[] | Documento, filtro: Documento, opcoes: Documento, ehInsercao: boolean): Documento {
    if (Array.isArray(modificador)) {
      const [novo] = criarAggregator(modificador).run([clonar(antigo)]) as Documento[];
      if (canonico(novo._id) !== canonico(antigo._id)) throw erros.idImutavel();
      return novo;
    }

    // _id: só é permitido "setar" o mesmo valor (ou definir na inserção de um upsert).
    for (const [op, campos] of Object.entries(modificador)) {
      for (const [caminho, valor] of Object.entries(campos as Documento)) {
        if (caminho !== '_id' && !caminho.startsWith('_id.')) continue;
        if (op === '$setOnInsert' && ehInsercao) continue;
        if (op === '$set' && caminho === '_id' && canonico(valor) === canonico(antigo._id)) continue;
        throw erros.idImutavel();
      }
    }

    // Verificações que o mingo não faz (ele ignora silenciosamente).
    for (const op of ['$inc', '$mul'] as const) {
      for (const [caminho, valor] of Object.entries((modificador[op] as Documento | undefined) ?? {})) {
        if (typeof valor !== 'number') {
          throw new MongoServerError(`Cannot ${op === '$inc' ? 'increment' : 'multiply'} with non-numeric argument: {${caminho}: ${formatar(valor)}}`, {
            code: 14,
            codeName: 'TypeMismatch',
            traducao: `${op} precisa de um número como argumento.`,
          });
        }
        if (caminho.includes('$')) continue;
        const atual = lerCaminho(antigo, caminho);
        if (atual !== undefined && typeof atual !== 'number') {
          throw erros.tipoNaoNumerico(op, formatar(antigo._id), caminho, tipoBson(atual));
        }
      }
    }
    for (const op of ['$push', '$addToSet', '$pop', '$pull', '$pullAll'] as const) {
      for (const caminho of Object.keys((modificador[op] as Documento | undefined) ?? {})) {
        if (caminho.includes('$')) continue;
        const atual = lerCaminho(antigo, caminho);
        if (atual !== undefined && !Array.isArray(atual)) {
          throw new MongoServerError(
            `The field '${caminho}' must be an array but is of type ${tipoBson(atual)} in document {_id: ${formatar(antigo._id)}}`,
            { code: 2, codeName: 'BadValue', traducao: `${op} só funciona em arrays, e "${caminho}" é ${tipoBson(atual)} nesse documento.` },
          );
        }
      }
    }

    const efetivo: Documento = {};
    for (const [op, campos] of Object.entries(modificador)) {
      if (op === '$setOnInsert') {
        if (ehInsercao) efetivo.$set = { ...((efetivo.$set as Documento) ?? {}), ...(campos as Documento) };
        continue;
      }
      if (op === '$addToSet') {
        // O mingo duplica itens repetidos dentro de $each; o MongoDB não.
        const limpo: Documento = {};
        for (const [c, v] of Object.entries(campos as Documento)) {
          if (ehObjetoSimples(v) && Array.isArray(v.$each)) {
            const unicos = new Map(v.$each.map((item) => [canonico(item), item]));
            limpo[c] = { $each: [...unicos.values()] };
          } else limpo[c] = v;
        }
        efetivo.$addToSet = limpo;
        continue;
      }
      efetivo[op] = op === '$set' && efetivo.$set ? { ...(efetivo.$set as Documento), ...(campos as Documento) } : campos;
    }

    const novo = clonar(antigo);
    if (Object.keys(efetivo).length) {
      try {
        aplicarModificador(novo, efetivo, (opcoes.arrayFilters as Documento[]) ?? [], filtro, {
          cloneMode: 'deep',
          queryOptions: opcoesMingo(),
        });
      } catch (e) {
        throw traduzirErroMingo(e);
      }
    }
    if (canonico(novo._id) !== canonico(antigo._id)) throw erros.idImutavel();
    return novo;
  }

  private executarUpdate(metodo: 'updateOne' | 'updateMany', filtro: unknown, modificador: unknown, opcoes: unknown) {
    const registro = this.registrar(metodo, [filtro, modificador, opcoes]);
    exigirObjeto(filtro, 'filter');
    opcoes ??= {};
    exigirObjeto(opcoes, 'options');
    const mod = this.validarModificador(modificador, opcoes);
    this.anotarPlano(registro, filtro);

    const posicoes = this.posicoesQueCasam(filtro, metodo === 'updateOne');
    let modifiedCount = 0;
    for (const pos of posicoes) {
      const antigo = this.docs[pos];
      const novo = this.calcularUpdate(antigo, mod, filtro, opcoes, false);
      if (canonico(novo) === canonico(antigo)) continue;
      // Sem transação: se falhar no meio de um updateMany, o que já foi alterado fica.
      this.substituirInterno(pos, novo);
      modifiedCount++;
      registro.resultado = modifiedCount;
    }

    if (posicoes.length === 0 && opcoes.upsert === true) {
      const base = igualdadesDoFiltro(filtro);
      const semId = !('_id' in base);
      const provisorio = semId ? { _id: new ObjectId(), ...base } : base;
      const novo = this.calcularUpdate(provisorio, mod, {}, opcoes, true);
      const insertedId = this.inserirInterno(novo);
      return { acknowledged: true, insertedId, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    return { acknowledged: true, insertedId: null, matchedCount: posicoes.length, modifiedCount, upsertedCount: 0 };
  }

  updateOne(filtro: unknown, modificador: unknown, opcoes?: unknown) {
    return this.executarUpdate('updateOne', filtro, modificador, opcoes);
  }

  updateMany(filtro: unknown, modificador: unknown, opcoes?: unknown) {
    return this.executarUpdate('updateMany', filtro, modificador, opcoes);
  }

  replaceOne(filtro: unknown, substituto: unknown, opcoes: unknown = {}) {
    const registro = this.registrar('replaceOne', [filtro, substituto, opcoes]);
    exigirObjeto(filtro, 'filter');
    exigirObjeto(substituto, 'replacement');
    exigirObjeto(opcoes, 'options');
    if (Object.keys(substituto).some((k) => k.startsWith('$'))) throw erros.substituicaoComOperador();
    this.anotarPlano(registro, filtro);

    const [pos] = this.posicoesQueCasam(filtro, true);
    if (pos === undefined) {
      if (opcoes.upsert === true) {
        const base = igualdadesDoFiltro(filtro);
        const insertedId = this.inserirInterno({ ...('_id' in base ? { _id: base._id } : {}), ...substituto });
        return { acknowledged: true, insertedId, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      return { acknowledged: true, insertedId: null, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }
    const antigo = this.docs[pos];
    if ('_id' in substituto && canonico(substituto._id) !== canonico(antigo._id)) throw erros.idImutavel();
    const { _id: _ignorado, ...resto } = clonar(substituto);
    const novo: Documento = { _id: antigo._id, ...resto };
    const mudou = canonico(novo) !== canonico(antigo);
    if (mudou) this.substituirInterno(pos, novo);
    return { acknowledged: true, insertedId: null, matchedCount: 1, modifiedCount: mudou ? 1 : 0, upsertedCount: 0 };
  }

  private executarDelete(metodo: 'deleteOne' | 'deleteMany', filtro: unknown) {
    const registro = this.registrar(metodo, [filtro]);
    if (filtro === undefined) {
      throw new MongoInvalidArgumentError(
        `Missing required argument at position 0 (Collection.${metodo})`,
        `${metodo} exige um filtro. Para apagar tudo de propósito, passe {} explicitamente.`,
      );
    }
    exigirObjeto(filtro, 'filter');
    this.anotarPlano(registro, filtro);
    const posicoes = new Set(this.posicoesQueCasam(filtro, metodo === 'deleteOne'));
    const removidos = this.docs.filter((_, i) => posicoes.has(i));
    removidos.forEach((d) => this.indices.forEach((idx) => idx.remover(d)));
    this.docs = this.docs.filter((_, i) => !posicoes.has(i));
    registro.resultado = removidos.length;
    return { acknowledged: true, deletedCount: removidos.length };
  }

  deleteOne(filtro?: unknown) {
    return this.executarDelete('deleteOne', filtro);
  }

  deleteMany(filtro?: unknown) {
    return this.executarDelete('deleteMany', filtro);
  }

  // --- índices e ciclo de vida ----------------------------------------------

  createIndex(chave: unknown, opcoes: unknown = {}): string {
    this.registrar('createIndex', [chave, opcoes]);
    exigirObjeto(chave, 'keys');
    exigirObjeto(opcoes, 'options');
    if (Object.keys(chave).length === 0 || Object.values(chave).some((v) => v !== 1 && v !== -1)) {
      throw new MongoServerError('Values in the index key pattern can only be 1 or -1 in this simulation', {
        code: 67,
        codeName: 'CannotCreateIndex',
        traducao: 'Cada campo do índice recebe 1 (crescente) ou -1 (decrescente).',
      });
    }
    const nome = typeof opcoes.name === 'string' ? opcoes.name : nomeDoIndice(chave);
    const unico = opcoes.unique === true;
    const existente = this.indices.get(nome);
    if (existente) {
      if (canonico(existente.def.chave) === canonico(chave) && existente.def.unico === unico) return nome;
      throw new MongoServerError(`An existing index has the same name as the requested index. Requested index: ${nome}`, {
        code: 86,
        codeName: 'IndexKeySpecsConflict',
        traducao: 'Já existe um índice com esse nome e outra definição. Apague com dropIndex antes de recriar.',
      });
    }
    const idx = new Indice({ nome, chave: chave as Record<string, 1 | -1>, unico });
    for (const d of this.docs) {
      const valores = idx.conflito(d);
      if (valores) throw erros.chaveDuplicada(this.ns, nome, valores, formatar);
      idx.adicionar(d);
    }
    this.db.garantirRegistro(this);
    this.indices.set(nome, idx);
    this.db.registrarLog('I', 'INDEX', 'Index build: done', { namespace: this.ns, index: nome, unique: unico });
    return nome;
  }

  getIndexes() {
    this.registrar('getIndexes', []);
    return [...this.indices.values()].map((i) => ({ v: 2, key: clonar(i.def.chave), name: i.def.nome, ...(i.def.unico && i.def.nome !== '_id_' ? { unique: true } : {}) }));
  }

  dropIndex(nomeOuChave: unknown) {
    this.registrar('dropIndex', [nomeOuChave]);
    const nome = typeof nomeOuChave === 'string' ? nomeOuChave : ehObjetoSimples(nomeOuChave) ? nomeDoIndice(nomeOuChave) : '';
    if (nome === '_id_') {
      throw new MongoServerError('cannot drop _id index', { code: 72, codeName: 'InvalidOptions', traducao: 'O índice do _id é obrigatório e não pode ser removido.' });
    }
    if (!this.indices.delete(nome)) {
      throw new MongoServerError(`index not found with name [${nome}]`, { code: 27, codeName: 'IndexNotFound', traducao: 'Não existe índice com esse nome. Veja os existentes com getIndexes().' });
    }
    return { nIndexesWas: this.indices.size + 1, ok: 1 };
  }

  drop(): boolean {
    this.registrar('drop', []);
    return this.db.removerColecao(this.nome);
  }

  // --- persistência ---------------------------------------------------------

  definicoesDeIndice(): DefinicaoIndice[] {
    return [...this.indices.values()].map((i) => i.def).filter((d) => d.nome !== '_id_');
  }

  carregar(docs: Documento[], indices: DefinicaoIndice[], opcoes: OpcoesColecao) {
    this.docs = docs;
    this.indices.clear();
    this.criarIndiceInterno({ nome: '_id_', chave: { _id: 1 }, unico: true });
    indices.forEach((d) => this.criarIndiceInterno(d));
    this.definirOpcoes(opcoes);
  }
}
