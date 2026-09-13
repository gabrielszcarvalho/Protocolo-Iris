import { planejar } from '../../src/engine/explain';
import { Indice } from '../../src/engine/indexes';

const docs = Array.from({ length: 100 }, (_, i) => ({ _id: i, setor: i < 10 ? 'Limbo' : 'Purgatório', n: i }));

function indice(campo: string) {
  const idx = new Indice({ nome: `${campo}_1`, chave: { [campo]: 1 }, unico: false });
  docs.forEach((d) => idx.adicionar(d));
  return idx;
}

describe('planejar', () => {
  it('sem índice no campo, examina a coleção inteira', () => {
    expect(planejar(docs, { setor: 'Limbo' }, [indice('_id')])).toEqual({ estagio: 'COLLSCAN', docsExaminados: 100 });
  });

  it('com índice, examina só os documentos do intervalo', () => {
    expect(planejar(docs, { setor: 'Limbo', n: { $gt: 5 } }, [indice('setor')])).toEqual({
      estagio: 'IXSCAN',
      indice: 'setor_1',
      docsExaminados: 10,
    });
  });

  it('escolhe o índice mais seletivo e olha dentro de $and', () => {
    const plano = planejar(docs, { $and: [{ setor: 'Purgatório' }, { _id: { $lt: 12 } }] }, [indice('setor'), indice('_id')]);
    expect(plano).toMatchObject({ indice: '_id_1', docsExaminados: 12 });
  });

  it('$or e $regex não usam índice nesta simulação', () => {
    expect(planejar(docs, { setor: { $regex: '^L' } }, [indice('setor')]).estagio).toBe('COLLSCAN');
  });
});
