import type { Capitulo } from './tipos';
import { mesmaQuantidade, objetivo, ordemComoReferencia, respostaCompleta, respostaE, semCampo, somenteCampos, todas, usouEstagio, valoresComoReferencia, type Objetivo } from '../objetivos';
import { lista, relatorio } from './relatorio';

const decrescentePor = (campo: string) => (v: unknown) => {
  const docs = lista(v);
  return docs.length > 1 && docs.every((d, i) => i === 0 || (docs[i - 1][campo] as number) >= (d[campo] as number));
};

const obj91: Objetivo[] = [
  objetivo('Um documento por setor, com o total de almas em total.', respostaCompleta),
  objetivo('Do setor mais cheio para o mais vazio.', respostaE(decrescentePor('total'))),
];

const obj92: Objetivo[] = [
  objetivo('As 5 pendências com mais almas, com o total de cada.', respostaCompleta),
  objetivo('Da mais comum para a menos comum; empate em ordem alfabética.', ordemComoReferencia),
];

const obj93: Objetivo[] = [
  objetivo('Cada documento tem só setor e total.', somenteCampos(['setor', 'total'])),
  objetivo('Sem o _id.', semCampo('_id')),
  objetivo('Totais certos, em ordem alfabética de setor.', todas(respostaCompleta, ordemComoReferencia)),
];

const obj94: Objetivo[] = [
  objetivo('Só pendências com 25 ou mais almas ATIVAS, com o total de ativas.', respostaCompleta),
  objetivo('Da mais comum para a menos comum; empate em ordem alfabética.', ordemComoReferencia),
  objetivo('Filtrou antes E depois do agrupamento (dois $match).', usouEstagio('$match', 2)),
];

const obj95: Objetivo[] = [
  objetivo('Um documento por setor, com total de almas com data de falecimento.', todas(mesmaQuantidade, valoresComoReferencia(['total']))),
  objetivo('maisAntiga e maisRecente: quem faleceu primeiro e por último no setor.', valoresComoReferencia(['maisAntiga', 'maisRecente'])),
  objetivo('pendencias: a lista de pendências do setor, sem repetição.', valoresComoReferencia(['pendencias'], ['pendencias'])),
];

const obj96: Objetivo[] = [
  objetivo('Para cada setor, quantos bairros DIFERENTES aparecem.', respostaCompleta),
  objetivo('Em dois agrupamentos seguidos ($group duas vezes).', usouEstagio('$group', 2)),
];

const obj97: Objetivo[] = [
  objetivo('Um único documento, só com o campo total.', respostaE((v) => lista(v).length === 1 && Object.keys(lista(v)[0]).join() === 'total')),
  objetivo('Com a contagem certa.', respostaCompleta),
  objetivo('Usando o estágio $count.', usouEstagio('$count')),
];

export const capitulo9: Capitulo = {
  numero: 9,
  titulo: 'O Censo',
  fase: 4,
  abertura:
    'O Céu pediu números, não nomes: quantas almas em cada setor, quais pendências se repetem, quem espera há mais tempo. A esteira ganhou uma nova máquina — a Agrupadora, que junta fichas parecidas numa pilha só e escreve o total na capa.',
  missoes: [
    {
      id: '9.1',
      titulo: 'Censo por setor',
      assunto: 'Lotação dos setores',
      corpo: 'Quantas almas há em cada setor? Um documento por setor (o setor no `_id`, a contagem em `total`), do mais cheio para o mais vazio.',
      objetivos: obj91,
      requer: ['agrupamento'],
      tipo: 'consulta',
      validar: relatorio(obj91, { ordem: true }),
      solucaoReferencia: "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }, { $sort: { total: -1 } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: '$anos_pendentes' } } }, { $sort: { total: -1 } }])", porque: 'somou os anos em vez de contar' },
        { codigo: "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }, { $sort: { total: 1 } }])", porque: 'ordenou do menor para o maior' },
      ],
      dicas: [
        '$group cria um documento por valor distinto do _id. Para agrupar por setor, _id: "$setor".',
        'Contar é somar 1 para cada ficha: total: { $sum: 1 }. Depois, $sort no campo novo.',
        "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }, { $sort: { total: -1 } }])",
      ],
      recompensa: 5,
      licao: '$group: _id é a chave do grupo; { $sum: 1 } conta documentos; o resultado pode ser ordenado depois.',
    },
    {
      id: '9.2',
      titulo: 'Pendências campeãs',
      assunto: 'As cinco pendências mais comuns',
      corpo: 'Quais são as 5 pendências mais comuns entre TODAS as almas? `_id` com a pendência, `total` com a quantidade. Em empate de total, ordem alfabética de pendência.',
      objetivos: obj92,
      requer: ['agrupamento'],
      tipo: 'consulta',
      validar: relatorio(obj92, { ordem: true }),
      solucaoReferencia: "db.almas.aggregate([{ $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $sort: { total: -1, _id: 1 } }, { $limit: 5 }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $limit: 5 }, { $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $sort: { total: -1, _id: 1 } }])", porque: 'limitou antes de agrupar' },
        { codigo: "db.almas.aggregate([{ $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $limit: 5 }, { $sort: { total: -1, _id: 1 } }])", porque: 'limitou antes de ordenar' },
      ],
      dicas: ['Agrupar, ordenar e só então cortar. Qualquer outra ordem responde outra pergunta.', 'No $sort depois do $group, o campo da pendência se chama _id.', "db.almas.aggregate([{ $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $sort: { total: -1, _id: 1 } }, { $limit: 5 }])"],
      recompensa: 5,
      licao: 'Top N = $group → $sort → $limit. Depois do $group, a chave do grupo se chama _id.',
    },
    {
      id: '9.3',
      titulo: 'Relatório apresentável',
      assunto: 'O Tribunal não entende “_id”',
      corpo: 'Refaça a contagem por setor, mas apresentável: cada documento com `setor` e `total`, SEM `_id`, em ordem alfabética de setor.',
      objetivos: obj93,
      requer: ['agrupamento'],
      tipo: 'consulta',
      validar: relatorio(obj93, { ordem: true }),
      solucaoReferencia: "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }, { $project: { _id: 0, setor: '$_id', total: 1 } }, { $sort: { setor: 1 } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }, { $project: { setor: '$_id', total: 1 } }, { $sort: { setor: 1 } }])", porque: 'o _id continuou lá' },
        { codigo: "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }, { $project: { _id: 0, total: 1 } }, { $sort: { total: 1 } }])", porque: 'perdeu o nome do setor' },
      ],
      dicas: ['Depois do $group, um $project pode renomear: o valor de _id vira um campo novo.', "setor: '$_id' copia o valor; _id: 0 esconde o original.", "db.almas.aggregate([{ $group: { _id: '$setor', total: { $sum: 1 } } }, { $project: { _id: 0, setor: '$_id', total: 1 } }, { $sort: { setor: 1 } }])"],
      recompensa: 5,
      licao: "Para apresentar um agrupamento: $project { _id: 0, nome: '$_id', ... }.",
    },
    {
      id: '9.4',
      titulo: 'Pendências recorrentes',
      assunto: 'Só o que ainda está vivo (no sentido burocrático)',
      corpo:
        'Considere só as almas ATIVAS (`ativo: true`). Agrupe por `pendencia` contando em `total` e mantenha apenas as pendências com 25 ou mais almas. Da mais comum para a menos comum; empate em ordem alfabética.',
      objetivos: obj94,
      requer: ['agrupamento'],
      tipo: 'consulta',
      validar: relatorio(obj94, { ordem: true }),
      solucaoReferencia: "db.almas.aggregate([{ $match: { ativo: true } }, { $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $match: { total: { $gte: 25 } } }, { $sort: { total: -1, _id: 1 } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $match: { total: { $gte: 25 } } }, { $sort: { total: -1, _id: 1 } }])", porque: 'contou as inativas também' },
        { codigo: "db.almas.aggregate([{ $match: { ativo: true, total: { $gte: 25 } } }, { $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $sort: { total: -1, _id: 1 } }])", porque: 'filtrou total antes de ele existir' },
      ],
      dicas: [
        'Há DOIS filtros: um sobre as fichas (ativo) e outro sobre os grupos (total). Cada um mora de um lado do $group.',
        'O campo total só existe DEPOIS do $group. Um $match depois dele funciona como o HAVING do SQL.',
        "db.almas.aggregate([{ $match: { ativo: true } }, { $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $match: { total: { $gte: 25 } } }, { $sort: { total: -1, _id: 1 } }])",
      ],
      recompensa: 6,
      licao: '$match antes do $group filtra documentos (WHERE); depois do $group filtra grupos (HAVING).',
    },
    {
      id: '9.5',
      titulo: 'Capa do setor',
      assunto: 'Resumo para a capa de cada pasta',
      corpo:
        'Considere só as almas cujo `falecimento` é de fato uma data (o legado tem textos). Para cada setor (no `_id`, em ordem alfabética), gere: `total` de almas; `maisAntiga` — o nome de quem faleceu PRIMEIRO; `maisRecente` — o nome de quem faleceu por ÚLTIMO; `pendencias` — a lista das pendências do setor, sem repetição.',
      objetivos: obj95,
      requer: ['coleta'],
      tipo: 'consulta',
      validar: relatorio(obj95, { ordem: true, conjuntos: ['pendencias'] }),
      solucaoReferencia:
        "db.almas.aggregate([{ $match: { falecimento: { $type: 'date' } } }, { $sort: { falecimento: 1 } }, { $group: { _id: '$setor', total: { $sum: 1 }, maisAntiga: { $first: '$nome' }, maisRecente: { $last: '$nome' }, pendencias: { $addToSet: '$pendencia' } } }, { $sort: { _id: 1 } }])",
      solucoesErradas: [
        {
          codigo:
            "db.almas.aggregate([{ $match: { falecimento: { $type: 'date' } } }, { $group: { _id: '$setor', total: { $sum: 1 }, maisAntiga: { $first: '$nome' }, maisRecente: { $last: '$nome' }, pendencias: { $addToSet: '$pendencia' } } }, { $sort: { _id: 1 } }])",
          porque: '$first/$last sem ordenar antes',
        },
        {
          codigo:
            "db.almas.aggregate([{ $match: { falecimento: { $type: 'date' } } }, { $sort: { falecimento: 1 } }, { $group: { _id: '$setor', total: { $sum: 1 }, maisAntiga: { $first: '$nome' }, maisRecente: { $last: '$nome' }, pendencias: { $push: '$pendencia' } } }, { $sort: { _id: 1 } }])",
          porque: '$push repete as pendências',
        },
      ],
      dicas: [
        '“Primeiro” e “último” só fazem sentido se as fichas chegarem ORDENADAS ao $group.',
        "$first e $last pegam o valor da primeira e da última ficha de cada grupo; $addToSet junta sem repetir ($push repete). Filtre datas com { $type: 'date' }.",
        "db.almas.aggregate([{ $match: { falecimento: { $type: 'date' } } }, { $sort: { falecimento: 1 } }, { $group: { _id: '$setor', total: { $sum: 1 }, maisAntiga: { $first: '$nome' }, maisRecente: { $last: '$nome' }, pendencias: { $addToSet: '$pendencia' } } }, { $sort: { _id: 1 } }])",
      ],
      recompensa: 7,
      licao: '$first/$last dependem de um $sort antes do $group; $addToSet junta valores distintos, $push junta todos.',
    },
    {
      id: '9.6',
      titulo: 'Bairros por setor',
      assunto: 'Quantos bairros cada setor atende',
      corpo:
        'Para cada setor (no `_id`, em ordem alfabética), quantos BAIRROS DIFERENTES aparecem nos endereços? Ignore quem não tem bairro. O supervisor quer ver a técnica de agrupar duas vezes: primeiro pares setor+bairro, depois conte os pares de cada setor em `bairros`.',
      objetivos: obj96,
      requer: ['agrupamento'],
      tipo: 'consulta',
      validar: relatorio(obj96, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $match: { 'endereco.bairro': { $exists: true } } }, { $group: { _id: { setor: '$setor', bairro: '$endereco.bairro' } } }, { $group: { _id: '$_id.setor', bairros: { $sum: 1 } } }, { $sort: { _id: 1 } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $match: { 'endereco.bairro': { $exists: true } } }, { $group: { _id: '$setor', bairros: { $sum: 1 } } }, { $sort: { _id: 1 } }])", porque: 'contou almas, não bairros' },
      ],
      dicas: [
        'Um $group com _id composto ({ setor, bairro }) deixa UM documento por par — as repetições somem.',
        "O segundo $group agrupa esses pares pelo setor: _id: '$_id.setor', e conta com $sum: 1.",
        "db.almas.aggregate([{ $match: { 'endereco.bairro': { $exists: true } } }, { $group: { _id: { setor: '$setor', bairro: '$endereco.bairro' } } }, { $group: { _id: '$_id.setor', bairros: { $sum: 1 } } }, { $sort: { _id: 1 } }])",
      ],
      recompensa: 6,
      licao: 'Contar valores distintos: $group por (grupo, valor) e depois $group por grupo com $sum: 1.',
    },
    {
      id: '9.7',
      titulo: 'Só o número',
      assunto: 'Uma cifra para o boletim',
      corpo: 'O boletim do Limbo só tem espaço para um número: quantas almas do `Limbo` têm mais de 40 anos pendentes. Responda com o estágio `$count`, num documento `{ total: n }`.',
      objetivos: obj97,
      requer: ['coleta'],
      tipo: 'consulta',
      validar: relatorio(obj97),
      solucaoReferencia: "db.almas.aggregate([{ $match: { setor: 'Limbo', anos_pendentes: { $gt: 40 } } }, { $count: 'total' }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $match: { setor: 'Limbo', anos_pendentes: { $gt: 40 } } }, { $group: { _id: null, total: { $sum: 1 } } }])", porque: 'o $group deixou _id: null' },
        { codigo: "db.almas.aggregate([{ $match: { setor: 'Limbo' } }, { $count: 'total' }])", porque: 'esqueceu o filtro de anos' },
      ],
      dicas: ['Existe um estágio que substitui tudo por um único número.', "{ $count: 'total' } devolve [{ total: n }].", "db.almas.aggregate([{ $match: { setor: 'Limbo', anos_pendentes: { $gt: 40 } } }, { $count: 'total' }])"],
      recompensa: 4,
      licao: "$count: 'campo' resume a esteira num documento só, sem _id.",
    },
  ],
};
