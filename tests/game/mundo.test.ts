import { criarMundo, gerarFichasDaFase2, aplicarFase, Rng, IDS } from '../../src/game/mundo';
import { canonico } from '../../src/engine/bson';

describe('mundo', () => {
  it('Rng é determinístico', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 5 }, () => a.proximo())).toEqual(Array.from({ length: 5 }, () => b.proximo()));
  });

  it('fase 1 tem as 8 fichas escritas à mão, incluindo o antecessor', () => {
    const db = criarMundo(1);
    const almas = db.colecao('almas');
    expect(almas.countDocuments({})).toBe(8);
    expect(almas.findOne({ _id: IDS.aurelio })!.nome).toBe('Aurélio Vilaverde');
    expect(almas.distinct('setor')).toEqual(['Limbo', 'Purgatório']);
  });

  it('fase 2 é idêntica a cada geração', () => {
    expect(canonico(gerarFichasDaFase2())).toBe(canonico(gerarFichasDaFase2()));
  });

  it('fase 2 abre todos os setores e traz sujeira legada no Arquivo Morto', () => {
    const almas = criarMundo(2).colecao('almas');
    expect(almas.countDocuments({})).toBe(300);
    expect(almas.distinct('setor')).toHaveLength(5);
    expect(almas.countDocuments({ anos_pendentes: { $type: 'string' } })).toBeGreaterThan(5);
    expect(almas.countDocuments({ anos_pendentes: { $type: 'string' }, setor: { $ne: 'Arquivo Morto' } })).toBe(0);
    expect(almas.countDocuments({ endereco: { $exists: false } })).toBeGreaterThan(0);
    expect(almas.countDocuments({ pendencia: { $regex: / $/ } })).toBeGreaterThan(0);
  });

  it('aplicarFase é idempotente', () => {
    const db = criarMundo(2);
    aplicarFase(db, 2);
    expect(db.colecao('almas').countDocuments({})).toBe(300);
  });
});
