import type { Capitulo } from './tipos';
import { validarEscrita } from '../validacao';
import {
  camposComoNaReferencia,
  colecaoExiste,
  contagemNoArquivo,
  fichasQue,
  intactas,
  nenhumaNoArquivo,
  numUnicoComando,
  objetivo,
  removidasComoNaReferencia,
  usouUpsert,
  validarPorObjetivos,
} from '../objetivos';
import { IDS, PROTOCOLO_DUPLICADO } from '../mundo';
import { canonico, lerCaminho } from '../../engine/bson';

type Doc = Record<string, unknown>;
const zulmira = (d: Doc) => d.protocolo === 'A-2003-0311';
const inativaDoLimbo = (d: Doc) => d.setor === 'Limbo' && d.ativo === false;
const CHEFES = ['Chefe de Setor', 'Arquivista-Chefe Interina'];
const chefe = (d: Doc) => CHEFES.includes(d.cargo as string);
const odorico = (d: Doc) => d.protocolo === 'A-1951-0007';
const semAudiencias = (d: Doc) => Array.isArray(d.audiencias) && d.audiencias.length === 0;

const obj42 = [
  objetivo('Nenhuma alma inativa ficou no Limbo.', nenhumaNoArquivo(inativaDoLimbo)),
  objetivo('Todas elas foram para o Arquivo Morto.', camposComoNaReferencia(inativaDoLimbo, ['setor'])),
  objetivo('Almas ativas não foram mexidas.', intactas((d) => d.ativo !== false)),
  objetivo('Almas inativas de outros setores continuam onde estavam.', intactas((d) => d.ativo === false && d.setor !== 'Limbo')),
  objetivo('Tudo num único updateMany.', numUnicoComando('updateMany')),
];

const obj45 = [
  objetivo('Nenhuma ficha tem mais o campo cargo.', nenhumaNoArquivo((d) => 'cargo' in d, 'arquivistas')),
  objetivo('Todas têm funcao com o valor do antigo cargo.', camposComoNaReferencia(() => true, ['funcao'], 'arquivistas')),
  objetivo('Todas foram carimbadas com renomeadoEm (uma data).', fichasQue(() => true, (d) => d.renomeadoEm instanceof Date, 'arquivistas')),
  objetivo('Nenhum outro campo mudou.', camposComoNaReferencia(() => true, ['nome', 'setor', 'turno', 'creditos', 'ativo', 'contato', 'habilidades', 'selos'], 'arquivistas')),
];

const tiburcio = (d: Doc) => d.nome === 'Tibúrcio Leme';
const obj46 = [
  objetivo('Existe exatamente um Tibúrcio Leme.', contagemNoArquivo(tiburcio, 1, 'arquivistas')),
  objetivo("Com turno 'madrugada' e setor 'Limbo'.", fichasQue(tiburcio, (d) => d.turno === 'madrugada' && d.setor === 'Limbo', 'arquivistas')),
  objetivo('Feito com upsert (seguro mesmo se ele já existisse).', usouUpsert),
];

const obj48 = [
  objetivo('A coleção rascunhos não existe mais.', colecaoExiste('rascunhos', false)),
  objetivo(`Só uma cópia do protocolo ${PROTOCOLO_DUPLICADO} restou.`, contagemNoArquivo((d) => d.protocolo === PROTOCOLO_DUPLICADO, 1)),
  objetivo('Nenhuma alma inativa e sem audiências restou no Arquivo Morto.', nenhumaNoArquivo((d) => d.setor === 'Arquivo Morto' && d.ativo === false && semAudiencias(d))),
  objetivo('Nenhuma outra ficha foi apagada.', removidasComoNaReferencia()),
];

export const capitulo4: Capitulo = {
  numero: 4,
  titulo: 'Retificação',
  fase: 3,
  abertura:
    'A Corregedoria do Além abriu sindicância: fichas com setor errado, créditos mal calculados, rascunhos pelo chão. A partir de hoje você também ALTERA o arquivo — e o que se apaga aqui não ressuscita. A repartição também abriu a coleção dos seus colegas: arquivistas.',
  missoes: [
    {
      id: '4.1',
      titulo: 'Correção pontual',
      assunto: 'Alma no setor errado',
      corpo: 'A ficha de protocolo `A-2003-0311` (Zulmira Reis) diz Limbo, mas ela está no Purgatório desde terça. Corrija só essa ficha.',
      objetivos: [
        objetivo("A ficha A-2003-0311 está no setor 'Purgatório'.", fichasQue(zulmira, (d) => d.setor === 'Purgatório')),
        objetivo('Os outros campos da ficha continuam iguais.', camposComoNaReferencia(zulmira, ['nome', 'pendencia', 'vinculos', 'audiencias', 'anos_pendentes'])),
        objetivo('Nenhuma outra ficha foi alterada.', intactas((d) => !zulmira(d))),
      ],
      requer: ['retificacao'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $set: { setor: 'Purgatório' } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { setor: 'Purgatório' })", porque: 'esqueceu o $set' },
        { codigo: "db.almas.updateMany({ setor: 'Limbo' }, { $set: { setor: 'Purgatório' } })", porque: 'mudou o Limbo inteiro' },
      ],
      dicas: [
        'Alterar documentos exige a credencial Retificação. Primeiro argumento: o filtro. Segundo: a alteração.',
        'A alteração precisa de um operador: { $set: { campo: valor } }. Sem ele, o servidor recusa.',
        "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $set: { setor: 'Purgatório' } })",
      ],
      recompensa: 3,
      licao: 'updateOne(filtro, { $set: {...} }) altera o primeiro documento que bate, só nos campos informados.',
    },
    {
      id: '4.2',
      titulo: 'Circular interna',
      assunto: 'Circular nº 77: inativos para o Arquivo Morto',
      corpo: 'Por ordem da Corregedoria, TODAS as almas inativas (`ativo: false`) do Limbo passam para o setor `Arquivo Morto`. Faça num único comando.',
      objetivos: obj42,
      requer: ['retificacao'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj42, validarEscrita({ colecao: 'almas' })),
      solucaoReferencia: "db.almas.updateMany({ setor: 'Limbo', ativo: false }, { $set: { setor: 'Arquivo Morto' } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ setor: 'Limbo', ativo: false }, { $set: { setor: 'Arquivo Morto' } })", porque: 'só alterou a primeira' },
        { codigo: "db.almas.updateMany({ ativo: false }, { $set: { setor: 'Arquivo Morto' } })", porque: 'moveu inativas de todos os setores' },
      ],
      dicas: [
        'updateOne para na primeira ficha. Você precisa de todas.',
        'updateMany recebe o mesmo formato: filtro e alteração. O filtro tem duas condições.',
        "db.almas.updateMany({ setor: 'Limbo', ativo: false }, { $set: { setor: 'Arquivo Morto' } })",
      ],
      recompensa: 3,
      licao: 'updateMany altera todos os documentos que batem com o filtro, num único comando.',
    },
    {
      id: '4.3',
      titulo: 'Sigilo',
      assunto: 'Ramais dos colegas',
      corpo:
        'Almas andam ligando para os arquivistas fora do expediente. Remova o campo `ramal` (dentro de `contato`) de todos os arquivistas que NÃO são chefes. Chefes são os de cargo `Chefe de Setor` ou `Arquivista-Chefe Interina`. O e-mail fica.',
      objetivos: [
        objetivo('Nenhum arquivista que não é chefe tem ramal.', nenhumaNoArquivo((d) => !chefe(d) && lerCaminho(d, 'contato.ramal') !== undefined, 'arquivistas')),
        objetivo('Os chefes continuam com ramal.', fichasQue(chefe, (d) => lerCaminho(d, 'contato.ramal') !== undefined, 'arquivistas')),
        objetivo('Todos continuam com e-mail.', fichasQue(() => true, (d) => typeof lerCaminho(d, 'contato.email') === 'string', 'arquivistas')),
      ],
      requer: ['borracha'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'arquivistas' }),
      solucaoReferencia: "db.arquivistas.updateMany({ cargo: { $nin: ['Chefe de Setor', 'Arquivista-Chefe Interina'] } }, { $unset: { 'contato.ramal': '' } })",
      solucoesErradas: [
        { codigo: "db.arquivistas.updateMany({ cargo: { $nin: ['Chefe de Setor', 'Arquivista-Chefe Interina'] } }, { $unset: { contato: '' } })", porque: 'apagou o contato inteiro' },
        { codigo: "db.arquivistas.updateMany({}, { $unset: { 'contato.ramal': '' } })", porque: 'tirou o ramal dos chefes também' },
        { codigo: "db.arquivistas.updateMany({ cargo: { $nin: ['Chefe de Setor', 'Arquivista-Chefe Interina'] } }, { $set: { 'contato.ramal': '' } })", porque: 'deixou o ramal vazio em vez de remover' },
      ],
      dicas: [
        'Remover um campo é diferente de deixá-lo vazio. Veja a credencial Borracha Oficial.',
        '$unset remove o campo; use dot notation para chegar dentro de contato. Para "não é chefe", lembre do $nin.',
        "db.arquivistas.updateMany({ cargo: { $nin: ['Chefe de Setor', 'Arquivista-Chefe Interina'] } }, { $unset: { 'contato.ramal': '' } })",
      ],
      recompensa: 4,
      licao: '$unset remove um campo (com dot notation, só o campo interno). $set com "" apenas esvazia.',
    },
    {
      id: '4.4',
      titulo: 'Gratificação',
      assunto: 'Folha de créditos do mês',
      corpo:
        'Quatro ordens da Tesouraria, NESTA ordem: 1) turno da `noite` ganha +50 créditos; 2) todos os arquivistas ativos recebem reajuste de 10%; 3) ninguém pode passar de 1000 créditos (teto); 4) ninguém pode ficar abaixo de 100 (piso).',
      objetivos: [
        objetivo('Turno da noite recebeu +50 antes do reajuste.', camposComoNaReferencia((d) => d.turno === 'noite', ['creditos'], 'arquivistas')),
        objetivo('Ativos dos outros turnos receberam 10% de reajuste.', camposComoNaReferencia((d) => d.turno !== 'noite' && d.ativo === true, ['creditos'], 'arquivistas')),
        objetivo('Ninguém acima de 1000 créditos.', nenhumaNoArquivo((d) => (d.creditos as number) > 1000, 'arquivistas')),
        objetivo('Ninguém abaixo de 100 créditos.', nenhumaNoArquivo((d) => (d.creditos as number) < 100, 'arquivistas')),
      ],
      requer: ['calculadora'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'arquivistas' }),
      solucaoReferencia: [
        "db.arquivistas.updateMany({ turno: 'noite' }, { $inc: { creditos: 50 } })",
        'db.arquivistas.updateMany({ ativo: true }, { $mul: { creditos: 1.1 } })',
        'db.arquivistas.updateMany({}, { $min: { creditos: 1000 } })',
        'db.arquivistas.updateMany({}, { $max: { creditos: 100 } })',
      ].join('\n'),
      solucoesErradas: [
        {
          codigo: 'db.arquivistas.updateMany({ ativo: true }, { $mul: { creditos: 1.1 } }); db.arquivistas.updateMany({}, { $min: { creditos: 1000 } }); db.arquivistas.updateMany({}, { $max: { creditos: 100 } })',
          porque: 'esqueceu o adicional da noite',
        },
        {
          codigo:
            "db.arquivistas.updateMany({ turno: 'noite' }, { $inc: { creditos: 50 } }); db.arquivistas.updateMany({ ativo: true }, { $mul: { creditos: 1.1 } }); db.arquivistas.updateMany({}, { $max: { creditos: 1000 } }); db.arquivistas.updateMany({}, { $min: { creditos: 100 } })",
          porque: 'trocou $min e $max',
        },
      ],
      dicas: [
        'São quatro updateMany seguidos. A ordem importa: o reajuste de 10% incide sobre o valor já com o adicional.',
        '$inc soma, $mul multiplica (10% = 1.1). Teto é $min (só baixa quem está acima); piso é $max (só sobe quem está abaixo).',
        "db.arquivistas.updateMany({ turno: 'noite' }, { $inc: { creditos: 50 } })  →  depois $mul 1.1 nos ativos, $min 1000 e $max 100 em todos",
      ],
      recompensa: 5,
      licao: '$inc soma, $mul multiplica, $min funciona como teto e $max como piso.',
    },
    {
      id: '4.5',
      titulo: 'Nova nomenclatura',
      assunto: 'Reforma administrativa',
      corpo: 'A reforma administrativa extinguiu a palavra "cargo". Em TODAS as fichas de arquivistas, o campo `cargo` passa a se chamar `funcao`, e cada ficha deve ser carimbada com a data da mudança em `renomeadoEm`.',
      objetivos: obj45,
      requer: ['borracha'],
      depoisDe: ['4.3'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj45),
      solucaoReferencia: "db.arquivistas.updateMany({}, { $rename: { cargo: 'funcao' }, $currentDate: { renomeadoEm: true } })",
      solucoesErradas: [
        { codigo: "db.arquivistas.updateMany({}, { $set: { funcao: '$cargo' }, $currentDate: { renomeadoEm: true } })", porque: 'gravou o texto "$cargo"' },
        { codigo: "db.arquivistas.updateMany({}, { $rename: { cargo: 'funcao' } })", porque: 'esqueceu a data' },
      ],
      dicas: [
        'Existe um operador que muda o NOME do campo mantendo o valor.',
        '$rename: { antigo: "novo" }. E $currentDate: { campo: true } grava a data atual. Os dois cabem no mesmo update.',
        "db.arquivistas.updateMany({}, { $rename: { cargo: 'funcao' }, $currentDate: { renomeadoEm: true } })",
      ],
      recompensa: 4,
      licao: '$rename troca o nome do campo; $currentDate carimba a data atual. Vários operadores podem ir no mesmo update.',
    },
    {
      id: '4.6',
      titulo: 'Cadastro fantasma',
      assunto: 'Talvez ele exista, talvez não',
      corpo:
        'O arquivista `Tibúrcio Leme` foi transferido do Inferno. Ninguém sabe se a ficha dele já foi criada. Garanta que exista UMA ficha dele com `turno: \'madrugada\'` e `setor: \'Limbo\'` — sem duplicar, caso ela já exista.',
      objetivos: obj46,
      requer: ['cadastro-fantasma'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj46, validarEscrita({ colecao: 'arquivistas' })),
      solucaoReferencia: "db.arquivistas.updateOne({ nome: 'Tibúrcio Leme' }, { $set: { turno: 'madrugada', setor: 'Limbo' } }, { upsert: true })",
      solucoesErradas: [
        { codigo: "db.arquivistas.insertOne({ nome: 'Tibúrcio Leme', turno: 'madrugada', setor: 'Limbo' })", porque: 'insertOne duplicaria se ele existisse' },
        { codigo: "db.arquivistas.updateOne({ nome: 'Tibúrcio Leme' }, { $set: { turno: 'madrugada', setor: 'Limbo' } })", porque: 'sem upsert, nada acontece' },
      ],
      dicas: [
        'Rode o update sem nenhuma opção e veja o matchedCount. O que falta?',
        'A opção { upsert: true } cria o documento quando nada bate — com os campos do filtro mais os do $set.',
        "db.arquivistas.updateOne({ nome: 'Tibúrcio Leme' }, { $set: { turno: 'madrugada', setor: 'Limbo' } }, { upsert: true })",
      ],
      recompensa: 4,
      licao: 'upsert: true atualiza se existir e cria se não existir — nunca duplica.',
    },
    {
      id: '4.7',
      titulo: 'O formulário em branco',
      assunto: 'Ficha refeita do zero',
      corpo:
        'A ficha de Odorico Paz (`A-1951-0007`) está tão rasurada que a Corregedoria mandou refazer: ela deve ficar APENAS com `protocolo`, `nome` e `setor: \'Ante-Sala\'`. Todo o resto some. Mesma ficha (mesmo _id), não uma nova.',
      objetivos: [
        objetivo('A ficha A-1951-0007 tem só protocolo, nome e setor.', fichasQue(odorico, (d) => Object.keys(d).filter((k) => k !== '_id').sort().join() === 'nome,protocolo,setor')),
        objetivo("Com setor 'Ante-Sala' e nome 'Odorico Paz'.", fichasQue(odorico, (d) => d.setor === 'Ante-Sala' && d.nome === 'Odorico Paz')),
        objetivo('É a mesma ficha de antes (mesmo _id).', fichasQue(odorico, (d) => canonico(d._id) === canonico(IDS.odorico))),
        objetivo('Nenhuma outra ficha mudou.', intactas((d) => !odorico(d))),
      ],
      requer: ['formulario-novo'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.replaceOne({ protocolo: 'A-1951-0007' }, { protocolo: 'A-1951-0007', nome: 'Odorico Paz', setor: 'Ante-Sala' })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ protocolo: 'A-1951-0007' }, { $set: { setor: 'Ante-Sala' } })", porque: '$set mantém os outros campos' },
        { codigo: "db.almas.deleteOne({ protocolo: 'A-1951-0007' }); db.almas.insertOne({ protocolo: 'A-1951-0007', nome: 'Odorico Paz', setor: 'Ante-Sala' })", porque: 'apagar e inserir troca o _id' },
      ],
      dicas: [
        'Com $set, os campos que você não mencionou continuam lá. Aqui a ideia é o contrário.',
        'replaceOne(filtro, documentoNovo) troca o documento inteiro e mantém o _id. Sem operadores no segundo argumento.',
        "db.almas.replaceOne({ protocolo: 'A-1951-0007' }, { protocolo: 'A-1951-0007', nome: 'Odorico Paz', setor: 'Ante-Sala' })",
      ],
      recompensa: 4,
      licao: 'replaceOne substitui o documento inteiro (campos não informados somem); updateOne com $set só mexe no que você citar.',
    },
    {
      id: '4.8',
      titulo: 'Expurgo',
      assunto: 'Limpeza autorizada pela Corregedoria',
      corpo: `Três limpezas: 1) a coleção \`rascunhos\` inteira vai para a fornalha; 2) o protocolo \`${PROTOCOLO_DUPLICADO}\` foi digitado duas vezes — apague só UMA das cópias; 3) apague as almas do Arquivo Morto inativas e sem nenhuma audiência. Confira com find antes de apagar: aqui não existe lixeira.`,
      objetivos: obj48,
      requer: ['expurgo'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj48),
      solucaoReferencia: [
        'db.rascunhos.drop()',
        `db.almas.deleteOne({ protocolo: '${PROTOCOLO_DUPLICADO}' })`,
        "db.almas.deleteMany({ setor: 'Arquivo Morto', ativo: false, audiencias: { $size: 0 } })",
      ].join('\n'),
      solucoesErradas: [
        {
          codigo: `db.rascunhos.drop(); db.almas.deleteMany({ protocolo: '${PROTOCOLO_DUPLICADO}' }); db.almas.deleteMany({ setor: 'Arquivo Morto', ativo: false, audiencias: { $size: 0 } })`,
          porque: 'apagou as duas cópias',
        },
        { codigo: `db.almas.deleteOne({ protocolo: '${PROTOCOLO_DUPLICADO}' }); db.almas.deleteMany({ setor: 'Arquivo Morto', ativo: false, audiencias: { $size: 0 } })`, porque: 'esqueceu os rascunhos' },
      ],
      dicas: [
        `Comece conferindo: db.almas.find({ protocolo: '${PROTOCOLO_DUPLICADO}' }). Quantas voltam?`,
        'drop() apaga a coleção; deleteOne apaga só o primeiro que bate; deleteMany apaga todos. Array vazio: { $size: 0 }.',
        `db.rascunhos.drop(); db.almas.deleteOne({ protocolo: '${PROTOCOLO_DUPLICADO}' }); e um deleteMany com setor, ativo e audiencias: { $size: 0 }`,
      ],
      recompensa: 5,
      licao: 'drop apaga a coleção, deleteOne o primeiro que bate, deleteMany todos. Sempre confira com find antes.',
    },
  ],
};
