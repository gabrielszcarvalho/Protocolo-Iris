/**
 * Regras do jogo, sem interface: progresso, carimbos, Árvore de Credenciamento, memorandos,
 * crescimento do mundo. A UI só chama estes métodos e reage aos eventos.
 */

import { Database, type RegistroOperacao, type SnapshotBanco } from '../engine/database';
import { Sessao, type ResultadoExecucao } from '../engine/shell';
import { canonico, ehObjetoSimples } from '../engine/bson';
import { CredencialError } from '../engine/errors';
import { NO_POR_ID, RAIZ, criarVerificador, situacaoDoNo, type NoCredencial } from './arvore';
import { CAPITULOS, CAPITULO_DA_MISSAO, MISSAO_POR_ID, TODAS_AS_MISSOES, type Capitulo, type Missao } from './missoes';
import { aplicarFase, criarMundo } from './mundo';
import { montarContexto, type ResultadoValidacao } from './validacao';

export interface Progresso {
  versao: 1;
  carimbos: number;
  credenciais: string[];
  concluidas: Record<string, { estrelas: 1 | 2 | 3; carimbos: number }>;
  dicas: Record<string, number>;
  tentativas: Record<string, number>;
  capitulo: number;
  fase: number;
  missaoAtual: string | null;
  tutorialConcluido: boolean;
  /** Avisos contextuais que o jogador já viu (para não repetir). */
  avisosVistos: string[];
  estatisticas: { comandos: number; erros: number; carimbosGanhos: number };
}

export function progressoInicial(): Progresso {
  return {
    versao: 1,
    carimbos: 0,
    credenciais: [RAIZ],
    concluidas: {},
    dicas: {},
    tentativas: {},
    capitulo: 1,
    fase: 1,
    missaoAtual: CAPITULOS[0].missoes[0].id,
    tutorialConcluido: false,
    avisosVistos: [],
    estatisticas: { comandos: 0, erros: 0, carimbosGanhos: 0 },
  };
}

export type Evento =
  | { tipo: 'missao-concluida'; missao: Missao; estrelas: 1 | 2 | 3; carimbos: number }
  | { tipo: 'capitulo-aberto'; capitulo: Capitulo }
  | { tipo: 'fim-do-conteudo' }
  | { tipo: 'credencial-bloqueou'; credencial: string };

export interface Destaque {
  encontrados: string[];
  inseridos: string[];
  alterados: string[];
  removidos: string[];
}

export interface ResultadoComando {
  execucao: ResultadoExecucao;
  eventos: Evento[];
  destaque: Destaque;
}

export type SituacaoMissao = 'concluida' | 'disponivel' | 'falta-credencial' | 'fechada';

export interface Save {
  versao: 1;
  progresso: Progresso;
  mundo: SnapshotBanco;
  inicioMissao?: SnapshotBanco;
}

function mapaAlmas(db: Database): Map<string, string> {
  return new Map(db.colecao('almas').docs.map((d) => [String(d._id), canonico(d)]));
}

function idsDoValor(valor: unknown): string[] {
  const lista = Array.isArray(valor) ? valor : ehObjetoSimples(valor) ? [valor] : [];
  return lista.filter((d) => ehObjetoSimples(d) && '_id' in d).map((d) => String((d as Record<string, unknown>)._id));
}

export class Jogo {
  progresso: Progresso;
  mundo!: Database;
  sessao!: Sessao;
  private inicioMissao: Database;
  private historicoMissao: RegistroOperacao[] = [];
  private ultimo?: { valor: unknown; ok: boolean; operacoes: RegistroOperacao[] };

  private constructor(progresso: Progresso, mundo: Database, inicioMissao?: Database) {
    this.progresso = progresso;
    this.instalarMundo(mundo);
    this.inicioMissao = inicioMissao ?? mundo.clonar();
    this.carregarAnexo();
  }

  static novo(): Jogo {
    return new Jogo(progressoInicial(), criarMundo(1));
  }

  static carregar(save: Save): Jogo {
    const progresso = { ...progressoInicial(), ...save.progresso };
    return new Jogo(progresso, Database.restaurar(save.mundo), save.inicioMissao ? Database.restaurar(save.inicioMissao) : undefined);
  }

  serializar(): Save {
    return { versao: 1, progresso: structuredClone(this.progresso), mundo: this.mundo.snapshot(), inicioMissao: this.inicioMissao.snapshot() };
  }

  private instalarMundo(db: Database) {
    db.verificador = criarVerificador(() => this.possui);
    this.mundo = db;
    this.sessao = new Sessao(db);
  }

  // --- consultas de estado ---------------------------------------------------

  get possui(): ReadonlySet<string> {
    return new Set(this.progresso.credenciais);
  }

  get missaoAtual(): Missao | undefined {
    return this.progresso.missaoAtual ? MISSAO_POR_ID.get(this.progresso.missaoAtual) : undefined;
  }

  get capitulosAbertos(): Capitulo[] {
    return CAPITULOS.filter((c) => c.numero <= this.progresso.capitulo);
  }

  capituloDe(missao: Missao): Capitulo {
    return CAPITULO_DA_MISSAO.get(missao.id)!;
  }

  concluida(missao: Missao): boolean {
    return missao.id in this.progresso.concluidas;
  }

  credenciaisFaltando(missao: Missao): NoCredencial[] {
    return missao.requer.filter((id) => !this.possui.has(id)).map((id) => NO_POR_ID.get(id)!);
  }

  situacaoMissao(missao: Missao): SituacaoMissao {
    if (this.concluida(missao)) return 'concluida';
    if (this.capituloDe(missao).numero > this.progresso.capitulo) return 'fechada';
    return this.credenciaisFaltando(missao).length ? 'falta-credencial' : 'disponivel';
  }

  situacaoNo(no: NoCredencial) {
    return situacaoDoNo(no, this.possui, this.progresso.carimbos);
  }

  get conteudoConcluido(): boolean {
    return TODAS_AS_MISSOES.every((m) => this.concluida(m));
  }

  // --- ações ----------------------------------------------------------------

  selecionarMissao(id: string): void {
    const missao = MISSAO_POR_ID.get(id);
    if (!missao || this.situacaoMissao(missao) === 'fechada') return;
    this.progresso.missaoAtual = id;
    this.inicioMissao = this.mundo.clonar();
    this.historicoMissao = [];
    this.ultimo = undefined;
    this.carregarAnexo();
  }

  /** Coloca o anexo do memorando (ex.: `const lote = [...]`) no escopo do terminal. */
  private carregarAnexo(): void {
    const anexo = this.missaoAtual?.anexo;
    if (anexo) this.sessao.executar(anexo.codigo);
  }

  /** Volta o mundo ao estado em que o memorando atual chegou. */
  reiniciarMissao(): void {
    this.instalarMundo(this.inicioMissao.clonar());
    this.historicoMissao = [];
    this.ultimo = undefined;
    this.carregarAnexo();
  }

  executar(codigo: string): ResultadoComando {
    const antes = mapaAlmas(this.mundo);
    const execucao = this.sessao.executar(codigo);
    const eventos: Evento[] = [];

    if (execucao.operacoes.length || !execucao.ok) {
      this.progresso.estatisticas.comandos++;
      if (!execucao.ok) this.progresso.estatisticas.erros++;
    }
    if (execucao.erro instanceof CredencialError) eventos.push({ tipo: 'credencial-bloqueou', credencial: execucao.erro.credencial });

    this.historicoMissao.push(...execucao.operacoes);
    if (execucao.operacoes.length) this.ultimo = { valor: execucao.valor, ok: execucao.ok, operacoes: execucao.operacoes };

    const depois = mapaAlmas(this.mundo);
    const destaque: Destaque = { encontrados: idsDoValor(execucao.valor), inseridos: [], alterados: [], removidos: [] };
    for (const [id, c] of depois) {
      if (!antes.has(id)) destaque.inseridos.push(id);
      else if (antes.get(id) !== c) destaque.alterados.push(id);
    }
    for (const id of antes.keys()) if (!depois.has(id)) destaque.removidos.push(id);

    // Executar NUNCA conclui o memorando: o jogador analisa a resposta e decide quando protocolar.
    return { execucao, eventos, destaque };
  }

  /**
   * O jogador envia a última resposta para a Diretoria. Recusa conta como tentativa e sempre
   * traz diagnóstico e a conferência item a item (os quadradinhos de "A entregar").
   */
  protocolar(): { validacao: ResultadoValidacao; eventos: Evento[]; objetivos: boolean[] } {
    const missao = this.missaoAtual;
    if (!missao) return { validacao: { ok: false, motivo: 'Nenhum memorando aberto.' }, eventos: [], objetivos: [] };
    const faltando = this.credenciaisFaltando(missao);
    if (faltando.length) {
      return {
        validacao: { ok: false, motivo: `Este memorando exige a credencial ${faltando.map((n) => `“${n.nome}”`).join(' e ')}.` },
        eventos: [],
        objetivos: [],
      };
    }
    const objetivos = this.conferirObjetivos(missao);
    const validacao = this.validar(missao);
    if (validacao.ok) return { validacao, eventos: this.concluir(missao), objetivos: objetivos.map(() => true) };
    this.progresso.tentativas[missao.id] = (this.progresso.tentativas[missao.id] ?? 0) + 1;
    return { validacao, eventos: [], objetivos };
  }

  /** Confere cada objetivo do memorando contra a última resposta / o estado do arquivo. */
  conferirObjetivos(missao: Missao): boolean[] {
    const ctx = this.contexto(missao);
    return missao.objetivos.map((o) => {
      try {
        return o.conferir(ctx);
      } catch {
        return false;
      }
    });
  }

  private validar(missao: Missao): ResultadoValidacao {
    try {
      return missao.validar(this.contexto(missao));
    } catch (e) {
      return { ok: false, motivo: `Não foi possível conferir: ${(e as Error).message}` };
    }
  }

  private contexto(missao: Missao) {
    return montarContexto({
      tipo: missao.tipo,
      codigoReferencia: missao.solucaoReferencia,
      anexo: missao.anexo?.codigo,
      resultado: this.ultimo?.valor,
      execucaoOk: this.ultimo?.ok ?? false,
      operacoes: this.ultimo?.operacoes ?? [],
      historicoMissao: this.historicoMissao,
      mundoInicio: this.inicioMissao,
      mundo: this.mundo,
    });
  }

  estrelasPara(missao: Missao): 1 | 2 | 3 {
    const dicas = this.progresso.dicas[missao.id] ?? 0;
    const tentativas = this.progresso.tentativas[missao.id] ?? 0;
    if (dicas >= 3) return 1;
    if (dicas === 0 && tentativas <= 1) return 3;
    if (dicas <= 1 && tentativas <= 3) return 2;
    return 1;
  }

  private concluir(missao: Missao): Evento[] {
    const estrelas = this.estrelasPara(missao);
    const carimbos = missao.recompensa + estrelas - 1;
    this.progresso.carimbos += carimbos;
    this.progresso.estatisticas.carimbosGanhos += carimbos;
    this.progresso.concluidas[missao.id] = { estrelas, carimbos };
    const eventos: Evento[] = [{ tipo: 'missao-concluida', missao, estrelas, carimbos }];

    const capitulo = this.capituloDe(missao);
    if (capitulo.numero === this.progresso.capitulo && capitulo.missoes.every((m) => this.concluida(m))) {
      const proximo = CAPITULOS.find((c) => c.numero === capitulo.numero + 1);
      if (proximo) {
        this.progresso.capitulo = proximo.numero;
        if (proximo.fase > this.progresso.fase) {
          aplicarFase(this.mundo, proximo.fase);
          this.progresso.fase = proximo.fase;
        }
        eventos.push({ tipo: 'capitulo-aberto', capitulo: proximo });
      } else {
        eventos.push({ tipo: 'fim-do-conteudo' });
      }
    }

    const proxima = TODAS_AS_MISSOES.find((m) => this.situacaoMissao(m) !== 'concluida' && this.situacaoMissao(m) !== 'fechada');
    if (proxima) this.selecionarMissao(proxima.id);
    else this.progresso.missaoAtual = null;
    return eventos;
  }

  /** Revela a próxima dica do memorando atual. Retorna as dicas já reveladas. */
  revelarDica(): string[] {
    const missao = this.missaoAtual;
    if (!missao) return [];
    const nivel = Math.min(3, (this.progresso.dicas[missao.id] ?? 0) + 1);
    this.progresso.dicas[missao.id] = nivel;
    return missao.dicas.slice(0, nivel);
  }

  dicasReveladas(missao: Missao): string[] {
    return missao.dicas.slice(0, this.progresso.dicas[missao.id] ?? 0);
  }

  comprar(id: string): { ok: true; no: NoCredencial } | { ok: false; motivo: string } {
    const no = NO_POR_ID.get(id);
    if (!no) return { ok: false, motivo: 'Credencial desconhecida.' };
    switch (this.situacaoNo(no)) {
      case 'possui':
        return { ok: false, motivo: 'Você já possui esta credencial.' };
      case 'lacrado':
        return { ok: false, motivo: 'Lacrada pela Diretoria. Chega numa próxima atualização.' };
      case 'bloqueado':
        return { ok: false, motivo: `Requer antes: ${no.requer.filter((r) => !this.possui.has(r)).map((r) => NO_POR_ID.get(r)!.nome).join(', ')}.` };
      case 'sem-carimbos':
        return { ok: false, motivo: `Faltam ${no.custo - this.progresso.carimbos} carimbo(s).` };
    }
    this.progresso.carimbos -= no.custo;
    this.progresso.credenciais.push(no.id);
    return { ok: true, no };
  }

  marcarAviso(chave: string): boolean {
    if (this.progresso.avisosVistos.includes(chave)) return false;
    this.progresso.avisosVistos.push(chave);
    return true;
  }
}
