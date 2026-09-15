/**
 * Modos fora da campanha. Tudo aqui trabalha em CÓPIAS do arquivo do jogador: nada mexe no
 * progresso, nos carimbos ou no mundo da campanha.
 *
 *  - Sala de Treino: terminal livre e memorandos gerados na hora. Cada memorando tem o SEU arquivo:
 *    o que se faz num nunca aparece em outro nem no terminal livre.
 *  - Expediente: consultas já deferidas na campanha, embaralhadas, contra o relógio.
 */

import type { Database, RegistroOperacao } from '../engine/database';
import { Sessao, type ResultadoExecucao } from '../engine/shell';
import { TODAS_AS_CREDENCIAIS, criarVerificador } from './arvore';
import { calcularDestaque, mapaAlmas, type Destaque } from './jogo';
import type { Missao } from './missoes';
import { Rng } from './mundo';
import { montarContexto, type ResultadoValidacao } from './validacao';
import { gerarMemorando, type AssuntoTreino } from './gerador';

export interface ComandoTreino {
  execucao: ResultadoExecucao;
  destaque: Destaque;
}

/** Um arquivo próprio + um terminal ligado a ele. */
abstract class Bancada {
  mundo!: Database;
  protected sessao!: Sessao;

  protected constructor(
    protected readonly base: Database,
    protected readonly possui: () => ReadonlySet<string>,
  ) {}

  protected instalar() {
    const db = this.base.clonar();
    db.verificador = criarVerificador(this.possui);
    this.mundo = db;
    this.sessao = new Sessao(db);
  }

  executar(codigo: string): ComandoTreino {
    const antes = mapaAlmas(this.mundo);
    const execucao = this.sessao.executar(codigo);
    return { execucao, destaque: calcularDestaque(antes, this.mundo, execucao.valor) };
  }

  abstract reiniciar(): void;
}

class TerminalLivre extends Bancada {
  constructor(base: Database, possui: () => ReadonlySet<string>) {
    super(base, possui);
    this.reiniciar();
  }

  reiniciar() {
    this.instalar();
  }
}

/** Um memorando com o arquivo só dele. Usado pelos memorandos de treino e pelo Expediente. */
export class MesaDeMemorando extends Bancada {
  dicas = 0;
  tentativas = 0;
  deferido = false;
  marcas?: boolean[];
  parecer?: ResultadoValidacao;
  private mundoInicio!: Database;
  private historico: RegistroOperacao[] = [];
  private ultimo?: { valor: unknown; ok: boolean; operacoes: RegistroOperacao[] };

  constructor(
    base: Database,
    readonly missao: Missao,
    possui: () => ReadonlySet<string>,
    readonly assunto?: AssuntoTreino,
  ) {
    super(base, possui);
    this.reiniciar();
  }

  /** Volta o arquivo DESTE memorando ao estado em que ele chegou. */
  reiniciar() {
    this.instalar();
    if (this.missao.anexo) this.sessao.executar(this.missao.anexo.codigo);
    this.mundoInicio = this.mundo.clonar();
    this.historico = [];
    this.ultimo = undefined;
    this.marcas = undefined;
    this.parecer = undefined;
  }

  override executar(codigo: string): ComandoTreino {
    const r = super.executar(codigo);
    this.historico.push(...r.execucao.operacoes);
    if (r.execucao.operacoes.length) this.ultimo = { valor: r.execucao.valor, ok: r.execucao.ok, operacoes: r.execucao.operacoes };
    return r;
  }

  private contexto() {
    return montarContexto({
      tipo: this.missao.tipo,
      codigoReferencia: this.missao.solucaoReferencia,
      anexo: this.missao.anexo?.codigo,
      resultado: this.ultimo?.valor,
      execucaoOk: this.ultimo?.ok ?? false,
      operacoes: this.ultimo?.operacoes ?? [],
      historicoMissao: this.historico,
      mundoInicio: this.mundoInicio,
      mundo: this.mundo,
    });
  }

  /** A resposta de referência ficaria vazia neste arquivo? */
  referenciaVazia(): boolean {
    const ref = this.contexto().referencia().valor;
    return ref === null || ref === undefined || (Array.isArray(ref) && ref.length === 0);
  }

  protocolar(): { validacao: ResultadoValidacao; marcas: boolean[] } {
    const ctx = this.contexto();
    const marcas = this.missao.objetivos.map((o) => {
      try {
        return o.conferir(ctx);
      } catch {
        return false;
      }
    });
    let validacao: ResultadoValidacao;
    try {
      validacao = this.missao.validar(ctx);
    } catch (e) {
      validacao = { ok: false, motivo: `Não foi possível conferir: ${(e as Error).message}` };
    }
    this.marcas = marcas;
    this.parecer = validacao;
    if (validacao.ok) this.deferido = true;
    else this.tentativas++;
    return { validacao, marcas };
  }

  revelarDica(): string[] {
    this.dicas = Math.min(3, this.dicas + 1);
    return this.missao.dicas.slice(0, this.dicas);
  }
}

export class SalaDeTreino {
  todasAsCredenciais = false;
  memorandos: MesaDeMemorando[] = [];
  /** Memorando aberto; null é o terminal livre. */
  ativo: MesaDeMemorando | null = null;
  private readonly base: Database;
  private readonly livre: TerminalLivre;
  private contador = 0;

  constructor(
    base: Database,
    private readonly credenciais: () => ReadonlySet<string>,
  ) {
    this.base = base.clonar();
    this.livre = new TerminalLivre(this.base, () => this.possui);
  }

  get possui(): ReadonlySet<string> {
    return this.todasAsCredenciais ? TODAS_AS_CREDENCIAIS : this.credenciais();
  }

  get mundo(): Database {
    return (this.ativo ?? this.livre).mundo;
  }

  executar(codigo: string): ComandoTreino {
    return (this.ativo ?? this.livre).executar(codigo);
  }

  /** Restaura só o arquivo aberto agora (o do memorando ativo ou o do terminal livre). */
  reiniciar() {
    (this.ativo ?? this.livre).reiniciar();
  }

  /** Gera um memorando novo (com arquivo próprio) e o abre. Null se nada serve com as credenciais atuais. */
  gerar(assunto?: AssuntoTreino, semente = Date.now()): MesaDeMemorando | null {
    const id = `T-${this.contador + 1}`;
    const gerado = gerarMemorando(this.base, this.possui, { id, semente: semente + this.contador * 7919, assunto });
    if (!gerado) return null;
    this.contador++;
    const mesa = new MesaDeMemorando(this.base, gerado.missao, () => this.possui, gerado.assunto);
    this.memorandos.push(mesa);
    this.ativo = mesa;
    return mesa;
  }

  abrir(id: string | null) {
    this.ativo = id === null ? null : (this.memorandos.find((m) => m.missao.id === id) ?? this.ativo);
  }

  /** Troca o memorando aberto por outro do mesmo assunto, no mesmo lugar da lista. */
  pular(semente = Date.now()): MesaDeMemorando | null {
    const atual = this.ativo;
    if (!atual) return null;
    const nova = this.gerar(atual.assunto, semente);
    if (!nova) {
      this.ativo = atual;
      return null;
    }
    this.memorandos.pop();
    this.memorandos.splice(this.memorandos.indexOf(atual), 1, nova);
    return nova;
  }

  descartar(id: string) {
    const i = this.memorandos.findIndex((m) => m.missao.id === id);
    if (i < 0) return;
    const [removido] = this.memorandos.splice(i, 1);
    if (this.ativo === removido) this.ativo = this.memorandos[Math.min(i, this.memorandos.length - 1)] ?? null;
  }
}

export const DURACAO_EXPEDIENTE_MS = 5 * 60_000;

export class Expediente {
  readonly fila: Missao[];
  readonly inicio: number;
  indice = 0;
  deferidos = 0;
  pulados = 0;
  encerrado = false;
  private mesa!: MesaDeMemorando;
  private readonly base: Database;

  static elegiveis(concluidas: Missao[]): Missao[] {
    return concluidas.filter((m) => m.tipo === 'consulta');
  }

  constructor(base: Database, concluidas: Missao[], agora = Date.now(), semente = agora) {
    const elegiveis = Expediente.elegiveis(concluidas);
    this.fila = new Rng(semente).amostra(elegiveis, elegiveis.length);
    this.base = base.clonar();
    this.inicio = agora;
    this.prepararDesafio();
  }

  get missao(): Missao | undefined {
    return this.fila.length ? this.fila[this.indice % this.fila.length] : undefined;
  }

  get mundo(): Database {
    return this.mesa.mundo;
  }

  restanteMs(agora = Date.now()): number {
    return Math.max(0, DURACAO_EXPEDIENTE_MS - (agora - this.inicio));
  }

  /** Arquivo novo para o desafio; pula memorandos cuja resposta ficaria vazia nesta cópia. */
  private prepararDesafio() {
    for (let tentativas = 0; tentativas < Math.max(1, this.fila.length); tentativas++) {
      const missao = this.missao;
      if (!missao) return;
      this.mesa = new MesaDeMemorando(this.base, missao, () => TODAS_AS_CREDENCIAIS);
      if (!this.mesa.referenciaVazia()) return;
      this.indice++;
    }
  }

  executar(codigo: string): ComandoTreino {
    return this.mesa.executar(codigo);
  }

  protocolar(agora = Date.now()): { validacao: ResultadoValidacao; marcas: boolean[] } {
    if (this.encerrado || !this.missao || this.restanteMs(agora) === 0) {
      this.encerrado = true;
      return { validacao: { ok: false, motivo: 'O expediente acabou. Hora de bater o ponto.' }, marcas: [] };
    }
    const r = this.mesa.protocolar();
    if (r.validacao.ok) {
      this.deferidos++;
      this.indice++;
      this.prepararDesafio();
    }
    return r;
  }

  pular() {
    if (this.encerrado) return;
    this.pulados++;
    this.indice++;
    this.prepararDesafio();
  }
}
