/**
 * Roteiro do tutorial (caixinhas que apontam para partes da tela) e avisos contextuais
 * que aparecem uma única vez, na hora em que o assunto surge.
 * O `alvo` corresponde ao atributo data-tutorial do elemento na tela.
 */

import type { Controlador } from './controlador';

export interface PassoTutorial {
  alvo: string | null;
  titulo: string;
  texto: string;
  /** Código sugerido, mostrado em destaque. */
  codigo?: string;
  botao?: string;
  /** Quando definido, o passo só avança sozinho quando a condição for verdadeira. */
  espera?: (c: Controlador) => boolean;
  aguardando?: string;
}

export const PASSOS_TUTORIAL: PassoTutorial[] = [
  {
    alvo: null,
    titulo: 'Bem-vindo ao seu posto',
    texto: 'Esta é a sua mesa de trabalho no Departamento. Em um minuto eu mostro onde fica cada coisa.',
    botao: 'Vamos lá',
  },
  {
    alvo: 'memorando',
    titulo: 'Memorandos',
    texto: 'Aqui chegam os MEMORANDOS da Diretoria. Cada um é uma tarefa. Este primeiro pede para você listar todas as fichas do arquivo.',
  },
  {
    alvo: 'mapa',
    titulo: 'O Departamento',
    texto: 'Este é o MAPA. Cada quadradinho é uma ficha de alma. Por enquanto só o Limbo e o Purgatório estão abertos; o resto do prédio está interditado.',
  },
  {
    alvo: 'editor',
    titulo: 'O terminal',
    texto: 'Este é o seu TERMINAL: é aqui que você escreve comandos do MongoDB. Clique nele e digite:',
    codigo: 'db.almas.find()',
    espera: (c) => c.textoEditor.replace(/\s/g, '').includes('db.almas.find('),
    aguardando: 'Digite o comando no terminal…',
  },
  {
    alvo: 'executar',
    titulo: 'Executar',
    texto: 'Agora aperte EXECUTAR (ou Ctrl+Enter no teclado). O comando roda de verdade no banco do Departamento.',
    espera: (c) => !!c.jogo && '1.1' in c.jogo.progresso.concluidas,
    aguardando: 'Execute o comando…',
  },
  {
    alvo: 'saida',
    titulo: 'A resposta',
    texto: 'A resposta do servidor aparece aqui, exatamente como o MongoDB mostraria. Quando algo dá errado, o erro real vem em vermelho e a tradução logo abaixo.',
  },
  {
    alvo: 'carimbos',
    titulo: 'Carimbos',
    texto: 'Cada memorando cumprido rende CARIMBOS, a moeda da repartição. Quanto menos dicas e tentativas, mais carimbos.',
  },
  {
    alvo: 'botao-arvore',
    titulo: 'Árvore de Credenciamento',
    texto: 'Você começa só com o find. Na ÁRVORE DE CREDENCIAMENTO você troca carimbos por comandos novos — e escolhe a ordem.',
  },
  {
    alvo: 'caixa',
    titulo: 'Caixa de entrada',
    texto: 'Todos os memorandos ficam listados aqui. O cadeado indica que falta uma credencial para cumprir aquele memorando.',
  },
  {
    alvo: 'botao-manual',
    titulo: 'Manual',
    texto: 'Esqueceu como um comando funciona? O MANUAL (Ctrl+K) explica tudo o que você já desbloqueou, com exemplos. Bom expediente!',
    botao: 'Assumir o posto',
  },
];

export interface AvisoContextual {
  chave: string;
  alvo: string;
  titulo: string;
  texto: string;
}

export const AVISOS: Record<string, Omit<AvisoContextual, 'chave'>> = {
  'credencial-faltando': {
    alvo: 'botao-arvore',
    titulo: 'Falta uma credencial',
    texto: 'Este memorando pede um comando que você ainda não tem. Abra a Árvore de Credenciamento e troque seus carimbos por ele.',
  },
  'primeiro-erro': {
    alvo: 'saida',
    titulo: 'Erro não quebra nada',
    texto: 'A linha vermelha é o erro real do MongoDB — vale aprender a ler. A linha amarela logo abaixo traduz o que aconteceu.',
  },
  anexo: {
    alvo: 'anexo',
    titulo: 'Memorando com anexo',
    texto: 'Este memorando trouxe um ANEXO. A variável já está carregada no seu terminal: é só usar pelo nome.',
  },
  'mundo-cresceu': {
    alvo: 'mapa',
    titulo: 'O arquivo cresceu',
    texto: 'Agora são centenas de fichas em cinco setores. Ler tudo virou impossível — é hora de filtrar.',
  },
  parecer: {
    alvo: 'protocolar',
    titulo: 'Quer um parecer?',
    texto: 'Se a resposta não confere e você não sabe por quê, clique em PROTOCOLAR: a Diretoria explica o que está errado. Cada protocolo recusado reduz os carimbos.',
  },
};
