/**
 * Toda missão, jogada na ordem da campanha (o mundo de cada uma é o resultado das soluções de
 * referência de todas as anteriores, com as fases aplicadas ao abrir cada capítulo):
 *  - a solução de referência passa e marca TODOS os quadradinhos de "A entregar";
 *  - consultas de referência devolvem alguma coisa (dados de teste que não servem são bug);
 *  - cada erro comum é rejeitado com diagnóstico e deixa pelo menos um quadradinho desmarcado.
 * Para ler os diagnósticos gerados: MOSTRAR_MOTIVOS=caminho/arquivo.txt npx vitest run tests/game/missoes.test.ts
 */

import { appendFileSync } from 'node:fs';
import { CAPITULOS, TODAS_AS_MISSOES, type Missao } from '../../src/game/missoes';
import { aplicarFase, criarMundo } from '../../src/game/mundo';
import { montarContexto } from '../../src/game/validacao';
import { NO_POR_ID } from '../../src/game/arvore';
import { Sessao } from '../../src/engine/shell';
import type { Database } from '../../src/engine/database';

let mundos: Map<string, Database> | undefined;

function mundoAntesDe(missao: Missao): Database {
  if (!mundos) {
    mundos = new Map();
    const db = criarMundo(1);
    for (const capitulo of CAPITULOS) {
      aplicarFase(db, capitulo.fase);
      for (const m of capitulo.missoes) {
        mundos.set(m.id, db.clonar());
        const s = new Sessao(db);
        if (m.anexo) s.executar(m.anexo.codigo);
        s.executar(m.solucaoReferencia);
        db.historico.length = 0;
      }
    }
  }
  return mundos.get(missao.id)!.clonar();
}

function rodar(missao: Missao, codigo: string) {
  const db = mundoAntesDe(missao);
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
  return { execucao: r, validacao: missao.validar(ctx), marcas: missao.objetivos.map((o) => o.conferir(ctx)) };
}

for (const capitulo of CAPITULOS) {
  describe(`Capítulo ${capitulo.numero} — ${capitulo.titulo}`, () => {
    for (const missao of capitulo.missoes) {
      describe(`${missao.id} ${missao.titulo}`, () => {
        it('a solução de referência passa e marca todos os quadradinhos', () => {
          const r = rodar(missao, missao.solucaoReferencia);
          expect(r.validacao, r.execucao.saida.map((l) => l.texto).join('\n')).toEqual({ ok: true });
          expect(r.marcas).toEqual(missao.objetivos.map(() => true));
          if (missao.tipo === 'consulta') {
            const v = r.execucao.valor;
            expect(Array.isArray(v) ? v.length : v, 'a referência não pode voltar vazia').toBeTruthy();
          }
        });

        it('tem objetivos, erros comuns, três dicas e credenciais do próprio capítulo ou anteriores', () => {
          expect(missao.objetivos.length).toBeGreaterThan(0);
          expect(missao.solucoesErradas.length).toBeGreaterThan(0);
          expect(missao.dicas).toHaveLength(3);
          for (const id of missao.requer) expect(NO_POR_ID.get(id)!.capitulo, `${missao.id} → ${id}`).toBeLessThanOrEqual(capitulo.numero);
          for (const id of missao.depoisDe ?? []) expect(TODAS_AS_MISSOES.findIndex((m) => m.id === id)).toBeLessThan(TODAS_AS_MISSOES.indexOf(missao));
        });

        for (const errada of missao.solucoesErradas) {
          it(`rejeita e deixa quadradinho desmarcado: ${errada.porque}`, () => {
            const r = rodar(missao, errada.codigo);
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
  const missao = (id: string) => TODAS_AS_MISSOES.find((m) => m.id === id)!;

  it('1.2 aponta o _id sobrando', () => {
    expect(rodar(missao('1.2'), 'db.almas.find({}, { nome: 1, setor: 1 })').validacao.motivo).toMatch(/Esperado: nome, setor\. Veio: _id, nome, setor/);
  });

  it('1.4 explica find x findOne', () => {
    expect(rodar(missao('1.4'), "db.almas.find({ nome: 'Aurélio Vilaverde' })").validacao.motivo).toMatch(/findOne devolve a ficha/);
  });

  it('1.7 exige insertMany', () => {
    expect(rodar(missao('1.7'), missao('1.7').solucoesErradas[0].codigo).validacao.motivo).toMatch(/use insertMany/);
  });

  it('1.8 lista quem faltou registrar', () => {
    expect(rodar(missao('1.8'), 'db.almas.insertMany(lote)').validacao.motivo).toMatch(/Faltam registrar: Macário Bittencourt, Noêmia Pacheco, Olegário Moura/);
  });

  it('2.3 identifica o valor-limite', () => {
    expect(rodar(missao('2.3'), 'db.almas.find({ anos_pendentes: { $gte: 60 } })').validacao.motivo).toMatch(/anos_pendentes: 60/);
  });

  it('2.8 marca qual metade do filtro sumiu', () => {
    expect(rodar(missao('2.8'), missao('2.8').solucoesErradas[0].codigo).marcas).toEqual([false, true, true]);
  });

  it('3.4 explica o falso positivo', () => {
    const r = rodar(missao('3.4'), "db.almas.find({ 'audiencias.parecer': 'C', 'audiencias.peso': { $gt: 30 } })");
    expect(r.validacao.motivo).toMatch(/audiências DIFERENTES/);
    expect(r.marcas).toEqual([true, false]);
  });
});
