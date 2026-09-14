/**
 * Efeitos sonoros sintetizados na hora (Web Audio). Nenhum arquivo, nenhuma rede.
 */

class Som {
  ligado = true;
  private ctx?: AudioContext;

  private tocar(fn: (ctx: AudioContext, t: number) => void) {
    if (!this.ligado || typeof AudioContext === 'undefined') return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      fn(this.ctx, this.ctx.currentTime);
    } catch {
      // som é enfeite: nunca pode quebrar o jogo
    }
  }

  private tom(ctx: AudioContext, t: number, freq: number, dur: number, tipo: OscillatorType, volume: number) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t);
    ganho.gain.setValueAtTime(volume, t);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  private ruido(ctx: AudioContext, t: number, dur: number, volume: number, corte: number) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / dados.length) ** 3;
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = corte;
    const ganho = ctx.createGain();
    ganho.gain.value = volume;
    fonte.connect(filtro).connect(ganho).connect(ctx.destination);
    fonte.start(t);
  }

  /** Carimbo batendo no papel. */
  carimbo() {
    this.tocar((ctx, t) => {
      this.ruido(ctx, t, 0.18, 0.9, 900);
      this.tom(ctx, t, 85, 0.25, 'sine', 0.6);
    });
  }

  /** Credencial nova: três notas subindo. */
  desbloqueio() {
    this.tocar((ctx, t) => {
      [523, 659, 784].forEach((f, i) => this.tom(ctx, t + i * 0.09, f, 0.35, 'triangle', 0.18));
    });
  }

  erro() {
    this.tocar((ctx, t) => this.tom(ctx, t, 140, 0.12, 'square', 0.06));
  }

  indeferido() {
    this.tocar((ctx, t) => {
      this.tom(ctx, t, 330, 0.15, 'triangle', 0.15);
      this.tom(ctx, t + 0.14, 247, 0.25, 'triangle', 0.15);
    });
  }

  /** Tecla de máquina de escrever. */
  tecla() {
    this.tocar((ctx, t) => this.ruido(ctx, t, 0.03, 0.15, 3000));
  }

  clique() {
    this.tocar((ctx, t) => this.tom(ctx, t, 900, 0.04, 'sine', 0.05));
  }
}

export const som = new Som();
