import { Jogo } from '../../src/game/jogo';
import { CAPITULOS } from '../../src/game/missoes';
import { NO_POR_ID } from '../../src/game/arvore';

/** Compra o que falta, roda a solução de referência e protocola. */
function concluirComReferencia(jogo: Jogo) {
  const missao = jogo.missaoAtual!;
  for (const no of jogo.credenciaisFaltando(missao)) {
    jogo.progresso.carimbos += no.custo;
    expect(jogo.comprar(no.id)).toMatchObject({ ok: true });
  }
  jogo.executar(missao.solucaoReferencia);
  return jogo.protocolar();
}

describe('Jogo', () => {
  it('começa com a Credencial Provisória, zero carimbos e o primeiro memorando', () => {
    const jogo = Jogo.novo();
    expect(jogo.progresso.carimbos).toBe(0);
    expect(jogo.missaoAtual!.id).toBe('1.1');
    // lê direto (countDocuments ainda não foi comprado pelo jogador)
    expect(jogo.mundo.colecao('almas').docs).toHaveLength(8);
  });

  it('comando não comprado gera erro diegético e evento', () => {
    const jogo = Jogo.novo();
    const r = jogo.executar('db.almas.findOne()');
    expect(r.execucao.ok).toBe(false);
    expect(r.eventos).toContainEqual({ tipo: 'credencial-bloqueou', credencial: 'Leitura Rápida' });
  });

  it('executar a resposta certa NÃO conclui sozinho: é preciso protocolar', () => {
    const jogo = Jogo.novo();
    const r = jogo.executar('db.almas.find()');
    expect(r.eventos).toEqual([]);
    expect(r.destaque.encontrados).toHaveLength(8);
    expect(jogo.missaoAtual!.id).toBe('1.1');

    const p = jogo.protocolar();
    expect(p.validacao).toEqual({ ok: true });
    expect(p.objetivos).toEqual([true]);
    expect(p.eventos[0]).toMatchObject({ tipo: 'missao-concluida', estrelas: 3, carimbos: 4 });
    expect(jogo.progresso.carimbos).toBe(4);
    expect(jogo.missaoAtual!.id).toBe('1.2');
  });

  it('protocolar errado conta tentativa e marca os quadradinhos que já estão certos', () => {
    const jogo = Jogo.novo();
    jogo.executar('db.almas.find()');
    jogo.protocolar(); // 1.1
    jogo.executar('db.almas.find({}, { nome: 1, setor: 1 })');
    expect(jogo.progresso.tentativas['1.2']).toBeUndefined();
    const { validacao, objetivos } = jogo.protocolar();
    expect(validacao.ok).toBe(false);
    expect(objetivos).toEqual([true, true, false]); // todas as almas ✓, nome e setor ✓, sem _id ✗
    expect(jogo.progresso.tentativas['1.2']).toBe(1);
  });

  it('dicas reduzem as estrelas', () => {
    const jogo = Jogo.novo();
    expect(jogo.revelarDica()).toHaveLength(1);
    jogo.revelarDica();
    jogo.revelarDica();
    expect(jogo.revelarDica()).toHaveLength(3);
    jogo.executar('db.almas.find()');
    expect(jogo.protocolar().eventos[0]).toMatchObject({ estrelas: 1, carimbos: 2 });
  });

  it('compra exige carimbos e requisitos', () => {
    const jogo = Jogo.novo();
    expect(jogo.comprar('leitura-rapida')).toMatchObject({ ok: false, motivo: 'Faltam 2 carimbo(s).' });
    jogo.progresso.carimbos = 50;
    expect(jogo.comprar('despacho-em-lote')).toMatchObject({ ok: false });
    expect(jogo.comprar('expurgo')).toMatchObject({ ok: false, motivo: expect.stringMatching(/Lacrada/) });
    expect(jogo.comprar('leitura-rapida')).toMatchObject({ ok: true });
    expect(jogo.progresso.carimbos).toBe(48);
    expect(jogo.executar("db.almas.findOne({ nome: 'Odorico Paz' })").execucao.ok).toBe(true);
  });

  it('memorando com anexo carrega a variável no terminal e pode ser reiniciado', () => {
    const jogo = Jogo.novo();
    for (let i = 0; i < 7; i++) concluirComReferencia(jogo);
    expect(jogo.missaoAtual!.id).toBe('1.8');
    const r = jogo.executar('db.almas.insertMany(lote)');
    expect(r.execucao.ok).toBe(false);
    expect(r.destaque.inseridos).toHaveLength(1);
    const total = jogo.mundo.colecao('almas').docs.length;
    jogo.reiniciarMissao();
    expect(jogo.mundo.colecao('almas').docs).toHaveLength(total - 1);
    jogo.executar('db.almas.insertMany(lote, { ordered: false })');
    expect(jogo.protocolar().eventos[0]).toMatchObject({ tipo: 'missao-concluida' });
  });

  it('terminar o capítulo 1 abre o 2 e faz o mundo crescer', () => {
    const jogo = Jogo.novo();
    let eventos: ReturnType<Jogo['protocolar']>['eventos'] = [];
    for (const _ of CAPITULOS[0].missoes) eventos = concluirComReferencia(jogo).eventos;
    expect(eventos).toContainEqual({ tipo: 'capitulo-aberto', capitulo: CAPITULOS[1] });
    expect(jogo.progresso.fase).toBe(2);
    expect(jogo.mundo.colecao('almas').docs.length).toBeGreaterThan(300);
    expect(jogo.missaoAtual!.id).toBe('2.1');
  });

  it('é possível jogar todo o conteúdo até o fim', () => {
    const jogo = Jogo.novo();
    let ultimo: ReturnType<Jogo['protocolar']> | undefined;
    for (let i = 0; i < 100 && jogo.missaoAtual; i++) {
      const id = jogo.missaoAtual.id;
      ultimo = concluirComReferencia(jogo);
      expect(ultimo.validacao, `falhou em ${id}: ${ultimo.validacao.motivo}`).toEqual({ ok: true });
    }
    expect(jogo.conteudoConcluido).toBe(true);
    expect(ultimo!.eventos).toContainEqual({ tipo: 'fim-do-conteudo' });
  });

  it('mesmo com 1 estrela em todos os memorandos, os carimbos sempre bastam', () => {
    const jogo = Jogo.novo();
    for (let i = 0; i < 100 && jogo.missaoAtual; i++) {
      const missao = jogo.missaoAtual;
      for (const no of jogo.credenciaisFaltando(missao)) {
        expect(jogo.comprar(no.id), `${missao.id}: faltou carimbo para ${no.nome}`).toMatchObject({ ok: true });
      }
      jogo.revelarDica();
      jogo.revelarDica();
      jogo.revelarDica();
      jogo.executar(missao.solucaoReferencia);
      expect(jogo.protocolar().eventos[0]).toMatchObject({ tipo: 'missao-concluida', estrelas: 1 });
    }
    expect(jogo.conteudoConcluido).toBe(true);
  });

  it('nenhuma ordem de compra deixa o jogador sem saída (pior caso calculado)', () => {
    // Em cada capítulo, supõe o pior: 1 estrela em tudo e compras que rendem menos do que custam
    // feitas primeiro. O saldo ainda precisa pagar a credencial mais cara que o capítulo exige.
    let saldoMinimo = 0;
    for (const capitulo of CAPITULOS) {
      const nos = [...new Set(capitulo.missoes.flatMap((m) => m.requer))].map((id) => NO_POR_ID.get(id)!);
      const livres = capitulo.missoes.filter((m) => m.requer.length === 0).reduce((s, m) => s + m.recompensa, 0);
      const prejuizos = nos.reduce((s, no) => {
        const rende = capitulo.missoes.filter((m) => m.requer.includes(no.id)).reduce((t, m) => t + m.recompensa, 0);
        return s + Math.min(0, rende - no.custo);
      }, 0);
      const maisCara = Math.max(0, ...nos.map((n) => n.custo));
      expect(saldoMinimo + livres + prejuizos, `capítulo ${capitulo.numero}`).toBeGreaterThanOrEqual(maisCara);
      saldoMinimo += capitulo.missoes.reduce((s, m) => s + m.recompensa, 0) - nos.reduce((s, n) => s + n.custo, 0);
      expect(saldoMinimo, `saldo ao fim do capítulo ${capitulo.numero}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('salvar e carregar preserva progresso, mundo e credenciais', () => {
    const jogo = Jogo.novo();
    jogo.executar('db.almas.find()');
    jogo.protocolar();
    const volta = Jogo.carregar(JSON.parse(JSON.stringify(jogo.serializar())));
    expect(volta.progresso.carimbos).toBe(4);
    expect(volta.missaoAtual!.id).toBe('1.2');
    expect(volta.executar('db.almas.findOne()').execucao.ok).toBe(false);
  });
});
