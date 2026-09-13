import { IDBFactory } from 'fake-indexeddb';
import { Armazenamento, CHAVES } from '../../src/engine/persist';
import { Database } from '../../src/engine/database';
import { ObjectId } from '../../src/engine/bson';

describe('Armazenamento (IndexedDB)', () => {
  it('salva e carrega valores com tipos BSON', async () => {
    const arm = new Armazenamento(new IDBFactory());
    const id = new ObjectId('65a1b2c3d4e5f60718293a4b');
    await arm.salvar(CHAVES.progresso, { capitulo: 3, visto: new Date('2026-01-01'), id });
    const volta = await arm.carregar<{ capitulo: number; visto: Date; id: ObjectId }>(CHAVES.progresso);
    expect(volta!.capitulo).toBe(3);
    expect(volta!.visto).toBeInstanceOf(Date);
    expect(volta!.id.equals(id)).toBe(true);
  });

  it('chave inexistente devolve undefined e remover apaga', async () => {
    const arm = new Armazenamento(new IDBFactory());
    expect(await arm.carregar('nada')).toBeUndefined();
    await arm.salvar('x', [1, 2]);
    await arm.remover('x');
    expect(await arm.carregar('x')).toBeUndefined();
  });

  it('salva e restaura o banco inteiro com validador e índices', async () => {
    const arm = new Armazenamento(new IDBFactory());
    const db = new Database();
    db.createCollection('protocolos', { validator: { $jsonSchema: { required: ['numero'] } } });
    db.colecao('protocolos').insertOne({ numero: 'P-1', criado: new Date('1950-05-05') });
    db.colecao('protocolos').createIndex({ numero: 1 }, { unique: true });
    await arm.salvarBanco(CHAVES.mundo, db);

    const volta = (await arm.carregarBanco(CHAVES.mundo))!;
    const p = volta.colecao('protocolos');
    expect(p.findOne({})!.criado).toBeInstanceOf(Date);
    expect(() => p.insertOne({ numero: 'P-1' })).toThrow(/E11000/);
    expect(() => p.insertOne({ semNumero: true })).toThrow(/Document failed validation/);
  });
});
