/**
 * O terminal: recebe o texto digitado pelo jogador e executa como o mongosh executaria.
 *
 * Como funciona o "escopo controlado":
 *  - o código roda dentro de `with (escopo) { ... }`, onde `escopo` é um Proxy que diz "tenho"
 *    para QUALQUER identificador. Assim `window`, `globalThis`, `fetch`, `document` nunca chegam
 *    ao escopo global: ou estão na lista de permitidos (db, ISODate, Math...), ou viram
 *    ReferenceError, igual a um shell sem essas variáveis.
 *  - `this` é um objeto vazio congelado.
 * Isto NÃO é uma sandbox de segurança (JS no navegador sempre pode escapar); é um limite de
 * conveniência para um jogo local, sem rede e sem dados sensíveis.
 *
 * Variáveis sobrevivem entre comandos (`const x = db.almas.findOne()` e depois `x.nome`), como
 * no mongosh: declarações no nível de cima viram atribuições no escopo da sessão.
 */

import { ISODate, NumberDecimal, NumberInt, NumberLong, ObjectId } from './bson';
import { CursorBase, type Documento } from './cursor';
import { ErroShell, MongoBulkWriteError, normalizarErro } from './errors';
import { formatar } from './format';
import type { Colecao } from './collection';
import { criarApisDoCluster } from './cluster';
import type { Database, RegistroOperacao } from './database';

export interface LinhaSaida {
  tipo: 'resultado' | 'print' | 'erro' | 'info';
  texto: string;
  traducao?: string;
}

export interface ResultadoExecucao {
  ok: boolean;
  saida: LinhaSaida[];
  /** Valor da última expressão. Cursores chegam aqui já materializados (array completo). */
  valor: unknown;
  erro?: ErroShell;
  operacoes: RegistroOperacao[];
  limparTela?: boolean;
}

const METODOS_COLECAO = [
  'insertOne', 'insertMany', 'find', 'findOne', 'countDocuments', 'estimatedDocumentCount', 'distinct',
  'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'aggregate',
  'createIndex', 'getIndexes', 'dropIndex', 'drop',
] as const;

const AJUDA = [
  'Comandos do terminal do Departamento:',
  '  show collections          lista as coleções',
  '  db.<colecao>.find(...)    consulta documentos',
  '  it                        mostra os próximos 20 resultados',
  '  cls                       limpa a tela',
  '  Ctrl+Enter executa · ↑/↓ navega no histórico · Ctrl+K abre o Manual',
].join('\n');

// ---------------------------------------------------------------------------
// Divisão do código em instruções (para capturar o valor da última expressão)
// ---------------------------------------------------------------------------

const PALAVRAS_ANTES_DE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof']);
const CONTINUA_SE_TERMINA_COM = /[,{[(=+\-*/%&|?:.!<>~^]$|=>$/;
const CONTINUA_SE_COMECA_COM = /^[.)\]},?:+\-*/%&|=<>]/;

/**
 * Divide o código em instruções de nível superior. Respeita strings, template literals,
 * comentários e literais de regex (que é onde um splitter ingênuo quebra: `/a;b/`).
 */
export function dividirInstrucoes(codigo: string): string[] {
  const instrucoes: string[] = [];
  let inicio = 0;
  let profundidade = 0;
  let ultimoSignificativo = ''; // último caractere não-branco fora de comentário
  let ultimaPalavra = '';
  const pilhaTemplate: number[] = []; // profundidade em que cada `${` foi aberto

  const empurrar = (fim: number) => {
    const trecho = codigo.slice(inicio, fim).trim();
    if (trecho) instrucoes.push(trecho);
    inicio = fim + 1;
  };

  let i = 0;
  const n = codigo.length;
  while (i < n) {
    const c = codigo[i];
    const prox = codigo[i + 1];

    // comentários
    if (c === '/' && prox === '/') {
      while (i < n && codigo[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && prox === '*') {
      const fim = codigo.indexOf('*/', i + 2);
      i = fim === -1 ? n : fim + 2;
      continue;
    }

    // strings simples
    if (c === '"' || c === "'") {
      i++;
      while (i < n && codigo[i] !== c && codigo[i] !== '\n') i += codigo[i] === '\\' ? 2 : 1;
      i++;
      ultimoSignificativo = c;
      ultimaPalavra = '';
      continue;
    }

    // template literal (com ${ } aninhado)
    if (c === '`' || (c === '}' && pilhaTemplate.length && pilhaTemplate[pilhaTemplate.length - 1] === profundidade)) {
      if (c === '}') pilhaTemplate.pop();
      i++;
      while (i < n && codigo[i] !== '`') {
        if (codigo[i] === '\\') {
          i += 2;
          continue;
        }
        if (codigo[i] === '$' && codigo[i + 1] === '{') {
          pilhaTemplate.push(profundidade);
          i += 2;
          break;
        }
        i++;
      }
      if (codigo[i - 1] !== '{' || codigo[i - 2] !== '$') i++; // fechou com `
      ultimoSignificativo = '`';
      ultimaPalavra = '';
      continue;
    }

    // literal de regex
    if (c === '/' && (ultimoSignificativo === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(ultimoSignificativo) || PALAVRAS_ANTES_DE_REGEX.has(ultimaPalavra))) {
      i++;
      let classe = false;
      while (i < n && codigo[i] !== '\n') {
        const r = codigo[i];
        if (r === '\\') {
          i += 2;
          continue;
        }
        if (r === '[') classe = true;
        else if (r === ']') classe = false;
        else if (r === '/' && !classe) break;
        i++;
      }
      i++;
      while (i < n && /[a-z]/i.test(codigo[i])) i++;
      ultimoSignificativo = '/';
      ultimaPalavra = '';
      continue;
    }

    if (c === '(' || c === '[' || c === '{') profundidade++;
    else if (c === ')' || c === ']' || c === '}') profundidade--;

    if (profundidade === 0 && c === ';') {
      empurrar(i);
      ultimoSignificativo = '';
      ultimaPalavra = '';
      i++;
      continue;
    }

    if (profundidade === 0 && c === '\n') {
      const resto = codigo.slice(i + 1).replace(/^(\s|\/\/[^\n]*\n?)*/, '');
      const antes = codigo.slice(inicio, i).replace(/\/\/[^\n]*$/, '').trimEnd();
      if (!antes.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').trim()) {
        // até aqui só havia comentário/linha em branco: descarta em vez de grudar na próxima instrução
        inicio = i + 1;
        i++;
        continue;
      }
      if (resto && !CONTINUA_SE_TERMINA_COM.test(antes) && !CONTINUA_SE_COMECA_COM.test(resto)) {
        empurrar(i);
        ultimoSignificativo = '';
        ultimaPalavra = '';
        i++;
        continue;
      }
    }

    if (!/\s/.test(c)) {
      if (/[\w$]/.test(c)) {
        ultimaPalavra = /[\w$]/.test(ultimoSignificativo) ? ultimaPalavra + c : c;
      } else {
        ultimaPalavra = '';
      }
      ultimoSignificativo = c;
    }
    i++;
  }
  empurrar(n);
  return instrucoes.filter((s) => s.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').trim());
}

const NAO_EH_EXPRESSAO = /^(const|let|var|if|for|while|do|switch|try|function|class|return|throw|break|continue|import|export)\b|^\{/;
const DECLARACAO_SIMPLES = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/;

function montarCorpo(instrucoes: string[], capturarUltima: boolean): string {
  const partes = instrucoes.map((s, idx) => {
    // declarações no topo viram atribuições no escopo da sessão (persistem entre comandos)
    const decl = DECLARACAO_SIMPLES.exec(s);
    const texto = decl ? s.replace(DECLARACAO_SIMPLES, `${decl[1]} =`) : s;
    if (capturarUltima && idx === instrucoes.length - 1 && (decl || !NAO_EH_EXPRESSAO.test(s))) {
      return decl ? `${texto};\nreturn undefined;` : `return (\n${texto}\n);`;
    }
    return `${texto};`;
  });
  return `with (__escopo) {\n${partes.join('\n')}\n}`;
}

// ---------------------------------------------------------------------------
// Fachadas: o jogador só enxerga a API pública
// ---------------------------------------------------------------------------

function fachadaColecao(col: Colecao, db: Database): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  for (const m of METODOS_COLECAO) {
    f[m] = (...args: unknown[]) => {
      const antes = db.historico.length;
      try {
        return (col[m] as (...a: unknown[]) => unknown).apply(col, args);
      } catch (e) {
        // Marca a operação que falhou, mesmo que o código do jogador capture o erro com try/catch.
        const registro = db.historico.length > antes ? db.historico[antes] : undefined;
        if (registro && registro.erro === undefined) registro.erro = normalizarErro(e).codeName ?? (e as Error).name;
        throw e;
      }
    };
  }
  f.getName = () => col.nome;
  f.toString = () => col.ns;
  return Object.freeze(f);
}

function fachadaBanco(db: Database): Record<string, unknown> {
  const base: Record<string, unknown> = {
    getName: () => db.getName(),
    getCollection: (nome: string) => fachadaColecao(db.getCollection(nome), db),
    getCollectionNames: () => db.getCollectionNames(),
    getCollectionInfos: (filtro?: Documento) => db.getCollectionInfos(filtro),
    createCollection: (nome: unknown, opcoes?: unknown) => db.createCollection(nome, opcoes),
    runCommand: (cmd: unknown) => db.runCommand(cmd),
    dropDatabase: () => db.dropDatabase(),
    toString: () => db.nome,
  };
  return new Proxy(base, {
    get(alvo, chave) {
      if (typeof chave !== 'string') return undefined;
      if (Object.prototype.hasOwnProperty.call(alvo, chave)) return alvo[chave];
      if (chave === 'then' || chave.startsWith('_')) return undefined;
      // qualquer outro nome é uma coleção: db.almas, db.protocolos...
      return fachadaColecao(db.colecao(chave), db);
    },
    set() {
      throw new TypeError('db é somente leitura: para criar uma coleção, use db.createCollection("nome") ou insira um documento.');
    },
  });
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

export class Sessao {
  private cursorAtual?: CursorBase;
  private readonly escopo: Record<string, unknown> = Object.create(null);

  constructor(readonly db: Database) {}

  executar(entrada: string): ResultadoExecucao {
    const inicioHistorico = this.db.historico.length;
    const saida: LinhaSaida[] = [];
    const operacoes = () => this.db.historico.slice(inicioHistorico);

    const especial = this.comandoEspecial(entrada.trim(), saida);
    if (especial) return { ok: true, saida, valor: undefined, operacoes: operacoes(), ...especial };

    try {
      const valor = this.avaliar(entrada, saida);
      let valorFinal: unknown = valor;
      if (valor instanceof CursorBase) {
        valorFinal = valor.todos();
        this.cursorAtual = valor;
        this.imprimirLote(saida);
      } else if (valor !== undefined) {
        saida.push({ tipo: 'resultado', texto: formatar(valor) });
      }
      return { ok: true, saida, valor: valorFinal, operacoes: operacoes() };
    } catch (e) {
      const erro = normalizarErro(e);
      // Marca a operação que falhou (missões conferem, por exemplo, "uma inserção foi bloqueada").
      const ultima = this.db.historico.at(-1);
      if (ultima && this.db.historico.length > inicioHistorico && ultima.erro === undefined) ultima.erro = erro.codeName ?? erro.name;
      saida.push({ tipo: 'erro', texto: this.textoDoErro(erro), traducao: erro.traducao });
      return { ok: false, saida, valor: undefined, erro, operacoes: operacoes() };
    }
  }

  private textoDoErro(erro: ErroShell): string {
    let texto = `${erro.name}: ${erro.message}`;
    if (erro.errInfo !== undefined) texto += `\nAdditional information: ${formatar(erro.errInfo)}`;
    if (erro instanceof MongoBulkWriteError) {
      texto += `\nResult: BulkWriteResult ${formatar({ insertedCount: erro.result.insertedCount, insertedIds: erro.result.insertedIds, writeErrors: erro.result.writeErrors.length })}`;
    }
    return texto;
  }

  private imprimirLote(saida: LinhaSaida[]) {
    if (!this.cursorAtual) {
      saida.push({ tipo: 'info', texto: 'no cursor' });
      return;
    }
    const { lote, restantes } = this.cursorAtual.proximoLote();
    if (lote.length) saida.push({ tipo: 'resultado', texto: formatar(lote) });
    if (restantes > 0) saida.push({ tipo: 'info', texto: 'Type "it" for more' });
    else this.cursorAtual = undefined;
  }

  private comandoEspecial(texto: string, saida: LinhaSaida[]): Partial<ResultadoExecucao> | null {
    let m: RegExpExecArray | null;
    if (/^show\s+(collections|tables)$/.test(texto)) {
      this.db.inspecionar({ metodo: 'getCollectionNames', args: [] });
      const nomes = this.db.nomesDasColecoes();
      if (nomes.length) saida.push({ tipo: 'resultado', texto: nomes.join('\n') });
      return {};
    }
    if (/^show\s+(dbs|databases)$/.test(texto)) {
      saida.push({ tipo: 'resultado', texto: `${this.db.nome}  (Departamento de Almas Extraviadas)` });
      return {};
    }
    if ((m = /^use\s+(\S+)$/.exec(texto))) {
      if (m[1] === this.db.nome) saida.push({ tipo: 'info', texto: `already on db ${this.db.nome}` });
      else
        saida.push({
          tipo: 'erro',
          texto: `Acesso negado ao banco "${m[1]}".`,
          traducao: `Este terminal só enxerga o banco "${this.db.nome}". O resto do arquivo pegou fogo em 1953.`,
        });
      return {};
    }
    if (texto === 'it') {
      this.imprimirLote(saida);
      return {};
    }
    if (texto === 'cls' || texto === 'clear') return { limparTela: true };
    if (texto === 'help') {
      saida.push({ tipo: 'info', texto: AJUDA });
      return {};
    }
    return null;
  }

  private globais(saida: LinhaSaida[]): Record<string, unknown> {
    const imprimir = (...args: unknown[]) => {
      saida.push({ tipo: 'print', texto: args.map((a) => (typeof a === 'string' ? a : formatar(a))).join(' ') });
    };
    function ObjectIdShell(hex?: string) {
      return new ObjectId(hex);
    }
    const cluster = criarApisDoCluster(this.db);
    return {
      db: fachadaBanco(this.db),
      rs: Object.freeze(cluster.rs),
      sh: Object.freeze(cluster.sh),
      diretoria: Object.freeze(cluster.diretoria),
      prova: Object.freeze(cluster.prova),
      ObjectId: ObjectIdShell,
      ISODate,
      NumberInt,
      NumberLong,
      NumberDecimal,
      Date,
      Math,
      JSON,
      RegExp,
      Number,
      String,
      Boolean,
      Array,
      Object,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      undefined,
      NaN,
      Infinity,
      print: imprimir,
      printjson: (v: unknown) => imprimir(formatar(v)),
      console: Object.freeze({ log: imprimir, info: imprimir, warn: imprimir, error: imprimir }),
    };
  }

  private avaliar(codigo: string, saida: LinhaSaida[]): unknown {
    const globais = this.globais(saida);
    const escopo = this.escopo;
    const proxy = new Proxy(escopo, {
      has: (_, chave) => typeof chave === 'string',
      get: (alvo, chave) => {
        if (chave === Symbol.unscopables || typeof chave !== 'string') return undefined;
        if (chave in alvo) return alvo[chave];
        if (chave in globais) return globais[chave];
        throw new ReferenceError(`${chave} is not defined`);
      },
      set: (alvo, chave, valor) => {
        if (typeof chave !== 'string') return false;
        if (chave in globais) throw new TypeError(`"${chave}" é reservado do terminal e não pode ser sobrescrito.`);
        alvo[chave] = valor;
        return true;
      },
    });

    const instrucoes = dividirInstrucoes(codigo);
    if (!instrucoes.length) return undefined;

    let funcao: (escopo: object) => unknown;
    try {
      funcao = new Function('__escopo', montarCorpo(instrucoes, true)) as typeof funcao;
    } catch {
      // A última instrução não era expressão (ou o splitter errou): roda sem capturar valor.
      funcao = new Function('__escopo', montarCorpo(instrucoes, false)) as typeof funcao;
    }
    return funcao.call(Object.freeze({}), proxy);
  }
}
