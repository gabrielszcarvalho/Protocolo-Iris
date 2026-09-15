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
    titulo: 'Bem-vindo ao Purgatório',
    texto: 'Esta é a sua mesa no 3º subsolo. Os mortos lá em cima esperam seus despachos. Em um minuto eu mostro onde fica cada coisa.',
    botao: 'Vamos lá',
  },
  {
    alvo: 'memorando',
    titulo: 'Memorandos',
    texto: 'Aqui chegam os MEMORANDOS da Diretoria. Cada um é uma tarefa. Este primeiro pede para você listar todas as fichas que sobraram do incêndio.',
  },
  {
    alvo: 'mapa',
    titulo: 'A planta do Departamento',
    texto: 'Cada quadradinho é a ficha de uma alma. Por enquanto só o Limbo e o Purgatório estão abertos. Lá em cima fica a porta do Céu; lá embaixo, a do Inferno.',
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
    texto: 'Agora aperte EXECUTAR (ou Ctrl+Enter). O comando roda de verdade no banco do Departamento — e não envia nada para a Diretoria ainda.',
    espera: (c) => c.ultimaExecucaoOk,
    aguardando: 'Execute o comando…',
  },
  {
    alvo: 'saida',
    titulo: 'Analise a resposta',
    texto: 'A resposta do servidor aparece aqui, exatamente como o MongoDB mostraria. Antes de enviar, confira: voltou mesmo o que o memorando pediu? Quando algo dá errado, o erro vem em vermelho e a tradução logo abaixo.',
  },
  {
    alvo: 'protocolar',
    titulo: 'Protocolar',
    texto: 'Conferiu? Clique em PROTOCOLAR RESPOSTA (ou Ctrl+Shift+Enter) para enviar a última resposta à Diretoria. Se estiver errada, ela volta indeferida — e cada recusa custa estrelas.',
    espera: (c) => !!c.jogo && '1.1' in c.jogo.progresso.concluidas,
    aguardando: 'Protocole a resposta…',
  },
  {
    alvo: 'carimbos',
    titulo: 'Carimbos',
    texto: 'Cada memorando deferido rende CARIMBOS, a moeda da repartição. Quanto menos dicas e recusas, mais carimbos.',
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
    texto: 'Esqueceu como um comando funciona? O MANUAL (Ctrl+K) explica tudo o que você já desbloqueou, com exemplos. Bom expediente — a eternidade é longa.',
    botao: 'Assumir o posto',
  },
];

/** Roteiro da Sala de Treino: aparece na primeira visita e pode ser revisto pelo Menu. */
export const PASSOS_TUTORIAL_TREINO: PassoTutorial[] = [
  {
    alvo: null,
    titulo: 'Sala de Treino',
    texto: 'Aqui nada vale carimbo e nada estraga a campanha: tudo acontece em CÓPIAS do seu arquivo. É o lugar para errar à vontade. Vou mostrar como funciona.',
    botao: 'Mostrar',
  },
  {
    alvo: 'treino-livre',
    titulo: 'Todas as credenciais',
    texto: 'Por padrão você só usa os comandos que já comprou. Marque esta opção para liberar TUDO na Sala — inclusive os assuntos que o gerador de memorandos pode sortear.',
  },
  {
    alvo: 'treino-gerar',
    titulo: 'Gerar memorando',
    texto: 'Escolha um assunto (ou deixe “Qualquer assunto”) e clique em GERAR MEMORANDO. Cada exercício é sorteado com dados reais do arquivo e corrigido como na campanha.',
    espera: (c) => (c.treino?.memorandos.length ?? 0) > 0,
    aguardando: 'Gere um memorando…',
  },
  {
    alvo: 'treino-abas',
    titulo: 'Um arquivo por aba',
    texto: 'O memorando abriu numa ABA. Cada aba — e o Terminal livre — tem o SEU próprio arquivo: apagar tudo numa não muda nada nas outras. Dá para abrir vários ao mesmo tempo.',
  },
  {
    alvo: 'objetivos',
    titulo: 'O que entregar',
    texto: 'Leia o pedido e os itens de A ENTREGAR. Quando você protocolar, cada quadradinho vira ✓ ou ✗.',
  },
  {
    alvo: 'editor',
    titulo: 'Resolva no terminal',
    texto: 'Escreva a resposta e EXECUTE (Ctrl+Enter). O mapa e o fichário mostram o arquivo desta aba. Rode quantas vezes quiser.',
    espera: (c) => c.ultimaExecucaoOk,
    aguardando: 'Execute um comando…',
  },
  {
    alvo: 'protocolar',
    titulo: 'Protocolar',
    texto: 'Analisou a resposta? PROTOCOLE (Ctrl+Shift+Enter). Errou? O parecer explica o motivo — ajuste e protocole de novo, sem perder nada.',
    espera: (c) => !!c.treino?.ativo?.parecer,
    aguardando: 'Protocole a resposta…',
  },
  {
    alvo: 'treino-acoes',
    titulo: 'Dicas, pular e restaurar',
    texto: 'PEDIR DICA vai até a solução completa, com “Levar ao terminal”. PULAR troca por outro exercício do mesmo assunto. RESTAURAR volta só o arquivo desta aba. DESCARTAR fecha o memorando.',
  },
  {
    alvo: 'botao-menu',
    titulo: 'De volta ao expediente',
    texto: 'Para voltar aos memorandos da campanha ou rever este tutorial, abra o MENU. Bom treino — no Purgatório, tempo é o que não falta.',
    botao: 'Começar a treinar',
  },
];

export type Roteiro = 'campanha' | 'treino';

export const ROTEIROS: Record<Roteiro, PassoTutorial[]> = { campanha: PASSOS_TUTORIAL, treino: PASSOS_TUTORIAL_TREINO };

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
    titulo: 'Erro não mata ninguém',
    texto: 'Aqui todo mundo já morreu mesmo. A linha vermelha é o erro real do MongoDB — vale aprender a ler. A linha amarela logo abaixo traduz o que aconteceu.',
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
  indeferido: {
    alvo: 'objetivos',
    titulo: 'Protocolo indeferido',
    texto: 'Os quadradinhos de A ENTREGAR mostram o que já estava certo (✓) e o que falta (✗). Ajuste a consulta, rode de novo, confira e protocole outra vez. Se travar, peça uma dica.',
  },
};
