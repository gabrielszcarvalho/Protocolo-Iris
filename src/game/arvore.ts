/**
 * Árvore de Credenciamento: o jogador gasta carimbos para liberar comandos.
 * Cada nó lista as "chaves" que libera (ver engine/credenciais.ts) e o texto do Manual,
 * que é gerado daqui — uma única fonte de verdade.
 */

import { CredencialError } from '../engine/errors';
import { chavesDaOperacao, type Operacao } from '../engine/credenciais';

export interface EntradaManual {
  chave: string;
  sintaxe: string;
  explicacao: string;
  exemplo?: string;
}

export interface NoCredencial {
  id: string;
  nome: string;
  ramo: string;
  descricao: string;
  custo: number;
  requer: string[];
  /** false = aparece na árvore, mas ainda lacrado pela Diretoria (conteúdo futuro). */
  disponivel: boolean;
  libera: EntradaManual[];
}

export const RAMOS = ['Admissão', 'Triagem', 'Inventário', 'Retificação', 'Anexos', 'Grafologia', 'Regulamento', 'Relatórios'] as const;

const e = (chave: string, sintaxe: string, explicacao: string, exemplo?: string): EntradaManual => ({ chave, sintaxe, explicacao, exemplo });

export const ARVORE: NoCredencial[] = [
  // ------------------------------------------------------------------ Admissão
  {
    id: 'credencial-provisoria',
    nome: 'Credencial Provisória',
    ramo: 'Admissão',
    descricao: 'O mínimo para trabalhar: consultar o arquivo.',
    custo: 0,
    requer: [],
    disponivel: true,
    libera: [
      e('find', 'db.colecao.find(filtro, projecao)', 'Busca documentos. Sem filtro, traz todos. O filtro { campo: valor } traz só os que batem. A projeção escolhe os campos: { nome: 1 } mostra, { nome: 0 } esconde, e _id: 0 some com o _id.', "db.almas.find({ setor: 'Limbo' }, { nome: 1, _id: 0 })"),
      e('getCollectionNames', 'show collections', 'Lista as coleções do banco.'),
    ],
  },
  {
    id: 'leitura-rapida',
    nome: 'Leitura Rápida',
    ramo: 'Admissão',
    descricao: 'Buscar uma única ficha em vez de uma lista.',
    custo: 2,
    requer: ['credencial-provisoria'],
    disponivel: true,
    libera: [
      e('findOne', 'db.colecao.findOne(filtro, projecao)', 'Igual ao find, mas devolve só o PRIMEIRO documento que bate (um objeto, não uma lista). Se nada bater, devolve null.', "db.almas.findOne({ nome: 'Odorico Paz' })"),
    ],
  },
  {
    id: 'recenseamento',
    nome: 'Recenseamento',
    ramo: 'Admissão',
    descricao: 'Contar sem precisar ler ficha por ficha.',
    custo: 2,
    requer: ['credencial-provisoria'],
    disponivel: true,
    libera: [
      e('countDocuments', 'db.colecao.countDocuments(filtro)', 'Conta quantos documentos batem com o filtro. Com {} conta todos.', "db.almas.countDocuments({ setor: 'Purgatório' })"),
      e('count', 'cursor.count()', 'Forma antiga de contar, ainda vista em apostilas: db.almas.find({...}).count(). Prefira countDocuments.'),
    ],
  },
  {
    id: 'protocolo-de-entrada',
    nome: 'Protocolo de Entrada',
    ramo: 'Admissão',
    descricao: 'Registrar almas recém-chegadas.',
    custo: 3,
    requer: ['credencial-provisoria'],
    disponivel: true,
    libera: [
      e('insertOne', 'db.colecao.insertOne(documento)', 'Grava UM documento. Se você não informar _id, o MongoDB cria um ObjectId automaticamente.', "db.almas.insertOne({ nome: 'Gaspar Mendonça', setor: 'Limbo' })"),
    ],
  },
  {
    id: 'despacho-em-lote',
    nome: 'Despacho em Lote',
    ramo: 'Admissão',
    descricao: 'Registrar várias almas num único comando.',
    custo: 4,
    requer: ['protocolo-de-entrada'],
    disponivel: true,
    libera: [
      e('insertMany', 'db.colecao.insertMany([ doc1, doc2, ... ], opcoes)', 'Grava uma LISTA de documentos de uma vez. Por padrão para no primeiro erro (os anteriores ficam gravados).', "db.almas.insertMany([{ nome: 'A' }, { nome: 'B' }])"),
      e('ordered', '{ ordered: false }', 'Opção do insertMany: com ordered: false, um documento com erro não interrompe os outros — todos os válidos são gravados.', 'db.almas.insertMany(lote, { ordered: false })'),
    ],
  },

  // ------------------------------------------------------------------ Triagem
  {
    id: 'regua-de-comparacao',
    nome: 'Régua de Comparação',
    ramo: 'Triagem',
    descricao: 'Maior, menor, diferente.',
    custo: 5,
    requer: ['leitura-rapida'],
    disponivel: true,
    libera: [
      e('$gt', '{ campo: { $gt: valor } }', 'Maior que (greater than).', 'db.almas.find({ anos_pendentes: { $gt: 50 } })'),
      e('$gte', '{ campo: { $gte: valor } }', 'Maior ou igual.'),
      e('$lt', '{ campo: { $lt: valor } }', 'Menor que (less than).'),
      e('$lte', '{ campo: { $lte: valor } }', 'Menor ou igual. Combine com $gte para uma faixa: { $gte: 10, $lte: 20 }.'),
      e('$ne', '{ campo: { $ne: valor } }', 'Diferente (not equal). Atenção: também traz documentos que nem têm o campo.'),
      e('$eq', '{ campo: { $eq: valor } }', 'Igual. É o mesmo que { campo: valor }, escrito por extenso.'),
    ],
  },
  {
    id: 'logica-cartorial',
    nome: 'Lógica Cartorial',
    ramo: 'Triagem',
    descricao: 'E, OU, NEM.',
    custo: 6,
    requer: ['regua-de-comparacao'],
    disponivel: true,
    libera: [
      e('$or', '{ $or: [ cond1, cond2 ] }', 'Traz documentos que satisfazem PELO MENOS UMA das condições.', "db.almas.find({ $or: [{ setor: 'Limbo' }, { anos_pendentes: { $gt: 80 } }] })"),
      e('$and', '{ $and: [ cond1, cond2 ] }', 'Todas as condições. Vírgula já é AND ({ a: 1, b: 2 }); o $and explícito é necessário quando você repete o mesmo operador, como dois $or.'),
      e('$nor', '{ $nor: [ cond1, cond2 ] }', 'Nenhuma das condições (o contrário do $or).'),
    ],
  },
  {
    id: 'lista-oficial',
    nome: 'Lista Oficial',
    ramo: 'Triagem',
    descricao: 'Dentro ou fora de uma lista de valores.',
    custo: 4,
    requer: ['regua-de-comparacao'],
    disponivel: true,
    libera: [
      e('$in', '{ campo: { $in: [v1, v2] } }', 'O valor está na lista. Mais curto que vários $or no mesmo campo.', "db.almas.find({ setor: { $in: ['Limbo', 'Ante-Sala'] } })"),
      e('$nin', '{ campo: { $nin: [v1, v2] } }', 'O valor NÃO está na lista (também traz quem não tem o campo).'),
    ],
  },
  {
    id: 'pericia-de-fichas',
    nome: 'Perícia de Fichas',
    ramo: 'Triagem',
    descricao: 'Achar campos ausentes e tipos errados.',
    custo: 6,
    requer: ['regua-de-comparacao'],
    disponivel: true,
    libera: [
      e('$exists', '{ campo: { $exists: true|false } }', 'Filtra pela presença do campo, não pelo valor. Funciona com dot notation: { "endereco.cep": { $exists: false } }.'),
      e('$type', '{ campo: { $type: "string" } }', 'Filtra pelo tipo BSON: "string", "int", "double", "number", "date", "array", "object", "bool", "null".', "db.almas.find({ anos_pendentes: { $type: 'string' } })"),
    ],
  },
  {
    id: 'fila-organizada',
    nome: 'Fila Organizada',
    ramo: 'Triagem',
    descricao: 'Ordenar e paginar resultados.',
    custo: 5,
    requer: ['recenseamento'],
    disponivel: true,
    libera: [
      e('sort', 'cursor.sort({ campo: 1 | -1 })', '1 = crescente, -1 = decrescente. Vários campos desempatam na ordem escrita.', 'db.almas.find().sort({ falecimento: 1 })'),
      e('limit', 'cursor.limit(n)', 'Traz no máximo n documentos.'),
      e('skip', 'cursor.skip(n)', 'Pula os n primeiros. Página p com t itens: skip((p - 1) * t).limit(t). O MongoDB aplica sempre sort → skip → limit.'),
    ],
  },

  // ------------------------------------------------------------------ Inventário
  {
    id: 'inventario-de-vinculos',
    nome: 'Inventário de Vínculos',
    ramo: 'Inventário',
    descricao: 'Perguntas sobre arrays inteiros.',
    custo: 6,
    requer: ['lista-oficial'],
    disponivel: true,
    libera: [
      e('$all', '{ campo: { $all: [v1, v2] } }', 'O array contém TODOS os valores, em qualquer ordem. (Sem $all, { vinculos: "poeta" } já busca um elemento; { vinculos: ["a", "b"] } exige o array exato, na ordem.)', "db.almas.find({ vinculos: { $all: ['mãe', 'poeta'] } })"),
      e('$size', '{ campo: { $size: n } }', 'O array tem exatamente n elementos. Não aceita faixas ($size: { $gt: 2 } não existe).'),
    ],
  },
  {
    id: 'lupa-de-audiencias',
    nome: 'Lupa de Audiências',
    ramo: 'Inventário',
    descricao: 'Várias condições no MESMO elemento do array.',
    custo: 8,
    requer: ['inventario-de-vinculos'],
    disponivel: true,
    libera: [
      e('$elemMatch', '{ array: { $elemMatch: { cond1, cond2 } } }', 'Exige que UM MESMO elemento satisfaça todas as condições. Com dot notation ("audiencias.parecer" e "audiencias.peso" separados), cada condição pode ser atendida por um elemento diferente — falso positivo clássico.', "db.almas.find({ audiencias: { $elemMatch: { parecer: 'C', peso: { $gt: 30 } } } })"),
    ],
  },

  // ------------------------------------------------------------------ Lacrados (próximas atualizações)
  lacrado('retificacao', 'Retificação', 'Retificação', 8, ['credencial-provisoria'], ['updateOne', 'updateMany', '$set']),
  lacrado('borracha', 'Borracha Oficial', 'Retificação', 6, ['retificacao'], ['$unset', '$rename', '$currentDate']),
  lacrado('calculadora', 'Calculadora de Repartição', 'Retificação', 6, ['retificacao'], ['$inc', '$mul', '$min', '$max']),
  lacrado('cadastro-fantasma', 'Cadastro Fantasma', 'Retificação', 5, ['retificacao'], ['upsert']),
  lacrado('formulario-novo', 'Formulário Novo', 'Retificação', 5, ['retificacao'], ['replaceOne']),
  lacrado('expurgo', 'Expurgo', 'Retificação', 8, ['retificacao'], ['deleteOne', 'deleteMany', 'drop']),
  lacrado('grampeador', 'Grampeador', 'Anexos', 8, ['retificacao'], ['$push', '$each', '$position', '$sort', '$slice']),
  lacrado('sem-repeticao', 'Sem Repetição', 'Anexos', 5, ['grampeador'], ['$addToSet']),
  lacrado('tesoura', 'Tesoura', 'Anexos', 6, ['grampeador'], ['$pull', '$pop', '$pullAll']),
  lacrado('posicional', 'Dedo Posicional', 'Anexos', 8, ['grampeador'], ['$ (posicional)']),
  lacrado('filtros-de-anexo', 'Filtros de Anexo', 'Anexos', 10, ['posicional'], ['arrayFilters', '$[<apelido>]', '$[]']),
  lacrado('grafologia', 'Grafologia', 'Grafologia', 8, ['pericia-de-fichas'], ['$regex', '$options']),
  lacrado('negacao', 'Carimbo de Negação', 'Grafologia', 5, ['grafologia'], ['$not']),
  lacrado('norma', 'Norma Técnica', 'Regulamento', 10, ['pericia-de-fichas'], ['createCollection', '$jsonSchema', 'validator', 'getCollectionInfos']),
  lacrado('indice-unico', 'Índice Único', 'Regulamento', 8, ['norma'], ['createIndex', 'getIndexes', 'dropIndex']),
  lacrado('emenda', 'Emenda ao Regulamento', 'Regulamento', 10, ['norma'], ['runCommand', 'collMod', 'validationLevel', 'validationAction']),
  lacrado('esteira', 'Esteira de Relatórios', 'Relatórios', 10, ['fila-organizada'], ['aggregate', '$match', '$project', '$sort@agregacao', '$limit', '$skip', '$concat']),
  lacrado('agrupamento', 'Agrupamento', 'Relatórios', 10, ['esteira'], ['$group', '$sum', '$avg', '$min@agregacao', '$max@agregacao', '$first', '$last', '$push@agregacao', '$addToSet@agregacao', '$count']),
  lacrado('desdobramento', 'Desdobramento', 'Relatórios', 10, ['agrupamento'], ['$unwind', '$year']),
  lacrado('parecer', 'Parecer Técnico', 'Relatórios', 12, ['desdobramento'], ['$cond', '$switch', '$expr', '$arrayToObject']),
];

function lacrado(id: string, nome: string, ramo: string, custo: number, requer: string[], chaves: string[]): NoCredencial {
  return {
    id,
    nome,
    ramo,
    descricao: 'Lacrado pela Diretoria. Chega numa próxima atualização do Departamento.',
    custo,
    requer,
    disponivel: false,
    libera: chaves.map((c) => e(c, c.replace('@agregacao', ''), 'Em breve.')),
  };
}

export const NO_POR_ID = new Map(ARVORE.map((n) => [n.id, n]));
export const NO_POR_CHAVE = new Map(ARVORE.flatMap((n) => n.libera.map((l) => [l.chave, n] as const)));
export const RAIZ = 'credencial-provisoria';

export type SituacaoNo = 'possui' | 'compravel' | 'sem-carimbos' | 'bloqueado' | 'lacrado';

export function situacaoDoNo(no: NoCredencial, possui: ReadonlySet<string>, carimbos: number): SituacaoNo {
  if (possui.has(no.id)) return 'possui';
  if (!no.disponivel) return 'lacrado';
  if (!no.requer.every((r) => possui.has(r))) return 'bloqueado';
  return carimbos >= no.custo ? 'compravel' : 'sem-carimbos';
}

/** Verificador plugado no Database: bloqueia o que o jogador ainda não comprou. */
export function criarVerificador(possui: () => ReadonlySet<string>) {
  return (op: Operacao) => {
    const atuais = possui();
    for (const { nome, chave } of chavesDaOperacao(op)) {
      const no = NO_POR_CHAVE.get(chave);
      if (no && !atuais.has(no.id)) throw new CredencialError(nome, no.nome);
    }
  };
}
