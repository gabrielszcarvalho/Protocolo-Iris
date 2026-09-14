import type { Capitulo } from './tipos';
import { mesmaQuantidade, nenhumaDeFora, objetivo, ordemComoReferencia, respostaCompleta, respostaE, semCampo, somenteCampos, todas, todasSao, usouEstagio, type Objetivo } from '../objetivos';
import { feitoComAggregate, lista, relatorio, soComCampos } from './relatorio';

const obj81: Objetivo[] = [
  objetivo('Somente almas do Purgatório com mais de 50 anos pendentes.', todasSao((d) => d.setor === 'Purgatório' && typeof d.anos_pendentes === 'number' && d.anos_pendentes > 50)),
  objetivo('Nenhuma delas ficou de fora.', nenhumaDeFora()),
  feitoComAggregate,
];

const obj82: Objetivo[] = [
  objetivo('Todas as almas da Ante-Sala, e só elas.', todas(mesmaQuantidade, todasSao((d) => d.setor === 'Ante-Sala'))),
  objetivo('Cada documento mostra só nome, setor e anos_pendentes.', respostaE(soComCampos(['nome', 'setor', 'anos_pendentes']))),
  objetivo('Sem o _id.', semCampo('_id')),
];

const obj83: Objetivo[] = [
  objetivo('As 5 almas da segunda página (da 6ª à 10ª posição).', respostaCompleta),
  objetivo('Na ordem: mais anos pendentes primeiro; empate em ordem alfabética.', ordemComoReferencia),
  objetivo('Só nome e anos_pendentes, sem _id.', todas(somenteCampos(['nome', 'anos_pendentes']), semCampo('_id'))),
];

const carta = (d: Record<string, unknown>) => d.pendencia === 'Carta não entregue' && typeof d.anos_pendentes === 'number' && d.anos_pendentes > 30;
const obj84: Objetivo[] = [
  objetivo('Somente cartas não entregues há mais de 30 anos.', todasSao(carta)),
  objetivo('Nenhuma ficou de fora.', nenhumaDeFora()),
  objetivo('Em duas peneiras: dois estágios $match seguidos.', usouEstagio('$match', 2)),
];

const obj85: Objetivo[] = [
  objetivo('Todas as almas do Purgatório que têm endereço.', mesmaQuantidade),
  objetivo('enderecoCompleto no formato “rua, número — bairro”.', todas(respostaCompleta, respostaE((v) => lista(v).every((d) => typeof d.enderecoCompleto === 'string')))),
  objetivo('Só nome e enderecoCompleto, em ordem alfabética de nome.', todas(somenteCampos(['nome', 'enderecoCompleto']), ordemComoReferencia)),
];

export const capitulo8: Capitulo = {
  numero: 8,
  titulo: 'A Esteira',
  fase: 4,
  abertura:
    'O Tribunal Celeste cansou de receber listas: quer RELATÓRIOS. No subsolo, a Diretoria religou uma velha esteira de caldeiras — as fichas entram de um lado, passam por estágios e saem do outro já filtradas, ordenadas e recortadas.',
  missoes: [
    {
      id: '8.1',
      titulo: 'A primeira esteira',
      assunto: 'Relatório de atrasos no Purgatório',
      corpo: 'Monte seu primeiro relatório com `aggregate`: as almas do `Purgatório` com mais de 50 anos pendentes. Um pipeline de um estágio só já resolve.',
      objetivos: obj81,
      requer: ['esteira'],
      tipo: 'consulta',
      validar: relatorio(obj81),
      solucaoReferencia: "db.almas.aggregate([{ $match: { setor: 'Purgatório', anos_pendentes: { $gt: 50 } } }])",
      solucoesErradas: [
        { codigo: "db.almas.find({ setor: 'Purgatório', anos_pendentes: { $gt: 50 } })", porque: 'usou find em vez de aggregate' },
        { codigo: "db.almas.aggregate([{ $match: { setor: 'Purgatório' } }])", porque: 'esqueceu o filtro de anos' },
      ],
      dicas: [
        'aggregate recebe uma LISTA de estágios: db.almas.aggregate([ { ... }, { ... } ]).',
        'O estágio $match usa exatamente o mesmo filtro que você escreveria no find.',
        "db.almas.aggregate([{ $match: { setor: 'Purgatório', anos_pendentes: { $gt: 50 } } }])",
      ],
      recompensa: 5,
      licao: 'aggregate([ ... ]) passa os documentos por estágios; $match filtra com a sintaxe do find.',
    },
    {
      id: '8.2',
      titulo: 'Só o essencial',
      assunto: 'Resumo da Ante-Sala',
      corpo: 'Relatório da `Ante-Sala` com apenas `nome`, `setor` e `anos_pendentes` de cada alma — o Tribunal não quer ver `_id`.',
      objetivos: obj82,
      requer: ['esteira'],
      tipo: 'consulta',
      validar: relatorio(obj82),
      solucaoReferencia: "db.almas.aggregate([{ $match: { setor: 'Ante-Sala' } }, { $project: { _id: 0, nome: 1, setor: 1, anos_pendentes: 1 } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $match: { setor: 'Ante-Sala' } }, { $project: { nome: 1, setor: 1, anos_pendentes: 1 } }])", porque: 'o _id continuou aparecendo' },
        { codigo: "db.almas.aggregate([{ $project: { _id: 0, nome: 1, setor: 1, anos_pendentes: 1 } }])", porque: 'esqueceu o $match' },
      ],
      dicas: [
        'Primeiro filtre, depois escolha os campos: dois estágios.',
        '$project funciona como a projeção do find: campo: 1 mostra, _id: 0 esconde.',
        "db.almas.aggregate([{ $match: { setor: 'Ante-Sala' } }, { $project: { _id: 0, nome: 1, setor: 1, anos_pendentes: 1 } }])",
      ],
      recompensa: 5,
      licao: '$project escolhe os campos de saída; o _id vem sempre, a não ser que você escreva _id: 0.',
    },
    {
      id: '8.3',
      titulo: 'Segunda página',
      assunto: 'Fila do Limbo, página 2',
      corpo:
        'O guichê do Limbo mostra a fila de 5 em 5, das almas com MAIS anos pendentes para as com menos (empate: ordem alfabética de `nome`). Traga a SEGUNDA página, só com `nome` e `anos_pendentes`, sem `_id`. A ordem dos estágios importa.',
      objetivos: obj83,
      requer: ['esteira'],
      tipo: 'consulta',
      validar: relatorio(obj83, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $match: { setor: 'Limbo' } }, { $sort: { anos_pendentes: -1, nome: 1 } }, { $skip: 5 }, { $limit: 5 }, { $project: { _id: 0, nome: 1, anos_pendentes: 1 } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $match: { setor: 'Limbo' } }, { $sort: { anos_pendentes: -1, nome: 1 } }, { $limit: 5 }, { $skip: 5 }, { $project: { _id: 0, nome: 1, anos_pendentes: 1 } }])",
          porque: '$limit antes do $skip esvazia a página',
        },
        {
          codigo: "db.almas.aggregate([{ $match: { setor: 'Limbo' } }, { $sort: { anos_pendentes: 1, nome: 1 } }, { $skip: 5 }, { $limit: 5 }, { $project: { _id: 0, nome: 1, anos_pendentes: 1 } }])",
          porque: 'ordenou do menor para o maior',
        },
      ],
      dicas: [
        'Na esteira, cada estágio só vê o que o anterior deixou passar. Se você limitar a 5 e DEPOIS pular 5, sobra o quê?',
        'A ordem é: $match → $sort → $skip → $limit → $project.',
        "db.almas.aggregate([{ $match: { setor: 'Limbo' } }, { $sort: { anos_pendentes: -1, nome: 1 } }, { $skip: 5 }, { $limit: 5 }, { $project: { _id: 0, nome: 1, anos_pendentes: 1 } }])",
      ],
      recompensa: 6,
      licao: 'No pipeline a ordem dos estágios é a ordem de execução: $skip antes de $limit para paginar.',
    },
    {
      id: '8.4',
      titulo: 'Duas peneiras',
      assunto: 'Cartas esquecidas',
      corpo:
        'A Correspondência pede um relatório em duas peneiras: primeiro separe as almas com pendência `Carta não entregue`; depois, dessas, deixe só as com mais de 30 anos pendentes. Use DOIS estágios `$match` — o supervisor quer ver as peneiras.',
      objetivos: obj84,
      requer: ['esteira'],
      tipo: 'consulta',
      validar: relatorio(obj84),
      solucaoReferencia: "db.almas.aggregate([{ $match: { pendencia: 'Carta não entregue' } }, { $match: { anos_pendentes: { $gt: 30 } } }])",
      solucoesErradas: [
        { codigo: "db.almas.aggregate([{ $match: { pendencia: 'Carta não entregue', anos_pendentes: { $gt: 30 } } }])", porque: 'juntou tudo num $match só' },
        { codigo: "db.almas.aggregate([{ $match: { pendencia: 'Carta não entregue' } }, { $match: { anos_pendentes: { $lt: 30 } } }])", porque: 'inverteu a comparação' },
      ],
      dicas: ['Um estágio pode se repetir no pipeline.', 'O segundo $match só recebe o que passou pelo primeiro.', "db.almas.aggregate([{ $match: { pendencia: 'Carta não entregue' } }, { $match: { anos_pendentes: { $gt: 30 } } }])"],
      recompensa: 5,
      licao: 'Estágios podem se repetir; filtros em sequência equivalem a um E entre eles.',
    },
    {
      id: '8.5',
      titulo: 'Endereço por extenso',
      assunto: 'Etiquetas para os mensageiros',
      corpo:
        'Os mensageiros precisam de etiquetas. Para cada alma do `Purgatório` que TEM `endereco`, gere `nome` e um campo novo `enderecoCompleto` no formato `Rua das Almas, 12 — Bexiga` (rua, vírgula e espaço, número, espaço-travessão-espaço, bairro). Sem `_id`, em ordem alfabética de `nome`.',
      objetivos: obj85,
      requer: ['concatenacao'],
      tipo: 'consulta',
      validar: relatorio(obj85, { ordem: true }),
      solucaoReferencia:
        "db.almas.aggregate([{ $match: { setor: 'Purgatório', endereco: { $exists: true } } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, enderecoCompleto: { $concat: ['$endereco.rua', ', ', '$endereco.numero', ' — ', '$endereco.bairro'] } } }])",
      solucoesErradas: [
        {
          codigo: "db.almas.aggregate([{ $match: { setor: 'Purgatório', endereco: { $exists: true } } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, enderecoCompleto: { $concat: ['$endereco.rua', '$endereco.numero', '$endereco.bairro'] } } }])",
          porque: 'esqueceu os separadores',
        },
        {
          codigo: "db.almas.aggregate([{ $match: { setor: 'Purgatório' } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, enderecoCompleto: { $concat: ['$endereco.rua', ', ', '$endereco.numero', ' — ', '$endereco.bairro'] } } }])",
          porque: 'incluiu almas sem endereço (enderecoCompleto: null)',
        },
      ],
      dicas: [
        'Os separadores também são itens da lista do $concat: textos fixos entre aspas.',
        "No $project, um campo novo recebe uma expressão: enderecoCompleto: { $concat: ['$endereco.rua', ', ', ...] }. Quem não tem endereço vira null — filtre com $exists antes.",
        "db.almas.aggregate([{ $match: { setor: 'Purgatório', endereco: { $exists: true } } }, { $sort: { nome: 1 } }, { $project: { _id: 0, nome: 1, enderecoCompleto: { $concat: ['$endereco.rua', ', ', '$endereco.numero', ' — ', '$endereco.bairro'] } } }])",
      ],
      recompensa: 6,
      licao: '$concat junta textos e campos ("$campo.sub"); se qualquer parte faltar, o resultado é null.',
    },
  ],
};
