import type { Validador } from '../validacao';
import type { Objetivo } from '../objetivos';

export interface Missao {
  id: string;
  titulo: string;
  /** Assunto do memorando (linha "Assunto:"). */
  assunto: string;
  /** Narrativa curta. Trechos entre `crases` viram código na tela. */
  corpo: string;
  /** O que precisa ser entregue. Cada item tem sua conferência (os quadradinhos do memorando). */
  objetivos: Objetivo[];
  /** Código carregado automaticamente no terminal quando o memorando é aberto (ex.: `const lote = [...]`). */
  anexo?: { variavel: string; codigo: string };
  /** Credenciais (ids da árvore) necessárias. Usado para avisar o jogador, nunca para validar. */
  requer: string[];
  /** Memorandos que precisam estar deferidos antes (quando um depende do estado deixado pelo outro). */
  depoisDe?: string[];
  tipo: 'consulta' | 'escrita';
  validar: Validador;
  solucaoReferencia: string;
  /** Erros comuns: os testes garantem que todos são rejeitados. */
  solucoesErradas: { codigo: string; porque: string }[];
  /** Três níveis: empurrão → conceito → quase-resposta. Cada dica usada reduz carimbos. */
  dicas: [string, string, string];
  /** Carimbos base (o total recebido é base + estrelas − 1). */
  recompensa: number;
  /** Frase curta mostrada ao concluir: o conceito que ficou. */
  licao: string;
}

export interface Capitulo {
  numero: number;
  titulo: string;
  /** Fase do mundo que o capítulo exige (o mundo cresce ao abrir o capítulo). */
  fase: number;
  /** Texto do cartão de abertura do capítulo. */
  abertura: string;
  missoes: Missao[];
}
