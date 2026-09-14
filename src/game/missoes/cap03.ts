import type { Capitulo } from './tipos';
import { validarConsulta } from '../validacao';

const consulta = validarConsulta({ colecao: 'almas' });

export const capitulo3: Capitulo = {
  numero: 3,
  titulo: 'Inventário',
  fase: 2,
  abertura: 'A Diretoria agora quer entender as relações: quem ficou para trás e o que foi decidido em cada audiência. Isso mora nos arrays.',
  missoes: [
    {
      id: '3.1',
      titulo: 'Um vínculo',
      assunto: 'Investigação de contrabando',
      corpo: 'Traga as almas que têm `contrabandista` entre os seus vínculos. Pode haver outros vínculos junto.',
      objetivos: ['Almas com o valor contrabandista dentro do array vinculos.'],
      requer: [],
      tipo: 'consulta',
      validar: consulta,
      solucaoReferencia: "db.almas.find({ vinculos: 'contrabandista' })",
      solucoesErradas: [{ codigo: "db.almas.find({ vinculos: ['contrabandista'] })", porque: 'exigiu o array exato' }],
      dicas: [
        'Buscar um valor dentro de um array é mais simples do que parece.',
        '{ array: valor } encontra documentos cujo array CONTÉM o valor. Já { array: [valor] } exige o array exatamente igual.',
        "db.almas.find({ vinculos: 'contrabandista' })",
      ],
      recompensa: 2,
      licao: '{ array: valor } busca um elemento; { array: [ ... ] } exige o array idêntico, na mesma ordem.',
    },
    {
      id: '3.2',
      titulo: 'Todos os vínculos',
      assunto: 'Mães poetas',
      corpo: 'O Sarau do Além quer as almas que são `mãe` E `poeta` ao mesmo tempo, em qualquer ordem no array.',
      objetivos: ['vinculos contém mãe e poeta, em qualquer ordem.'],
      requer: ['inventario-de-vinculos'],
      tipo: 'consulta',
      validar: consulta,
      solucaoReferencia: "db.almas.find({ vinculos: { $all: ['mãe', 'poeta'] } })",
      solucoesErradas: [
        { codigo: "db.almas.find({ vinculos: ['mãe', 'poeta'] })", porque: 'exigiu array exato e ordem' },
        { codigo: "db.almas.find({ vinculos: { $in: ['mãe', 'poeta'] } })", porque: 'aceitou só um dos dois' },
      ],
      dicas: ['$in aceita qualquer um da lista. Você precisa de todos.', '$all: [ ... ] exige que o array contenha todos os valores, em qualquer ordem.', "db.almas.find({ vinculos: { $all: ['mãe', 'poeta'] } })"],
      recompensa: 3,
      licao: '$all: todos os valores, qualquer ordem. $in: pelo menos um.',
    },
    {
      id: '3.3',
      titulo: 'Ficha completa',
      assunto: 'Almas muito relacionadas',
      corpo: 'Traga as almas com exatamente 4 vínculos.',
      objetivos: ['O array vinculos tem exatamente 4 elementos.'],
      requer: ['inventario-de-vinculos'],
      tipo: 'consulta',
      validar: consulta,
      solucaoReferencia: 'db.almas.find({ vinculos: { $size: 4 } })',
      solucoesErradas: [{ codigo: "db.almas.find({ 'vinculos.3': { $exists: true } })", porque: 'pegou quem tem 4 ou mais' }],
      dicas: ['Há um operador que olha o tamanho do array.', '$size: n compara o número de elementos. Ele só aceita um número exato.', 'db.almas.find({ vinculos: { $size: 4 } })'],
      recompensa: 3,
      licao: '$size: n casa arrays com exatamente n elementos.',
    },
    {
      id: '3.4',
      titulo: 'Mesma audiência',
      assunto: 'Pareceres pesados',
      corpo: 'Traga as almas que tiveram UMA audiência com parecer `C` e peso acima de 30 — as duas coisas na MESMA audiência.',
      objetivos: ['Algum elemento de audiencias com parecer C e peso > 30 ao mesmo tempo.'],
      requer: ['lupa-de-audiencias'],
      tipo: 'consulta',
      validar: validarConsulta({
        colecao: 'almas',
        explicarExtras: (extras) => {
          const cruzados = extras.filter((d) => {
            const auds = (d.audiencias as { parecer: string; peso: number }[] | undefined) ?? [];
            return auds.some((a) => a.parecer === 'C') && auds.some((a) => a.peso > 30) && !auds.some((a) => a.parecer === 'C' && a.peso > 30);
          });
          return cruzados.length ? `${cruzados.length === extras.length ? 'Todas' : `${cruzados.length} delas`} têm um parecer C e um peso acima de 30, mas em audiências DIFERENTES` : undefined;
        },
      }),
      solucaoReferencia: "db.almas.find({ audiencias: { $elemMatch: { parecer: 'C', peso: { $gt: 30 } } } })",
      solucoesErradas: [{ codigo: "db.almas.find({ 'audiencias.parecer': 'C', 'audiencias.peso': { $gt: 30 } })", porque: 'condições em elementos diferentes' }],
      dicas: [
        'Rode com dot notation ("audiencias.parecer" e "audiencias.peso") e confira uma das fichas extras. As condições caíram na mesma audiência?',
        'Para exigir que UM MESMO elemento satisfaça tudo, use $elemMatch com as condições dentro.',
        "db.almas.find({ audiencias: { $elemMatch: { parecer: 'C', peso: { $gt: 30 } } } })",
      ],
      recompensa: 5,
      licao: '$elemMatch aplica todas as condições ao mesmo elemento. Dot notation deixa cada condição cair num elemento diferente.',
    },
  ],
};
