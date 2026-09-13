import {
  operadoresDaOperacao,
  estagiosDoPipeline,
  verificarCredencial,
  capituloDoOperador,
} from '../../src/engine/credenciais';
import { CredencialError } from '../../src/engine/errors';

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

  it('$sort muda de capítulo conforme o contexto', () => {
    expect(capituloDoOperador('$sort', 'crud')).toBe(5);
    expect(capituloDoOperador('$sort', 'agregacao')).toBe(8);
  });

  it('bloqueia operador de capítulo futuro', () => {
    expect(() => verificarCredencial({ metodo: 'aggregate', args: [[{ $unwind: '$audiencias' }]] }, 9)).toThrow(CredencialError);
    expect(() => verificarCredencial({ metodo: 'find', args: [{ setor: 'Limbo' }] }, 1)).not.toThrow();
    expect(() => verificarCredencial({ metodo: 'find', args: [{ anos: { $gt: 1 } }] }, 1)).toThrow(
      /'\$gt' não consta no seu nível de credenciamento \(exige: Capítulo 2\)/,
    );
  });
});
