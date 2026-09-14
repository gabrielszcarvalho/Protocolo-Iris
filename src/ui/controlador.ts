/**
 * Estado da interface. Um objeto mutável com número de versão: a UI assina e redesenha quando
 * a versão muda (useSyncExternalStore). As regras ficam em game/jogo.ts; aqui só orquestramos
 * telas, painéis, sons, tutorial e salvamento.
 */

import { useSyncExternalStore } from 'react';
import { Jogo, type Destaque, type Evento, type Save } from '../game/jogo';
import type { Capitulo, Missao } from '../game/missoes';
import { ARVORE, type NoCredencial } from '../game/arvore';
import type { LinhaSaida } from '../engine/shell';
import type { ResultadoValidacao } from '../game/validacao';
import { Armazenamento } from '../engine/persist';
import { som } from './som';
import { AVISOS, PASSOS_TUTORIAL, type AvisoContextual } from './tutorialDados';
import { inferirEsquema } from './inferencia';
import type { Sugestoes } from './componentes/Editor';

export type Tela = 'carregando' | 'titulo' | 'abertura' | 'jogo';
export type Painel = 'arvore' | 'manual' | 'menu' | null;
export type AbaSaida = 'resultado' | 'log' | 'fichario';

export interface BlocoSaida {
  id: number;
  comando: string;
  linhas: LinhaSaida[];
}

/** Cartões em fila (um por vez). O `id` estável evita remontar o cartão a cada atualização. */
export type Sobreposicao = { id: number } & (
  | { tipo: 'conclusao'; missao: Missao; estrelas: 1 | 2 | 3; carimbos: number }
  | { tipo: 'capitulo'; capitulo: Capitulo }
  | { tipo: 'credencial'; no: NoCredencial }
  | { tipo: 'fim' }
);

export interface Toast {
  id: number;
  texto: string;
  acao?: { rotulo: string; painel: Painel };
}

/** Resultado do último protocolo: marcas dos quadradinhos de "A entregar". */
export interface Conferencia {
  missaoId: string;
  marcas: boolean[];
  /** O jogador rodou comandos depois do protocolo: as marcas se referem à resposta anterior. */
  desatualizada: boolean;
}

const CHAVE_SAVE = 'save-v1';
const CHAVE_EXTRA = 'interface-v1';
const SEM_DESTAQUE: Destaque = { encontrados: [], inseridos: [], alterados: [], removidos: [] };
const METODOS_DE_COLECAO = new Set(['find', 'findOne', 'countDocuments', 'insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'aggregate', 'createIndex', 'getIndexes', 'dropIndex', 'drop', 'distinct']);
const METODOS_DE_CURSOR = new Set(['sort', 'limit', 'skip', 'count']);

export class Controlador {
  private versao = 0;
  private readonly ouvintes = new Set<() => void>();
  private readonly armazenamento = typeof indexedDB !== 'undefined' ? new Armazenamento() : undefined;
  private timerSalvar?: ReturnType<typeof setTimeout>;
  private seq = 0;
  private cacheCampos?: { total: number; campos: string[] };

  jogo?: Jogo;
  tela: Tela = 'carregando';
  temSave = false;
  blocos: BlocoSaida[] = [];
  destaque: Destaque = SEM_DESTAQUE;
  fila: Sobreposicao[] = [];
  painel: Painel = null;
  toasts: Toast[] = [];
  tutorial: number | null = null;
  aviso: AvisoContextual | null = null;
  textoEditor = '';
  historico: string[] = [];
  /** Parecer do último protocolo recusado. */
  parecer?: ResultadoValidacao;
  conferencia?: Conferencia;
  ultimaExecucaoOk = false;
  aba: AbaSaida = 'resultado';
  somLigado = true;
  pedidoEditor?: { id: number; texto: string };
  credencialEmFoco?: string;

  // --- infraestrutura de assinatura -----------------------------------------

  assinar = (fn: () => void) => {
    this.ouvintes.add(fn);
    return () => {
      this.ouvintes.delete(fn);
    };
  };

  versaoAtual = () => this.versao;

  private mudou() {
    this.versao++;
    this.ouvintes.forEach((fn) => fn());
  }

  private salvar() {
    clearTimeout(this.timerSalvar);
    this.timerSalvar = setTimeout(() => {
      if (!this.jogo || !this.armazenamento) return;
      void this.armazenamento.salvarJSON(CHAVE_SAVE, this.jogo.serializar()).catch(() => undefined);
      void this.armazenamento.salvarJSON(CHAVE_EXTRA, { historico: this.historico, somLigado: this.somLigado }).catch(() => undefined);
    }, 300);
  }

  private limparMemorando() {
    this.parecer = undefined;
    this.conferencia = undefined;
    this.destaque = SEM_DESTAQUE;
  }

  // --- telas ------------------------------------------------------------------

  async iniciar() {
    try {
      const save = await this.armazenamento?.carregarJSON<Save>(CHAVE_SAVE);
      const extra = await this.armazenamento?.carregarJSON<{ historico: string[]; somLigado: boolean }>(CHAVE_EXTRA);
      if (save) {
        this.jogo = Jogo.carregar(save);
        this.temSave = true;
      }
      if (extra) {
        this.historico = extra.historico ?? [];
        this.somLigado = extra.somLigado ?? true;
      }
    } catch {
      // save corrompido ou IndexedDB indisponível: começa do zero
    }
    som.ligado = this.somLigado;
    this.tela = 'titulo';
    this.mudou();
  }

  novoJogo() {
    this.jogo = Jogo.novo();
    this.temSave = true;
    this.blocos = [];
    this.historico = [];
    this.fila = [];
    this.limparMemorando();
    this.tela = 'abertura';
    this.salvar();
    this.mudou();
  }

  continuar() {
    this.tela = 'jogo';
    this.mudou();
    this.verificarAvisos();
  }

  concluirAbertura() {
    this.tela = 'jogo';
    if (this.jogo && !this.jogo.progresso.tutorialConcluido) this.tutorial = 0;
    this.mudou();
  }

  voltarAoTitulo() {
    this.painel = null;
    this.tutorial = null;
    this.aviso = null;
    this.tela = 'titulo';
    this.mudou();
  }

  async apagarProgresso() {
    this.jogo = undefined;
    this.temSave = false;
    this.historico = [];
    this.blocos = [];
    await this.armazenamento?.remover(CHAVE_SAVE).catch(() => undefined);
    this.voltarAoTitulo();
  }

  alternarSom() {
    this.somLigado = !this.somLigado;
    som.ligado = this.somLigado;
    if (this.somLigado) som.clique();
    this.salvar();
    this.mudou();
  }

  // --- terminal ---------------------------------------------------------------

  setTextoEditor(texto: string) {
    this.textoEditor = texto;
    if (this.tutorial !== null && PASSOS_TUTORIAL[this.tutorial].espera) this.checarTutorial();
  }

  inserirNoEditor(texto: string) {
    this.pedidoEditor = { id: ++this.seq, texto };
    this.painel = null;
    this.mudou();
  }

  /** Executa um comando. Nunca envia nada à Diretoria: isso é trabalho do protocolar. */
  executar(codigo?: string) {
    const jogo = this.jogo;
    const texto = (codigo ?? this.textoEditor).trim();
    if (!jogo || !texto) return;

    const r = jogo.executar(texto);
    this.blocos = r.execucao.limparTela ? [] : [...this.blocos.slice(-50), { id: ++this.seq, comando: texto, linhas: r.execucao.saida }];
    this.historico = [...this.historico.filter((h) => h !== texto), texto].slice(-100);
    this.destaque = r.destaque;
    this.aba = 'resultado';
    this.ultimaExecucaoOk = r.execucao.ok && r.execucao.operacoes.length > 0;
    if (this.conferencia && r.execucao.operacoes.length) this.conferencia.desatualizada = true;

    if (!r.execucao.ok) {
      som.erro();
      this.mostrarAviso('primeiro-erro');
    }
    this.processarEventos(r.eventos);
    this.checarTutorial();
    this.salvar();
    this.mudou();
  }

  /** Envia a última resposta para conferência. */
  protocolar() {
    const jogo = this.jogo;
    const missao = jogo?.missaoAtual;
    if (!jogo || !missao) return;
    const { validacao, eventos, objetivos } = jogo.protocolar();
    if (validacao.ok) {
      this.limparMemorando();
    } else {
      this.parecer = validacao;
      this.conferencia = objetivos.length ? { missaoId: missao.id, marcas: objetivos, desatualizada: false } : undefined;
      som.indeferido();
      this.mostrarAviso('indeferido');
    }
    this.processarEventos(eventos);
    this.checarTutorial();
    this.salvar();
    this.mudou();
  }

  private processarEventos(eventos: Evento[]) {
    for (const ev of eventos) {
      switch (ev.tipo) {
        case 'missao-concluida':
          this.fila.push({ id: ++this.seq, tipo: 'conclusao', missao: ev.missao, estrelas: ev.estrelas, carimbos: ev.carimbos });
          som.carimbo();
          break;
        case 'capitulo-aberto':
          this.fila.push({ id: ++this.seq, tipo: 'capitulo', capitulo: ev.capitulo });
          break;
        case 'fim-do-conteudo':
          this.fila.push({ id: ++this.seq, tipo: 'fim' });
          break;
        case 'credencial-bloqueou':
          this.adicionarToast(`Esse comando exige a credencial “${ev.credencial}”.`, { rotulo: 'Abrir Árvore', painel: 'arvore' });
          break;
      }
    }
  }

  // --- painéis e sobreposições -------------------------------------------------

  abrirPainel(painel: Painel, credencial?: string) {
    this.painel = painel;
    this.credencialEmFoco = credencial;
    if (painel === 'arvore' && this.aviso?.alvo === 'botao-arvore') this.aviso = null;
    som.clique();
    this.mudou();
  }

  fecharPainel() {
    this.painel = null;
    this.mudou();
    this.verificarAvisos();
  }

  fecharSobreposicao() {
    this.fila.shift();
    this.checarTutorial();
    this.mudou();
    this.verificarAvisos();
  }

  comprar(id: string) {
    if (!this.jogo) return;
    const r = this.jogo.comprar(id);
    if (r.ok) {
      som.desbloqueio();
      this.fila.push({ id: ++this.seq, tipo: 'credencial', no: r.no });
      this.painel = null;
      this.salvar();
    }
    this.mudou();
    return r;
  }

  selecionarMissao(id: string) {
    if (!this.jogo) return;
    this.jogo.selecionarMissao(id);
    this.limparMemorando();
    som.clique();
    this.salvar();
    this.mudou();
    this.verificarAvisos();
  }

  reiniciarMissao() {
    if (!this.jogo) return;
    this.jogo.reiniciarMissao();
    this.blocos = [...this.blocos, { id: ++this.seq, comando: '(reiniciar memorando)', linhas: [{ tipo: 'info', texto: 'O arquivo voltou ao estado em que o memorando chegou.' }] }];
    this.limparMemorando();
    this.salvar();
    this.mudou();
  }

  revelarDica() {
    this.jogo?.revelarDica();
    this.salvar();
    this.mudou();
  }

  adicionarToast(texto: string, acao?: Toast['acao']) {
    const id = ++this.seq;
    this.toasts = [...this.toasts.slice(-2), { id, texto, acao }];
    setTimeout(() => this.dispensarToast(id), 6000);
  }

  dispensarToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.mudou();
  }

  mudarAba(aba: AbaSaida) {
    this.aba = aba;
    this.mudou();
  }

  // --- tutorial e avisos --------------------------------------------------------

  private checarTutorial() {
    if (this.tutorial === null) return;
    const passo = PASSOS_TUTORIAL[this.tutorial];
    if (passo.espera?.(this)) this.avancarTutorial();
  }

  avancarTutorial() {
    if (this.tutorial === null) return;
    this.tutorial++;
    if (this.tutorial >= PASSOS_TUTORIAL.length) {
      this.tutorial = null;
      if (this.jogo) this.jogo.progresso.tutorialConcluido = true;
      this.salvar();
      this.mudou();
      this.verificarAvisos();
      return;
    }
    this.mudou();
    this.checarTutorial();
  }

  pularTutorial() {
    this.tutorial = PASSOS_TUTORIAL.length - 1;
    this.avancarTutorial();
  }

  reverTutorial() {
    this.painel = null;
    this.aviso = null;
    this.tutorial = 1;
    this.mudou();
  }

  verificarAvisos() {
    const jogo = this.jogo;
    if (!jogo || this.tela !== 'jogo' || this.tutorial !== null || this.fila.length || this.painel || this.aviso) return;
    const missao = jogo.missaoAtual;
    if (missao && jogo.situacaoMissao(missao) === 'falta-credencial') this.mostrarAviso('credencial-faltando');
    else if (missao?.anexo) this.mostrarAviso('anexo');
    else if (jogo.progresso.fase >= 2) this.mostrarAviso('mundo-cresceu');
  }

  mostrarAviso(chave: keyof typeof AVISOS) {
    if (!this.jogo || this.tutorial !== null || this.aviso) return;
    if (!this.jogo.marcarAviso(chave)) return;
    this.aviso = { chave, ...AVISOS[chave] };
    this.salvar();
    this.mudou();
  }

  fecharAviso() {
    this.aviso = null;
    this.mudou();
    this.verificarAvisos();
  }

  // --- dados derivados ----------------------------------------------------------

  sugestoes(): Sugestoes {
    const jogo = this.jogo;
    if (!jogo) return { colecoes: [], metodosColecao: [], metodosCursor: [], operadores: [], campos: [] };
    const chaves = ARVORE.filter((n) => jogo.possui.has(n.id)).flatMap((n) => n.libera.map((l) => l.chave));
    const docs = jogo.mundo.colecao('almas').docs;
    if (!this.cacheCampos || this.cacheCampos.total !== docs.length) {
      this.cacheCampos = { total: docs.length, campos: inferirEsquema(docs).map((c) => c.caminho).filter((c) => c !== '_id') };
    }
    return {
      colecoes: jogo.mundo.nomesDasColecoes(),
      metodosColecao: chaves.filter((c) => METODOS_DE_COLECAO.has(c)),
      metodosCursor: ['toArray', 'pretty', ...chaves.filter((c) => METODOS_DE_CURSOR.has(c))],
      operadores: chaves.filter((c) => c.startsWith('$') && !/[@[\s]/.test(c)),
      campos: this.cacheCampos.campos,
    };
  }
}

export const controlador = new Controlador();

export function useControlador(): Controlador {
  useSyncExternalStore(controlador.assinar, controlador.versaoAtual);
  return controlador;
}
