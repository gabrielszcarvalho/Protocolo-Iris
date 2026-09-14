/**
 * Modos fora da campanha. Os dois trabalham numa CÓPIA do arquivo do jogador: nada do que
 * acontece aqui mexe no progresso, nos carimbos ou no mundo da campanha.
 *
 *  - Sala de Treino: terminal livre, com as credenciais do jogador ou todas liberadas.
 *  - Expediente: consultas já deferidas na campanha, embaralhadas, contra o relógio.
 */

import type { Database, RegistroOperacao } from '../engine/database';
import { Sessao, type ResultadoExecucao } from '../engine/shell';
import { TODAS_AS_CREDENCIAIS, criarVerificador } from './arvore';
import { calcularDestaque, mapaAlmas, type Destaque } from './jogo';
import type { Missao } from './missoes';
import { Rng } from './mundo';
import { montarContexto, type ResultadoValidacao } from './validacao';

export interface ComandoTreino {
  execucao: ResultadoExecucao;
  destaque: Destaque;
}

abstract class Bancada {
  mundo!: Database;
  protected sessao!: Sessao;

  protected instalar(db: Database, possui: () => ReadonlySet<string>) {
    db.verificador = criarVerificador(possui);
    this.mundo = db;
    this.sessao = new Sessao(db);
  }

  executar(codigo: string): ComandoTreino {
    const antes = mapaAlmas(this.mundo);
    const execucao = this.sessao.executar(codigo);
    return { execucao, destaque: calcularDestaque(antes, this.mundo, execucao.valor) };
  }
}

export class SalaDeTreino extends Bancada {
  todasAsCredenciais = false;

  constructor(
    private readonly base: Database,
    private readonly credenciais: () => ReadonlySet<string>,
  ) {
    super();
    this.base = base.clonar();
    this.reiniciar();
  }

  get possui(): ReadonlySet<string> {
    return this.todasAsCredenciais ? TODAS_AS_CREDENCIAIS : this.credenciais();
  }

  /** Volta a cópia ao estado em que a Sala foi aberta. */
  reiniciar() {
    this.instalar(this.base.clonar(), () => this.possui);
  }
}

export const DURACAO_EXPEDIENTE_MS = 5 * 60_000;

export class Expediente extends Bancada {
  readonly fila: Missao[];
  readonly inicio: number;
  indice = 0;
  deferidos = 0;
  pulados = 0;
  encerrado = false;
  private mundoInicio!: Database;
  private historico: RegistroOperacao[] = [];
  private ultimo?: { valor: unknown; ok: boolean; operacoes: RegistroOperacao[] };

  static elegiveis(concluidas: Missao[]): Missao[] {
    return concluidas.filter((m) => m.tipo === 'consulta');
  }

  constructor(
    private readonly base: Database,
    concluidas: Missao[],
    agora = Date.now(),
    semente = agora,
  ) {
    super();
    const elegiveis = Expediente.elegiveis(concluidas);
    this.fila = new Rng(semente).amostra(elegiveis, elegiveis.length);
    this.base = base.clonar();
    this.inicio = agora;
    this.prepararDesafio();
  }

  get missao(): Missao | undefined {
    return this.fila.length ? this.fila[this.indice % this.fila.length] : undefined;
  }

  restanteMs(agora = Date.now()): number {
    return Math.max(0, DURACAO_EXPEDIENTE_MS - (agora - this.inicio));
  }

  /** Arquivo novo para o desafio; pula memorandos cuja resposta ficaria vazia nesta cópia. */
  private prepararDesafio() {
    for (let tentativas = 0; tentativas < this.fila.length; tentativas++) {
      this.instalar(this.base.clonar(), () => TODAS_AS_CREDENCIAIS);
      const missao = this.missao!;
      if (missao.anexo) this.sessao.executar(missao.anexo.codigo);
      this.mundoInicio = this.mundo.clonar();
      this.historico = [];
      this.ultimo = undefined;
      const ref = this.contexto(missao).referencia().valor;
      if (!(Array.isArray(ref) && ref.length === 0) && ref !== null && ref !== undefined) return;
      this.indice++;
    }
  }

  override executar(codigo: string): ComandoTreino {
    const r = super.executar(codigo);
    this.historico.push(...r.execucao.operacoes);
    if (r.execucao.operacoes.length) this.ultimo = { valor: r.execucao.valor, ok: r.execucao.ok, operacoes: r.execucao.operacoes };
    return r;
  }

  private contexto(missao: Missao) {
    return montarContexto({
      tipo: missao.tipo,
      codigoReferencia: missao.solucaoReferencia,
      anexo: missao.anexo?.codigo,
      resultado: this.ultimo?.valor,
      execucaoOk: this.ultimo?.ok ?? false,
      operacoes: this.ultimo?.operacoes ?? [],
      historicoMissao: this.historico,
      mundoInicio: this.mundoInicio,
      mundo: this.mundo,
    });
  }

  protocolar(agora = Date.now()): { validacao: ResultadoValidacao; marcas: boolean[] } {
    const missao = this.missao;
    if (this.encerrado || !missao || this.restanteMs(agora) === 0) {
      this.encerrado = true;
      return { validacao: { ok: false, motivo: 'O expediente acabou. Hora de bater o ponto.' }, marcas: [] };
    }
    const ctx = this.contexto(missao);
    const marcas = missao.objetivos.map((o) => {
      try {
        return o.conferir(ctx);
      } catch {
        return false;
      }
    });
    let validacao: ResultadoValidacao;
    try {
      validacao = missao.validar(ctx);
    } catch (e) {
      validacao = { ok: false, motivo: `Não foi possível conferir: ${(e as Error).message}` };
    }
    if (validacao.ok) {
      this.deferidos++;
      this.indice++;
      this.prepararDesafio();
    }
    return { validacao, marcas };
  }

  pular() {
    if (this.encerrado) return;
    this.pulados++;
    this.indice++;
    this.prepararDesafio();
  }
}
