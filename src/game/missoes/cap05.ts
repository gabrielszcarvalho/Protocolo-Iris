import type { Capitulo } from './tipos';
import { validarEscrita } from '../validacao';
import { camposComoNaReferencia, fichasQue, intactas, nenhumaNoArquivo, objetivo } from '../objetivos';
import { canonico } from '../../engine/bson';

type Doc = Record<string, unknown>;
type Audiencia = { parecer: string; peso: number; data: Date };
const vinculos = (d: Doc) => (Array.isArray(d.vinculos) ? (d.vinculos as string[]) : []);
const audiencias = (d: Doc) => (Array.isArray(d.audiencias) ? (d.audiencias as Audiencia[]) : []);
const protocolo = (p: string) => (d: Doc) => d.protocolo === p;
const iracema = protocolo('A-1938-0042');
const dalva = protocolo('A-1964-0033');
const zulmira = protocolo('A-2003-0311');
const firmino = protocolo('A-1988-0512');
const zPesada = (a: Audiencia) => a.parecer === 'Z' && a.peso > 45;

export const capitulo5: Capitulo = {
  numero: 5,
  titulo: 'Anexos',
  fase: 3,
  abertura:
    'Os mortos continuam acumulando vínculos e audiências depois de mortos — ninguém sabe como. O Setor de Anexos quer as listas em ordem: acrescentar, tirar, trocar itens sem refazer a ficha inteira.',
  missoes: [
    {
      id: '5.1',
      titulo: 'Novo vínculo',
      assunto: 'Uma neta apareceu',
      corpo: 'Descobriram que Iracema Vilaverde (`A-1938-0042`) deixou uma neta. Acrescente o vínculo `neta` à lista dela, sem perder os que já existem.',
      objetivos: [
        objetivo("Iracema tem o vínculo 'neta'.", fichasQue(iracema, (d) => vinculos(d).includes('neta'))),
        objetivo("Os vínculos antigos continuam e 'neta' entrou no fim.", camposComoNaReferencia(iracema, ['vinculos'])),
      ],
      requer: ['grampeador'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $push: { vinculos: 'neta' } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $set: { vinculos: ['neta'] } })", porque: '$set trocou a lista inteira' },
        { codigo: "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $set: { vinculos: 'neta' } })", porque: 'transformou a lista em texto' },
      ],
      dicas: ['$set troca o valor inteiro do campo. Para acrescentar a um array existe outro operador.', '$push: { array: valor } coloca o valor no fim da lista.', "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $push: { vinculos: 'neta' } })"],
      recompensa: 3,
      licao: '$push acrescenta um item no fim do array sem mexer nos outros.',
    },
    {
      id: '5.2',
      titulo: 'No topo da lista',
      assunto: 'Vínculos prioritários',
      corpo: 'Dalva Nogueira (`A-1964-0033`) ganhou dois vínculos que precisam aparecer ANTES dos outros, nesta ordem: `testemunha` e `tia`.',
      objetivos: [
        objetivo("Dalva tem 'testemunha' e 'tia'.", fichasQue(dalva, (d) => vinculos(d).includes('testemunha') && vinculos(d).includes('tia'))),
        objetivo('Os dois novos vêm primeiro, nessa ordem.', fichasQue(dalva, (d) => canonico(vinculos(d).slice(0, 2)) === canonico(['testemunha', 'tia']))),
        objetivo('Os vínculos antigos continuam logo depois.', camposComoNaReferencia(dalva, ['vinculos'])),
      ],
      requer: ['grampeador'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateOne({ protocolo: 'A-1964-0033' }, { $push: { vinculos: { $each: ['testemunha', 'tia'], $position: 0 } } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ protocolo: 'A-1964-0033' }, { $push: { vinculos: { $each: ['testemunha', 'tia'] } } })", porque: 'entraram no fim' },
        { codigo: "db.almas.updateOne({ protocolo: 'A-1964-0033' }, { $push: { vinculos: ['testemunha', 'tia'] } })", porque: 'sem $each vira uma lista dentro da lista' },
      ],
      dicas: ['Para empurrar vários itens de uma vez, o $push precisa de um modificador.', '$each: [ ... ] insere vários; $position: 0 diz onde inserir (0 = começo).', "db.almas.updateOne({ protocolo: 'A-1964-0033' }, { $push: { vinculos: { $each: ['testemunha', 'tia'], $position: 0 } } })"],
      recompensa: 4,
      licao: '$each insere vários itens; $position escolhe onde. Sem $each, a lista inteira vira UM item.',
    },
    {
      id: '5.3',
      titulo: 'Gaveta pequena',
      assunto: 'Só cabem três audiências',
      corpo:
        'A gaveta de Iracema (`A-1938-0042`) só comporta 3 audiências. Anexe as duas novas (já estão no terminal, na variável `novasAudiencias`), deixe a lista da mais recente para a mais antiga e mantenha só as 3 mais recentes.',
      anexo: {
        variavel: 'novasAudiencias',
        codigo: "const novasAudiencias = [\n  { parecer: 'B', peso: 20, data: ISODate('2024-01-10') },\n  { parecer: 'A', peso: 5, data: ISODate('2025-03-03') }\n]",
      },
      objetivos: [
        objetivo('As duas audiências novas estão na ficha.', fichasQue(iracema, (d) => audiencias(d).filter((a) => a.data instanceof Date && a.data.getUTCFullYear() >= 2024).length === 2)),
        objetivo('Ordenadas da mais recente para a mais antiga.', fichasQue(iracema, (d) => audiencias(d).every((a, i, l) => i === 0 || l[i - 1].data >= a.data))),
        objetivo('Só as 3 mais recentes ficaram.', fichasQue(iracema, (d) => audiencias(d).length === 3)),
      ],
      requer: ['grampeador'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $push: { audiencias: { $each: novasAudiencias, $sort: { data: -1 }, $slice: 3 } } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $push: { audiencias: { $each: novasAudiencias, $sort: { data: -1 } } } })", porque: 'esqueceu o $slice' },
        { codigo: "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $push: { audiencias: { $each: novasAudiencias, $slice: 3 } } })", porque: 'cortou sem ordenar' },
      ],
      dicas: [
        'O $push com $each aceita mais dois modificadores: um ordena, outro corta.',
        '$sort: { data: -1 } ordena os subdocumentos pela data decrescente; $slice: 3 mantém só os 3 primeiros depois de ordenar.',
        "db.almas.updateOne({ protocolo: 'A-1938-0042' }, { $push: { audiencias: { $each: novasAudiencias, $sort: { data: -1 }, $slice: 3 } } })",
      ],
      recompensa: 5,
      licao: 'No $push, $sort ordena e $slice limita o array logo depois de inserir — tudo num comando só.',
    },
    {
      id: '5.4',
      titulo: 'Sem repetir',
      assunto: 'Curso de caligrafia gótica',
      corpo: 'Todo o turno da `noite` fez o curso de caligrafia. Acrescente `caligrafia` às habilidades de cada um — mas quem já tinha não pode ficar com a habilidade repetida.',
      objetivos: [
        objetivo('Todos do turno da noite têm caligrafia.', fichasQue((d) => d.turno === 'noite', (d) => (d.habilidades as string[]).includes('caligrafia'), 'arquivistas')),
        objetivo('Ninguém ficou com caligrafia repetida.', nenhumaNoArquivo((d) => ((d.habilidades as string[]) ?? []).filter((h) => h === 'caligrafia').length > 1, 'arquivistas')),
        objetivo('Arquivistas de outros turnos não mudaram.', intactas((d) => d.turno !== 'noite', 'arquivistas')),
      ],
      requer: ['sem-repeticao'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'arquivistas' }),
      solucaoReferencia: "db.arquivistas.updateMany({ turno: 'noite' }, { $addToSet: { habilidades: 'caligrafia' } })",
      solucoesErradas: [
        { codigo: "db.arquivistas.updateMany({ turno: 'noite' }, { $push: { habilidades: 'caligrafia' } })", porque: '$push duplicou em quem já tinha' },
        { codigo: "db.arquivistas.updateMany({}, { $addToSet: { habilidades: 'caligrafia' } })", porque: 'deu o curso para todos os turnos' },
      ],
      dicas: ['Dona Custódia é da noite e já tinha caligrafia. O que acontece com ela num $push?', '$addToSet só acrescenta se o valor ainda não estiver na lista.', "db.arquivistas.updateMany({ turno: 'noite' }, { $addToSet: { habilidades: 'caligrafia' } })"],
      recompensa: 3,
      licao: '$addToSet acrescenta sem duplicar; $push acrescenta sempre.',
    },
    {
      id: '5.5',
      titulo: 'Vínculo revogado',
      assunto: 'Sociedades dissolvidas',
      corpo: 'No Purgatório, ninguém mais tem sócio: remova `ex-sócio` dos vínculos de TODAS as almas do setor Purgatório. Os demais vínculos ficam.',
      objetivos: [
        objetivo("Nenhuma alma do Purgatório tem 'ex-sócio'.", nenhumaNoArquivo((d) => d.setor === 'Purgatório' && vinculos(d).includes('ex-sócio'))),
        objetivo('Os outros vínculos delas continuam.', camposComoNaReferencia((d) => d.setor === 'Purgatório' && vinculos(d).includes('ex-sócio'), ['vinculos'])),
        objetivo('Almas de outros setores não mudaram.', intactas((d) => d.setor !== 'Purgatório')),
      ],
      requer: ['tesoura'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateMany({ setor: 'Purgatório' }, { $pull: { vinculos: 'ex-sócio' } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ setor: 'Purgatório' }, { $pull: { vinculos: 'ex-sócio' } })", porque: 'só a primeira ficha' },
        { codigo: "db.almas.updateMany({}, { $pull: { vinculos: 'ex-sócio' } })", porque: 'mexeu em todos os setores' },
      ],
      dicas: ['Tirar um item específico de um array é trabalho da Tesoura.', '$pull: { array: valor } remove todas as ocorrências do valor. Com updateMany, em todas as fichas do filtro.', "db.almas.updateMany({ setor: 'Purgatório' }, { $pull: { vinculos: 'ex-sócio' } })"],
      recompensa: 4,
      licao: '$pull remove de um array todos os itens iguais ao valor (ou que atendem a uma condição).',
    },
    {
      id: '5.6',
      titulo: 'Pela ponta',
      assunto: 'Vínculos prescritos',
      corpo: 'Na ficha de Zulmira Reis (`A-2003-0311`), o ÚLTIMO vínculo prescreveu, e o PRIMEIRO também. Remova os dois pelas pontas da lista.',
      objetivos: [
        objetivo("O último vínculo ('poeta') saiu.", fichasQue(zulmira, (d) => !vinculos(d).includes('poeta'))),
        objetivo("O primeiro vínculo ('mãe') saiu.", fichasQue(zulmira, (d) => !vinculos(d).includes('mãe'))),
        objetivo("'contrabandista' continua.", fichasQue(zulmira, (d) => canonico(vinculos(d)) === canonico(['contrabandista']))),
      ],
      requer: ['tesoura'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $pop: { vinculos: 1 } })\ndb.almas.updateOne({ protocolo: 'A-2003-0311' }, { $pop: { vinculos: -1 } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $pop: { vinculos: -1 } }); db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $pop: { vinculos: -1 } })", porque: 'tirou os dois primeiros' },
        { codigo: "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $pop: { vinculos: 1 } }); db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $pop: { vinculos: 1 } })", porque: 'tirou os dois últimos' },
      ],
      dicas: ['Um operador da Tesoura remove itens das pontas.', '$pop: { array: 1 } remove o último; $pop: { array: -1 } remove o primeiro. Não dá para usar os dois no mesmo campo num único update.', "db.almas.updateOne({ protocolo: 'A-2003-0311' }, { $pop: { vinculos: 1 } })  e depois  { $pop: { vinculos: -1 } }"],
      recompensa: 4,
      licao: '$pop: 1 remove o último item; $pop: -1 remove o primeiro.',
    },
    {
      id: '5.7',
      titulo: 'Retificação cirúrgica',
      assunto: 'O sócio se arrependeu',
      corpo: "Na ficha de Firmino Toledo (`A-1988-0512`), o vínculo `ex-sócio` deve virar `sócio arrependido`, NA MESMA POSIÇÃO da lista, sem mexer nos outros.",
      objetivos: [
        objetivo("'ex-sócio' não existe mais na ficha.", fichasQue(firmino, (d) => !vinculos(d).includes('ex-sócio'))),
        objetivo("'sócio arrependido' ficou na mesma posição (a segunda).", fichasQue(firmino, (d) => vinculos(d)[1] === 'sócio arrependido')),
        objetivo("'pai' continua em primeiro.", fichasQue(firmino, (d) => vinculos(d)[0] === 'pai')),
      ],
      requer: ['posicional'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateOne({ protocolo: 'A-1988-0512', vinculos: 'ex-sócio' }, { $set: { 'vinculos.$': 'sócio arrependido' } })",
      solucoesErradas: [
        { codigo: "db.almas.updateOne({ protocolo: 'A-1988-0512' }, { $set: { vinculos: ['sócio arrependido'] } })", porque: 'trocou a lista inteira' },
        { codigo: "db.almas.updateOne({ protocolo: 'A-1988-0512' }, { $set: { 'vinculos.$': 'sócio arrependido' } })", porque: 'o filtro não menciona o array' },
      ],
      dicas: [
        'Você não sabe a posição de antemão — quer "o item que bateu com o filtro".',
        'O $ posicional no caminho ("vinculos.$") representa o primeiro item que casou com o filtro. Para isso, o filtro precisa citar o array: { vinculos: "ex-sócio" }.',
        "db.almas.updateOne({ protocolo: 'A-1988-0512', vinculos: 'ex-sócio' }, { $set: { 'vinculos.$': 'sócio arrependido' } })",
      ],
      recompensa: 4,
      licao: '"array.$" altera o primeiro item que bateu com o filtro — e o filtro precisa mencionar o array.',
    },
    {
      id: '5.8',
      titulo: 'Vários de uma vez',
      assunto: 'Revisão de pareceres pesados',
      corpo: 'O Tribunal Celeste revisou tudo: em TODAS as almas, TODA audiência com parecer `Z` e peso acima de 45 passa a ter parecer `C`. As outras audiências ficam como estão.',
      objetivos: [
        objetivo('Nenhuma audiência Z com peso acima de 45 restou.', nenhumaNoArquivo((d) => audiencias(d).some(zPesada))),
        objetivo('As audiências alteradas viraram C e mantiveram peso e data.', camposComoNaReferencia((d) => audiencias(d).some(zPesada), ['audiencias'])),
        objetivo('Fichas sem Z pesado não mudaram.', intactas((d) => !audiencias(d).some(zPesada))),
      ],
      requer: ['filtros-de-anexo'],
      tipo: 'escrita',
      validar: validarEscrita({ colecao: 'almas' }),
      solucaoReferencia: "db.almas.updateMany({}, { $set: { 'audiencias.$[a].parecer': 'C' } }, { arrayFilters: [{ 'a.parecer': 'Z', 'a.peso': { $gt: 45 } }] })",
      solucoesErradas: [
        { codigo: "db.almas.updateMany({ audiencias: { $elemMatch: { parecer: 'Z', peso: { $gt: 45 } } } }, { $set: { 'audiencias.$.parecer': 'C' } })", porque: 'o $ só pega a primeira de cada ficha' },
        { codigo: "db.almas.updateMany({ audiencias: { $elemMatch: { parecer: 'Z', peso: { $gt: 45 } } } }, { $set: { 'audiencias.$[].parecer': 'C' } })", porque: '$[] trocou todas as audiências da ficha' },
      ],
      dicas: [
        'Custódio Albuquerque tem DUAS audiências Z pesadas. O $ posicional resolve as duas?',
        '$[apelido] no caminho + a opção arrayFilters: [{ "apelido.campo": condição }] alteram todos os itens que atendem ao filtro.',
        "db.almas.updateMany({}, { $set: { 'audiencias.$[a].parecer': 'C' } }, { arrayFilters: [{ 'a.parecer': 'Z', 'a.peso': { $gt: 45 } }] })",
      ],
      recompensa: 5,
      licao: '$[apelido] com arrayFilters altera TODOS os itens do array que atendem à condição; $ só o primeiro.',
    },
  ],
};
