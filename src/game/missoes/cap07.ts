import type { Capitulo } from './tipos';
import {
  aceita,
  aceitaComAviso,
  colecaoExiste,
  fichasQue,
  historicoTem,
  indiceUnicoEm,
  logTem,
  nenhumaNoArquivo,
  objetivo,
  opcoesDaColecao,
  recusa,
  recusaDuplicado,
  removidas,
  semViolacoes,
  temValidador,
  todas,
  validarPorObjetivos,
  type Objetivo,
} from '../objetivos';
import { NORMA_REQUERIMENTOS } from '../mundo';
import { ehObjetoSimples } from '../../engine/bson';
import { operadoresDaOperacao } from '../../engine/credenciais';

type Doc = Record<string, unknown>;
const P = 'protocolos';
const R = 'requerimentos';

/** Protocolo completo e válido segundo a norma final. As sondas partem dele. */
const V: Doc = {
  numero: 'P-9001',
  requerente: 'Iracema Vilaverde',
  situacao: 'aberto',
  prioridade: 3,
  documentos: ['certidão de óbito'],
  endereco: { cidade: 'Purgatório', uf: 'PG', cep: '00000-000' },
};
const sem = (campo: string): Doc => {
  const copia = { ...V };
  delete copia[campo];
  return copia;
};
const com = (campos: Doc): Doc => ({ ...V, ...campos });

// Normas em texto (usadas nas soluções de referência).
const S71 = "{ bsonType: 'object', required: ['numero', 'requerente', 'situacao'], properties: { numero: { bsonType: 'string' }, requerente: { bsonType: 'string' }, situacao: { bsonType: 'string' } } }";
const P72 = "requerente: { bsonType: 'string', minLength: 3 }, situacao: { enum: ['aberto', 'deferido', 'indeferido'] }, prioridade: { bsonType: 'int', minimum: 1, maximum: 5 }";
const S72 = `{ bsonType: 'object', required: ['numero', 'requerente', 'situacao'], properties: { numero: { bsonType: 'string' }, ${P72} } }`;
const DOCS = "documentos: { bsonType: 'array', minItems: 1, items: { bsonType: 'string' } }";
const R73 = "['numero', 'requerente', 'situacao', 'documentos', 'endereco']";
const S73 = `{ bsonType: 'object', required: ${R73}, properties: { numero: { bsonType: 'string' }, ${P72}, ${DOCS}, endereco: { bsonType: 'object', required: ['cidade'], properties: { cidade: { bsonType: 'string' } } } } }`;
const END74 = "endereco: { bsonType: 'object', required: ['cidade'], properties: { cidade: { bsonType: 'string' }, uf: { bsonType: 'string', pattern: '^[A-Z]{2}$' }, cep: { bsonType: 'string', pattern: '^\\\\d{5}-\\\\d{3}$' } } }";
const NUM74 = "numero: { bsonType: 'string', pattern: '^P-\\\\d{4}$' }";
const S74 = `{ bsonType: 'object', required: ${R73}, properties: { ${NUM74}, ${P72}, ${DOCS}, ${END74} } }`;
const S76 = `{ bsonType: 'object', required: ${R73}, properties: { ${NUM74}, ${P72}, ${DOCS}, ${END74}, canal: { enum: ['balcão', 'carta', 'sonho'] } } }`;

const recriar = (schema: string) => `db.protocolos.drop()\ndb.createCollection('protocolos', { validator: { $jsonSchema: ${schema} } })`;

const regras71 = todas(recusa(P, sem('numero')), recusa(P, com({ numero: 1 })));
const regras72 = todas(regras71, recusa(P, com({ situacao: 'perdido' })), recusa(P, com({ requerente: 'Al' })), recusa(P, com({ prioridade: 9 })));
const regras73 = todas(regras72, recusa(P, com({ documentos: [] })), recusa(P, sem('endereco')));

const obj71: Objetivo[] = [
  objetivo('A coleção protocolos existe e tem validador.', temValidador(P)),
  objetivo('Aceita um protocolo completo.', aceita(P, V)),
  objetivo('Recusa protocolo sem numero, sem requerente ou sem situacao.', todas(recusa(P, sem('numero')), recusa(P, sem('requerente')), recusa(P, sem('situacao')))),
  objetivo('Recusa numero que não é texto.', recusa(P, com({ numero: 1 }))),
];

const obj72: Objetivo[] = [
  objetivo('Aceita um protocolo completo.', aceita(P, V)),
  objetivo("situacao só aceita 'aberto', 'deferido' ou 'indeferido'.", recusa(P, com({ situacao: 'perdido' }))),
  objetivo('prioridade só aceita inteiro de 1 a 5.', todas(recusa(P, com({ prioridade: 9 })), recusa(P, com({ prioridade: 0 })), recusa(P, com({ prioridade: 2.5 })))),
  objetivo('requerente com pelo menos 3 caracteres.', recusa(P, com({ requerente: 'Al' }))),
  objetivo('As regras da norma anterior continuam valendo.', regras71),
];

const obj73: Objetivo[] = [
  objetivo('Aceita um protocolo completo.', aceita(P, V)),
  objetivo('documentos é obrigatório e precisa de pelo menos 1 item.', todas(recusa(P, sem('documentos')), recusa(P, com({ documentos: [] })))),
  objetivo('Cada item de documentos é um texto.', recusa(P, com({ documentos: ['certidão', 42] }))),
  objetivo('endereco é obrigatório e precisa ter cidade.', todas(recusa(P, sem('endereco')), recusa(P, com({ endereco: { uf: 'PG' } })))),
  objetivo('As regras anteriores continuam valendo.', regras72),
];

const obj74: Objetivo[] = [
  objetivo('Aceita um protocolo completo.', aceita(P, V)),
  objetivo('numero no formato P-0000, e nada além.', todas(recusa(P, com({ numero: 'p-12' })), recusa(P, com({ numero: 'XP-12345' })))),
  objetivo('cep no formato 00000-000.', recusa(P, com({ endereco: { cidade: 'Purgatório', uf: 'PG', cep: '123' } }))),
  objetivo('uf com duas letras maiúsculas.', recusa(P, com({ endereco: { cidade: 'Purgatório', uf: 'pg', cep: '00000-000' } }))),
  objetivo('As regras anteriores continuam valendo.', regras73),
];

const obj75: Objetivo[] = [
  objetivo('Existe um índice único no campo numero.', indiceUnicoEm(P, 'numero')),
  objetivo('Um segundo protocolo com o mesmo número é recusado (E11000).', recusaDuplicado(P, com({ numero: 'P-9002' }), com({ numero: 'P-9002' }))),
  objetivo('A norma continua valendo.', todas(aceita(P, V), recusa(P, sem('numero')))),
];

const collModIncompleto = (o: { metodo: string; args: unknown[] }) => {
  const cmd = o.args[0];
  if (o.metodo !== 'runCommand' || !ehObjetoSimples(cmd) || cmd.collMod !== P || !ehObjetoSimples(cmd.validator)) return false;
  const schema = cmd.validator.$jsonSchema;
  return ehObjetoSimples(schema) && !Array.isArray(schema.required);
};

const obj76: Objetivo[] = [
  objetivo('Rodou um collMod só com a regra de canal.', historicoTem(collModIncompleto)),
  objetivo('Enquanto isso, um protocolo sem numero conseguiu entrar.', historicoTem((o) => o.colecao === P && o.metodo === 'insertOne' && !o.erro && ehObjetoSimples(o.args[0]) && !('numero' in o.args[0]))),
  objetivo('A norma completa voltou, agora com a regra de canal.', todas(aceita(P, com({ canal: 'sonho' })), recusa(P, com({ canal: 'telepatia' })), regras73, recusa(P, com({ numero: 'p-12' })))),
  objetivo('O lixo sem numero foi removido.', todas(colecaoExiste(P), nenhumaNoArquivo((d) => !('numero' in d), P))),
];

const obj77: Objetivo[] = [
  objetivo('A norma está aplicada em requerimentos.', temValidador(R)),
  objetivo("Com validationLevel 'moderate'.", opcoesDaColecao(R, { validationLevel: 'moderate' })),
  objetivo('O requerimento legado RQ-0007 (inválido) recebeu revisado: true.', fichasQue((d) => d.codigo === 'RQ-0007', (d) => d.revisado === true, R)),
  objetivo('Um requerimento novo e inválido foi recusado enquanto a ação era error.', historicoTem((o) => o.colecao === R && o.metodo.startsWith('insert') && o.erro === 'DocumentValidationFailure')),
  objetivo("Com validationAction 'warn', um inválido entrou e ficou registrado no log.", todas(opcoesDaColecao(R, { validationAction: 'warn' }), logTem('Document would fail validation'), aceitaComAviso(R, { codigo: 'RQ-9990' }))),
];

const obj78: Objetivo[] = [
  objetivo('A auditoria foi feita: find com $nor + $jsonSchema.', historicoTem((o) => o.colecao === R && o.metodo === 'find' && operadoresDaOperacao(o).includes('$nor') && operadoresDaOperacao(o).includes('$jsonSchema'))),
  objetivo('Nenhum requerimento viola a norma.', semViolacoes(R, NORMA_REQUERIMENTOS)),
  objetivo('Nenhum requerimento foi apagado.', removidas(0, R)),
  objetivo("Norma endurecida: validationLevel 'strict' e validationAction 'error'.", opcoesDaColecao(R, { validationLevel: 'strict', validationAction: 'error' })),
];

const ANEXO_NORMA = {
  variavel: 'normaRequerimentos',
  codigo: [
    'const normaRequerimentos = {',
    '  $jsonSchema: {',
    "    bsonType: 'object',",
    "    required: ['codigo', 'requerente', 'situacao', 'valor'],",
    '    properties: {',
    "      codigo: { bsonType: 'string', pattern: '^RQ-\\\\d{4}$' },",
    "      requerente: { bsonType: 'string', minLength: 3 },",
    "      situacao: { enum: ['aberto', 'deferido', 'indeferido'] },",
    "      valor: { bsonType: ['int', 'double'], minimum: 0 }",
    '    }',
    '  }',
    '}',
  ].join('\n'),
};

export const capitulo7: Capitulo = {
  numero: 7,
  titulo: 'O Regulamento',
  fase: 4,
  abertura:
    'Chega de fichas tortas. O Conselho Superior do Além aprovou o Regulamento: a partir de agora, coleções novas nascem com regras, e o legado vai ser saneado. Também encontraram no porão a coleção requerimentos — preenchida à mão por almas nervosas.',
  missoes: [
    {
      id: '7.1',
      titulo: 'A norma nasce',
      assunto: 'Criação da coleção protocolos',
      corpo: 'Crie a coleção `protocolos` com um validador `$jsonSchema`: os campos `numero`, `requerente` e `situacao` são obrigatórios, e os três precisam ser texto (`string`).',
      objetivos: obj71,
      requer: ['norma'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj71),
      solucaoReferencia: `db.createCollection('protocolos', { validator: { $jsonSchema: ${S71} } })`,
      solucoesErradas: [
        { codigo: "db.createCollection('protocolos')", porque: 'criou sem validador' },
        { codigo: "db.createCollection('protocolos', { validator: { $jsonSchema: { required: ['numero', 'requerente', 'situacao'] } } })", porque: 'esqueceu os tipos' },
      ],
      dicas: [
        'createCollection recebe um segundo argumento com { validator: { $jsonSchema: { ... } } }.',
        'Dentro do $jsonSchema: required: [ ... ] lista os obrigatórios; properties: { campo: { bsonType: "string" } } define os tipos.',
        `db.createCollection('protocolos', { validator: { $jsonSchema: ${S71} } })`,
      ],
      recompensa: 4,
      licao: 'createCollection com $jsonSchema: required exige campos, bsonType exige tipos. Documento fora da norma é recusado.',
    },
    {
      id: '7.2',
      titulo: 'Valores permitidos',
      assunto: 'Emenda nº 1 — situações, prioridades, nomes',
      corpo:
        'A norma ficou frouxa. Recrie `protocolos` (a coleção ainda está vazia: pode apagar e criar de novo) mantendo as regras anteriores e acrescentando: `situacao` só aceita `aberto`, `deferido` ou `indeferido`; `prioridade`, quando existir, é inteiro de 1 a 5; `requerente` tem pelo menos 3 caracteres.',
      objetivos: obj72,
      requer: ['norma'],
      depoisDe: ['7.1'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj72),
      solucaoReferencia: recriar(S72),
      solucoesErradas: [
        { codigo: recriar(S71), porque: 'recriou a norma antiga' },
        { codigo: recriar(S72.replace("bsonType: 'int'", "bsonType: 'number'")), porque: "prioridade 'number' aceita 2.5" },
      ],
      dicas: [
        'db.protocolos.drop() e depois db.createCollection de novo, com a norma inteira (antiga + novas regras).',
        "enum: [ ... ] lista valores permitidos; bsonType: 'int' com minimum e maximum faz a faixa; minLength vale para textos.",
        recriar(S72),
      ],
      recompensa: 5,
      licao: 'enum restringe valores; minimum/maximum valem para números, minLength para textos. bsonType "int" recusa 2.5.',
    },
    {
      id: '7.3',
      titulo: 'Estruturas',
      assunto: 'Emenda nº 2 — anexos e endereço',
      corpo:
        'Todo protocolo agora precisa de `documentos`: uma lista com PELO MENOS um item, e cada item é texto. E de `endereco`: um subdocumento que tem obrigatoriamente `cidade` (texto). Recrie a coleção mantendo tudo o que já valia.',
      objetivos: obj73,
      requer: ['norma'],
      depoisDe: ['7.2'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj73),
      solucaoReferencia: recriar(S73),
      solucoesErradas: [
        { codigo: recriar(S73.replace('minItems: 1, ', '')), porque: 'aceita lista vazia' },
        { codigo: recriar(S73.replace(R73, "['numero', 'requerente', 'situacao', 'documentos']")), porque: 'endereco não ficou obrigatório' },
      ],
      dicas: [
        'Arrays e subdocumentos também têm regras. Os dois precisam entrar no required.',
        "documentos: { bsonType: 'array', minItems: 1, items: { bsonType: 'string' } }. endereco: { bsonType: 'object', required: ['cidade'], properties: { cidade: {...} } }.",
        recriar(S73),
      ],
      recompensa: 5,
      licao: 'minItems e items validam arrays; um subdocumento tem seu próprio required e properties.',
    },
    {
      id: '7.4',
      titulo: 'Formato oficial',
      assunto: 'Emenda nº 3 — padrões de escrita',
      corpo:
        'Últimos detalhes: `numero` no formato `P-` seguido de 4 dígitos (e nada mais); dentro de `endereco`, `uf` com duas letras maiúsculas e `cep` no formato `00000-000`, quando existirem. Recrie mantendo tudo.',
      objetivos: obj74,
      requer: ['norma'],
      depoisDe: ['7.3'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj74),
      solucaoReferencia: recriar(S74),
      solucoesErradas: [
        { codigo: recriar(S74.replace("'^P-\\\\d{4}$'", "'P-\\\\d{4}'")), porque: 'padrão sem âncoras' },
        { codigo: recriar(S74.replace(", pattern: '^[A-Z]{2}$'", '')), porque: 'esqueceu a regra da uf' },
      ],
      dicas: [
        'pattern recebe uma expressão regular em forma de texto e só vale para campos string.',
        "No texto, a barra invertida é dobrada: pattern: '^P-\\\\d{4}$'. As regras de uf e cep vão dentro de endereco.properties.",
        recriar(S74),
      ],
      recompensa: 5,
      licao: 'pattern valida o formato de textos com regex; ancore com ^ e $ para não aceitar lixo em volta.',
    },
    {
      id: '7.5',
      titulo: 'Protocolo é único',
      assunto: 'Números repetidos',
      corpo: 'Dois protocolos com o mesmo `numero` quase causaram uma ressurreição por engano. Impeça números repetidos em `protocolos` — e repare: o $jsonSchema não sabe fazer isso.',
      objetivos: obj75,
      requer: ['indice-unico'],
      depoisDe: ['7.4'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj75),
      solucaoReferencia: 'db.protocolos.createIndex({ numero: 1 }, { unique: true })',
      solucoesErradas: [
        { codigo: 'db.protocolos.createIndex({ numero: 1 })', porque: 'índice sem unique' },
        { codigo: 'db.protocolos.createIndex({ requerente: 1 }, { unique: true })', porque: 'campo errado' },
      ],
      dicas: ['Schema valida UM documento por vez; comparar com os outros é trabalho de índice.', 'createIndex({ campo: 1 }, { unique: true }) cria um índice que recusa valores repetidos com E11000.', 'db.protocolos.createIndex({ numero: 1 }, { unique: true })'],
      recompensa: 4,
      licao: 'Unicidade não é regra de schema: é índice único. Duplicata gera E11000 duplicate key.',
    },
    {
      id: '7.6',
      titulo: 'A circular incompleta',
      assunto: 'Emenda nº 4 — canal de atendimento (LEIA ATÉ O FIM)',
      corpo:
        'A Diretoria quer acrescentar a regra `canal`, que só aceita `balcão`, `carta` ou `sonho`. Um estagiário garante que basta rodar `db.runCommand({ collMod: "protocolos", validator: { $jsonSchema: { properties: { canal: { enum: [...] } } } } })`. Faça EXATAMENTE isso, depois tente inserir um protocolo sem `numero` e veja o que acontece. Então conserte: restaure a norma completa (com canal) via collMod e apague o lixo que entrou.',
      objetivos: obj76,
      requer: ['emenda'],
      depoisDe: ['7.5'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj76),
      solucaoReferencia: [
        "db.runCommand({ collMod: 'protocolos', validator: { $jsonSchema: { properties: { canal: { enum: ['balcão', 'carta', 'sonho'] } } } } })",
        "db.protocolos.insertOne({ requerente: 'Lixo sem número' })",
        `db.runCommand({ collMod: 'protocolos', validator: { $jsonSchema: ${S76} } })`,
        'db.protocolos.deleteMany({ numero: { $exists: false } })',
      ].join('\n'),
      solucoesErradas: [
        { codigo: `db.runCommand({ collMod: 'protocolos', validator: { $jsonSchema: ${S76} } })`, porque: 'pulou o experimento pedido' },
        {
          codigo: "db.runCommand({ collMod: 'protocolos', validator: { $jsonSchema: { properties: { canal: { enum: ['balcão', 'carta', 'sonho'] } } } } }); db.protocolos.insertOne({ requerente: 'Lixo sem número' })",
          porque: 'não restaurou a norma',
        },
      ],
      dicas: [
        'Depois do primeiro collMod, rode db.getCollectionInfos({ name: "protocolos" }) e olhe o validador. Cadê o required?',
        'collMod SUBSTITUI o validador inteiro — não junta com o antigo. Para acrescentar uma regra, mande a norma completa + a regra nova.',
        'collMod com a norma inteira (a do memorando 7.4) mais canal: { enum: [...] }, e depois db.protocolos.deleteMany({ numero: { $exists: false } }).',
      ],
      recompensa: 6,
      licao: 'collMod troca o validador por inteiro. Emendar uma norma = reenviar a norma completa com a mudança.',
    },
    {
      id: '7.7',
      titulo: 'Tolerância ao legado',
      assunto: 'Aplicação gradual em requerimentos',
      corpo:
        'A coleção `requerimentos` tem papelada antiga fora da norma (anexada no terminal como `normaRequerimentos`). 1) Aplique a norma com `validationLevel: "moderate"` e ação `"error"`. 2) Marque o legado `RQ-0007` (inválido) com `revisado: true` — deve passar. 3) Tente inserir um requerimento novo e inválido — deve ser recusado. 4) Mude a ação para `"warn"` e insira um inválido: ele entra, mas vai para o log do servidor.',
      anexo: ANEXO_NORMA,
      objetivos: obj77,
      requer: ['emenda'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj77),
      solucaoReferencia: [
        "db.runCommand({ collMod: 'requerimentos', validator: normaRequerimentos, validationLevel: 'moderate', validationAction: 'error' })",
        "db.requerimentos.updateOne({ codigo: 'RQ-0007' }, { $set: { revisado: true } })",
        "try { db.requerimentos.insertOne({ codigo: 'RQ-9999', situacao: 'perdido' }) } catch (e) { print('recusado, como esperado') }",
        "db.runCommand({ collMod: 'requerimentos', validationAction: 'warn' })",
        "db.requerimentos.insertOne({ codigo: 'RQ-9998', situacao: 'perdido' })",
      ].join('\n'),
      solucoesErradas: [
        {
          codigo: "db.runCommand({ collMod: 'requerimentos', validator: normaRequerimentos, validationLevel: 'strict' }); try { db.requerimentos.updateOne({ codigo: 'RQ-0007' }, { $set: { revisado: true } }) } catch (e) {}",
          porque: 'strict não deixa atualizar o legado',
        },
        {
          codigo: "db.runCommand({ collMod: 'requerimentos', validator: normaRequerimentos, validationLevel: 'moderate', validationAction: 'error' }); db.requerimentos.updateOne({ codigo: 'RQ-0007' }, { $set: { revisado: true } })",
          porque: 'parou antes dos testes de inserção e do warn',
        },
      ],
      dicas: [
        'São quatro passos, em comandos separados. Leia o erro de cada um e confira a aba Log do servidor.',
        'moderate: documentos que JÁ eram inválidos podem ser atualizados; inserções novas continuam validadas. warn: aceita o inválido e registra um aviso no log.',
        "collMod com validator: normaRequerimentos, validationLevel: 'moderate', validationAction: 'error'; updateOne no RQ-0007; um insertOne inválido; collMod só com validationAction: 'warn'; outro insertOne inválido.",
      ],
      recompensa: 6,
      licao: 'moderate perdoa atualizações de legado inválido, mas não inserções novas; warn deixa passar e registra no log.',
    },
    {
      id: '7.8',
      titulo: 'Endurecer a norma',
      assunto: 'Saneamento final de requerimentos',
      corpo:
        'Hora de acabar com o legado. Liste os requerimentos inválidos com `$nor` + `$jsonSchema` (a norma está no terminal como `normaRequerimentos`), corrija cada tipo de problema SEM apagar nada (inclusive o RQ-9998, que entrou com aviso) até a auditoria voltar vazia, e endureça a coleção para `strict` + `error`.',
      anexo: ANEXO_NORMA,
      objetivos: obj78,
      requer: ['emenda'],
      depoisDe: ['7.7'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj78),
      solucaoReferencia: [
        'db.requerimentos.find({ $nor: [normaRequerimentos] })',
        "db.requerimentos.updateMany({ valor: { $type: 'string' } }, [{ $set: { valor: { $toInt: '$valor' } } }])",
        "db.requerimentos.updateMany({ situacao: 'ABERTO' }, { $set: { situacao: 'aberto' } })",
        "db.requerimentos.updateMany({ requerente: { $exists: false } }, { $set: { requerente: 'Desconhecido' } })",
        "db.requerimentos.updateOne({ codigo: 'RQ-9998' }, { $set: { situacao: 'aberto', valor: 0 } })",
        "db.runCommand({ collMod: 'requerimentos', validator: normaRequerimentos, validationLevel: 'strict', validationAction: 'error' })",
      ].join('\n'),
      solucoesErradas: [
        {
          codigo: "db.requerimentos.deleteMany({ $nor: [normaRequerimentos] }); db.runCommand({ collMod: 'requerimentos', validator: normaRequerimentos, validationLevel: 'strict', validationAction: 'error' })",
          porque: 'apagou o legado em vez de corrigir',
        },
        { codigo: "db.requerimentos.find({ $nor: [normaRequerimentos] }); db.runCommand({ collMod: 'requerimentos', validationLevel: 'strict', validationAction: 'error' })", porque: 'endureceu sem corrigir' },
      ],
      dicas: [
        'Rode a auditoria e agrupe os problemas: valor como texto, situação em maiúsculas, requerente ausente, e o RQ-9998.',
        "Texto para número: update com pipeline [{ $set: { valor: { $toInt: '$valor' } } }]. Campo ausente: $exists: false + $set. Depois, collMod com strict/error.",
        "updateMany com $toInt no valor; updateMany situacao 'ABERTO' → 'aberto'; updateMany requerente ausente → 'Desconhecido'; corrigir RQ-9998; collMod strict + error.",
      ],
      recompensa: 6,
      licao: 'Migração segura: auditar com $nor + $jsonSchema, corrigir o legado, e só então endurecer para strict.',
    },
  ],
};
