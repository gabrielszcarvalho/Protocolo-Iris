import { Indice, nomeDoIndice } from '../../src/engine/indexes';

describe('Indice', () => {
  it('gera o nome no padrão do MongoDB', () => {
    expect(nomeDoIndice({ numero: 1 })).toBe('numero_1');
    expect(nomeDoIndice({ setor: 1, nome: -1 })).toBe('setor_1_nome_-1');
  });

  it('detecta conflito em índice único', () => {
    const idx = new Indice({ nome: 'numero_1', chave: { numero: 1 }, unico: true });
    const a = { numero: 'P-1' };
    idx.adicionar(a);
    expect(idx.conflito({ numero: 'P-1' })).toEqual({ numero: 'P-1' });
    expect(idx.conflito({ numero: 'P-2' })).toBeNull();
    // o próprio documento (update) não conflita consigo mesmo
    expect(idx.conflito({ numero: 'P-1' }, a)).toBeNull();
  });

  it('documento sem o campo conta como null', () => {
    const idx = new Indice({ nome: 'cpf_1', chave: { cpf: 1 }, unico: true });
    idx.adicionar({ nome: 'sem cpf' });
    expect(idx.conflito({ nome: 'outro sem cpf' })).toEqual({ cpf: null });
  });

  it('arrays geram várias chaves (multikey)', () => {
    const idx = new Indice({ nome: 'tags_1', chave: { tags: 1 }, unico: true });
    idx.adicionar({ tags: ['a', 'b'] });
    expect(idx.conflito({ tags: ['c', 'b'] })).toEqual({ tags: 'b' });
  });

  it('remover libera a chave', () => {
    const idx = new Indice({ nome: 'numero_1', chave: { numero: 1 }, unico: true });
    const a = { numero: 'P-1' };
    idx.adicionar(a);
    idx.remover(a);
    expect(idx.conflito({ numero: 'P-1' })).toBeNull();
  });

  it('índice não único nunca conflita', () => {
    const idx = new Indice({ nome: 'setor_1', chave: { setor: 1 }, unico: false });
    idx.adicionar({ setor: 'Limbo' });
    expect(idx.conflito({ setor: 'Limbo' })).toBeNull();
  });
});
