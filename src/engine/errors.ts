/**
 * Erros com mensagem idêntica (ou muito próxima) à do mongosh, para o jogador aprender a ler
 * o erro real. Cada erro carrega uma `traducao` didática em português, exibida abaixo.
 */

export class ErroShell extends Error {
  code?: number;
  codeName?: string;
  traducao?: string;
  errInfo?: unknown;

  constructor(nome: string, mensagem: string, extras: Partial<ErroShell> = {}) {
    super(mensagem);
    this.name = nome;
    Object.assign(this, extras);
  }
}

export class MongoServerError extends ErroShell {
  constructor(mensagem: string, extras: Partial<ErroShell> = {}) {
    super('MongoServerError', mensagem, extras);
  }
}

export class MongoInvalidArgumentError extends ErroShell {
  constructor(mensagem: string, traducao?: string) {
    super('MongoInvalidArgumentError', mensagem, { traducao });
  }
}

export interface ResumoBulk {
  insertedCount: number;
  insertedIds: Record<number, unknown>;
  writeErrors: { index: number; code: number; errmsg: string }[];
}

export class MongoBulkWriteError extends ErroShell {
  result: ResumoBulk;
  constructor(primeiro: ErroShell, result: ResumoBulk) {
    super('MongoBulkWriteError', primeiro.message, {
      code: primeiro.code,
      codeName: primeiro.codeName,
      traducao:
        (primeiro.traducao ?? '') +
        ` Resultado do lote: ${result.insertedCount} documento(s) inserido(s), ` +
        `${result.writeErrors.length} erro(s).`,
    });
    this.result = result;
  }
}

/** Erro diegético: operador ainda não liberado para o capítulo atual. */
export class CredencialError extends ErroShell {
  constructor(operador: string, capitulo: number) {
    super(
      'CredencialError',
      `Comando '${operador}' não consta no seu nível de credenciamento (exige: Capítulo ${capitulo}).`,
      {
        traducao:
          'O Departamento ainda não liberou esse recurso para você. Conclua os memorandos ' +
          'pendentes para receber a credencial.',
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Fábricas — um lugar só para cada mensagem do servidor
// ---------------------------------------------------------------------------

export const erros = {
  chaveDuplicada(ns: string, indice: string, chave: Record<string, unknown>, formatar: (v: unknown) => string) {
    const dup = Object.entries(chave)
      .map(([k, v]) => `${k}: ${formatar(v)}`)
      .join(', ');
    return new MongoServerError(
      `E11000 duplicate key error collection: ${ns} index: ${indice} dup key: { ${dup} }`,
      {
        code: 11000,
        codeName: 'DuplicateKey',
        traducao:
          `Já existe um documento com esse valor no índice único "${indice}". ` +
          'Índices únicos (incluindo o _id) não aceitam repetição.',
      },
    );
  },

  falhaValidacao(errInfo: unknown) {
    return new MongoServerError('Document failed validation', {
      code: 121,
      codeName: 'DocumentValidationFailure',
      errInfo,
      traducao:
        'O documento não obedece ao validador da coleção. Veja em "Additional information" ' +
        'qual regra foi violada.',
    });
  },

  ordemSort() {
    return new MongoServerError(
      '$sort key ordering must be 1 (for ascending) or -1 (for descending)',
      {
        code: 15975,
        codeName: 'Location15975',
        traducao: 'No sort, cada campo recebe 1 (crescente) ou -1 (decrescente). Nada além disso.',
      },
    );
  },

  sortVazio() {
    return new MongoServerError('$sort stage must have at least one sort key', {
      code: 15976,
      codeName: 'Location15976',
      traducao: 'O $sort precisa de pelo menos um campo.',
    });
  },

  operadorDesconhecido(op: string, topo: boolean) {
    return new MongoServerError(topo ? `unknown top level operator: ${op}` : `unknown operator: ${op}`, {
      code: 2,
      codeName: 'BadValue',
      traducao: `O operador ${op} não existe (ou está escrito errado). Confira o Manual.`,
    });
  },

  estagioDesconhecido(estagio: string) {
    return new MongoServerError(`Unrecognized pipeline stage name: '${estagio}'`, {
      code: 40324,
      codeName: 'Location40324',
      traducao: `Não existe o estágio ${estagio}. Cada estágio do pipeline é um objeto com uma única chave começando com $.`,
    });
  },

  estagioMalFormado() {
    return new MongoServerError(
      'A pipeline stage specification object must contain exactly one field.',
      {
        code: 40323,
        codeName: 'Location40323',
        traducao: 'Cada estágio é um objeto separado: [ { $match: ... }, { $sort: ... } ], não { $match, $sort } juntos.',
      },
    );
  },

  pipelineNaoArray() {
    return new MongoInvalidArgumentError(
      'Argument "pipeline" must be an array of aggregation stages',
      'O aggregate recebe uma LISTA de estágios: db.colecao.aggregate([ {...}, {...} ]).',
    );
  },

  updateSemOperador() {
    return new MongoInvalidArgumentError(
      'Update document requires atomic operators',
      'Em updateOne/updateMany o segundo argumento precisa de operadores como $set, $inc... ' +
        'Para trocar o documento inteiro, use replaceOne.',
    );
  },

  substituicaoComOperador() {
    return new MongoInvalidArgumentError(
      'Replacement document must not contain atomic operators',
      'replaceOne recebe o documento novo por inteiro, sem $set. Para alterar campos, use updateOne.',
    );
  },

  idImutavel() {
    return new MongoServerError(
      "Performing an update on the path '_id' would modify the immutable field '_id'",
      {
        code: 66,
        codeName: 'ImmutableField',
        traducao: 'O _id de um documento nunca muda. Para "trocar" o _id, insira um novo e apague o antigo.',
      },
    );
  },

  tipoNaoNumerico(op: string, id: string, campo: string, tipo: string) {
    return new MongoServerError(
      `Cannot apply ${op} to a value of non-numeric type. {_id: ${id}} has the field '${campo}' of non-numeric type ${tipo}`,
      {
        code: 14,
        codeName: 'TypeMismatch',
        traducao: `${op} só funciona em números. Esse documento tem "${campo}" gravado como ${tipo} — dado legado?`,
      },
    );
  },

  conflitoDeCaminho(caminho: string, conflito: string) {
    return new MongoServerError(
      `Updating the path '${caminho}' would create a conflict at '${conflito}'`,
      {
        code: 40,
        codeName: 'ConflictingUpdateOperators',
        traducao: 'Dois operadores do mesmo update mexem no mesmo campo. Separe em dois comandos.',
      },
    );
  },

  posicionalSemMatch() {
    return new MongoServerError(
      'The positional operator did not find the match needed from the query.',
      {
        code: 2,
        codeName: 'BadValue',
        traducao: 'O $ posicional precisa que o filtro mencione o array (ex.: { "audiencias.parecer": "Z" }).',
      },
    );
  },

  arrayFilterAusente(id: string, caminho: string) {
    return new MongoServerError(`No array filter found for identifier '${id}' in path '${caminho}'`, {
      code: 2,
      codeName: 'BadValue',
      traducao: `Você usou $[${id}] mas não passou { arrayFilters: [ { "${id}.campo": ... } ] } nas opções.`,
    });
  },

  projecaoMista(campo: string, inclusiva: boolean) {
    return new MongoServerError(
      inclusiva
        ? `Cannot do exclusion on field ${campo} in inclusion projection`
        : `Cannot do inclusion on field ${campo} in exclusion projection`,
      {
        code: inclusiva ? 31254 : 31253,
        codeName: inclusiva ? 'Location31254' : 'Location31253',
        traducao:
          'Uma projeção ou inclui campos (1) ou exclui campos (0). A única exceção permitida é _id: 0.',
      },
    );
  },

  groupSemId() {
    return new MongoServerError('a group specification must include an _id', {
      code: 15955,
      codeName: 'Location15955',
      traducao: 'Todo $group precisa de _id: é por ele que os documentos são agrupados (use _id: null para agrupar tudo).',
    });
  },

  colecaoJaExiste(ns: string) {
    return new MongoServerError(`Collection ${ns} already exists.`, {
      code: 48,
      codeName: 'NamespaceExists',
      traducao: 'Essa coleção já existe. Para mudar o validador de uma coleção existente, use collMod.',
    });
  },

  colecaoInexistente() {
    return new MongoServerError('ns does not exist', {
      code: 26,
      codeName: 'NamespaceNotFound',
      traducao: 'Não há coleção com esse nome.',
    });
  },

  valorInvalido(mensagem: string, traducao: string) {
    return new MongoServerError(mensagem, { code: 2, codeName: 'BadValue', traducao });
  },

  comandoDesconhecido(nome: string) {
    return new MongoServerError(`no such command: '${nome}'`, {
      code: 59,
      codeName: 'CommandNotFound',
      traducao: `O servidor do Departamento não conhece o comando "${nome}".`,
    });
  },
};

// ---------------------------------------------------------------------------
// Tradução de erros de JavaScript e do mingo
// ---------------------------------------------------------------------------

/** Converte qualquer erro lançado durante a execução em ErroShell com tradução. */
export function normalizarErro(e: unknown): ErroShell {
  if (e instanceof ErroShell) return e;
  if (!(e instanceof Error)) return new ErroShell('Error', String(e));

  const msg = e.message;

  if (e instanceof SyntaxError) {
    return new ErroShell('SyntaxError', msg, {
      traducao: 'Erro de sintaxe: confira parênteses, chaves, colchetes, vírgulas e aspas.',
    });
  }
  if (e instanceof ReferenceError) {
    const variavel = /^(\S+) is not defined/.exec(msg)?.[1];
    return new ErroShell('ReferenceError', msg, {
      traducao: variavel
        ? `"${variavel}" não existe no terminal. Coleções são acessadas por db.nome (ex.: db.${variavel}); textos precisam de aspas.`
        : 'Você usou um nome que não existe no terminal.',
    });
  }
  if (e instanceof TypeError) {
    const metodo = /\.(\w+) is not a function/.exec(msg)?.[1];
    return new ErroShell('TypeError', msg, {
      traducao: metodo
        ? `O método "${metodo}" não existe aqui. Confira a grafia (maiúsculas importam: insertOne, não insertone).`
        : 'Você tentou usar um valor de um jeito que ele não permite.',
    });
  }

  // Mensagens internas do mingo, reescritas no formato do servidor.
  let m: RegExpExecArray | null;
  if ((m = /unknown top level operator: (\$\w+)/.exec(msg))) return erros.operadorDesconhecido(m[1], true);
  if ((m = /unknown (?:query )?operator:? '?(\$\w+)/.exec(msg))) return erros.operadorDesconhecido(m[1], false);
  if ((m = /unregistered pipeline operator (\$\w+)/.exec(msg))) return erros.estagioDesconhecido(m[1]);
  if (/group specification must include an '?_id/.test(msg)) return erros.groupSemId();
  if ((m = /Unknown update operator: '(\$\w+)'/.exec(msg))) return erros.operadorDesconhecido(m[1], false);
  if (/Cannot do exclusion and inclusion in projection/.test(msg)) {
    return erros.projecaoMista('?', true);
  }

  return new MongoServerError(msg.replace(/^mingo:\s*/, ''), {
    traducao: 'O servidor recusou a operação. Leia a mensagem acima com calma: ela costuma dizer exatamente o campo culpado.',
  });
}
