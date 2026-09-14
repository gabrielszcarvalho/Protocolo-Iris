/**
 * Toda missão:
 *  - a solução de referência passa e marca TODOS os quadradinhos de "A entregar";
 *  - cada erro comum é rejeitado com diagnóstico e deixa pelo menos um quadradinho desmarcado
 *    (senão o jogador veria "tudo certo" numa resposta errada).
 * Para ler os diagnósticos gerados: MOSTRAR_MOTIVOS=caminho/arquivo.txt npx vitest run tests/game/missoes.test.ts
 */

import { appendFileSync } from 'node:fs';
import { CAPITULOS, type Missao } from '../../src/game/missoes';
import { criarMundo } from '../../src/game/mundo';
import { montarContexto } from '../../src/game/validacao';
import { Sessao } from '../../src/engine/shell';

function rodar(missao: Missao, fase: number, codigo: string) {
  const db = criarMundo(fase);
  const inicio = db.clonar();
  const sessao = new Sessao(db);
  if (missao.anexo) sessao.executar(missao.anexo.codigo);
  const antes = db.historico.length;
  const r = sessao.executar(codigo);
  const ctx = montarContexto({
    tipo: missao.tipo,
    codigoReferencia: missao.solucaoReferencia,
    anexo: missao.anexo?.codigo,
    resultado: r.valor,
    execucaoOk: r.ok,
    operacoes: r.operacoes,
    historicoMissao: db.historico.slice(antes),
    mundoInicio: inicio,
    mundo: db,
  });
  return { validacao: missao.validar(ctx), marcas: missao.objetivos.map((o) => o.conferir(ctx)) };
}

for (const capitulo of CAPITULOS) {
  describe(`Capítulo ${capitulo.numero} — ${capitulo.titulo}`, () => {
    for (const missao of capitulo.missoes) {
      describe(`${missao.id} ${missao.titulo}`, () => {
        it('a solução de referência passa e marca todos os quadradinhos', () => {
          const r = rodar(missao, capitulo.fase, missao.solucaoReferencia);
          expect(r.validacao).toEqual({ ok: true });
          expect(r.marcas).toEqual(missao.objetivos.map(() => true));
        });

        it('tem objetivos, pelo menos um erro comum cadastrado e três dicas', () => {
          expect(missao.objetivos.length).toBeGreaterThan(0);
          expect(missao.solucoesErradas.length).toBeGreaterThan(0);
          expect(missao.dicas).toHaveLength(3);
        });

        for (const errada of missao.solucoesErradas) {
          it(`rejeita e deixa quadradinho desmarcado: ${errada.porque}`, () => {
            const r = rodar(missao, capitulo.fase, errada.codigo);
            if (process.env.MOSTRAR_MOTIVOS) {
              appendFileSync(process.env.MOSTRAR_MOTIVOS, `[${missao.id}] ${errada.porque}\n   → ${r.validacao.motivo}\n   ☐ ${r.marcas.map((m) => (m ? '✓' : '✗')).join(' ')}\n`);
            }
            expect(r.validacao.ok).toBe(false);
            expect(r.validacao.motivo).toBeTruthy();
            expect(r.marcas).toContain(false);
          });
        }
      });
    }
  });
}

describe('diagnósticos específicos', () => {
  const cap = (n: number) => CAPITULOS[n - 1];
  const missao = (id: string) => CAPITULOS.flatMap((c) => c.missoes).find((m) => m.id === id)!;

  it('1.2 aponta o _id sobrando', () => {
    expect(rodar(missao('1.2'), 1, 'db.almas.find({}, { nome: 1, setor: 1 })').validacao.motivo).toMatch(/Esperado: nome, setor\. Veio: _id, nome, setor/);
  });

  it('1.4 explica find x findOne', () => {
    expect(rodar(missao('1.4'), 1, "db.almas.find({ nome: 'Aurélio Vilaverde' })").validacao.motivo).toMatch(/findOne devolve a ficha/);
  });

  it('1.7 exige insertMany', () => {
    expect(rodar(missao('1.7'), 1, cap(1).missoes[6].solucoesErradas[0].codigo).validacao.motivo).toMatch(/use insertMany/);
  });

  it('1.8 lista quem faltou registrar', () => {
    expect(rodar(missao('1.8'), 1, 'db.almas.insertMany(lote)').validacao.motivo).toMatch(/Faltam registrar: Macário Bittencourt, Noêmia Pacheco, Olegário Moura/);
  });

  it('2.3 identifica o valor-limite', () => {
    expect(rodar(missao('2.3'), 2, 'db.almas.find({ anos_pendentes: { $gte: 60 } })').validacao.motivo).toMatch(/anos_pendentes: 60/);
  });

  it('2.8 marca qual metade do filtro sumiu', () => {
    const r = rodar(missao('2.8'), 2, cap(2).missoes[7].solucoesErradas[0].codigo);
    expect(r.marcas).toEqual([false, true, true]);
  });

  it('3.4 explica o falso positivo', () => {
    const r = rodar(missao('3.4'), 2, "db.almas.find({ 'audiencias.parecer': 'C', 'audiencias.peso': { $gt: 30 } })");
    expect(r.validacao.motivo).toMatch(/audiências DIFERENTES/);
    expect(r.marcas).toEqual([true, false]);
  });
});
