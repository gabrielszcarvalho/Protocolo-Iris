import { Jogo } from '../../src/game/jogo';
import { DURACAO_EXPEDIENTE_MS, Expediente, SalaDeTreino } from '../../src/game/treino';
import { TODAS_AS_MISSOES } from '../../src/game/missoes';

function jogoAte(id: string) {
  const jogo = Jogo.novo();
  while (jogo.missaoAtual && jogo.missaoAtual.id !== id) {
    const m = jogo.missaoAtual;
    for (const no of jogo.credenciaisFaltando(m)) {
      jogo.progresso.carimbos += no.custo;
      jogo.comprar(no.id);
    }
    jogo.executar(m.solucaoReferencia);
    jogo.protocolar();
  }
  return jogo;
}

describe('Sala de Treino', () => {
  it('trabalha numa cópia, com as credenciais do jogador ou todas liberadas', () => {
    const jogo = Jogo.novo();
    const sala = new SalaDeTreino(jogo.mundo, () => jogo.possui);
    expect(sala.executar('db.almas.findOne()').execucao.ok).toBe(false);

    sala.todasAsCredenciais = true;
    expect(sala.executar('db.almas.findOne()').execucao.ok).toBe(true);
    sala.executar('db.almas.deleteMany({})');
    expect(sala.mundo.colecao('almas').docs).toHaveLength(0);
    expect(jogo.mundo.colecao('almas').docs).toHaveLength(8);

    sala.reiniciar();
    expect(sala.mundo.colecao('almas').docs).toHaveLength(8);
  });
});

describe('Expediente', () => {
  const jogo = jogoAte('3.1');
  const concluidas = TODAS_AS_MISSOES.filter((m) => jogo.concluida(m));

  it('só usa consultas já deferidas', () => {
    const exp = new Expediente(jogo.mundo, concluidas, 0, 3);
    expect(exp.fila.length).toBeGreaterThan(3);
    expect(exp.fila.every((m) => m.tipo === 'consulta' && jogo.concluida(m))).toBe(true);
  });

  it('defere a resposta certa e passa ao próximo memorando', () => {
    const exp = new Expediente(jogo.mundo, concluidas, 0, 42);
    const primeira = exp.missao!;
    exp.executar(primeira.solucaoReferencia);
    expect(exp.protocolar(1000).validacao).toEqual({ ok: true });
    expect(exp.deferidos).toBe(1);
    expect(exp.missao!.id).not.toBe(primeira.id);
  });

  it('recusa a resposta errada e mostra as marcas', () => {
    const exp = new Expediente(jogo.mundo, concluidas, 0, 7);
    exp.executar("db.almas.find({ setor: 'Setor que não existe' })");
    const r = exp.protocolar(1000);
    expect(r.validacao.ok).toBe(false);
    expect(r.marcas).toContain(false);
    expect(exp.deferidos).toBe(0);
  });

  it('acaba quando o tempo acaba e nunca mexe no arquivo da campanha', () => {
    const exp = new Expediente(jogo.mundo, concluidas, 0, 1);
    const total = jogo.mundo.colecao('almas').docs.length;
    exp.executar('db.almas.deleteMany({})');
    expect(exp.protocolar(DURACAO_EXPEDIENTE_MS + 1).validacao.ok).toBe(false);
    expect(exp.encerrado).toBe(true);
    expect(jogo.mundo.colecao('almas').docs).toHaveLength(total);
  });
});
