import type { Capitulo } from './tipos';
import { condNaForma, nenhumaDeFora, objetivo, ordemComoReferencia, respostaCompleta, respostaE, semCampo, somenteCampos, todas, todasSao, usouOperador, valoresComoReferencia, type Objetivo } from '../objetivos';
import { ehObjetoSimples } from '../../engine/bson';
import { audiencias, lista, relatorio, vinculos } from './relatorio';

const FAIXAS_COND =
  "{ $cond: [{ $lt: ['$anos_pendentes', 10] }, 'Recente', { $cond: [{ $lt: ['$anos_pendentes', 30] }, 'Moderada', { $cond: [{ $lt: ['$anos_pendentes', 60] }, 'Antiga', 'Ancestral'] }] }] }";
const FAIXAS_SWITCH =
  "{ $switch: { branches: [{ case: { $lt: ['$anos_pendentes', 10] }, then: 'Recente' }, { case: { $lt: ['$anos_pendentes', 30] }, then: 'Moderada' }, { case: { $lt: ['$anos_pendentes', 60] }, then: 'Antiga' }], default: 'Ancestral' } }";

const faixa = (setor: string, expressao: string) =>
  `db.almas.aggregate([{ $match: { setor: '${setor}', anos_pendentes: { $type: 'number' } } }, { $sort: { anos_pendentes: 1, nome: 1 } }, { $project: { _id: 0, nome: 1, anos_pendentes: 1, faixa: ${expressao} } }])`;

const obj111: Objetivo[] = [
  objetivo('Todas as almas do Purgatório, com nome e situacao, sem _id, em ordem de nome.', todas(somenteCampos(['nome', 'situacao']), semCampo('_id'), ordemComoReferencia)),
  objetivo("situacao: 'urgente' com mais de 50 anos pendentes; 'normal' no resto.", respostaCompleta),
  objetivo('Escrito com $cond na forma { if, then, else }.', condNaForma('objeto')),
];

const obj112: Objetivo[] = [
  objetivo('Todas as almas da Ante-Sala, com nome e status, sem _id, em ordem de nome.', todas(somenteCampos(['nome', 'status']), semCampo('_id'), ordemComoReferencia)),
  objetivo("status: 'em trâmite' para ativas; 'suspenso' para inativas.", respostaCompleta),
  objetivo('Escrito com $cond na forma de lista [condição, então, senão].', condNaForma('array')),
];

const obj113: Objetivo[] = [
  objetivo('Almas do Limbo com nome, anos_pendentes e faixa, sem _id, na ordem pedida.', todas(somenteCampos(['nome', 'anos_pendentes', 'faixa']), semCampo('_id'), ordemComoReferencia)),
  objetivo('Cada alma na faixa certa (atenção aos limites 10, 30 e 60).', respostaCompleta),
  objetivo('Com $cond dentro de $cond.', condNaForma('aninhado')),
];

const obj114: Objetivo[] = [
  objetivo('Almas do Purgatório com nome, anos_pendentes e faixa, sem _id, na ordem pedida.', todas(somenteCampos(['nome', 'anos_pendentes', 'faixa']), semCampo('_id'), ordemComoReferencia)),
  objetivo('Cada alma na faixa certa.', respostaCompleta),
  objetivo('Com $switch.', usouOperador('$switch')),
];

const obj115: Objetivo[] = [
  objetivo('Um documento por pendência da Correspondência, em ordem alfabética, com total.', todas(ordemComoReferencia, valoresComoReferencia(['total']))),
  objetivo('ativas: quantas dessas almas estão ativas.', valoresComoReferencia(['ativas'])),
];

const maisAudiencias = (d: Record<string, unknown>) => audiencias(d).length > vinculos(d).length;
const obj116: Objetivo[] = [
  objetivo('Somente almas com mais audiências do que vínculos.', todasSao(maisAudiencias)),
  objetivo('Nenhuma ficou de fora (inclusive quem não tem a lista de vínculos).', nenhumaDeFora()),
  objetivo('Comparando os dois campos com $expr.', usouOperador('$expr')),
];

const equilibrada = (d: Record<string, unknown>) => audiencias(d).length > 0 && audiencias(d).length === vinculos(d).length;
const obj117: Objetivo[] = [
  objetivo('Somente almas com o MESMO número de audiências e de vínculos (pelo menos um de cada).', todasSao(equilibrada)),
  objetivo('Nenhuma ficou de fora.', nenhumaDeFora()),
  objetivo('Com $expr dentro de um $match do pipeline.', usouOperador('$expr')),
];

const obj118: Objetivo[] = [
  objetivo('Um documento por setor, só com setor e pareceres, sem _id, em ordem de setor.', todas(somenteCampos(['setor', 'pareceres']), semCampo('_id'), ordemComoReferencia)),
  objetivo('pareceres é um OBJETO: { A: n, B: n, ... }.', respostaE((v) => lista(v).length > 0 && lista(v).every((d) => ehObjetoSimples(d.pareceres)))),
  objetivo('Com as contagens certas de cada parecer.', respostaCompleta),
];

export const capitulo11: Capitulo = {
  numero: 11,
  titulo: 'O Parecer',
  fase: 4,
  abertura:
    'Os relatórios agora precisam OPINAR. O Céu quer “urgente” ou “normal”, faixas de atraso, contagens condicionais. A esteira ganhou um Parecerista — uma engrenagem que olha cada ficha e decide qual carimbo bater.',
  missoes: [
    {
      id: '11.1',
      titulo: 'Urgente ou normal',
      assunto: 'Triagem do Purgatório',
      corpo:
        "Para cada alma do `Purgatório`, gere `nome` e `situacao`: `'urgente'` se tiver MAIS de 50 anos pendentes, `'normal'` caso contrário. Sem `_id`, em ordem alfabética de nome. Use `$cond` na forma `{ if, then, else }`.",
      objetivos: obj111,
      requer: ['parecer'],
      tipo: 'consulta',
      validar: relatorio(obj111, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $match: { setor: 'Purgatório' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, situacao: { $cond: { if: { $gt: ['$anos_pendentes', 50] }, then: 'urgente', else: 'normal' } } } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $match: { setor: 'Purgatório' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, situacao: { $cond: { if: { $gt: ['$anos_pendentes', 50] }, then: 'normal', else: 'urgente' } } } }])",
          porque: 'trocou o então pelo senão',
        },
        {
          codigo: "db.almas.aggregate([{ $match: { setor: 'Purgatório' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, situacao: { $cond: [{ $gt: ['$anos_pendentes', 50] }, 'urgente', 'normal'] } } }])",
          porque: 'usou a forma de lista (fica para o próximo memorando)',
        },
      ],
      dicas: [
        "Em expressões, a comparação é escrita como lista: { $gt: ['$campo', valor] }.",
        "situacao: { $cond: { if: <comparação>, then: 'urgente', else: 'normal' } } dentro do $project.",
        "db.almas.aggregate([{ $match: { setor: 'Purgatório' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, situacao: { $cond: { if: { $gt: ['$anos_pendentes', 50] }, then: 'urgente', else: 'normal' } } } }])",
      ],
      recompensa: 5,
      licao: "$cond { if, then, else } decide um valor; em expressões, comparações são { $gt: ['$campo', valor] }.",
    },
    {
      id: '11.2',
      titulo: 'A forma curta',
      assunto: 'Status da Ante-Sala',
      corpo: "Para cada alma da `Ante-Sala`, gere `nome` e `status`: `'em trâmite'` se estiver ativa, `'suspenso'` se não. Sem `_id`, em ordem de nome. Desta vez, `$cond` na forma de LISTA.",
      objetivos: obj112,
      requer: ['parecer'],
      tipo: 'consulta',
      validar: relatorio(obj112, { ordem: true }),
      solucaoReferencia: "db.almas.aggregate([{ $match: { setor: 'Ante-Sala' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, status: { $cond: ['$ativo', 'em trâmite', 'suspenso'] } } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $match: { setor: 'Ante-Sala' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, status: { $cond: ['$ativo', 'suspenso', 'em trâmite'] } } }])", porque: 'inverteu os valores' },
        {
          codigo: "db.almas.aggregate([{ $match: { setor: 'Ante-Sala' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, status: { $cond: { if: '$ativo', then: 'em trâmite', else: 'suspenso' } } } }])",
          porque: 'usou a forma de objeto',
        },
      ],
      dicas: ['A forma de lista é [condição, valor-se-verdadeiro, valor-se-falso].', "Um campo booleano já é uma condição: '$ativo'.", "db.almas.aggregate([{ $match: { setor: 'Ante-Sala' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, status: { $cond: ['$ativo', 'em trâmite', 'suspenso'] } } }])"],
      recompensa: 4,
      licao: '$cond: [condição, então, senão] é a forma curta; um campo booleano serve como condição.',
    },
    {
      id: '11.3',
      titulo: 'Faixas de atraso',
      assunto: 'Classificação do Limbo',
      corpo:
        "Para cada alma do `Limbo`, gere `nome`, `anos_pendentes` e `faixa`: menos de 10 anos → `'Recente'`; menos de 30 → `'Moderada'`; menos de 60 → `'Antiga'`; o resto → `'Ancestral'`. Considere só as fichas em que `anos_pendentes` é número. Sem `_id`, ordenado por anos pendentes (crescente) e depois nome. Use `$cond` aninhado.",
      objetivos: obj113,
      requer: ['parecer'],
      tipo: 'consulta',
      validar: relatorio(obj113, { ordem: true }),
      solucaoReferencia: faixa('Limbo', FAIXAS_COND),
      solucoesErradas: [
        { codigo: faixa('Limbo', FAIXAS_COND.replace(/\$lt/g, '$lte')), porque: 'os limites caíram na faixa errada' },
        { codigo: faixa('Limbo', "{ $cond: [{ $lt: ['$anos_pendentes', 30] }, 'Moderada', 'Ancestral'] }"), porque: 'faltaram faixas' },
      ],
      dicas: [
        '“Menos de 10” é $lt. Uma alma com exatamente 10 anos já é Moderada.',
        'O senão de um $cond pode ser OUTRO $cond — assim você encadeia as faixas.',
        faixa('Limbo', FAIXAS_COND),
      ],
      recompensa: 6,
      licao: '$cond aninhado encadeia faixas; confira os limites ($lt × $lte).',
    },
    {
      id: '11.4',
      titulo: 'Sem escadinha',
      assunto: 'Faixas do Purgatório, versão legível',
      corpo: 'Mesmas faixas do memorando anterior (Recente, Moderada, Antiga, Ancestral), agora para o `Purgatório` (de novo, só com `anos_pendentes` numérico, e na mesma ordem) — e com `$switch`, que o revisor consegue ler sem se perder.',
      objetivos: obj114,
      requer: ['parecer'],
      tipo: 'consulta',
      validar: relatorio(obj114, { ordem: true }),
      solucaoReferencia: faixa('Purgatório', FAIXAS_SWITCH),
      solucoesErradas: [
        {
          codigo: faixa(
            'Purgatório',
            "{ $switch: { branches: [{ case: { $lt: ['$anos_pendentes', 60] }, then: 'Antiga' }, { case: { $lt: ['$anos_pendentes', 30] }, then: 'Moderada' }, { case: { $lt: ['$anos_pendentes', 10] }, then: 'Recente' }], default: 'Ancestral' } }",
          ),
          porque: 'casos na ordem errada: o primeiro que casa vence',
        },
        { codigo: faixa('Purgatório', FAIXAS_COND), porque: 'usou $cond de novo' },
      ],
      dicas: ['$switch lê os casos de cima para baixo e para no PRIMEIRO verdadeiro.', "{ $switch: { branches: [{ case: <cond>, then: 'Recente' }, ...], default: 'Ancestral' } }", faixa('Purgatório', FAIXAS_SWITCH)],
      recompensa: 5,
      licao: '$switch avalia os casos em ordem e usa o primeiro verdadeiro; default cobre o resto.',
    },
    {
      id: '11.5',
      titulo: 'Contagem condicional',
      assunto: 'Quantas ainda correm atrás',
      corpo: 'Na `Correspondência`, agrupe por `pendencia` (no `_id`, em ordem alfabética) e calcule `total` de almas e `ativas` — quantas delas estão ativas. Tudo num único `$group`.',
      objetivos: obj115,
      requer: ['parecer'],
      tipo: 'consulta',
      validar: relatorio(obj115, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $match: { setor: 'Correspondência' } }, { $group: { _id: '$pendencia', total: { $sum: 1 }, ativas: { $sum: { $cond: ['$ativo', 1, 0] } } } }, { $sort: { _id: 1 } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $match: { setor: 'Correspondência' } }, { $group: { _id: '$pendencia', total: { $sum: 1 }, ativas: { $sum: '$ativo' } } }, { $sort: { _id: 1 } }])", porque: '$sum ignora booleanos' },
      ],
      dicas: ['$sum ignora o que não é número — true não vale 1.', 'Transforme cada ficha em 1 ou 0 com $cond e some: { $sum: { $cond: [...] } }.', "db.almas.aggregate([{ $match: { setor: 'Correspondência' } }, { $group: { _id: '$pendencia', total: { $sum: 1 }, ativas: { $sum: { $cond: ['$ativo', 1, 0] } } } }, { $sort: { _id: 1 } }])"],
      recompensa: 6,
      licao: '{ $sum: { $cond: [condição, 1, 0] } } conta só quem atende à condição, dentro do mesmo grupo.',
    },
    {
      id: '11.6',
      titulo: 'Campo contra campo',
      assunto: 'Mais audiências que parentes',
      corpo:
        'Com `find`, traga as almas que têm MAIS audiências do que vínculos. Atenção: algumas fichas não têm a lista `vinculos` (ou `audiencias`) — trate a ausência como lista vazia.',
      objetivos: obj116,
      requer: ['expressao'],
      tipo: 'consulta',
      validar: relatorio(obj116),
      solucaoReferencia: "db.almas.find({ $expr: { $gt: [{ $size: { $ifNull: ['$audiencias', []] } }, { $size: { $ifNull: ['$vinculos', []] } }] } })",
      solucoesErradas: [
        { codigo: "db.almas.find({ $expr: { $gte: [{ $size: { $ifNull: ['$audiencias', []] } }, { $size: { $ifNull: ['$vinculos', []] } }] } })", porque: 'incluiu os empates' },
        { codigo: "db.almas.find({ $expr: { $gt: ['$audiencias', '$vinculos'] } })", porque: 'comparou as listas, não os tamanhos' },
      ],
      dicas: [
        'Um filtro comum compara um campo com um VALOR. Para comparar dois campos entre si, use $expr.',
        "{ $size: '$lista' } dá o tamanho, mas falha se a lista não existir: { $size: { $ifNull: ['$lista', []] } }.",
        "db.almas.find({ $expr: { $gt: [{ $size: { $ifNull: ['$audiencias', []] } }, { $size: { $ifNull: ['$vinculos', []] } }] } })",
      ],
      recompensa: 6,
      licao: '$expr leva expressões de aggregate para o filtro e permite comparar campos do mesmo documento.',
    },
    {
      id: '11.7',
      titulo: 'Equilíbrio',
      assunto: 'Uma audiência por parente',
      corpo:
        'Agora na esteira: traga as almas que têm o MESMO número de audiências e de vínculos, com pelo menos um de cada, em ordem alfabética de nome. Filtre com `$expr` dentro de um `$match`.',
      objetivos: obj117,
      requer: ['expressao'],
      tipo: 'consulta',
      validar: relatorio(obj117, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $match: { 'audiencias.0': { $exists: true }, 'vinculos.0': { $exists: true } } }, { $match: { $expr: { $eq: [{ $size: '$audiencias' }, { $size: '$vinculos' }] } } }, { $sort: { nome: 1 } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $match: { $expr: { $eq: [{ $size: { $ifNull: ['$audiencias', []] } }, { $size: { $ifNull: ['$vinculos', []] } }] } } }, { $sort: { nome: 1 } }])",
          porque: 'incluiu quem não tem nenhum dos dois',
        },
        {
          codigo: "db.almas.aggregate([{ $match: { 'audiencias.0': { $exists: true }, 'vinculos.0': { $exists: true } } }, { $match: { $expr: { $gte: [{ $size: '$audiencias' }, { $size: '$vinculos' }] } } }, { $sort: { nome: 1 } }])",
          porque: 'usou >= em vez de igual',
        },
      ],
      dicas: [
        '“Pelo menos um de cada” pode ser um $match comum antes: \'lista.0\' existe.',
        'Depois dele, as duas listas existem e $size funciona sem $ifNull. Compare com $eq dentro do $expr.',
        "db.almas.aggregate([{ $match: { 'audiencias.0': { $exists: true }, 'vinculos.0': { $exists: true } } }, { $match: { $expr: { $eq: [{ $size: '$audiencias' }, { $size: '$vinculos' }] } } }, { $sort: { nome: 1 } }])",
      ],
      recompensa: 6,
      licao: '$match com $expr compara campos dentro do pipeline; um $match comum antes protege as expressões.',
    },
    {
      id: '11.8',
      titulo: 'Tabela dinâmica',
      assunto: 'Pareceres por setor, numa linha só',
      corpo:
        'O Tribunal quer UMA linha por setor: `{ setor: "Limbo", pareceres: { A: 12, B: 9, C: 7, Z: 3 } }`. Conte as audiências por setor e parecer e transforme as contagens num objeto. Sem `_id`, em ordem de setor, e as chaves de `pareceres` em ordem alfabética.',
      objetivos: obj118,
      requer: ['expressao', 'coleta', 'desdobramento'],
      tipo: 'consulta',
      validar: relatorio(obj118, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: { setor: '$setor', parecer: '$audiencias.parecer' }, total: { $sum: 1 } } }, { $sort: { '_id.parecer': 1 } }, { $group: { _id: '$_id.setor', pares: { $push: { k: '$_id.parecer', v: '$total' } } } }, { $project: { _id: 0, setor: '$_id', pareceres: { $arrayToObject: '$pares' } } }, { $sort: { setor: 1 } }])",
      solucoesErradas: [
        {
          codigo:
            "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: { setor: '$setor', parecer: '$audiencias.parecer' }, total: { $sum: 1 } } }, { $sort: { '_id.parecer': 1 } }, { $group: { _id: '$_id.setor', pares: { $push: { k: '$_id.parecer', v: '$total' } } } }, { $project: { _id: 0, setor: '$_id', pareceres: '$pares' } }, { $sort: { setor: 1 } }])",
          porque: 'deixou a lista de pares sem converter',
        },
      ],
      dicas: [
        'São dois agrupamentos: (setor, parecer) → total; depois, por setor, junte os pares { k: parecer, v: total } com $push.',
        "$arrayToObject transforma [{ k: 'A', v: 12 }, ...] em { A: 12, ... }. Ordene pelos pareceres ANTES de juntar os pares.",
        "db.almas.aggregate([{ $unwind: '$audiencias' }, { $group: { _id: { setor: '$setor', parecer: '$audiencias.parecer' }, total: { $sum: 1 } } }, { $sort: { '_id.parecer': 1 } }, { $group: { _id: '$_id.setor', pares: { $push: { k: '$_id.parecer', v: '$total' } } } }, { $project: { _id: 0, setor: '$_id', pareceres: { $arrayToObject: '$pares' } } }, { $sort: { setor: 1 } }])",
      ],
      recompensa: 8,
      licao: '$push de pares { k, v } + $arrayToObject “pivota” linhas em colunas.',
    },
  ],
};
