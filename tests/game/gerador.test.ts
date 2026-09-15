import { criarMundo } from '../../src/game/mundo';
import { RAIZ, TODAS_AS_CREDENCIAIS } from '../../src/game/arvore';
import { ASSUNTOS_TREINO, gerarMemorando } from '../../src/game/gerador';
import { MesaDeMemorando, SalaDeTreino } from '../../src/game/treino';

const mundo = criarMundo(4);
const todas = () => TODAS_AS_CREDENCIAIS;

describe('Gerador de memorandos de treino', () => {
  for (const { id: assunto } of ASSUNTOS_TREINO) {
    it(`${assunto}: a referência passa e marca tudo; resposta vazia ou nada feito é recusado`, () => {
      const vistos = new Set<string>();
      for (let semente = 1; semente <= 12; semente++) {
        const gerado = gerarMemorando(mundo, TODAS_AS_CREDENCIAIS, { id: `T-${semente}`, semente, assunto });
        expect(gerado, `semente ${semente}`).not.toBeNull();
        const { missao } = gerado!;
        vistos.add(missao.solucaoReferencia);
        expect(missao.dicas[2]).toBe(missao.solucaoReferencia);

        const certa = new MesaDeMemorando(mundo, missao, todas);
        expect(certa.executar(missao.solucaoReferencia).execucao.ok, missao.solucaoReferencia).toBe(true);
        const r = certa.protocolar();
        expect(r.validacao, missao.solucaoReferencia).toEqual({ ok: true });
        expect(r.marcas.every(Boolean)).toBe(true);

        const errada = new MesaDeMemorando(mundo, missao, todas);
        if (missao.tipo === 'consulta') errada.executar("db.almas.find({ nome: 'Ninguém com este nome' })");
        const e = errada.protocolar();
        expect(e.validacao.ok, missao.solucaoReferencia).toBe(false);
        expect(e.validacao.motivo).toBeTruthy();
        expect(e.marcas).toContain(false);
      }
      expect(vistos.size, 'o sorteio precisa variar').toBeGreaterThan(4);
    });
  }

  it('só gera o que as credenciais do jogador permitem', () => {
    const inicio = criarMundo(1);
    for (let semente = 1; semente <= 10; semente++) {
      const gerado = gerarMemorando(inicio, new Set([RAIZ]), { id: 'T', semente });
      if (!gerado) continue;
      const mesa = new MesaDeMemorando(inicio, gerado.missao, () => new Set([RAIZ]));
      expect(mesa.executar(gerado.missao.solucaoReferencia).execucao.ok, gerado.missao.solucaoReferencia).toBe(true);
    }
    expect(gerarMemorando(inicio, new Set([RAIZ]), { id: 'T', semente: 1, assunto: 'relatorios' })).toBeNull();
  });
});

describe('Sala de Treino com vários memorandos', () => {
  it('cada memorando tem o próprio arquivo: uma alteração nunca aparece em outro', () => {
    const sala = new SalaDeTreino(mundo, todas);
    sala.todasAsCredenciais = true;
    const total = mundo.colecao('almas').docs.length;
    const a = sala.gerar('consultas', 1)!;
    const b = sala.gerar('gravacoes', 2)!;
    expect(sala.memorandos).toHaveLength(2);
    expect(sala.ativo).toBe(b);

    sala.abrir(a.missao.id);
    sala.executar('db.almas.deleteMany({})');
    expect(sala.mundo.colecao('almas').docs).toHaveLength(0);

    sala.abrir(b.missao.id);
    expect(sala.mundo.colecao('almas').docs).toHaveLength(total);
    sala.abrir(null);
    expect(sala.mundo.colecao('almas').docs).toHaveLength(total);
    expect(mundo.colecao('almas').docs).toHaveLength(total);

    // restaurar vale só para o arquivo aberto
    sala.abrir(a.missao.id);
    sala.reiniciar();
    expect(sala.mundo.colecao('almas').docs).toHaveLength(total);
  });

  it('pular troca no mesmo lugar e descartar fecha o memorando', () => {
    const sala = new SalaDeTreino(mundo, todas);
    sala.todasAsCredenciais = true;
    const a = sala.gerar('arrays', 10)!;
    const b = sala.gerar('regex', 11)!;
    sala.abrir(a.missao.id);
    const c = sala.pular(12)!;
    expect(sala.memorandos.map((m) => m.missao.id)).toEqual([c.missao.id, b.missao.id]);
    expect(c.assunto).toBe('arrays');
    expect(sala.ativo).toBe(c);

    sala.descartar(c.missao.id);
    expect(sala.memorandos).toEqual([b]);
    expect(sala.ativo).toBe(b);
    sala.descartar(b.missao.id);
    expect(sala.ativo).toBeNull();
  });
});
