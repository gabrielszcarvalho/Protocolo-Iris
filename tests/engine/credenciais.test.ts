import { operadoresDaOperacao, estagiosDoPipeline, chavesDaOperacao, chaveDoOperador } from '../../src/engine/credenciais';

describe('credenciais', () => {
  it('coleta operadores de filtro, opções e regex literal', () => {
    const ops = operadoresDaOperacao({
      colecao: 'almas',
      metodo: 'updateMany',
      args: [{ nome: /vila/i, anos: { $gt: 3 } }, { $set: { 'audiencias.$[a].parecer': 'C' } }, { arrayFilters: [{ 'a.peso': { $gt: 45 } }] }],
    });
    expect(ops).toEqual(expect.arrayContaining(['updateMany', '$regex', '$gt', '$set', '$[<apelido>]', 'arrayFilters']));
  });

  it('detecta o posicional $', () => {
    const ops = operadoresDaOperacao({ metodo: 'updateOne', args: [{}, { $set: { 'vinculos.$': 'x' } }] });
    expect(ops).toContain('$ (posicional)');
  });

  it('lista os estágios do pipeline na ordem', () => {
    expect(
      estagiosDoPipeline({ metodo: 'aggregate', args: [[{ $match: {} }, { $match: {} }, { $group: { _id: null } }]] }),
    ).toEqual(['$match', '$match', '$group']);
  });

  it('o mesmo nome vira outra credencial dentro de aggregate', () => {
    expect(chaveDoOperador('$sort', 'crud')).toBe('$sort');
    expect(chaveDoOperador('$sort', 'agregacao')).toBe('$sort@agregacao');
    expect(chaveDoOperador('$gt', 'agregacao')).toBe('$gt');
  });

  it('chavesDaOperacao remove repetições e mantém a ordem', () => {
    const chaves = chavesDaOperacao({ metodo: 'aggregate', args: [[{ $match: { a: { $gt: 1 }, b: { $gt: 2 } } }, { $sort: { a: 1 } }]] });
    expect(chaves.map((c) => c.chave)).toEqual(['aggregate', '$match', '$gt', '$sort@agregacao']);
  });
});
