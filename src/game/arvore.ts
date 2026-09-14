/**
 * Árvore de Credenciamento: o jogador gasta carimbos para liberar comandos.
 * Cada nó lista as "chaves" que libera (ver engine/credenciais.ts) e o texto do Manual,
 * que é gerado daqui — uma única fonte de verdade.
 *
 * Cada nó pertence a um capítulo e só pode ser comprado quando esse capítulo abre. Isso garante
 * que ninguém gaste carimbos em algo que ainda não serve e fique sem saída.
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
  capitulo: number;
  descricao: string;
  custo: number;
  requer: string[];
  /** false = aparece na árvore, mas ainda lacrado pela Diretoria (conteúdo futuro). */
  disponivel: boolean;
  libera: EntradaManual[];
}

export const RAMOS = ['Admissão', 'Triagem', 'Inventário', 'Retificação', 'Anexos', 'Grafologia', 'Regulamento', 'Relatórios', 'Diretoria'] as const;

const e = (chave: string, sintaxe: string, explicacao: string, exemplo?: string): EntradaManual => ({ chave, sintaxe, explicacao, exemplo });

type SemDisponivel = Omit<NoCredencial, 'disponivel'>;
const no = (dados: SemDisponivel): NoCredencial => ({ ...dados, disponivel: true });

export const ARVORE: NoCredencial[] = [
  // ------------------------------------------------------------------ Cap. 1 — Admissão
  no({
    id: 'credencial-provisoria', nome: 'Credencial Provisória', ramo: 'Admissão', capitulo: 1, custo: 0, requer: [],
    descricao: 'O mínimo para trabalhar: consultar o arquivo.',
    libera: [
      e('find', 'db.colecao.find(filtro, projecao)', 'Busca documentos. Sem filtro, traz todos. O filtro { campo: valor } traz só os que batem. A projeção escolhe os campos: { nome: 1 } mostra, { nome: 0 } esconde, e _id: 0 some com o _id.', "db.almas.find({ setor: 'Limbo' }, { nome: 1, _id: 0 })"),
      e('getCollectionNames', 'show collections', 'Lista as coleções do banco.'),
    ],
  }),
  no({
    id: 'leitura-rapida', nome: 'Leitura Rápida', ramo: 'Admissão', capitulo: 1, custo: 2, requer: ['credencial-provisoria'],
    descricao: 'Buscar uma única ficha em vez de uma lista.',
    libera: [e('findOne', 'db.colecao.findOne(filtro, projecao)', 'Igual ao find, mas devolve só o PRIMEIRO documento que bate (um objeto, não uma lista). Se nada bater, devolve null.', "db.almas.findOne({ nome: 'Odorico Paz' })")],
  }),
  no({
    id: 'recenseamento', nome: 'Recenseamento', ramo: 'Admissão', capitulo: 1, custo: 2, requer: ['credencial-provisoria'],
    descricao: 'Contar sem precisar ler ficha por ficha.',
    libera: [
      e('countDocuments', 'db.colecao.countDocuments(filtro)', 'Conta quantos documentos batem com o filtro. Com {} conta todos.', "db.almas.countDocuments({ setor: 'Purgatório' })"),
      e('count', 'cursor.count()', 'Forma antiga de contar, ainda vista em apostilas: db.almas.find({...}).count(). Prefira countDocuments.'),
    ],
  }),
  no({
    id: 'protocolo-de-entrada', nome: 'Protocolo de Entrada', ramo: 'Admissão', capitulo: 1, custo: 3, requer: ['credencial-provisoria'],
    descricao: 'Registrar almas recém-chegadas.',
    libera: [e('insertOne', 'db.colecao.insertOne(documento)', 'Grava UM documento. Se você não informar _id, o MongoDB cria um ObjectId automaticamente.', "db.almas.insertOne({ nome: 'Gaspar Mendonça', setor: 'Limbo' })")],
  }),
  no({
    id: 'despacho-em-lote', nome: 'Despacho em Lote', ramo: 'Admissão', capitulo: 1, custo: 4, requer: ['protocolo-de-entrada'],
    descricao: 'Registrar várias almas num único comando.',
    libera: [
      e('insertMany', 'db.colecao.insertMany([ doc1, doc2, ... ], opcoes)', 'Grava uma LISTA de documentos de uma vez. Por padrão para no primeiro erro (os anteriores ficam gravados).', "db.almas.insertMany([{ nome: 'A' }, { nome: 'B' }])"),
      e('ordered', '{ ordered: false }', 'Opção do insertMany: com ordered: false, um documento com erro não interrompe os outros — todos os válidos são gravados.', 'db.almas.insertMany(lote, { ordered: false })'),
    ],
  }),

  // ------------------------------------------------------------------ Cap. 2 — Triagem
  no({
    id: 'regua-de-comparacao', nome: 'Régua de Comparação', ramo: 'Triagem', capitulo: 2, custo: 5, requer: ['leitura-rapida'],
    descricao: 'Maior, menor, diferente.',
    libera: [
      e('$gt', '{ campo: { $gt: valor } }', 'Maior que (greater than).', 'db.almas.find({ anos_pendentes: { $gt: 50 } })'),
      e('$gte', '{ campo: { $gte: valor } }', 'Maior ou igual.'),
      e('$lt', '{ campo: { $lt: valor } }', 'Menor que (less than).'),
      e('$lte', '{ campo: { $lte: valor } }', 'Menor ou igual. Combine com $gte para uma faixa: { $gte: 10, $lte: 20 }.'),
      e('$ne', '{ campo: { $ne: valor } }', 'Diferente (not equal). Atenção: também traz documentos que nem têm o campo.'),
      e('$eq', '{ campo: { $eq: valor } }', 'Igual. É o mesmo que { campo: valor }, escrito por extenso. Em aggregate, { $eq: [a, b] } compara duas expressões.'),
    ],
  }),
  no({
    id: 'logica-cartorial', nome: 'Lógica Cartorial', ramo: 'Triagem', capitulo: 2, custo: 6, requer: ['regua-de-comparacao'],
    descricao: 'E, OU, NEM.',
    libera: [
      e('$or', '{ $or: [ cond1, cond2 ] }', 'Traz documentos que satisfazem PELO MENOS UMA das condições.', "db.almas.find({ $or: [{ setor: 'Limbo' }, { anos_pendentes: { $gt: 80 } }] })"),
      e('$and', '{ $and: [ cond1, cond2 ] }', 'Todas as condições. Vírgula já é AND ({ a: 1, b: 2 }); o $and explícito é necessário quando você repete o mesmo operador, como dois $or.'),
      e('$nor', '{ $nor: [ cond1, cond2 ] }', 'Nenhuma das condições (o contrário do $or).'),
    ],
  }),
  no({
    id: 'lista-oficial', nome: 'Lista Oficial', ramo: 'Triagem', capitulo: 2, custo: 4, requer: ['regua-de-comparacao'],
    descricao: 'Dentro ou fora de uma lista de valores.',
    libera: [
      e('$in', '{ campo: { $in: [v1, v2] } }', 'O valor está na lista. Mais curto que vários $or no mesmo campo.', "db.almas.find({ setor: { $in: ['Limbo', 'Ante-Sala'] } })"),
      e('$nin', '{ campo: { $nin: [v1, v2] } }', 'O valor NÃO está na lista (também traz quem não tem o campo).'),
    ],
  }),
  no({
    id: 'pericia-de-fichas', nome: 'Perícia de Fichas', ramo: 'Triagem', capitulo: 2, custo: 6, requer: ['regua-de-comparacao'],
    descricao: 'Achar campos ausentes e tipos errados.',
    libera: [
      e('$exists', '{ campo: { $exists: true|false } }', 'Filtra pela presença do campo, não pelo valor. Funciona com dot notation: { "endereco.cep": { $exists: false } }.'),
      e('$type', '{ campo: { $type: "string" } }', 'Filtra pelo tipo BSON: "string", "int", "double", "number", "date", "array", "object", "bool", "null".', "db.almas.find({ anos_pendentes: { $type: 'string' } })"),
    ],
  }),
  no({
    id: 'fila-organizada', nome: 'Fila Organizada', ramo: 'Triagem', capitulo: 2, custo: 5, requer: ['recenseamento'],
    descricao: 'Ordenar e paginar resultados.',
    libera: [
      e('sort', 'cursor.sort({ campo: 1 | -1 })', '1 = crescente, -1 = decrescente. Vários campos desempatam na ordem escrita.', 'db.almas.find().sort({ falecimento: 1 })'),
      e('limit', 'cursor.limit(n)', 'Traz no máximo n documentos.'),
      e('skip', 'cursor.skip(n)', 'Pula os n primeiros. Página p com t itens: skip((p - 1) * t).limit(t). O MongoDB aplica sempre sort → skip → limit.'),
    ],
  }),

  // ------------------------------------------------------------------ Cap. 3 — Inventário
  no({
    id: 'inventario-de-vinculos', nome: 'Inventário de Vínculos', ramo: 'Inventário', capitulo: 3, custo: 6, requer: ['lista-oficial'],
    descricao: 'Perguntas sobre arrays inteiros.',
    libera: [
      e('$all', '{ campo: { $all: [v1, v2] } }', 'O array contém TODOS os valores, em qualquer ordem. (Sem $all, { vinculos: "poeta" } já busca um elemento; { vinculos: ["a", "b"] } exige o array exato, na ordem.)', "db.almas.find({ vinculos: { $all: ['mãe', 'poeta'] } })"),
      e('$size', '{ campo: { $size: n } }', 'O array tem exatamente n elementos. Não aceita faixas. Em aggregate, { $size: "$campo" } devolve o tamanho.'),
    ],
  }),
  no({
    id: 'lupa-de-audiencias', nome: 'Lupa de Audiências', ramo: 'Inventário', capitulo: 3, custo: 8, requer: ['inventario-de-vinculos'],
    descricao: 'Várias condições no MESMO elemento do array.',
    libera: [
      e('$elemMatch', '{ array: { $elemMatch: { cond1, cond2 } } }', 'Exige que UM MESMO elemento satisfaça todas as condições. Com dot notation ("audiencias.parecer" e "audiencias.peso" separados), cada condição pode ser atendida por um elemento diferente — falso positivo clássico.', "db.almas.find({ audiencias: { $elemMatch: { parecer: 'C', peso: { $gt: 30 } } } })"),
    ],
  }),

  // ------------------------------------------------------------------ Cap. 4 — Retificação
  no({
    id: 'retificacao', nome: 'Retificação', ramo: 'Retificação', capitulo: 4, custo: 6, requer: ['credencial-provisoria'],
    descricao: 'Alterar fichas já registradas.',
    libera: [
      e('updateOne', 'db.colecao.updateOne(filtro, alteracao, opcoes)', 'Altera o PRIMEIRO documento que bate com o filtro. A alteração precisa de operadores ($set, $inc...).', "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $set: { setor: 'Purgatório' } })"),
      e('updateMany', 'db.colecao.updateMany(filtro, alteracao, opcoes)', 'Altera TODOS os documentos que batem. Não é atômico: se falhar no meio, o que já foi alterado fica.', "db.almas.updateMany({ ativo: false }, { $set: { revisar: true } })"),
      e('$set', '{ $set: { campo: valor } }', 'Define o valor de um campo (cria se não existir). Aceita dot notation: { $set: { "contato.ramal": "0042" } }.'),
    ],
  }),
  no({
    id: 'borracha', nome: 'Borracha Oficial', ramo: 'Retificação', capitulo: 4, custo: 5, requer: ['retificacao'],
    descricao: 'Apagar e renomear campos, carimbar datas.',
    libera: [
      e('$unset', '{ $unset: { campo: "" } }', 'Remove o campo do documento (o valor informado não importa).', "db.arquivistas.updateMany({}, { $unset: { 'contato.ramal': '' } })"),
      e('$rename', '{ $rename: { antigo: "novo" } }', 'Muda o nome de um campo, mantendo o valor.'),
      e('$currentDate', '{ $currentDate: { campo: true } }', 'Grava a data e hora atuais no campo.'),
    ],
  }),
  no({
    id: 'calculadora', nome: 'Calculadora de Repartição', ramo: 'Retificação', capitulo: 4, custo: 5, requer: ['retificacao'],
    descricao: 'Contas direto no servidor.',
    libera: [
      e('$inc', '{ $inc: { campo: n } }', 'Soma n ao valor (use negativo para subtrair). Falha se o campo for texto.', "db.arquivistas.updateMany({ turno: 'noite' }, { $inc: { creditos: 50 } })"),
      e('$mul', '{ $mul: { campo: n } }', 'Multiplica o valor por n. Reajuste de 10%: { $mul: { creditos: 1.1 } }.'),
      e('$min', '{ $min: { campo: teto } }', 'Só altera se o novo valor for MENOR que o atual. Serve de teto: ninguém fica acima.'),
      e('$max', '{ $max: { campo: piso } }', 'Só altera se o novo valor for MAIOR que o atual. Serve de piso: ninguém fica abaixo.'),
    ],
  }),
  no({
    id: 'cadastro-fantasma', nome: 'Cadastro Fantasma', ramo: 'Retificação', capitulo: 4, custo: 4, requer: ['retificacao'],
    descricao: 'Atualizar quem talvez não exista.',
    libera: [e('upsert', '{ upsert: true }', 'Opção de updateOne/updateMany/replaceOne: se nada bater com o filtro, cria o documento (com os campos de igualdade do filtro + a alteração). Se bater, só altera.', "db.arquivistas.updateOne({ nome: 'X' }, { $set: { turno: 'noite' } }, { upsert: true })")],
  }),
  no({
    id: 'formulario-novo', nome: 'Formulário Novo', ramo: 'Retificação', capitulo: 4, custo: 4, requer: ['retificacao'],
    descricao: 'Trocar o documento inteiro.',
    libera: [e('replaceOne', 'db.colecao.replaceOne(filtro, documentoNovo)', 'Substitui o documento INTEIRO (mantendo o _id). Campos que não estiverem no documento novo SOMEM. Não aceita operadores como $set.', "db.almas.replaceOne({ protocolo: 'X' }, { protocolo: 'X', nome: 'Y' })")],
  }),
  no({
    id: 'expurgo', nome: 'Expurgo', ramo: 'Retificação', capitulo: 4, custo: 6, requer: ['retificacao'],
    descricao: 'Apagar fichas e coleções.',
    libera: [
      e('deleteOne', 'db.colecao.deleteOne(filtro)', 'Apaga o primeiro documento que bate. Confira antes com find!'),
      e('deleteMany', 'db.colecao.deleteMany(filtro)', 'Apaga TODOS os que batem. Com {} apaga a coleção inteira — por isso o filtro é obrigatório.', "db.almas.deleteMany({ setor: 'Arquivo Morto', ativo: false })"),
      e('drop', 'db.colecao.drop()', 'Apaga a coleção inteira, com índices e validador. Devolve true se ela existia.'),
    ],
  }),

  // ------------------------------------------------------------------ Cap. 5 — Anexos
  no({
    id: 'grampeador', nome: 'Grampeador', ramo: 'Anexos', capitulo: 5, custo: 6, requer: ['retificacao'],
    descricao: 'Acrescentar itens a arrays.',
    libera: [
      e('$push', '{ $push: { array: valor } }', 'Acrescenta um item no fim do array (cria o array se não existir).', "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $push: { vinculos: 'neta' } })"),
      e('$each', '{ $push: { array: { $each: [v1, v2] } } }', 'Acrescenta vários itens de uma vez. Sem $each, a lista inteira viraria UM item.'),
      e('$position', '{ $each: [...], $position: 0 }', 'Em que posição inserir (0 = começo).'),
      e('$sort', '{ $each: [...], $sort: 1 | { campo: -1 } }', 'Ordena o array depois de inserir.'),
      e('$slice', '{ $each: [...], $slice: n }', 'Mantém só os n primeiros (ou os n últimos, com n negativo) depois de inserir e ordenar.'),
    ],
  }),
  no({
    id: 'sem-repeticao', nome: 'Sem Repetição', ramo: 'Anexos', capitulo: 5, custo: 4, requer: ['grampeador'],
    descricao: 'Acrescentar sem duplicar.',
    libera: [e('$addToSet', '{ $addToSet: { array: valor } }', 'Acrescenta o item só se ele ainda não estiver no array. Combina com $each.', "db.arquivistas.updateMany({ turno: 'noite' }, { $addToSet: { habilidades: 'caligrafia' } })")],
  }),
  no({
    id: 'tesoura', nome: 'Tesoura', ramo: 'Anexos', capitulo: 5, custo: 5, requer: ['grampeador'],
    descricao: 'Tirar itens de arrays.',
    libera: [
      e('$pull', '{ $pull: { array: valor | condicao } }', 'Remove todos os itens iguais ao valor (ou que atendem à condição).', "db.almas.updateMany({}, { $pull: { vinculos: 'ex-sócio' } })"),
      e('$pop', '{ $pop: { array: 1 | -1 } }', 'Remove o ÚLTIMO item (1) ou o PRIMEIRO (-1).'),
      e('$pullAll', '{ $pullAll: { array: [v1, v2] } }', 'Remove todos os itens iguais a qualquer valor da lista.'),
    ],
  }),
  no({
    id: 'posicional', nome: 'Dedo Posicional', ramo: 'Anexos', capitulo: 5, custo: 5, requer: ['grampeador'],
    descricao: 'Alterar o item do array que bateu com o filtro.',
    libera: [e('$ (posicional)', '{ "array.$": novoValor }', 'O $ no caminho representa o PRIMEIRO item do array que bateu com o filtro. O filtro precisa mencionar o array.', "db.almas.updateOne({ protocolo: 'X', vinculos: 'ex-sócio' }, { $set: { 'vinculos.$': 'sócio' } })")],
  }),
  no({
    id: 'filtros-de-anexo', nome: 'Filtros de Anexo', ramo: 'Anexos', capitulo: 5, custo: 6, requer: ['posicional'],
    descricao: 'Alterar TODOS os itens do array que atendem a uma condição.',
    libera: [
      e('arrayFilters', '{ arrayFilters: [ { "apelido.campo": cond } ] }', 'Opção do update que define quais itens o $[apelido] representa.'),
      e('$[<apelido>]', '{ "array.$[a].campo": valor }', 'Aplica a alteração a todos os itens que atendem ao filtro do apelido.', "db.almas.updateMany({}, { $set: { 'audiencias.$[a].parecer': 'C' } }, { arrayFilters: [{ 'a.parecer': 'Z' }] })"),
      e('$[]', '{ "array.$[].campo": valor }', 'Aplica a alteração a TODOS os itens do array, sem condição.'),
    ],
  }),

  // ------------------------------------------------------------------ Cap. 6 — Grafologia
  no({
    id: 'grafologia', nome: 'Grafologia', ramo: 'Grafologia', capitulo: 6, custo: 6, requer: ['pericia-de-fichas'],
    descricao: 'Buscar por padrões de texto (expressões regulares).',
    libera: [
      e('$regex', '{ campo: /padrao/ }  ou  { campo: { $regex: "padrao" } }', 'Casa textos com um padrão. ^ começo, $ fim, . qualquer caractere, * zero ou mais, + um ou mais, ? opcional, [abc] um destes, [^abc] nenhum destes, a|b um ou outro, {n} {n,} {n,m} repetições, \\d dígito, \\w letra/número/_, \\s espaço, \\. ponto literal.', "db.almas.find({ protocolo: /^A-19/ })"),
      e('$options', '{ $regex: "padrao", $options: "i" }', 'Opções do padrão. "i" ignora maiúsculas/minúsculas (igual a /padrao/i).'),
    ],
  }),
  no({
    id: 'negacao', nome: 'Carimbo de Negação', ramo: 'Grafologia', capitulo: 6, custo: 4, requer: ['grafologia'],
    descricao: 'Inverter uma condição.',
    libera: [e('$not', '{ campo: { $not: /padrao/ | { $gt: 5 } } }', 'Traz o que NÃO atende à condição — incluindo quem nem tem o campo.', "db.almas.find({ protocolo: { $not: /^[A-Z]-\\d{4}-\\d{4}$/ } })")],
  }),

  // ------------------------------------------------------------------ Cap. 7 — Regulamento
  no({
    id: 'norma', nome: 'Norma Técnica', ramo: 'Regulamento', capitulo: 7, custo: 8, requer: ['pericia-de-fichas'],
    descricao: 'Criar coleções com validação de schema.',
    libera: [
      e('createCollection', 'db.createCollection(nome, { validator: { $jsonSchema: {...} } })', 'Cria a coleção já com regras. Documento que não obedece é recusado com "Document failed validation".', "db.createCollection('protocolos', { validator: { $jsonSchema: { required: ['numero'], properties: { numero: { bsonType: 'string' } } } } })"),
      e('$jsonSchema', '{ $jsonSchema: { bsonType, required, properties, ... } }', 'Palavras-chave: required (lista de obrigatórios), bsonType ("string", "int", "double", "number", "object", "array", "date"), enum (valores permitidos), minimum/maximum (números), minLength (texto), minItems/items (arrays), pattern (regex em texto), properties (regras por campo, inclusive subdocumentos). Também serve como filtro: find({ $nor: [{ $jsonSchema: ... }] }) lista quem viola.'),
      e('validator', '{ validator: {...} }', 'Opção de createCollection/collMod com as regras da coleção.'),
      e('getCollectionInfos', 'db.getCollectionInfos({ name: "colecao" })', 'Mostra o validador, o validationLevel e o validationAction atuais.'),
    ],
  }),
  no({
    id: 'indice-unico', nome: 'Índice Único', ramo: 'Regulamento', capitulo: 7, custo: 5, requer: ['norma'],
    descricao: 'Impedir valores repetidos.',
    libera: [
      e('createIndex', 'db.colecao.createIndex({ campo: 1 }, { unique: true })', 'Cria um índice. Com unique: true, um segundo documento com o mesmo valor gera E11000 duplicate key. Schema não impede repetição — índice impede.', "db.protocolos.createIndex({ numero: 1 }, { unique: true })"),
      e('getIndexes', 'db.colecao.getIndexes()', 'Lista os índices da coleção.'),
      e('dropIndex', 'db.colecao.dropIndex("nome_1")', 'Remove um índice pelo nome.'),
    ],
  }),
  no({
    id: 'emenda', nome: 'Emenda ao Regulamento', ramo: 'Regulamento', capitulo: 7, custo: 8, requer: ['norma'],
    descricao: 'Mudar as regras de uma coleção existente.',
    libera: [
      e('runCommand', 'db.runCommand({ ... })', 'Executa um comando administrativo do servidor.'),
      e('collMod', 'db.runCommand({ collMod: "colecao", validator: {...} })', 'Troca o validador de uma coleção que já existe. ATENÇÃO: o validador novo SUBSTITUI o antigo por inteiro — não faz merge.'),
      e('validationLevel', '{ validationLevel: "strict" | "moderate" }', 'strict: toda inserção e atualização é validada. moderate: documentos que JÁ eram inválidos podem ser atualizados livremente (útil para migrar legado).'),
      e('validationAction', '{ validationAction: "error" | "warn" }', 'error: recusa o documento inválido. warn: aceita, mas grava um aviso no log do servidor.'),
    ],
  }),

  // ------------------------------------------------------------------ Cap. 8 a 11 — Relatórios
  no({
    id: 'esteira', nome: 'Esteira de Relatórios', ramo: 'Relatórios', capitulo: 8, custo: 8, requer: ['fila-organizada'],
    descricao: 'Pipelines de agregação: uma esteira de estágios.',
    libera: [
      e('aggregate', 'db.colecao.aggregate([ estagio1, estagio2, ... ])', 'Passa os documentos por uma sequência de estágios; a saída de um é a entrada do próximo.', "db.almas.aggregate([{ $match: { setor: 'Limbo' } }, { $sort: { nome: 1 } }])"),
      e('$match', '{ $match: filtro }', 'Filtra, com a mesma sintaxe do find. Pode aparecer várias vezes no pipeline.'),
      e('$project', '{ $project: { campo: 1, novo: expressao, _id: 0 } }', 'Escolhe campos e cria campos calculados. Em expressões, "$campo" é o valor do campo.'),
      e('$sort@agregacao', '{ $sort: { campo: 1 | -1 } }', 'Ordena os documentos que passam pela esteira.'),
      e('$limit', '{ $limit: n }', 'Deixa passar só os n primeiros.'),
      e('$skip', '{ $skip: n }', 'Descarta os n primeiros.'),
      e('$addFields', '{ $addFields: { novo: expressao } }', 'Acrescenta campos sem remover os outros. $set é sinônimo em pipelines.'),
    ],
  }),
  no({
    id: 'concatenacao', nome: 'Concatenação', ramo: 'Relatórios', capitulo: 8, custo: 3, requer: ['esteira'],
    descricao: 'Juntar textos num campo só.',
    libera: [e('$concat', '{ $concat: ["$campo1", " - ", "$campo2"] }', 'Junta textos. Se algum valor for nulo ou ausente, o resultado é null; números precisam de $toString.', "db.almas.aggregate([{ $project: { rotulo: { $concat: ['$nome', ' (', '$setor', ')'] } } }])")],
  }),
  no({
    id: 'agrupamento', nome: 'Agrupamento', ramo: 'Relatórios', capitulo: 9, custo: 8, requer: ['esteira'],
    descricao: 'Juntar documentos em grupos e calcular totais.',
    libera: [
      e('$group', '{ $group: { _id: "$campo", total: { $sum: 1 } } }', 'Um documento de saída por valor distinto de _id. _id: null agrupa tudo; _id: { a: "$a", b: "$b" } agrupa por dois campos.', "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }])"),
      e('$sum', '{ $sum: 1 | "$campo" }', 'Soma. $sum: 1 conta documentos. Ignora valores que não são números.'),
      e('$avg', '{ $avg: "$campo" }', 'Média. Ignora textos — cuidado com dados legados.'),
      e('$min@agregacao', '{ $min: "$campo" }', 'Menor valor do grupo.'),
      e('$max@agregacao', '{ $max: "$campo" }', 'Maior valor do grupo.'),
    ],
  }),
  no({
    id: 'coleta', nome: 'Coleta', ramo: 'Relatórios', capitulo: 9, custo: 6, requer: ['agrupamento'],
    descricao: 'Juntar listas dentro de cada grupo e contar o resultado.',
    libera: [
      e('$first', '{ $first: "$campo" }', 'Valor do PRIMEIRO documento do grupo (depende de um $sort antes).'),
      e('$last', '{ $last: "$campo" }', 'Valor do ÚLTIMO documento do grupo.'),
      e('$push@agregacao', '{ $push: "$campo" }', 'Lista com os valores de todos os documentos do grupo (com repetição).'),
      e('$addToSet@agregacao', '{ $addToSet: "$campo" }', 'Lista com os valores distintos do grupo (sem repetição, ordem não garantida).'),
      e('$count', '{ $count: "nomeDoCampo" }', 'Estágio que substitui tudo por um único documento com a contagem.', "db.almas.aggregate([{ $match: { setor: 'Limbo' } }, { $count: 'total' }])"),
    ],
  }),
  no({
    id: 'desdobramento', nome: 'Desdobramento', ramo: 'Relatórios', capitulo: 10, custo: 8, requer: ['agrupamento'],
    descricao: 'Transformar cada item de um array em um documento.',
    libera: [
      e('$unwind', '{ $unwind: "$array" }', 'Cria um documento para cada item do array (os demais campos se repetem). Documentos com array vazio ou sem o campo desaparecem.', "db.almas.aggregate([{ $unwind: '$audiencias' }, { $count: 'total' }])"),
      e('$year', '{ $year: "$campoData" }', 'Extrai o ano de uma data. Existem também $month e $dayOfMonth.'),
      e('$month', '{ $month: "$campoData" }', 'Extrai o mês (1 a 12).'),
    ],
  }),
  no({
    id: 'parecer', nome: 'Parecer Técnico', ramo: 'Relatórios', capitulo: 11, custo: 7, requer: ['esteira'],
    descricao: 'Decisões dentro do pipeline.',
    libera: [
      e('$cond', '{ $cond: { if: cond, then: a, else: b } }  ou  { $cond: [cond, a, b] }', 'Se a condição for verdadeira, vale a; senão, b. Pode ser aninhado: o else de um $cond pode ser outro $cond.', "db.almas.aggregate([{ $project: { antiga: { $cond: [{ $gt: ['$anos_pendentes', 50] }, true, false] } } }])"),
      e('$switch', '{ $switch: { branches: [ { case: cond, then: v } ], default: v } }', 'Várias faixas, lidas de cima para baixo. Mais legível que $cond aninhado.'),
      e('$ifNull', '{ $ifNull: ["$campo", padrao] }', 'Usa o padrão quando o campo é nulo ou ausente.'),
    ],
  }),
  no({
    id: 'expressao', nome: 'Expressão Livre', ramo: 'Relatórios', capitulo: 11, custo: 6, requer: ['parecer'],
    descricao: 'Comparar campos entre si e montar objetos.',
    libera: [
      e('$expr', '{ $expr: { $gt: ["$campo1", "$campo2"] } }', 'Usa expressões de aggregate dentro de um filtro (find ou $match) — por exemplo, comparar dois campos do mesmo documento.', "db.almas.find({ $expr: { $gt: [{ $size: '$audiencias' }, { $size: '$vinculos' }] } })"),
      e('$arrayToObject', '{ $arrayToObject: [ { k: "chave", v: valor } ] }', 'Transforma uma lista de pares { k, v } em um objeto — ótimo para "pivotar" resultados.'),
    ],
  }),

  // ------------------------------------------------------------------ Cap. 12 — Diretoria
  no({
    id: 'teoria', nome: 'Assento na Diretoria', ramo: 'Diretoria', capitulo: 12, custo: 3, requer: ['credencial-provisoria'],
    descricao: 'Tomar decisões de arquitetura.',
    libera: [
      e('diretoria.classificar', 'diretoria.classificar({ situacao: "volume" | "velocidade" | "variedade" })', 'Os 3 Vs do Big Data: VOLUME é quanto se guarda, VELOCIDADE é a pressa com que chega, VARIEDADE é a diversidade de formatos.'),
      e('diretoria.recomendar', 'diretoria.recomendar({ departamento: "chave-valor" | "documento" | "coluna larga" | "grafo" })', 'Chave-valor: acesso direto por chave, simples e rapidíssimo (sessões, cache). Documento: registros ricos e flexíveis (fichas). Coluna larga: bilhões de linhas por chave e tempo (telemetria). Grafo: relações e caminhos (quem conhece quem).'),
      e('prova.questoes', 'prova.questoes()', 'Mostra as questões da Prova de Credenciamento.'),
      e('prova.responder', "prova.responder(['a', 'b', ...])", 'Entrega as respostas da prova, na ordem das questões.'),
    ],
  }),
  no({
    id: 'replicacao', nome: 'Segunda Repartição', ramo: 'Diretoria', capitulo: 12, custo: 6, requer: ['teoria'],
    descricao: 'Cópias do arquivo em vários servidores.',
    libera: [
      e('rs.initiate', 'rs.initiate()  ou  rs.initiate({ _id, members: [{ host }] })', 'Inicia um replica set: um primário recebe as gravações e secundários mantêm cópias.'),
      e('rs.add', 'rs.add("host:porta")', 'Adiciona um membro. Com número ímpar de membros, sempre há maioria para eleger um novo primário.'),
      e('rs.status', 'rs.status()', 'Mostra quem é PRIMARY e quem é SECONDARY.'),
      e('diretoria.simularQueda', 'diretoria.simularQueda()', 'Derruba o primário (ou o host informado) e mostra o que acontece.'),
    ],
  }),
  no({
    id: 'consistencia', nome: 'Tratado de Consistência', ramo: 'Diretoria', capitulo: 12, custo: 6, requer: ['replicacao'],
    descricao: 'Escolher entre consistência e disponibilidade.',
    libera: [
      e('diretoria.configurar', 'diretoria.configurar(fluxo, { writeConcern: { w }, readConcern: { level }, readPreference })', 'w: "majority" só confirma quando a maioria gravou; readConcern "majority" só lê o que a maioria confirmou; readPreference "primary" lê sempre do primário. Juntos dão consistência forte (ACID, CP). w: 1 e leituras em "secondary" priorizam disponibilidade (BASE, AP).'),
      e('diretoria.simularParticao', 'diretoria.simularParticao()', 'Corta a rede entre os prédios e mostra o efeito em cada fluxo (teorema CAP).'),
    ],
  }),
  no({
    id: 'fragmentacao', nome: 'Partilha do Arquivo', ramo: 'Diretoria', capitulo: 12, custo: 6, requer: ['replicacao'],
    descricao: 'Dividir o arquivo entre várias caldeiras (sharding).',
    libera: [
      e('sh.enableSharding', 'sh.enableSharding("iris")', 'Habilita a fragmentação do banco.'),
      e('sh.shardCollection', 'sh.shardCollection("iris.colecao", { campo: 1 | "hashed" })', 'Divide a coleção entre os shards pela shard key. Chave de baixa cardinalidade (poucos valores) cria hotspot; "hashed" espalha por igual.'),
      e('sh.reshardCollection', 'sh.reshardCollection("iris.colecao", { campo: "hashed" })', 'Troca a shard key de uma coleção já fragmentada.'),
      e('sh.status', 'sh.status()', 'Mostra quantos documentos cada shard recebeu.'),
    ],
  }),
];

export const NO_POR_ID = new Map(ARVORE.map((n) => [n.id, n]));
export const NO_POR_CHAVE = new Map(ARVORE.flatMap((n) => n.libera.map((l) => [l.chave, n] as const)));
export const RAIZ = 'credencial-provisoria';

export type SituacaoNo = 'possui' | 'compravel' | 'sem-carimbos' | 'bloqueado' | 'lacrado';

export function situacaoDoNo(no: NoCredencial, possui: ReadonlySet<string>, carimbos: number, capituloAtual = Infinity): SituacaoNo {
  if (possui.has(no.id)) return 'possui';
  if (!no.disponivel || no.capitulo > capituloAtual) return 'lacrado';
  if (!no.requer.every((r) => possui.has(r))) return 'bloqueado';
  return carimbos >= no.custo ? 'compravel' : 'sem-carimbos';
}

/** Verificador plugado no Database: bloqueia o que o jogador ainda não comprou. */
export function criarVerificador(possui: () => ReadonlySet<string>) {
  return (op: Operacao) => {
    const atuais = possui();
    for (const { nome, chave } of chavesDaOperacao(op)) {
      const credencial = NO_POR_CHAVE.get(chave);
      if (credencial && !atuais.has(credencial.id)) throw new CredencialError(nome, credencial.nome);
    }
  };
}

/** Todas as chaves (para o modo de estudo que libera tudo). */
export const TODAS_AS_CREDENCIAIS: ReadonlySet<string> = new Set(ARVORE.map((n) => n.id));
