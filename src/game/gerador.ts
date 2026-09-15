/**
 * Gerador de memorandos de treino (Sala de Treino).
 *
 * Nada de IA: cada modelo é um exercício com lacunas preenchidas com valores sorteados do próprio
 * arquivo (setores, pendências, vínculos, protocolos...). O memorando nasce junto com a solução de
 * referência, então a correção é a mesma da campanha — pelo efeito, com diagnóstico e ✓/✗.
 *
 * Um sorteio só vira memorando se a referência roda com as credenciais do jogador e produz algo
 * interessante (consulta não vazia e que não traz o arquivo inteiro; gravação que muda algumas
 * fichas, mas não todas).
 */

import type { Database } from '../engine/database';
import { Sessao } from '../engine/shell';
import { criarVerificador } from './arvore';
import type { Missao } from './missoes';
import { Rng } from './mundo';
import { diffColecao, validarConsulta, validarEscrita, type OpcoesConsulta } from './validacao';
import { objetivo, ordemComoReferencia, semCampo, somenteCampos, todas, validarPorObjetivos, type Objetivo } from './objetivos';

export type AssuntoTreino = 'consultas' | 'arrays' | 'regex' | 'gravacoes' | 'relatorios';

export const ASSUNTOS_TREINO: { id: AssuntoTreino; rotulo: string }[] = [
  { id: 'consultas', rotulo: 'Consultas e filtros' },
  { id: 'arrays', rotulo: 'Arrays' },
  { id: 'regex', rotulo: 'Grafologia (regex)' },
  { id: 'gravacoes', rotulo: 'Gravações (update e delete)' },
  { id: 'relatorios', rotulo: 'Relatórios (aggregate)' },
];

type Doc = Record<string, unknown>;

interface Rascunho {
  titulo: string;
  corpo: string;
  tipo: 'consulta' | 'escrita';
  referencia: string;
  /** Texto do quadradinho principal. */
  entrega: string;
  ordem?: boolean;
  campos?: string[];
  semId?: boolean;
  relatorio?: boolean;
  /** Conceito e sintaxe; a terceira dica é sempre a solução. */
  dicas: [string, string];
  licao: string;
}

interface Sorteio {
  rng: Rng;
  almas: Doc[];
  setores: string[];
  pendencias: string[];
  vinculos: string[];
  pareceres: string[];
}

interface Modelo {
  assunto: AssuntoTreino;
  montar(s: Sorteio): Rascunho | null;
}

const q = (v: string) => `'${v}'`;
const outro = <T>(rng: Rng, lista: T[], evitar: T) => rng.escolher(lista.filter((x) => x !== evitar));

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

const COMPARACOES = [
  { op: '$gt', texto: 'mais de' },
  { op: '$gte', texto: 'pelo menos' },
  { op: '$lt', texto: 'menos de' },
  { op: '$lte', texto: 'no máximo' },
] as const;

const MODELOS: Modelo[] = [
  // --- consultas ------------------------------------------------------------
  {
    assunto: 'consultas',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const ativo = rng.chance(0.5);
      return {
        titulo: 'Chamada do setor',
        corpo: `Traga as almas do setor \`${setor}\` que estão ${ativo ? 'ativas' : 'inativas'} (\`ativo: ${ativo}\`).`,
        tipo: 'consulta',
        referencia: `db.almas.find({ setor: ${q(setor)}, ativo: ${ativo} })`,
        entrega: `Todas as almas ${ativo ? 'ativas' : 'inativas'} de ${setor}, e só elas.`,
        dicas: ['Duas condições no mesmo filtro valem as duas ao mesmo tempo (E).', '{ campo1: valor1, campo2: valor2 }'],
        licao: 'Vários campos no mesmo filtro funcionam como um E.',
      };
    },
  },
  {
    assunto: 'consultas',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const c = rng.escolher(COMPARACOES);
      const n = rng.inteiro(5, 85);
      return {
        titulo: 'Régua de anos',
        corpo: `Traga as almas de \`${setor}\` com ${c.texto} ${n} anos pendentes.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ setor: ${q(setor)}, anos_pendentes: { ${c.op}: ${n} } })`,
        entrega: `Almas de ${setor} com ${c.texto} ${n} anos pendentes — confira o valor-limite.`,
        dicas: ['“Mais de” não inclui o próprio número; “pelo menos” inclui.', '$gt (>), $gte (>=), $lt (<), $lte (<=): { campo: { $gt: n } }'],
        licao: `${c.op} compara números; atenção a incluir ou não o limite.`,
      };
    },
  },
  {
    assunto: 'consultas',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const de = rng.inteiro(0, 60);
      const ate = de + rng.inteiro(5, 25);
      return {
        titulo: 'Faixa exata',
        corpo: `Traga as almas de \`${setor}\` com anos pendentes entre ${de} e ${ate}, incluindo os dois limites.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ setor: ${q(setor)}, anos_pendentes: { $gte: ${de}, $lte: ${ate} } })`,
        entrega: `Almas de ${setor} com ${de} a ${ate} anos pendentes (limites incluídos).`,
        dicas: ['Dois operadores podem ficar dentro do mesmo campo.', '{ campo: { $gte: a, $lte: b } }'],
        licao: '$gte e $lte no mesmo campo formam uma faixa fechada.',
      };
    },
  },
  {
    assunto: 'consultas',
    montar: ({ rng, setores, pendencias }) => {
      const setor = rng.escolher(setores);
      const a = rng.escolher(pendencias);
      const b = outro(rng, pendencias, a);
      const negar = rng.chance(0.4);
      return {
        titulo: negar ? 'Lista negra' : 'Lista fechada',
        corpo: negar
          ? `Traga as almas de \`${setor}\` cuja pendência NÃO é \`${a}\` nem \`${b}\`.`
          : `Traga as almas de \`${setor}\` cuja pendência é \`${a}\` ou \`${b}\`.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ setor: ${q(setor)}, pendencia: { ${negar ? '$nin' : '$in'}: [${q(a)}, ${q(b)}] } })`,
        entrega: negar ? `Almas de ${setor} com qualquer pendência, menos essas duas.` : `Almas de ${setor} com uma dessas duas pendências.`,
        dicas: ['Há um operador que recebe uma LISTA de valores aceitos (ou recusados).', negar ? '{ campo: { $nin: [a, b] } }' : '{ campo: { $in: [a, b] } }'],
        licao: '$in aceita qualquer valor da lista; $nin recusa todos eles.',
      };
    },
  },
  {
    assunto: 'consultas',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const n = rng.inteiro(60, 88);
      return {
        titulo: 'Ou um, ou outro',
        corpo: `Traga as almas que estão em \`${setor}\` OU que têm mais de ${n} anos pendentes (em qualquer setor).`,
        tipo: 'consulta',
        referencia: `db.almas.find({ $or: [{ setor: ${q(setor)} }, { anos_pendentes: { $gt: ${n} } }] })`,
        entrega: `Almas de ${setor} e, de qualquer setor, as com mais de ${n} anos pendentes.`,
        dicas: ['Campos no mesmo filtro são E. Para OU, existe um operador próprio.', '{ $or: [ { condição1 }, { condição2 } ] }'],
        licao: '$or recebe uma lista de filtros e aceita quem atende a pelo menos um.',
      };
    },
  },
  {
    assunto: 'consultas',
    montar: ({ rng, setores, pendencias }) => {
      const setor = rng.escolher(setores);
      const pendencia = rng.escolher(pendencias);
      return {
        titulo: 'Só o número',
        corpo: `Quantas almas de \`${setor}\` têm a pendência \`${pendencia}\`? Responda com o número.`,
        tipo: 'consulta',
        referencia: `db.almas.countDocuments({ setor: ${q(setor)}, pendencia: ${q(pendencia)} })`,
        entrega: 'O número certo.',
        dicas: ['O memorando quer uma contagem, não as fichas.', 'db.colecao.countDocuments({ filtro })'],
        licao: 'countDocuments devolve só a quantidade que atende ao filtro.',
      };
    },
  },
  {
    assunto: 'consultas',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const k = rng.inteiro(3, 8);
      const mais = rng.chance(0.6);
      return {
        titulo: 'Topo da fila',
        corpo: `Traga as ${k} almas de \`${setor}\` com ${mais ? 'MAIS' : 'MENOS'} anos pendentes (empate: ordem alfabética de nome). Só \`nome\` e \`anos_pendentes\`, sem \`_id\`.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ setor: ${q(setor)} }, { _id: 0, nome: 1, anos_pendentes: 1 }).sort({ anos_pendentes: ${mais ? -1 : 1}, nome: 1 }).limit(${k})`,
        entrega: `As ${k} almas certas de ${setor}.`,
        ordem: true,
        campos: ['nome', 'anos_pendentes'],
        semId: true,
        dicas: ['Projeção escolhe os campos; sort ordena; limit corta.', `.find(filtro, { _id: 0, campo: 1 }).sort({ campo: ${mais ? -1 : 1}, nome: 1 }).limit(n)`],
        licao: 'sort antes de limit: primeiro ordena, depois corta.',
      };
    },
  },
  {
    assunto: 'consultas',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const campo = rng.escolher(['endereco', 'endereco.cep']);
      return {
        titulo: 'Fichas incompletas',
        corpo:
          campo === 'endereco'
            ? `Traga as almas de \`${setor}\` que não têm o campo \`endereco\`.`
            : `Traga as almas de \`${setor}\` sem \`endereco.cep\` (tanto as que têm endereço sem CEP quanto as que nem têm endereço).`,
        tipo: 'consulta',
        referencia: `db.almas.find({ setor: ${q(setor)}, ${campo === 'endereco' ? 'endereco' : "'endereco.cep'"}: { $exists: false } })`,
        entrega: `Almas de ${setor} sem ${campo}.`,
        dicas: ['O que importa é a PRESENÇA do campo, não o valor.', "{ campo: { $exists: false } } — com dot notation: { 'sub.campo': { $exists: false } }"],
        licao: '$exists: false encontra documentos em que o campo não existe.',
      };
    },
  },

  // --- arrays ---------------------------------------------------------------
  {
    assunto: 'arrays',
    montar: ({ rng, vinculos }) => {
      const v = rng.escolher(vinculos);
      return {
        titulo: 'Um vínculo',
        corpo: `Traga as almas que têm \`${v}\` entre os vínculos (pode haver outros junto).`,
        tipo: 'consulta',
        referencia: `db.almas.find({ vinculos: ${q(v)} })`,
        entrega: `Todas as almas com ${v} entre os vínculos.`,
        dicas: ['Buscar um valor dentro de um array é igual a buscar num campo comum.', '{ array: valor } encontra arrays que CONTÊM o valor.'],
        licao: '{ array: valor } busca um elemento; { array: [valor] } exige o array idêntico.',
      };
    },
  },
  {
    assunto: 'arrays',
    montar: ({ rng, vinculos }) => {
      const a = rng.escolher(vinculos);
      const b = outro(rng, vinculos, a);
      return {
        titulo: 'Os dois vínculos',
        corpo: `Traga as almas que são \`${a}\` E \`${b}\` ao mesmo tempo, em qualquer ordem.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ vinculos: { $all: [${q(a)}, ${q(b)}] } })`,
        entrega: `Almas com ${a} e ${b} nos vínculos.`,
        dicas: ['$in aceita qualquer um. Você precisa de todos.', '{ array: { $all: [a, b] } }'],
        licao: '$all exige todos os valores, em qualquer ordem.',
      };
    },
  },
  {
    assunto: 'arrays',
    montar: ({ rng }) => {
      const n = rng.inteiro(0, 5);
      return {
        titulo: 'Contando vínculos',
        corpo: n === 0 ? 'Traga as almas com a lista `vinculos` vazia.' : `Traga as almas com exatamente ${n} vínculo${n === 1 ? '' : 's'}.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ vinculos: { $size: ${n} } })`,
        entrega: `Almas com exatamente ${n} vínculo${n === 1 ? '' : 's'}.`,
        dicas: ['Existe um operador que olha o tamanho do array.', '{ array: { $size: n } }'],
        licao: '$size casa arrays com exatamente n elementos.',
      };
    },
  },
  {
    assunto: 'arrays',
    montar: ({ rng, pareceres }) => {
      const parecer = rng.escolher(pareceres);
      const peso = rng.inteiro(10, 45);
      return {
        titulo: 'Mesma audiência',
        corpo: `Traga as almas que tiveram UMA audiência com parecer \`${parecer}\` e peso acima de ${peso} — as duas coisas na mesma audiência.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ audiencias: { $elemMatch: { parecer: ${q(parecer)}, peso: { $gt: ${peso} } } } })`,
        entrega: `Almas com uma audiência ${parecer} de peso acima de ${peso}.`,
        dicas: ['Com dot notation, cada condição pode cair numa audiência diferente.', '{ array: { $elemMatch: { campo1: v, campo2: { $gt: n } } } }'],
        licao: '$elemMatch aplica todas as condições ao mesmo elemento do array.',
      };
    },
  },

  // --- regex ----------------------------------------------------------------
  {
    assunto: 'regex',
    montar: ({ rng, almas }) => {
      const nomes = almas.map((d) => d.nome).filter((n): n is string => typeof n === 'string');
      const letra = rng.escolher(nomes)[0];
      return {
        titulo: 'Inicial',
        corpo: `Traga as almas cujo \`nome\` começa com a letra \`${letra}\` (maiúscula).`,
        tipo: 'consulta',
        referencia: `db.almas.find({ nome: /^${letra}/ })`,
        entrega: `Almas com nome começando por ${letra}.`,
        dicas: ['Uma âncora marca o começo do texto.', '/^X/ casa textos que começam com X.'],
        licao: '^ ancora a regex no começo do texto.',
      };
    },
  },
  {
    assunto: 'regex',
    montar: ({ rng, almas }) => {
      const nomes = almas.map((d) => d.nome).filter((n): n is string => typeof n === 'string' && n.includes(' '));
      const sobrenome = rng.escolher(nomes).split(' ').at(-1)!;
      if (!/^[\p{L}]+$/u.test(sobrenome)) return null;
      return {
        titulo: 'Sobrenome',
        corpo: `Traga as almas cujo \`nome\` termina com \`${sobrenome}\`.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ nome: /${sobrenome}$/ })`,
        entrega: `Almas com nome terminando em ${sobrenome}.`,
        dicas: ['Uma âncora marca o fim do texto.', '/texto$/ casa quem termina com “texto”.'],
        licao: '$ ancora a regex no fim do texto.',
      };
    },
  },
  {
    assunto: 'regex',
    montar: ({ rng, almas }) => {
      const protocolos = almas.map((d) => d.protocolo).filter((p): p is string => typeof p === 'string' && /^[AB]-\d{4}-\d{4}$/.test(p));
      const p = rng.escolher(protocolos);
      const prefixo = p.slice(0, 5);
      return {
        titulo: 'Década',
        corpo: `Traga as almas com protocolo de letra \`${p[0]}\` e ano na década de ${p.slice(2, 5)}0 (formato \`${p[0]}-${p.slice(2, 5)}X-...\`).`,
        tipo: 'consulta',
        referencia: `db.almas.find({ protocolo: /^${prefixo}/ })`,
        entrega: `Protocolos ${prefixo}…`,
        dicas: ['O começo do protocolo diz a letra e o ano.', `/^${p[0]}-${p.slice(2, 4)}.../ — ancore no começo.`],
        licao: 'Com ^, a regex só aceita o padrão no início do texto.',
      };
    },
  },
  {
    assunto: 'regex',
    montar: ({ rng, pendencias }) => {
      const palavra = rng.escolher(pendencias).split(' ')[0].toLowerCase();
      if (palavra.length < 4) return null;
      return {
        titulo: 'Palavra na pendência',
        corpo: `Traga as almas cuja \`pendencia\` contém a palavra \`${palavra}\`, com maiúscula ou minúscula.`,
        tipo: 'consulta',
        referencia: `db.almas.find({ pendencia: /${palavra}/i })`,
        entrega: `Almas com “${palavra}” na pendência, ignorando maiúsculas.`,
        dicas: ['As pendências começam com letra maiúscula.', '/texto/i ignora maiúsculas e minúsculas.'],
        licao: 'A flag i torna a regex insensível a maiúsculas.',
      };
    },
  },

  // --- gravações ------------------------------------------------------------
  {
    assunto: 'gravacoes',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const n = rng.inteiro(30, 80);
      return {
        titulo: 'Prioridade',
        corpo: `Marque com \`prioridade: 'alta'\` todas as almas de \`${setor}\` com mais de ${n} anos pendentes.`,
        tipo: 'escrita',
        referencia: `db.almas.updateMany({ setor: ${q(setor)}, anos_pendentes: { $gt: ${n} } }, { $set: { prioridade: 'alta' } })`,
        entrega: 'As fichas certas marcadas, e nenhuma outra mexida.',
        dicas: ['Várias fichas de uma vez pedem updateMany.', "updateMany({ filtro }, { $set: { campo: 'valor' } })"],
        licao: 'updateMany + $set altera todas as fichas que casam com o filtro.',
      };
    },
  },
  {
    assunto: 'gravacoes',
    montar: ({ rng, setores }) => {
      const de = rng.escolher(setores);
      const para = outro(rng, setores, de);
      return {
        titulo: 'Transferência',
        corpo: `As almas INATIVAS de \`${de}\` foram transferidas para \`${para}\`. Atualize o setor delas.`,
        tipo: 'escrita',
        referencia: `db.almas.updateMany({ setor: ${q(de)}, ativo: false }, { $set: { setor: ${q(para)} } })`,
        entrega: `Inativas de ${de} agora em ${para}; as ativas continuam onde estavam.`,
        dicas: ['O filtro escolhe QUEM muda; o $set diz O QUE muda.', "updateMany({ setor: '...', ativo: false }, { $set: { setor: '...' } })"],
        licao: 'O filtro do update pode usar o mesmo campo que será alterado.',
      };
    },
  },
  {
    assunto: 'gravacoes',
    montar: ({ rng, setores, pendencias }) => {
      const setor = rng.escolher(setores);
      const pendencia = rng.escolher(pendencias);
      const k = rng.inteiro(1, 10);
      return {
        titulo: 'Mais uma espera',
        corpo: `As almas de \`${setor}\` com pendência \`${pendencia}\` perderam a audiência: some ${k} aos \`anos_pendentes\` delas.`,
        tipo: 'escrita',
        referencia: `db.almas.updateMany({ setor: ${q(setor)}, pendencia: ${q(pendencia)} }, { $inc: { anos_pendentes: ${k} } })`,
        entrega: `anos_pendentes aumentado em ${k} só nessas fichas.`,
        dicas: ['Não é para trocar o valor, é para somar.', '{ $inc: { campo: n } }'],
        licao: '$inc soma ao valor atual (use negativo para subtrair).',
      };
    },
  },
  {
    assunto: 'gravacoes',
    montar: ({ rng, almas, vinculos }) => {
      const candidatas = almas.filter((d) => typeof d.protocolo === 'string' && almas.filter((x) => x.protocolo === d.protocolo).length === 1 && Array.isArray(d.vinculos));
      const alma = rng.escolher(candidatas);
      const novos = vinculos.filter((v) => !(alma.vinculos as string[]).includes(v));
      const v = rng.escolher(novos);
      return {
        titulo: 'Novo vínculo',
        corpo: `Descobriram que a alma do protocolo \`${String(alma.protocolo)}\` (${String(alma.nome)}) também era \`${v}\`. Acrescente o vínculo no fim da lista.`,
        tipo: 'escrita',
        referencia: `db.almas.updateOne({ protocolo: ${q(String(alma.protocolo))} }, { $push: { vinculos: ${q(v)} } })`,
        entrega: `${v} no fim dos vínculos dessa alma, e nada mais alterado.`,
        dicas: ['Acrescentar item num array tem operador próprio.', '{ $push: { array: valor } }'],
        licao: '$push acrescenta um item no fim do array.',
      };
    },
  },
  {
    assunto: 'gravacoes',
    montar: ({ rng, setores, vinculos }) => {
      const setor = rng.escolher(setores);
      const v = rng.escolher(vinculos);
      return {
        titulo: 'Vínculo revogado',
        corpo: `O vínculo \`${v}\` foi revogado no setor \`${setor}\`: tire-o da lista de todas as almas desse setor.`,
        tipo: 'escrita',
        referencia: `db.almas.updateMany({ setor: ${q(setor)} }, { $pull: { vinculos: ${q(v)} } })`,
        entrega: `Nenhuma alma de ${setor} com ${v}; os outros vínculos intactos.`,
        dicas: ['Remover um VALOR de dentro de um array tem operador próprio.', '{ $pull: { array: valor } }'],
        licao: '$pull remove do array todos os itens iguais ao valor.',
      };
    },
  },
  {
    assunto: 'gravacoes',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      return {
        titulo: 'Expurgo',
        corpo: `Apague do arquivo as almas INATIVAS de \`${setor}\`.`,
        tipo: 'escrita',
        referencia: `db.almas.deleteMany({ setor: ${q(setor)}, ativo: false })`,
        entrega: `Inativas de ${setor} removidas; mais nada apagado.`,
        dicas: ['Apagar várias de uma vez pede o método no plural.', 'deleteMany({ filtro })'],
        licao: 'deleteMany apaga todas as fichas que casam com o filtro. Confira o filtro com find antes.',
      };
    },
  },
  {
    assunto: 'gravacoes',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      return {
        titulo: 'CEP sigiloso',
        corpo: `Por sigilo, remova o campo \`cep\` de dentro do \`endereco\` de todas as almas de \`${setor}\` (o resto do endereço fica).`,
        tipo: 'escrita',
        referencia: `db.almas.updateMany({ setor: ${q(setor)}, 'endereco.cep': { $exists: true } }, { $unset: { 'endereco.cep': '' } })`,
        entrega: `Nenhuma alma de ${setor} com endereco.cep; rua, número e bairro intactos.`,
        dicas: ['Apagar um CAMPO não é apagar a ficha.', "{ $unset: { 'sub.campo': '' } }"],
        licao: '$unset remove o campo; com dot notation, remove só dentro do subdocumento.',
      };
    },
  },

  // --- relatórios ---------------------------------------------------------------
  {
    assunto: 'relatorios',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      return {
        titulo: 'Pendências do setor',
        corpo: `Relatório de \`${setor}\`: quantas almas há por pendência (pendência no \`_id\`, contagem em \`total\`), da mais comum para a menos comum; empate em ordem alfabética.`,
        tipo: 'consulta',
        referencia: `db.almas.aggregate([{ $match: { setor: ${q(setor)} } }, { $group: { _id: '$pendencia', total: { $sum: 1 } } }, { $sort: { total: -1, _id: 1 } }])`,
        entrega: 'Uma linha por pendência, com o total certo.',
        ordem: true,
        relatorio: true,
        dicas: ['$match para o setor, $group para contar, $sort para ordenar.', "{ $group: { _id: '$campo', total: { $sum: 1 } } }"],
        licao: '$match → $group → $sort: filtrar, contar e ordenar.',
      };
    },
  },
  {
    assunto: 'relatorios',
    montar: ({ rng, pareceres }) => {
      const parecer = rng.escolher(pareceres);
      return {
        titulo: 'Pareceres por setor',
        corpo: `Por setor (no \`_id\`, em ordem alfabética), quantas AUDIÊNCIAS receberam parecer \`${parecer}\`? Campo \`total\`.`,
        tipo: 'consulta',
        referencia: `db.almas.aggregate([{ $unwind: '$audiencias' }, { $match: { 'audiencias.parecer': ${q(parecer)} } }, { $group: { _id: '$setor', total: { $sum: 1 } } }, { $sort: { _id: 1 } }])`,
        entrega: `Total de audiências ${parecer} em cada setor.`,
        ordem: true,
        relatorio: true,
        dicas: ['Audiências são itens de um array: desdobre antes de filtrar.', "$unwind → $match { 'audiencias.parecer': ... } → $group → $sort"],
        licao: '$unwind antes do $match faz o filtro olhar cada audiência sozinha.',
      };
    },
  },
  {
    assunto: 'relatorios',
    montar: ({ rng }) => {
      const ativo = rng.chance(0.5);
      return {
        titulo: 'Média de espera',
        corpo: `Considere só as almas ${ativo ? 'ativas' : 'inativas'} com \`anos_pendentes\` numérico. Por setor (no \`_id\`, em ordem alfabética): \`media\` e \`maior\` de anos pendentes.`,
        tipo: 'consulta',
        referencia: `db.almas.aggregate([{ $match: { ativo: ${ativo}, anos_pendentes: { $type: 'number' } } }, { $group: { _id: '$setor', media: { $avg: '$anos_pendentes' }, maior: { $max: '$anos_pendentes' } } }, { $sort: { _id: 1 } }])`,
        entrega: 'media e maior certos em cada setor.',
        ordem: true,
        relatorio: true,
        dicas: ["Filtre com { $type: 'number' } para ignorar o legado em texto.", "{ $group: { _id: '$setor', media: { $avg: '$campo' }, maior: { $max: '$campo' } } }"],
        licao: '$avg e $max calculam sobre os documentos de cada grupo.',
      };
    },
  },
  {
    assunto: 'relatorios',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const k = rng.inteiro(3, 8);
      return {
        titulo: 'Etiquetas',
        corpo: `Gere etiquetas para as ${k} primeiras almas de \`${setor}\` em ordem alfabética: só um campo \`rotulo\` no formato \`Nome — Pendência\` (espaço, travessão, espaço), sem \`_id\`.`,
        tipo: 'consulta',
        referencia: `db.almas.aggregate([{ $match: { setor: ${q(setor)} } }, { $sort: { nome: 1 } }, { $limit: ${k} }, { $project: { _id: 0, rotulo: { $concat: ['$nome', ' — ', '$pendencia'] } } }])`,
        entrega: `${k} etiquetas no formato certo.`,
        ordem: true,
        campos: ['rotulo'],
        semId: true,
        relatorio: true,
        dicas: ['Ordene e limite antes de montar o texto.', "{ $project: { _id: 0, rotulo: { $concat: ['$campo1', ' — ', '$campo2'] } } }"],
        licao: '$concat junta campos e textos fixos num campo novo.',
      };
    },
  },
  {
    assunto: 'relatorios',
    montar: ({ rng, setores }) => {
      const setor = rng.escolher(setores);
      const n = rng.inteiro(20, 70);
      return {
        titulo: 'Número do boletim',
        corpo: `Com \`aggregate\` e o estágio \`$count\`: quantas almas de \`${setor}\` têm mais de ${n} anos pendentes? Resposta no formato \`{ total: n }\`.`,
        tipo: 'consulta',
        referencia: `db.almas.aggregate([{ $match: { setor: ${q(setor)}, anos_pendentes: { $gt: ${n} } } }, { $count: 'total' }])`,
        entrega: 'Um único documento { total: n } com a contagem certa.',
        relatorio: true,
        dicas: ['$count substitui tudo por um documento só.', "[{ $match: {...} }, { $count: 'total' }]"],
        licao: "$count: 'campo' resume a esteira num único documento.",
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Montagem e sorteio
// ---------------------------------------------------------------------------

function montarMissao(r: Rascunho, id: string, assunto: AssuntoTreino): Missao {
  const rotulo = ASSUNTOS_TREINO.find((a) => a.id === assunto)!.rotulo;
  const objetivos: Objetivo[] = [];
  let validar: Missao['validar'];
  if (r.tipo === 'consulta') {
    const opts: OpcoesConsulta = { colecao: 'almas', ordem: r.ordem, relatorio: r.relatorio };
    const conteudo = validarConsulta({ ...opts, ordem: false });
    objetivos.push(objetivo(r.entrega, (ctx) => conteudo(ctx).ok));
    if (r.campos) objetivos.push(objetivo(`Só ${r.campos.join(', ')}${r.semId ? ', sem _id' : ''}.`, r.semId ? todas(somenteCampos(r.campos), semCampo('_id')) : somenteCampos(r.campos)));
    if (r.ordem) objetivos.push(objetivo('Na ordem pedida.', ordemComoReferencia));
    validar = validarPorObjetivos(objetivos, validarConsulta(opts));
  } else {
    const escrita = validarEscrita({ colecao: 'almas' });
    objetivos.push(objetivo(r.entrega, (ctx) => escrita(ctx).ok));
    validar = escrita;
  }
  return {
    id,
    titulo: r.titulo,
    assunto: `Treino · ${rotulo}`,
    corpo: r.corpo,
    objetivos,
    requer: [],
    tipo: r.tipo,
    validar,
    solucaoReferencia: r.referencia,
    solucoesErradas: [],
    dicas: [r.dicas[0], r.dicas[1], r.referencia],
    recompensa: 0,
    licao: r.licao,
  };
}

/** A referência roda com as credenciais do jogador e dá um exercício que vale a pena? */
function referenciaServe(base: Database, r: Rascunho, possui: ReadonlySet<string>): boolean {
  const db = base.clonar();
  db.verificador = criarVerificador(() => possui);
  const total = base.colecao('almas').docs.length;
  const execucao = new Sessao(db).executar(r.referencia);
  if (!execucao.ok) return false;
  if (r.tipo === 'escrita') {
    const d = diffColecao(base.colecao('almas').docs, db.colecao('almas').docs);
    const mexidas = d.inseridos.length + d.removidos.length + d.alterados.length;
    return mexidas > 0 && mexidas < total;
  }
  const v = execucao.valor;
  if (typeof v === 'number') return v > 0;
  if (Array.isArray(v)) return v.length > 0 && v.length < total;
  return v !== null && v !== undefined;
}

export interface MemorandoGerado {
  missao: Missao;
  assunto: AssuntoTreino;
}

export function gerarMemorando(base: Database, possui: ReadonlySet<string>, opcoes: { id: string; semente: number; assunto?: AssuntoTreino }): MemorandoGerado | null {
  const almas = base.colecao('almas').docs;
  if (!almas.length) return null;
  const texto = (lista: unknown[]) => [...new Set(lista.filter((x): x is string => typeof x === 'string' && x.trim() === x && x.length > 0))].sort();
  const sorteio: Sorteio = {
    rng: new Rng(opcoes.semente),
    almas,
    setores: texto(almas.map((d) => d.setor)),
    pendencias: texto(almas.map((d) => d.pendencia)),
    vinculos: texto(almas.flatMap((d) => (Array.isArray(d.vinculos) ? d.vinculos : []))),
    pareceres: texto(almas.flatMap((d) => (Array.isArray(d.audiencias) ? d.audiencias.map((a) => (a as Doc).parecer) : []))),
  };
  if (sorteio.setores.length < 2 || sorteio.pendencias.length < 2) return null;
  const modelos = MODELOS.filter((m) => !opcoes.assunto || m.assunto === opcoes.assunto);
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    const modelo = sorteio.rng.escolher(modelos);
    let rascunho: Rascunho | null;
    try {
      rascunho = modelo.montar(sorteio);
    } catch {
      continue; // lista vazia para sortear neste arquivo
    }
    if (rascunho && referenciaServe(base, rascunho, possui)) return { missao: montarMissao(rascunho, opcoes.id, modelo.assunto), assunto: modelo.assunto };
  }
  return null;
}
