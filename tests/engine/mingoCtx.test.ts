import { criarQuery, criarAggregator } from '../../src/engine/mingoCtx';
import { ObjectId } from '../../src/engine/bson';

const almas = [
  { _id: 1, anos: 37, setor: 'Limbo', audiencias: [{ peso: 10 }, { peso: '40' }] },
  { _id: 2, anos: '12', setor: 'Arquivo Morto', audiencias: [] },
  { _id: 3, anos: 2.5, setor: 'Limbo' },
  { _id: new ObjectId('65a1b2c3d4e5f60718293a4b'), setor: 'Ante-Sala' },
];

const ids = (filtro: Record<string, unknown>) =>
  almas.filter((d) => criarQuery(filtro).test(d)).map((d) => String(d._id));

describe('contexto do mingo', () => {
  it('$type distingue int de double', () => {
    expect(ids({ anos: { $type: 'int' } })).toEqual(['1']);
    expect(ids({ anos: { $type: 'double' } })).toEqual(['3']);
    expect(ids({ anos: { $type: 'number' } })).toEqual(['1', '3']);
    expect(ids({ anos: { $type: 'string' } })).toEqual(['2']);
    expect(ids({ anos: { $type: 2 } })).toEqual(['2']);
  });

  it('$type olha dentro de arrays e reconhece objectId', () => {
    expect(ids({ 'audiencias.peso': { $type: 'string' } })).toEqual(['1']);
    expect(ids({ audiencias: { $type: 'array' } })).toEqual(['1', '2']);
    expect(ids({ _id: { $type: 'objectId' } })).toEqual(['65a1b2c3d4e5f60718293a4b']);
  });

  it('$type com alias inválido gera erro', () => {
    expect(() => criarQuery({ anos: { $type: 'inteiro' } })).toThrow(/Unknown type name alias/);
  });

  it('$jsonSchema + $nor faz a auditoria de documentos inválidos', () => {
    const schema = { required: ['anos'], properties: { anos: { bsonType: 'int' } } };
    expect(ids({ $nor: [{ $jsonSchema: schema }] })).toEqual(['2', '3', '65a1b2c3d4e5f60718293a4b']);
  });

  it('operadores padrão continuam disponíveis', () => {
    expect(ids({ setor: { $in: ['Limbo'] }, anos: { $gte: 30 } })).toEqual(['1']);
  });

  it('$where fica desligado', () => {
    expect(() => criarQuery({ $where: 'true' }).test({})).toThrow();
  });

  it('aggregate usa o mesmo contexto', () => {
    const r = criarAggregator([
      { $match: { setor: 'Limbo' } },
      { $group: { _id: '$setor', total: { $sum: 1 } } },
    ]).run(almas);
    expect(r).toEqual([{ _id: 'Limbo', total: 2 }]);
  });
});
