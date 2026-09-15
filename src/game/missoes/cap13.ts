import type { Capitulo } from './tipos';
import {
  aceita,
  fichasQue,
  indiceUnicoEm,
  intactas,
  nenhumaNoArquivo,
  objetivo,
  ordemComoReferencia,
  recusa,
  respostaCompleta,
  respostaE,
  semCampo,
  somenteCampos,
  temValidador,
  todas,
  todasSao,
  validarPorObjetivos,
  type Conferencia,
  type Objetivo,
} from '../objetivos';
import { validarConsulta, validarEscrita, type ContextoValidacao } from '../validacao';
import { canonico } from '../../engine/bson';
import { lista, relatorio, type Doc } from './relatorio';

const aud = (d: Doc) => (Array.isArray(d.audiencias) ? (d.audiencias as { parecer: string; peso: number }[]) : []);
const vinc = (d: Doc) => (Array.isArray(d.vinculos) ? (d.vinculos as string[]) : []);
const OFICIAL = /^[AB]-\d{4}-\d{4}$/;
const S = 'sentencas';

/** Nada além do que a solução de referência mudaria foi mexido no arquivo de almas. */
const soOPedido: Conferencia = (ctx) => validarEscrita({ colecao: 'almas' })(ctx).ok;

// --- critérios do Juízo ---------------------------------------------------------

const mereceCeu = (d: Doc) => d.setor === 'Ante-Sala' && d.ativo === true && aud(d).length > 0 && aud(d).every((a) => a.parecer === 'A' || a.parecer === 'B');
const condenada = (d: Doc) => aud(d).some((a) => a.parecer === 'Z' && a.peso >= 40) && typeof d.pendencia === 'string' && /^(Dívida|Herança)/.test(d.pendencia);
const recorre = (d: Doc) => d.destino === 'Inferno' && vinc(d).includes('mãe');

// --- 13.1 -------------------------------------------------------------------------

const PIPELINE_BALANCA =
  "[{ $match: { setor: { $in: ['Purgatório', 'Ante-Sala'] }, ativo: true, 'audiencias.0': { $exists: true } } }, { $unwind: '$audiencias' }, { $group: { _id: '$_id', protocolo: { $first: '$protocolo' }, nome: { $first: '$nome' }, saldo: { $sum: { $cond: [{ $in: ['$audiencias.parecer', ['A', 'B']] }, '$audiencias.peso', { $multiply: ['$audiencias.peso', -1] }] } } } }, { $sort: { saldo: -1, nome: 1 } }, { $limit: 10 }, { $project: { _id: 0, protocolo: 1, nome: 1, saldo: 1 } }]";

const obj131: Objetivo[] = [
  objetivo('As 10 almas certas: ativas, do Purgatório ou da Ante-Sala, com os maiores saldos.', respostaCompleta),
  objetivo('saldo = pesos de A e B somados, menos os pesos de C e Z.', respostaE((v) => lista(v).length === 10 && lista(v).every((d) => typeof d.saldo === 'number'))),
  objetivo('Do maior saldo para o menor; empate em ordem alfabética.', ordemComoReferencia),
  objetivo('Só protocolo, nome e saldo, sem _id.', todas(somenteCampos(['protocolo', 'nome', 'saldo']), semCampo('_id'))),
];

// --- 13.2 -------------------------------------------------------------------------

const CEU = "db.almas.updateMany({ setor: 'Ante-Sala', ativo: true, 'audiencias.0': { $exists: true }, 'audiencias.parecer': { $nin: ['C', 'Z'] } }, { $set: { destino: 'Céu' } })";
const INFERNO = "db.almas.updateMany({ audiencias: { $elemMatch: { parecer: 'Z', peso: { $gte: 40 } } }, pendencia: /^(Dívida|Herança)/ }, { $set: { destino: 'Inferno' } })";

const obj132: Objetivo[] = [
  objetivo('Toda alma que merece o Céu recebeu destino: "Céu".', fichasQue(mereceCeu, (d) => d.destino === 'Céu')),
  objetivo('Nenhuma outra foi para o Céu — um único C ou Z já impede.', nenhumaNoArquivo((d) => d.destino === 'Céu' && !mereceCeu(d))),
  objetivo('Toda alma condenada recebeu destino: "Inferno".', fichasQue(condenada, (d) => d.destino === 'Inferno')),
  objetivo('Nenhuma outra foi para o Inferno — parecer Z e peso na MESMA audiência.', nenhumaNoArquivo((d) => d.destino === 'Inferno' && !condenada(d))),
  objetivo('Nada além do destino foi alterado.', soOPedido),
];

// --- 13.3 -------------------------------------------------------------------------

const NORMA_SENTENCAS =
  "{ bsonType: 'object', required: ['protocolo', 'destino', 'motivo', 'pesoTotal'], properties: { protocolo: { bsonType: 'string', pattern: '^[AB]-\\\\d{4}-\\\\d{4}$' }, destino: { enum: ['Céu', 'Inferno'] }, motivo: { bsonType: 'string', minLength: 10 }, pesoTotal: { bsonType: 'int', minimum: 0 } } }";
const CRIAR_SENTENCAS = `db.createCollection('sentencas', { validator: { $jsonSchema: ${NORMA_SENTENCAS} } })\ndb.sentencas.createIndex({ protocolo: 1 }, { unique: true })`;
const LAVRAR = (opcoes: string) =>
  `const julgadas = db.almas.find({ destino: { $exists: true } }).toArray()\ndb.sentencas.insertMany(julgadas.map((a) => ({ protocolo: a.protocolo, destino: a.destino, motivo: 'Julgado pelo Tribunal: ' + a.pendencia, pesoTotal: a.audiencias.reduce((soma, x) => soma + x.peso, 0) }))${opcoes})`;

const SENTENCA: Doc = { protocolo: 'A-0001-0001', destino: 'Céu', motivo: 'Sentença de conferência do Tribunal', pesoTotal: 7 };
const comS = (campos: Doc): Doc => ({ ...SENTENCA, ...campos });
const semMotivo = (): Doc => {
  const copia = { ...SENTENCA };
  delete copia.motivo;
  return copia;
};

/** Primeira alma julgada de cada protocolo no formato oficial. */
function julgadasOficiais(ctx: ContextoValidacao): Map<string, Doc> {
  const mapa = new Map<string, Doc>();
  for (const d of ctx.mundo.colecao('almas').docs) {
    if (typeof d.destino === 'string' && typeof d.protocolo === 'string' && OFICIAL.test(d.protocolo) && !mapa.has(d.protocolo)) mapa.set(d.protocolo, d);
  }
  return mapa;
}

const sentencasDe = (ctx: ContextoValidacao) => (ctx.mundo.existe(S) ? ctx.mundo.colecao(S).docs : []);

const obj133: Objetivo[] = [
  objetivo('A coleção sentencas existe, com validador e índice único em protocolo.', todas(temValidador(S), indiceUnicoEm(S, 'protocolo'))),
  objetivo(
    'A norma recusa: destino fora de Céu/Inferno, protocolo fora do formato oficial, motivo ausente ou curto, pesoTotal negativo ou fracionário.',
    todas(recusa(S, comS({ destino: 'Limbo' })), recusa(S, comS({ protocolo: ' A-1990-0001' })), recusa(S, semMotivo()), recusa(S, comS({ motivo: 'curto' })), recusa(S, comS({ pesoTotal: -1 })), recusa(S, comS({ pesoTotal: 2.5 }))),
  ),
  objetivo('E aceita uma sentença correta.', aceita(S, SENTENCA)),
  objetivo('Uma sentença para cada protocolo oficial julgado — nem a mais, nem a menos.', (ctx) => {
    const esperadas = julgadasOficiais(ctx);
    const docs = sentencasDe(ctx);
    return docs.length > 0 && docs.length === esperadas.size && docs.every((s) => esperadas.has(s.protocolo as string));
  }),
  objetivo('Cada sentença bate com a ficha: mesmo destino e pesoTotal igual à soma dos pesos das audiências.', (ctx) => {
    const esperadas = julgadasOficiais(ctx);
    const docs = sentencasDe(ctx);
    return (
      docs.length > 0 &&
      docs.every((s) => {
        const alma = esperadas.get(s.protocolo as string);
        return !!alma && s.destino === alma.destino && s.pesoTotal === aud(alma).reduce((soma, a) => soma + a.peso, 0);
      })
    );
  }),
];

// --- 13.4 -------------------------------------------------------------------------

const PUSH_RECURSO = "db.almas.updateMany({ destino: 'Inferno', vinculos: 'mãe' }, { $set: { recurso: true }, $push: { audiencias: { $each: [{ parecer: 'R', peso: 0, data: new Date('1953-09-13') }], $position: 0 } } })";
const ABRANDAR = "db.almas.updateMany({ destino: 'Inferno', vinculos: 'mãe' }, { $set: { 'audiencias.$[z].parecer': 'C' } }, { arrayFilters: [{ 'z.parecer': 'Z', 'z.peso': { $lt: 45 } }] })";

const obj134: Objetivo[] = [
  objetivo('Toda alma do Inferno com mãe entre os vínculos tem recurso: true.', fichasQue(recorre, (d) => d.recurso === true)),
  objetivo('A audiência de recurso (parecer R, peso 0) é a PRIMEIRA da lista.', fichasQue(recorre, (d) => aud(d)[0]?.parecer === 'R' && aud(d)[0]?.peso === 0)),
  objetivo('Nelas, TODA audiência Z com peso abaixo de 45 virou C.', fichasQue(recorre, (d) => !aud(d).some((a) => a.parecer === 'Z' && a.peso < 45))),
  objetivo('As de peso 45 ou mais continuam Z, e nenhuma outra alma foi mexida.', soOPedido),
];

// --- 13.5 -------------------------------------------------------------------------

const CONTABILIDADE =
  "db.almas.aggregate([{ $group: { _id: { $ifNull: ['$destino', 'Entre os dois'] }, almas: { $sum: 1 }, mediaAnos: { $avg: { $cond: [{ $eq: [{ $type: '$anos_pendentes' }, 'string'] }, { $toInt: '$anos_pendentes' }, '$anos_pendentes'] } }, recursos: { $sum: { $cond: [{ $eq: ['$recurso', true] }, 1, 0] } } } }, { $project: { _id: 0, destino: '$_id', almas: 1, mediaAnos: 1, recursos: 1 } }, { $sort: { almas: -1 } }])";

const porDestino =
  (campos: string[]): Conferencia =>
  (ctx) => {
    const ref = lista(ctx.referencia().valor);
    const obtido = new Map(lista(ctx.resultado).map((d) => [d.destino, d]));
    return ref.length > 0 && ref.every((r) => {
      const o = obtido.get(r.destino);
      return !!o && campos.every((c) => canonico(o[c]) === canonico(r[c]));
    });
  };

const obj135: Objetivo[] = [
  objetivo('Três linhas: Céu, Inferno e "Entre os dois" (quem ainda não tem destino).', respostaE((v) => lista(v).length === 3 && ['Céu', 'Inferno', 'Entre os dois'].every((n) => lista(v).some((d) => d.destino === n)))),
  objetivo('almas e recursos certos em cada linha.', porDestino(['almas', 'recursos'])),
  objetivo('mediaAnos conta também os anos gravados como texto.', porDestino(['mediaAnos'])),
  objetivo('Só destino, almas, mediaAnos e recursos, sem _id, do maior grupo para o menor.', todas(somenteCampos(['destino', 'almas', 'mediaAnos', 'recursos']), semCampo('_id'), ordemComoReferencia)),
];

// --- 13.6 -------------------------------------------------------------------------

const ABRIR_PORTOES = [
  "const comSentenca = db.sentencas.distinct('protocolo')",
  "db.almas.deleteMany({ destino: 'Céu', protocolo: { $in: comSentenca } })",
  "db.almas.updateMany({ destino: 'Inferno', recurso: { $ne: true }, protocolo: { $in: comSentenca } }, { $set: { ativo: false }, $unset: { endereco: '' } })",
].join('\n');

const protocolosSentenciados = (ctx: ContextoValidacao) => new Set(sentencasDe(ctx).map((s) => s.protocolo));

const obj136: Objetivo[] = [
  objetivo('As almas do Céu com sentença registrada subiram: saíram do arquivo.', (ctx) => {
    const s = protocolosSentenciados(ctx);
    const antes = ctx.mundoInicio.colecao('almas').docs.filter((d) => d.destino === 'Céu' && s.has(d.protocolo));
    return antes.length > 0 && !ctx.mundo.colecao('almas').docs.some((d) => d.destino === 'Céu' && s.has(d.protocolo));
  }),
  objetivo('Quem foi para o Céu SEM sentença continua no arquivo, esperando.', (ctx) => {
    const s = protocolosSentenciados(ctx);
    const ficam = new Set(ctx.mundo.colecao('almas').docs.map((d) => canonico(d._id)));
    const semSentenca = ctx.mundoInicio.colecao('almas').docs.filter((d) => d.destino === 'Céu' && !s.has(d.protocolo));
    return semSentenca.length > 0 && semSentenca.every((d) => ficam.has(canonico(d._id)));
  }),
  objetivo('Condenados com sentença e sem recurso: ativo false e sem endereco.', (ctx) => {
    const s = protocolosSentenciados(ctx);
    return fichasQue((d) => d.destino === 'Inferno' && d.recurso !== true && s.has(d.protocolo), (d) => d.ativo === false && !('endereco' in d))(ctx);
  }),
  objetivo('Quem recorreu ficou exatamente como estava, e nada mais mudou.', todas(intactas((d) => d.recurso === true), soOPedido)),
];

// --- 13.7 -------------------------------------------------------------------------

const ULTIMO_DESPACHO =
  "db.almas.find({ destino: { $exists: false }, ativo: true, setor: { $in: ['Purgatório', 'Ante-Sala'] }, nome: /\\s(da|de|do|das|dos)\\s/, anos_pendentes: { $type: 'number', $gt: 20 }, $expr: { $gt: [{ $size: { $ifNull: ['$audiencias', []] } }, { $size: { $ifNull: ['$vinculos', []] } }] } }, { _id: 0, nome: 1, protocolo: 1, anos_pendentes: 1 }).sort({ anos_pendentes: -1, nome: 1 }).limit(5)";

const entreOsDois = (d: Doc) =>
  !('destino' in d) &&
  d.ativo === true &&
  (d.setor === 'Purgatório' || d.setor === 'Ante-Sala') &&
  typeof d.nome === 'string' &&
  /\s(da|de|do|das|dos)\s/.test(d.nome) &&
  typeof d.anos_pendentes === 'number' &&
  d.anos_pendentes > 20 &&
  aud(d).length > vinc(d).length;

const obj137: Objetivo[] = [
  objetivo('Só almas sem destino, ativas, do Purgatório ou da Ante-Sala, com partícula no sobrenome, mais de 20 anos numéricos e mais audiências que vínculos.', todasSao(entreOsDois)),
  objetivo('As 5 certas, das que esperam há mais tempo; empate em ordem alfabética.', todas(respostaCompleta, ordemComoReferencia)),
  objetivo('Só nome, protocolo e anos_pendentes, sem _id.', todas(somenteCampos(['nome', 'protocolo', 'anos_pendentes']), semCampo('_id'))),
];

export const capitulo13: Capitulo = {
  numero: 13,
  titulo: 'Entre o Céu e o Inferno',
  fase: 5,
  abertura:
    'O Tribunal Celeste marcou o Juízo. O elevador foi religado: a seta de cima leva ao Céu, a de baixo às caldeiras. Cada ficha agora decide uma eternidade — e o arquivo, você sabe bem, está cheio de armadilhas. Nenhum memorando deste capítulo cabe num operador só. Use tudo o que aprendeu, confira antes de protocolar e lembre-se: aqui, um filtro errado manda alguém para o lugar errado para sempre.',
  missoes: [
    {
      id: '13.1',
      titulo: 'A balança',
      assunto: 'Quem está mais perto do Céu',
      corpo:
        'Antes do veredito, o Tribunal quer ver a balança. Considere as almas ATIVAS do `Purgatório` ou da `Ante-Sala` que têm pelo menos uma audiência. O `saldo` de cada alma é a soma dos pesos das audiências com parecer `A` ou `B`, MENOS a soma dos pesos das de parecer `C` ou `Z`. Traga as 10 almas com maior saldo (empate: ordem alfabética de nome), só com `protocolo`, `nome` e `saldo`, sem `_id`. Cuidado: há almas com o mesmo nome.',
      objetivos: obj131,
      requer: ['desdobramento', 'coleta', 'parecer'],
      tipo: 'consulta',
      validar: relatorio(obj131, { ordem: true }),
      solucaoReferencia: `db.almas.aggregate(${PIPELINE_BALANCA})`,
      solucoesErradas: [
        { codigo: `db.almas.aggregate(${PIPELINE_BALANCA.replace(", ativo: true", '')})`, porque: 'esqueceu que só valem as ativas' },
        {
          codigo: `db.almas.aggregate(${PIPELINE_BALANCA.replace("{ $multiply: ['$audiencias.peso', -1] }", '0')})`,
          porque: 'ignorou os pareceres ruins em vez de subtrair',
        },
      ],
      dicas: [
        'Desdobre as audiências, reagrupe cada alma pelo próprio _id e decida, audiência por audiência, se o peso soma ou subtrai.',
        "Dentro do $sum: { $cond: [{ $in: ['$audiencias.parecer', ['A', 'B']] }, '$audiencias.peso', { $multiply: ['$audiencias.peso', -1] }] }. Leve nome e protocolo com $first.",
        `db.almas.aggregate(${PIPELINE_BALANCA})`,
      ],
      recompensa: 8,
      licao: '$unwind + $group pelo _id + $sum com $cond: um saldo por documento, somando e subtraindo conforme cada item do array.',
    },
    {
      id: '13.2',
      titulo: 'O veredito',
      assunto: 'As duas portas',
      corpo:
        'Grave o `destino` das almas, e só dele. **Céu**: almas ATIVAS da `Ante-Sala`, com pelo menos uma audiência, em que TODAS as audiências tiveram parecer `A` ou `B`. **Inferno**: almas (de qualquer setor) com alguma audiência de parecer `Z` e peso 40 ou mais — na MESMA audiência — cuja `pendencia` começa com `Dívida` ou `Herança`. Quem não se encaixar em nenhum dos dois não ganha o campo.',
      objetivos: obj132,
      requer: ['lista-oficial', 'lupa-de-audiencias', 'grafologia', 'retificacao'],
      depoisDe: ['13.1'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj132, validarEscrita({ colecao: 'almas' })),
      solucaoReferencia: `${CEU}\n${INFERNO}`,
      solucoesErradas: [
        {
          codigo: `${CEU.replace("'audiencias.parecer': { $nin: ['C', 'Z'] }", "audiencias: { $elemMatch: { parecer: { $in: ['A', 'B'] } } }")}\n${INFERNO}`,
          porque: 'mandou para o Céu quem tem só UMA audiência boa',
        },
        {
          codigo: `${CEU}\n${INFERNO.replace("audiencias: { $elemMatch: { parecer: 'Z', peso: { $gte: 40 } } }", "'audiencias.parecer': 'Z', 'audiencias.peso': { $gte: 40 }")}`,
          porque: 'Z e peso em audiências diferentes',
        },
      ],
      dicas: [
        '“Todas as audiências são A ou B” é o mesmo que “nenhuma audiência é C ou Z”. E condições sobre UMA audiência pedem outro operador.',
        "Num array, { 'audiencias.parecer': { $nin: ['C', 'Z'] } } exige que NENHUM item seja C ou Z. Para o Inferno: $elemMatch com parecer e peso juntos, e regex /^(Dívida|Herança)/.",
        `${CEU}\n${INFERNO}`,
      ],
      recompensa: 9,
      licao: '$nin num array recusa se QUALQUER item casar; $elemMatch amarra condições ao mesmo item. Um erro aqui manda alguém para o lugar errado.',
    },
    {
      id: '13.3',
      titulo: 'O Livro do Juízo',
      assunto: 'Sentenças lavradas',
      corpo:
        'Crie a coleção `sentencas` com uma norma (`$jsonSchema`): `protocolo` texto no formato oficial `^[AB]-\\d{4}-\\d{4}$`; `destino` só `Céu` ou `Inferno`; `motivo` texto com pelo menos 10 caracteres; `pesoTotal` inteiro, mínimo 0 — os quatro obrigatórios. Um protocolo só pode ter UMA sentença. Depois lavre uma sentença para cada alma julgada: mesmo `protocolo` e `destino`, `motivo` = `"Julgado pelo Tribunal: "` + a pendência, e `pesoTotal` = soma dos pesos das audiências. Almas com protocolo torto ou repetido não podem travar o livro: as válidas precisam entrar todas.',
      objetivos: obj133,
      requer: ['norma', 'indice-unico', 'despacho-em-lote'],
      depoisDe: ['13.2'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj133),
      solucaoReferencia: `${CRIAR_SENTENCAS}\n${LAVRAR(', { ordered: false }')}`,
      solucoesErradas: [
        {
          codigo: `${CRIAR_SENTENCAS.replace(", pattern: '^[AB]-\\\\d{4}-\\\\d{4}$'", '')}\n${LAVRAR(', { ordered: false }')}`,
          porque: 'a norma deixou entrar protocolo torto',
        },
        { codigo: `${CRIAR_SENTENCAS}\n${LAVRAR('')}`, porque: 'o primeiro erro travou o resto do lote' },
      ],
      dicas: [
        'Três partes: createCollection com a norma, createIndex único, e um insertMany montado a partir das almas julgadas. O terminal aceita JavaScript: find(...).toArray().map(...).',
        'Protocolo repetido gera E11000 e protocolo torto gera DocumentValidationFailure. Com { ordered: false }, o insertMany grava todos os válidos e só depois reclama dos outros.',
        `${CRIAR_SENTENCAS}\n${LAVRAR(', { ordered: false }')}`,
      ],
      recompensa: 10,
      licao: 'Norma + índice único + insertMany com ordered: false: o banco filtra o lixo sozinho e as válidas entram todas.',
    },
    {
      id: '13.4',
      titulo: 'O recurso das mães',
      assunto: 'Uma mãe intercede',
      corpo:
        'Toda alma mandada para o Inferno que tem `mãe` entre os vínculos ganhou direito a recurso. Nelas: marque `recurso: true`; coloque uma audiência `{ parecer: "R", peso: 0, data: new Date("1953-09-13") }` como a PRIMEIRA da lista; e transforme em `C` TODAS as audiências de parecer `Z` com peso abaixo de 45 (as de 45 ou mais continuam `Z`). Não mexa no `destino`.',
      objetivos: obj134,
      requer: ['grampeador', 'filtros-de-anexo'],
      depoisDe: ['13.3'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj134, validarEscrita({ colecao: 'almas' })),
      solucaoReferencia: `${PUSH_RECURSO}\n${ABRANDAR}`,
      solucoesErradas: [
        {
          codigo: `${PUSH_RECURSO}\ndb.almas.updateMany({ destino: 'Inferno', vinculos: 'mãe', audiencias: { $elemMatch: { parecer: 'Z', peso: { $lt: 45 } } } }, { $set: { 'audiencias.$.parecer': 'C' } })`,
          porque: 'o posicional $ só troca o primeiro Z',
        },
        { codigo: `${PUSH_RECURSO.replace(', $position: 0', '')}\n${ABRANDAR}`, porque: 'o recurso foi para o fim da lista' },
      ],
      dicas: [
        'São duas mudanças de array diferentes: inserir numa posição e alterar vários itens que atendem a um critério.',
        '$push com $each e $position: 0 insere no topo. Para alterar TODOS os itens que casam, use $[apelido] com arrayFilters — o $ sozinho só pega o primeiro.',
        `${PUSH_RECURSO}\n${ABRANDAR}`,
      ],
      recompensa: 9,
      licao: '$position escolhe onde o item entra; arrayFilters altera todos os itens que casam, o posicional $ só o primeiro.',
    },
    {
      id: '13.5',
      titulo: 'A contabilidade do além',
      assunto: 'Relatório do Juízo para o Conselho',
      corpo:
        'Uma linha por destino — `Céu`, `Inferno` e, para quem ainda não tem destino, `Entre os dois`. Em cada uma: `almas` (quantas), `mediaAnos` (média dos anos pendentes, contando TAMBÉM os que o legado gravou como texto, convertidos para número) e `recursos` (quantas têm `recurso: true`). Só `destino`, `almas`, `mediaAnos` e `recursos`, sem `_id`, do grupo com mais almas para o com menos.',
      objetivos: obj135,
      requer: ['agrupamento', 'parecer'],
      depoisDe: ['13.4'],
      tipo: 'consulta',
      validar: relatorio(obj135, { ordem: true }),
      solucaoReferencia: CONTABILIDADE,
      solucoesErradas: [
        {
          codigo: CONTABILIDADE.replace("{ $avg: { $cond: [{ $eq: [{ $type: '$anos_pendentes' }, 'string'] }, { $toInt: '$anos_pendentes' }, '$anos_pendentes'] } }", "{ $avg: '$anos_pendentes' }"),
          porque: '$avg ignorou os anos gravados como texto',
        },
        { codigo: CONTABILIDADE.replace("{ $ifNull: ['$destino', 'Entre os dois'] }", "'$destino'"), porque: 'quem não tem destino virou null' },
      ],
      dicas: [
        '$avg ignora textos em silêncio — e o Arquivo Morto está cheio deles. Quem não tem destino precisa de um nome antes de agrupar.',
        "No _id: { $ifNull: ['$destino', 'Entre os dois'] }. Na média: { $cond: [{ $eq: [{ $type: '$anos_pendentes' }, 'string'] }, { $toInt: '$anos_pendentes' }, '$anos_pendentes'] }.",
        CONTABILIDADE,
      ],
      recompensa: 9,
      licao: '$ifNull dá nome ao que falta; $type + $toInt dentro do $avg evita que o legado em texto suma da conta.',
    },
    {
      id: '13.6',
      titulo: 'Os portões',
      assunto: 'Céu acima, caldeiras abaixo',
      corpo:
        'Os portões se abrem, mas só para quem tem sentença no livro. **Céu**: as almas com `destino: "Céu"` cuja sentença está em `sentencas` sobem — saem do arquivo. As que foram para o Céu sem sentença ficam, esperando. **Inferno**: as condenadas com sentença e SEM recurso descem — `ativo: false` e o campo `endereco` removido. Quem recorreu não se mexe.',
      objetivos: obj136,
      requer: ['expurgo', 'borracha', 'lista-oficial'],
      depoisDe: ['13.5'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj136, validarEscrita({ colecao: 'almas' })),
      solucaoReferencia: ABRIR_PORTOES,
      solucoesErradas: [
        {
          codigo: ABRIR_PORTOES.replace("db.almas.deleteMany({ destino: 'Céu', protocolo: { $in: comSentenca } })", "db.almas.deleteMany({ destino: 'Céu' })"),
          porque: 'subiu gente sem sentença',
        },
        { codigo: ABRIR_PORTOES.replace(" recurso: { $ne: true },", ''), porque: 'desceu quem ainda tinha recurso' },
      ],
      dicas: [
        'A lista de protocolos com sentença está em outra coleção. Guarde-a numa variável e use-a nos filtros.',
        "const comSentenca = db.sentencas.distinct('protocolo') — depois protocolo: { $in: comSentenca }. Quem recorreu tem recurso: true; filtre com $ne.",
        ABRIR_PORTOES,
      ],
      recompensa: 9,
      licao: 'distinct numa coleção + $in noutra cruza dados sem $lookup; $ne: true também pega quem nem tem o campo.',
    },
    {
      id: '13.7',
      titulo: 'O último despacho',
      assunto: 'Os que ainda esperam',
      corpo:
        'O Juízo termina com as almas que continuam entre os dois. Traga as que: não têm `destino`; estão ativas; estão no `Purgatório` ou na `Ante-Sala`; têm partícula no sobrenome (` da `, ` de `, ` do `, ` das ` ou ` dos `, entre espaços); têm `anos_pendentes` NUMÉRICO acima de 20; e têm mais audiências do que vínculos (quem não tem a lista conta como zero). Só `nome`, `protocolo` e `anos_pendentes`, sem `_id`: as 5 que esperam há mais tempo, empate em ordem alfabética.',
      objetivos: obj137,
      requer: ['grafologia', 'expressao', 'fila-organizada', 'pericia-de-fichas', 'lista-oficial'],
      depoisDe: ['13.6'],
      tipo: 'consulta',
      validar: validarPorObjetivos(obj137, validarConsulta({ colecao: 'almas', ordem: true })),
      solucaoReferencia: ULTIMO_DESPACHO,
      solucoesErradas: [
        { codigo: ULTIMO_DESPACHO.replace('/\\s(da|de|do|das|dos)\\s/', '/d[aeo]s?/'), porque: 'a regex pegou “de” no meio de qualquer nome' },
        { codigo: ULTIMO_DESPACHO.replace('anos_pendentes: -1', 'anos_pendentes: 1'), porque: 'trouxe as que esperam há MENOS tempo' },
      ],
      dicas: [
        'É um find só, com seis condições. Duas delas não são comparações comuns: a partícula (regex com espaços) e “mais audiências que vínculos” (dois campos comparados entre si).',
        "nome: /\\s(da|de|do|das|dos)\\s/; anos_pendentes: { $type: 'number', $gt: 20 }; $expr com $size e $ifNull. Depois projeção, sort e limit.",
        ULTIMO_DESPACHO,
      ],
      recompensa: 10,
      licao: 'Um filtro pode juntar tudo: $in, regex, $type, $expr com $size/$ifNull — e projeção, sort e limit fecham o despacho.',
    },
  ],
};
