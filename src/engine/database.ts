/**
 * Banco "iris": registro de coleções, comandos administrativos (createCollection, collMod),
 * log do servidor e histórico de operações (a matéria-prima das missões).
 */

import { clonar, deEJSON, ehObjetoSimples, paraEJSON } from './bson';
import { Colecao, type AcaoValidacao, type NivelValidacao, type OpcoesColecao } from './collection';
import { erros } from './errors';
import type { Operacao } from './credenciais';
import { clusterInicial, type EstadoCluster } from './cluster';
import { criarQuery } from './mingoCtx';
import type { Plano } from './explain';
import type { DefinicaoIndice } from './indexes';
import type { Documento } from './cursor';

export interface EntradaLog {
  t: Date;
  s: 'I' | 'W' | 'E';
  c: string;
  msg: string;
  attr?: unknown;
}

export interface RegistroOperacao extends Operacao {
  quando: number;
  plano?: Plano;
  resultado?: number;
  encadeamento?: { metodo: string; args: unknown[] }[];
  /** codeName do erro, quando a operação falhou (ex.: DocumentValidationFailure). */
  erro?: string;
}

export interface SnapshotBanco {
  versao: 1;
  colecoes: { nome: string; docs: unknown; indices: DefinicaoIndice[]; opcoes: unknown }[];
  cluster?: EstadoCluster;
}

const NIVEIS: NivelValidacao[] = ['strict', 'moderate', 'off'];
const ACOES: AcaoValidacao[] = ['error', 'warn'];

export class Database {
  readonly nome = 'iris';
  private readonly colecoes = new Map<string, Colecao>();
  readonly log: EntradaLog[] = [];
  readonly historico: RegistroOperacao[] = [];
  /** Infraestrutura simulada (replica set, sharding, decisões da Diretoria). */
  cluster: EstadoCluster = clusterInicial();
  /**
   * Gancho do jogo: lança erro (ex.: CredencialError) se a operação não for permitida.
   * Sem verificador, tudo é permitido.
   */
  verificador?: (op: Operacao) => void;

  // --- infraestrutura -------------------------------------------------------

  /** Chamado no início de toda operação: checa permissão e registra no histórico. */
  inspecionar(op: Operacao): RegistroOperacao {
    this.verificador?.(op);
    const registro: RegistroOperacao = { ...op, args: clonar(op.args), quando: Date.now() };
    this.historico.push(registro);
    return registro;
  }

  registrarLog(s: EntradaLog['s'], c: string, msg: string, attr?: unknown) {
    this.log.push({ t: new Date(), s, c, msg, attr: clonar(attr) });
  }

  /** Coleção existente ou uma "virtual" que passa a existir na primeira escrita. */
  colecao(nome: string): Colecao {
    return this.colecoes.get(nome) ?? new Colecao(nome, this);
  }

  garantirRegistro(col: Colecao) {
    if (this.colecoes.get(col.nome) === col) return;
    if (!this.colecoes.has(col.nome)) this.colecoes.set(col.nome, col);
  }

  removerColecao(nome: string): boolean {
    return this.colecoes.delete(nome);
  }

  existe(nome: string): boolean {
    return this.colecoes.has(nome);
  }

  // --- API do shell --------------------------------------------------------

  getName(): string {
    return this.nome;
  }

  getCollection(nome: string): Colecao {
    this.inspecionar({ metodo: 'getCollection', args: [nome] });
    return this.colecao(nome);
  }

  getCollectionNames(): string[] {
    this.inspecionar({ metodo: 'getCollectionNames', args: [] });
    return [...this.colecoes.keys()].sort();
  }

  getCollectionInfos(filtro: Documento = {}) {
    this.inspecionar({ metodo: 'getCollectionInfos', args: [filtro] });
    const infos = [...this.colecoes.values()].map((c) => ({
      name: c.nome,
      type: 'collection',
      options: c.opcoes.validator
        ? { validator: clonar(c.opcoes.validator), validationLevel: c.opcoes.validationLevel, validationAction: c.opcoes.validationAction }
        : {},
    }));
    const q = criarQuery(filtro);
    return infos.filter((i) => q.test(i)).sort((a, b) => a.name.localeCompare(b.name));
  }

  private lerOpcoesDeValidacao(entrada: Documento, base: OpcoesColecao): OpcoesColecao {
    const opcoes = { ...base };
    if ('validator' in entrada) {
      if (!ehObjetoSimples(entrada.validator)) {
        throw erros.valorInvalido("'validator' must be an object", 'validator recebe um objeto: { $jsonSchema: { ... } }.');
      }
      // Compilar já aqui faz erros de schema (ex.: "minlength") aparecerem na criação.
      criarQuery(entrada.validator);
      opcoes.validator = Object.keys(entrada.validator).length ? clonar(entrada.validator) : undefined;
    }
    if ('validationLevel' in entrada) {
      if (!NIVEIS.includes(entrada.validationLevel as NivelValidacao)) {
        throw erros.valorInvalido(
          `Enumeration value '${String(entrada.validationLevel)}' for field 'validationLevel' is not a valid value.`,
          'validationLevel aceita "strict", "moderate" ou "off".',
        );
      }
      opcoes.validationLevel = entrada.validationLevel as NivelValidacao;
    }
    if ('validationAction' in entrada) {
      if (!ACOES.includes(entrada.validationAction as AcaoValidacao)) {
        throw erros.valorInvalido(
          `Enumeration value '${String(entrada.validationAction)}' for field 'validationAction' is not a valid value.`,
          'validationAction aceita "error" ou "warn".',
        );
      }
      opcoes.validationAction = entrada.validationAction as AcaoValidacao;
    }
    return opcoes;
  }

  createCollection(nome: unknown, opcoes: unknown = {}) {
    this.inspecionar({ metodo: 'createCollection', args: [nome, opcoes] });
    if (typeof nome !== 'string' || !nome || nome.includes('$')) {
      throw erros.valorInvalido(`Invalid collection name: ${String(nome)}`, 'O nome da coleção é um texto sem $: createCollection("protocolos").');
    }
    if (!ehObjetoSimples(opcoes)) throw erros.valorInvalido("'options' must be an object", 'As opções são um objeto: { validator: ... }.');
    if (this.colecoes.has(nome)) throw erros.colecaoJaExiste(`${this.nome}.${nome}`);
    const col = new Colecao(nome, this);
    col.definirOpcoes(this.lerOpcoesDeValidacao(opcoes, col.opcoes));
    this.colecoes.set(nome, col);
    this.registrarLog('I', 'STORAGE', 'createCollection', { namespace: `${this.nome}.${nome}`, options: opcoes });
    return { ok: 1 };
  }

  runCommand(comando: unknown) {
    this.inspecionar({ metodo: 'runCommand', args: [comando] });
    if (!ehObjetoSimples(comando) || !Object.keys(comando).length) {
      throw erros.valorInvalido('runCommand requires a command document', 'runCommand recebe um objeto: db.runCommand({ collMod: "protocolos", ... }).');
    }
    const [nomeComando] = Object.keys(comando);
    switch (nomeComando) {
      case 'ping':
        return { ok: 1 };
      case 'collMod': {
        const alvo = comando.collMod;
        const col = typeof alvo === 'string' ? this.colecoes.get(alvo) : undefined;
        if (!col) throw erros.colecaoInexistente();
        const anterior = clonar(col.opcoes);
        // Atenção didática: "validator" SUBSTITUI o validador inteiro. Não há merge.
        col.definirOpcoes(this.lerOpcoesDeValidacao(comando, col.opcoes));
        this.registrarLog('I', 'COMMAND', 'collMod', {
          namespace: col.ns,
          validadorAnterior: anterior.validator ?? null,
          validadorNovo: col.opcoes.validator ?? null,
          validationLevel: col.opcoes.validationLevel,
          validationAction: col.opcoes.validationAction,
        });
        return { ok: 1 };
      }
      case 'create': {
        const { create, ...resto } = comando;
        return this.createCollection(create, resto);
      }
      case 'drop': {
        const existia = typeof comando.drop === 'string' && this.removerColecao(comando.drop);
        if (!existia) throw erros.colecaoInexistente();
        return { ok: 1 };
      }
      case 'listCollections':
        return { cursor: { firstBatch: this.getCollectionInfos() }, ok: 1 };
      default:
        throw erros.comandoDesconhecido(nomeComando);
    }
  }

  dropDatabase() {
    this.inspecionar({ metodo: 'dropDatabase', args: [] });
    this.colecoes.clear();
    return { ok: 1, dropped: this.nome };
  }

  // --- estado do mundo ------------------------------------------------------

  nomesDasColecoes(): string[] {
    return [...this.colecoes.keys()].sort();
  }

  /** Cópia profunda independente — usada para mundoAntes/mundoDepois e para o sandbox. */
  clonar(): Database {
    // O verificador NÃO é copiado: clones servem para simulação e soluções de referência.
    const copia = new Database();
    copia.cluster = clonar(this.cluster);
    for (const [nome, col] of this.colecoes) {
      const nova = new Colecao(nome, copia);
      nova.carregar(col.docs.map(clonar), col.definicoesDeIndice().map(clonar), clonar(col.opcoes));
      copia.colecoes.set(nome, nova);
    }
    return copia;
  }

  snapshot(): SnapshotBanco {
    return {
      versao: 1,
      colecoes: [...this.colecoes.values()].map((c) => ({
        nome: c.nome,
        docs: paraEJSON(c.docs),
        indices: c.definicoesDeIndice(),
        opcoes: paraEJSON(c.opcoes),
      })),
      cluster: clonar(this.cluster),
    };
  }

  static restaurar(snap: SnapshotBanco): Database {
    const db = new Database();
    if (snap.cluster) db.cluster = { ...clusterInicial(), ...clonar(snap.cluster) };
    for (const c of snap.colecoes) {
      const col = new Colecao(c.nome, db);
      col.carregar(deEJSON(c.docs) as Documento[], c.indices, deEJSON(c.opcoes) as OpcoesColecao);
      db.colecoes.set(c.nome, col);
    }
    return db;
  }
}
