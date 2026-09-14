import type { Capitulo } from './tipos';
import { objetivo, ordemComoReferencia, respostaCompleta, respostaE, semCampo, somenteCampos, todas, usouEstagio, valoresComoReferencia, type Objetivo } from '../objetivos';
import { ehObjetoSimples } from '../../engine/bson';
import { lista, relatorio } from './relatorio';

const usouUnwind = objetivo('Desdobrou as audiências com $unwind.', usouEstagio('$unwind'));

const obj101: Objetivo[] = [objetivo('O total de AUDIÊNCIAS (não de almas), em { total: n }.', respostaCompleta), usouUnwind];

const obj102: Objetivo[] = [
  objetivo('Um documento por parecer (A, B, C, Z), com total de audiências.', respostaCompleta),
  objetivo('Em ordem alfabética de parecer.', ordemComoReferencia),
  usouUnwind,
];

const obj103: Objetivo[] = [
  objetivo('Por setor, quantas audiências tiveram parecer A (em aprovacoes).', respostaCompleta),
  objetivo('Do setor com mais aprovações para o com menos; empate em ordem alfabética.', ordemComoReferencia),
];

const obj104: Objetivo[] = [
  objetivo('Um documento por setor, em ordem alfabética.', todas(respostaE((v) => lista(v).length > 1), ordemComoReferencia)),
  objetivo('media: o peso médio das audiências do setor.', valoresComoReferencia(['media'])),
  objetivo('menor e maior: o menor e o maior peso.', valoresComoReferencia(['menor', 'maior'])),
];

const obj105: Objetivo[] = [
  objetivo('As 5 almas com a maior média de peso nas audiências.', respostaCompleta),
  objetivo('Da maior média para a menor; empate em ordem alfabética.', ordemComoReferencia),
  objetivo('Só nome e media, sem _id.', todas(somenteCampos(['nome', 'media']), semCampo('_id'))),
];

const obj106: Objetivo[] = [
  objetivo('Só audiências de 2020 em diante, contadas em total.', respostaCompleta),
  objetivo('Agrupadas por ano E parecer: _id: { ano, parecer }.', respostaE((v) => lista(v).length > 0 && lista(v).every((d) => ehObjetoSimples(d._id) && 'ano' in d._id && 'parecer' in d._id))),
  objetivo('Em ordem de ano e, dentro do ano, de parecer.', ordemComoReferencia),
];

export const capitulo10: Capitulo = {
  numero: 10,
  titulo: 'As Audiências',
  fase: 4,
  abertura:
    'Cada alma carrega nas costas uma lista de audiências no Tribunal Celeste. Para o Céu, cada audiência é um processo; para a esteira, é só um item de array. Chegou a Desdobradeira: ela abre a lista e põe cada audiência na esteira como se fosse uma ficha.',
  missoes: [
    {
      id: '10.1',
      titulo: 'Quantas audiências?',
      assunto: 'Carga do Tribunal',
      corpo: 'Quantas AUDIÊNCIAS o Tribunal já realizou, somando todas as almas? Responda num documento `{ total: n }`.',
      objetivos: obj101,
      requer: ['desdobramento'],
      tipo: 'consulta',
      validar: relatorio(obj101),
      solucaoReferencia: "db.almas.aggregate([{ $unwind: '$audiencias' }, { $count: 'total' }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $match: { 'audiencias.0': { $exists: true } } }, { $count: 'total' }])", porque: 'contou almas com audiência, não audiências' },
      ],
      dicas: ['Cada alma é um documento, mas você quer contar os ITENS de um array.', '$unwind cria um documento por item do array; depois é só contar.', "db.almas.aggregate([{ $unwind: '$audiencias' }, { $count: 'total' }])"],
      recompensa: 5,
      licao: '$unwind transforma cada item de um array em um documento; contar depois dele conta os itens.',
    },
    {
      id: '10.2',
      titulo: 'Pareceres',
      assunto: 'Distribuição dos pareceres',
      corpo: 'Quantas audiências receberam cada parecer? Um documento por parecer (no `_id`), com `total`, em ordem alfabética.',
      objetivos: obj102,
      requer: ['desdobramento'],
      tipo: 'consulta',
      validar: relatorio(obj102, { ordem: true }),
      solucaoReferencia: "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$audiencias.parecer', total: { $sum: 1 } } }, { $sort: { _id: 1 } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $group: { _id: '$audiencias.parecer', total: { $sum: 1 } } }, { $sort: { _id: 1 } }])", porque: 'agrupou sem desdobrar (o _id virou uma lista)' },
      ],
      dicas: [
        'Rode o $group sem $unwind e olhe o _id: é uma lista inteira de pareceres.',
        "Depois do $unwind, audiencias deixa de ser lista e vira UM objeto: '$audiencias.parecer' é um valor só.",
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$audiencias.parecer', total: { $sum: 1 } } }, { $sort: { _id: 1 } }])",
      ],
      recompensa: 5,
      licao: 'Para agrupar por um campo de dentro de um array, desdobre antes com $unwind.',
    },
    {
      id: '10.3',
      titulo: 'Aprovações por setor',
      assunto: 'Quem mais consegue parecer A',
      corpo:
        'Por setor (no `_id`), quantas AUDIÊNCIAS tiveram parecer `A`? Campo `aprovacoes`. Do setor com mais para o com menos; empate em ordem alfabética. Cuidado: uma alma pode ter um A e vários C.',
      objetivos: obj103,
      requer: ['desdobramento'],
      tipo: 'consulta',
      validar: relatorio(obj103, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $match: { 'audiencias.parecer': 'A' } }, { $group: { _id: '$setor', aprovacoes: { $sum: 1 } } }, { $sort: { aprovacoes: -1, _id: 1 } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $match: { 'audiencias.parecer': 'A' } }, { $unwind: '$audiencias' }, { $group: { _id: '$setor', aprovacoes: { $sum: 1 } } }, { $sort: { aprovacoes: -1, _id: 1 } }])",
          porque: 'filtrou antes de desdobrar e contou as outras audiências junto',
        },
        {
          codigo: "db.almas.aggregate([{ $match: { 'audiencias.parecer': 'A' } }, { $group: { _id: '$setor', aprovacoes: { $sum: 1 } } }, { $sort: { aprovacoes: -1, _id: 1 } }])",
          porque: 'contou almas, não audiências',
        },
      ],
      dicas: [
        'Um $match antes do $unwind escolhe ALMAS que têm algum A — e traz todas as audiências delas.',
        'Desdobre primeiro; aí o $match olha cada audiência sozinha.',
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $match: { 'audiencias.parecer': 'A' } }, { $group: { _id: '$setor', aprovacoes: { $sum: 1 } } }, { $sort: { aprovacoes: -1, _id: 1 } }])",
      ],
      recompensa: 6,
      licao: '$match antes do $unwind filtra documentos inteiros; depois do $unwind, filtra itens do array.',
    },
    {
      id: '10.4',
      titulo: 'Peso das audiências',
      assunto: 'Estatística do Tribunal',
      corpo: 'Por setor (no `_id`, em ordem alfabética), calcule sobre os pesos das audiências: `media`, `menor` e `maior`.',
      objetivos: obj104,
      requer: ['desdobramento'],
      tipo: 'consulta',
      validar: relatorio(obj104, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$setor', media: { $avg: '$audiencias.peso' }, menor: { $min: '$audiencias.peso' }, maior: { $max: '$audiencias.peso' } } }, { $sort: { _id: 1 } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $group: { _id: '$setor', media: { $avg: '$audiencias.peso' }, menor: { $min: '$audiencias.peso' }, maior: { $max: '$audiencias.peso' } } }, { $sort: { _id: 1 } }])",
          porque: 'sem $unwind, as contas recebem listas',
        },
      ],
      dicas: ['$avg, $min e $max funcionam dentro do $group, cada um num campo novo.', 'Sem desdobrar, "$audiencias.peso" é uma LISTA de pesos por alma, e as contas não fazem o que você espera.', "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$setor', media: { $avg: '$audiencias.peso' }, menor: { $min: '$audiencias.peso' }, maior: { $max: '$audiencias.peso' } } }, { $sort: { _id: 1 } }])"],
      recompensa: 6,
      licao: '$avg, $min e $max calculam sobre os documentos do grupo; com arrays, desdobre antes.',
    },
    {
      id: '10.5',
      titulo: 'Os processos mais pesados',
      assunto: 'Cinco almas em maus lençóis',
      corpo:
        'Quais as 5 almas com a MAIOR média de peso nas audiências? Mostre só `nome` e `media`, sem `_id`. Da maior média para a menor; empate em ordem alfabética de nome. Dica de ofício: há almas com o mesmo nome — agrupe pelo `_id` da alma.',
      objetivos: obj105,
      requer: ['desdobramento', 'coleta'],
      tipo: 'consulta',
      validar: relatorio(obj105, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$_id', nome: { $first: '$nome' }, media: { $avg: '$audiencias.peso' } } }, { $sort: { media: -1, nome: 1 } }, { $limit: 5 }, { $project: { _id: 0, nome: 1, media: 1 } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$_id', nome: { $first: '$nome' }, media: { $avg: '$audiencias.peso' } } }, { $sort: { media: 1, nome: 1 } }, { $limit: 5 }, { $project: { _id: 0, nome: 1, media: 1 } }])",
          porque: 'pegou as menores médias',
        },
        {
          codigo: "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$_id', nome: { $first: '$nome' }, media: { $avg: '$audiencias.peso' } } }, { $sort: { media: -1, nome: 1 } }, { $limit: 5 }])",
          porque: 'o _id ficou no relatório',
        },
      ],
      dicas: [
        'Desdobre, reagrupe cada alma pelo próprio _id calculando a média, e só então ordene.',
        "Para levar o nome junto no $group: nome: { $first: '$nome' }. No fim, $project esconde o _id.",
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$_id', nome: { $first: '$nome' }, media: { $avg: '$audiencias.peso' } } }, { $sort: { media: -1, nome: 1 } }, { $limit: 5 }, { $project: { _id: 0, nome: 1, media: 1 } }])",
      ],
      recompensa: 7,
      licao: '$unwind + $group pelo _id original “remonta” o documento com cálculos sobre o array.',
    },
    {
      id: '10.6',
      titulo: 'Pareceres por ano',
      assunto: 'Tendência recente do Tribunal',
      corpo:
        'Considere só as audiências com `data` a partir de 1º de janeiro de 2020. Conte (`total`) quantas houve de cada parecer em cada ano: `_id: { ano, parecer }`, com o ano extraído da data. Ordene por ano e, dentro do ano, por parecer.',
      objetivos: obj106,
      requer: ['desdobramento'],
      tipo: 'consulta',
      validar: relatorio(obj106, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $match: { 'audiencias.data': { $gte: new Date('2020-01-01') } } }, { $group: { _id: { ano: { $year: '$audiencias.data' }, parecer: '$audiencias.parecer' }, total: { $sum: 1 } } }, { $sort: { '_id.ano': 1, '_id.parecer': 1 } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: { ano: { $year: '$audiencias.data' }, parecer: '$audiencias.parecer' }, total: { $sum: 1 } } }, { $sort: { '_id.ano': 1, '_id.parecer': 1 } }])",
          porque: 'esqueceu o filtro de data',
        },
        {
          codigo: "db.almas.aggregate([{ $unwind: '$audiencias' }, { $match: { 'audiencias.data': { $gte: new Date('2020-01-01') } } }, { $group: { _id: { $year: '$audiencias.data' }, total: { $sum: 1 } } }, { $sort: { _id: 1 } }])",
          porque: 'agrupou só por ano',
        },
      ],
      dicas: [
        'Datas se comparam com new Date("AAAA-MM-DD"). O _id do $group pode ser um objeto com duas chaves.',
        "{ $year: '$audiencias.data' } extrai o ano. Para ordenar por campos do _id composto: { '_id.ano': 1, '_id.parecer': 1 }.",
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $match: { 'audiencias.data': { $gte: new Date('2020-01-01') } } }, { $group: { _id: { ano: { $year: '$audiencias.data' }, parecer: '$audiencias.parecer' }, total: { $sum: 1 } } }, { $sort: { '_id.ano': 1, '_id.parecer': 1 } }])",
      ],
      recompensa: 7,
      licao: '_id composto agrupa por várias chaves; $year extrai o ano de uma data.',
    },
  ],
};
