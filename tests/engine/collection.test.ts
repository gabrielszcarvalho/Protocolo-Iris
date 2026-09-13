import { Database } from '../../src/engine/database';
import { ObjectId } from '../../src/engine/bson';
import { MongoBulkWriteError, MongoServerError, ErroShell } from '../../src/engine/errors';
import { estagiosDoPipeline } from '../../src/engine/credenciais';

function mundo() {
  const db = new Database();
  db.colecao('almas').insertMany([
    { _id: 1, nome: 'Iracema Vilaverde', setor: 'Limbo', anos: 37, vinculos: ['mãe', 'sindicalista'], audiencias: [{ parecer: 'Z', peso: 50 }, { parecer: 'Z', peso: 10 }], endereco: { cep: '01000-000' } },
    { _id: 2, nome: 'Odorico Paz', setor: 'Purgatório', anos: 12, vinculos: ['poeta'], audiencias: [{ parecer: 'A', peso: 5 }] },
    { _id: 3, nome: 'Benedita Sousa', setor: 'Arquivo Morto', anos: '40', vinculos: [], audiencias: [] },
    { _id: 4, nome: 'Zulmira Reis', setor: 'Limbo', anos: 2, vinculos: ['mãe'], audiencias: [{ parecer: 'C', peso: 31 }] },
  ]);
  db.historico.length = 0;
  return db;
}

const erroDe = (fn: () => unknown): ErroShell => {
  try {
    fn();
  } catch (e) {
    return e as ErroShell;
  }
  throw new Error('esperava erro');
};

describe('insert', () => {
  it('insertOne gera ObjectId quando falta _id e o coloca primeiro', () => {
    const db = new Database();
    const r = db.colecao('arquivistas').insertOne({ nome: 'Você' });
    expect(r.insertedId).toBeInstanceOf(ObjectId);
    expect(Object.keys(db.colecao('arquivistas').findOne()!)).toEqual(['_id', 'nome']);
    expect(db.getCollectionNames()).toEqual(['arquivistas']);
  });

  it('insertOne não guarda referência ao objeto do jogador', () => {
    const db = new Database();
    const doc = { nome: 'A', lista: [1] };
    db.colecao('x').insertOne(doc);
    doc.lista.push(2);
    expect(db.colecao('x').findOne()!.lista).toEqual([1]);
  });

  it('insertMany ordenado para no primeiro erro', () => {
    const db = mundo();
    const e = erroDe(() => db.colecao('almas').insertMany([{ _id: 10 }, { _id: 1 }, { _id: 11 }]));
    expect(e).toBeInstanceOf(MongoBulkWriteError);
    expect(e.message).toBe('E11000 duplicate key error collection: iris.almas index: _id_ dup key: { _id: 1 }');
    expect((e as MongoBulkWriteError).result.insertedCount).toBe(1);
    expect(db.colecao('almas').countDocuments({ _id: 11 })).toBe(0);
  });

  it('insertMany com ordered:false insere todos os válidos', () => {
    const db = mundo();
    const e = erroDe(() => db.colecao('almas').insertMany([{ _id: 10 }, { _id: 1 }, { _id: 11 }], { ordered: false }));
    expect((e as MongoBulkWriteError).result.insertedCount).toBe(2);
    expect(db.colecao('almas').countDocuments({})).toBe(6);
  });

  it('insertMany exige array', () => {
    expect(erroDe(() => new Database().colecao('x').insertMany({ a: 1 })).message).toMatch(/must be an array/);
  });
});

describe('find', () => {
  it('filtra, ordena, pula e limita (sempre sort → skip → limit)', () => {
    const db = mundo();
    const nomes = db.colecao('almas').find({}, { nome: 1, _id: 0 }).limit(2).skip(1).sort({ nome: 1 }).toArray();
    expect(nomes).toEqual([{ nome: 'Iracema Vilaverde' }, { nome: 'Odorico Paz' }]);
  });

  it('projeção exclusiva e dot notation', () => {
    const db = mundo();
    const [doc] = db.colecao('almas').find({ 'endereco.cep': '01000-000' }, { audiencias: 0, vinculos: 0 }).toArray();
    expect(Object.keys(doc)).toEqual(['_id', 'nome', 'setor', 'anos', 'endereco']);
  });

  it('projeção mista gera o erro do servidor', () => {
    const e = erroDe(() => mundo().colecao('almas').find({}, { nome: 1, setor: 0 }));
    expect(e.message).toBe('Cannot do exclusion on field setor in inclusion projection');
  });

  it('sort com valor inválido', () => {
    const e = erroDe(() => mundo().colecao('almas').find().sort({ nome: 2 }));
    expect(e.message).toBe('$sort key ordering must be 1 (for ascending) or -1 (for descending)');
  });

  it('operador desconhecido', () => {
    const e = erroDe(() => mundo().colecao('almas').find({ anos: { $maior: 1 } }).toArray());
    expect(e.message).toMatch(/unknown operator: \$maior/);
  });

  it('$elemMatch não dá falso positivo, dot notation cruzada dá', () => {
    const almas = mundo().colecao('almas');
    expect(almas.countDocuments({ 'audiencias.parecer': 'Z', 'audiencias.peso': { $lt: 20, $gt: 5 } })).toBe(1);
    expect(almas.countDocuments({ audiencias: { $elemMatch: { parecer: 'C', peso: { $gt: 30 } } } })).toBe(1);
    expect(almas.countDocuments({ 'audiencias.parecer': 'A', 'audiencias.peso': { $gt: 30 } })).toBe(0);
  });

  it('$type distingue string legada', () => {
    expect(mundo().colecao('almas').find({ anos: { $type: 'string' } }, { _id: 1 }).toArray()).toEqual([{ _id: 3 }]);
  });

  it('findOne, countDocuments e distinct', () => {
    const almas = mundo().colecao('almas');
    expect(almas.findOne({ setor: 'Nada' })).toBeNull();
    expect(almas.countDocuments({ setor: 'Limbo' })).toBe(2);
    expect(almas.distinct('vinculos')).toEqual(['mãe', 'poeta', 'sindicalista']);
  });

  it('coleção inexistente devolve vazio sem ser criada', () => {
    const db = mundo();
    expect(db.colecao('fantasma').find().toArray()).toEqual([]);
    expect(db.getCollectionNames()).toEqual(['almas']);
  });

  it('registra plano (docsExaminados) e encadeamento no histórico', () => {
    const db = mundo();
    db.colecao('almas').find({ _id: 2 }).sort({ nome: 1 }).toArray();
    const registro = db.historico.find((r) => r.metodo === 'find')!;
    expect(registro.plano).toMatchObject({ estagio: 'IXSCAN', docsExaminados: 1 });
    expect(registro.encadeamento).toEqual([{ metodo: 'sort', args: [{ nome: 1 }] }]);
  });
});

describe('update', () => {
  it('updateMany com $set, $inc e resultado no formato do mongosh', () => {
    const db = mundo();
    const r = db.colecao('almas').updateMany({ setor: 'Limbo' }, { $inc: { anos: 1 }, $set: { revisado: true } });
    expect(r).toEqual({ acknowledged: true, insertedId: null, matchedCount: 2, modifiedCount: 2, upsertedCount: 0 });
    expect(db.colecao('almas').findOne({ _id: 4 })).toMatchObject({ anos: 3, revisado: true });
  });

  it('modifiedCount não conta documento que já estava igual', () => {
    const r = mundo().colecao('almas').updateMany({}, { $set: { setor: 'Limbo' } });
    expect(r).toMatchObject({ matchedCount: 4, modifiedCount: 2 });
  });

  it('exige operadores de update', () => {
    expect(erroDe(() => mundo().colecao('almas').updateOne({ _id: 1 }, { setor: 'x' })).message).toBe('Update document requires atomic operators');
  });

  it('$inc em campo string gera TypeMismatch', () => {
    const e = erroDe(() => mundo().colecao('almas').updateOne({ _id: 3 }, { $inc: { anos: 1 } }));
    expect(e.message).toBe("Cannot apply $inc to a value of non-numeric type. {_id: 3} has the field 'anos' of non-numeric type string");
  });

  it('$unset, $rename, $mul, $min, $max, $currentDate', () => {
    const db = mundo();
    const almas = db.colecao('almas');
    almas.updateOne({ _id: 1 }, { $unset: { 'endereco.cep': '' }, $rename: { anos: 'anos_pendentes' }, $currentDate: { retificadoEm: true } });
    almas.updateOne({ _id: 2 }, { $mul: { anos: 1.5 } });
    almas.updateOne({ _id: 4 }, { $max: { anos: 10 } });
    const [a, b, d] = [almas.findOne({ _id: 1 })!, almas.findOne({ _id: 2 })!, almas.findOne({ _id: 4 })!];
    expect(a.endereco).toEqual({});
    expect(a.anos_pendentes).toBe(37);
    expect(a.retificadoEm).toBeInstanceOf(Date);
    expect(b.anos).toBe(18);
    expect(d.anos).toBe(10);
    almas.updateOne({ _id: 4 }, { $min: { anos: 3 } });
    expect(almas.findOne({ _id: 4 })!.anos).toBe(3);
  });

  it('_id é imutável', () => {
    expect(erroDe(() => mundo().colecao('almas').updateOne({ _id: 1 }, { $set: { _id: 99 } })).codeName).toBe('ImmutableField');
  });

  it('upsert cria com os campos de igualdade do filtro e $setOnInsert', () => {
    const db = mundo();
    const almas = db.colecao('almas');
    const r = almas.updateOne({ protocolo: 'A-2025-0001', setor: 'Limbo' }, { $set: { nome: 'Nova' }, $setOnInsert: { anos: 0 } }, { upsert: true });
    expect(r.upsertedCount).toBe(1);
    expect(almas.findOne({ protocolo: 'A-2025-0001' }, { _id: 0 })).toEqual({ protocolo: 'A-2025-0001', setor: 'Limbo', nome: 'Nova', anos: 0 });
    // segunda vez: casa, não duplica, $setOnInsert não se aplica
    const r2 = almas.updateOne({ protocolo: 'A-2025-0001', setor: 'Limbo' }, { $set: { nome: 'Nova' }, $setOnInsert: { anos: 99 } }, { upsert: true });
    expect(r2).toMatchObject({ matchedCount: 1, modifiedCount: 0, upsertedCount: 0 });
    expect(almas.countDocuments({ protocolo: 'A-2025-0001' })).toBe(1);
  });

  it('update com pipeline converte tipo legado', () => {
    const db = mundo();
    db.colecao('almas').updateMany({ anos: { $type: 'string' } }, [{ $set: { anos: { $toInt: '$anos' } } }]);
    expect(db.colecao('almas').findOne({ _id: 3 })!.anos).toBe(40);
  });
});

describe('arrays', () => {
  it('$push com $each, $position, $sort e $slice', () => {
    const db = mundo();
    db.colecao('almas').updateOne({ _id: 1 }, { $push: { vinculos: { $each: ['zelador', 'avó'], $position: 0, $sort: 1, $slice: 3 } } });
    expect(db.colecao('almas').findOne({ _id: 1 })!.vinculos).toEqual(['avó', 'mãe', 'sindicalista']);
  });

  it('$addToSet não duplica nem dentro do $each', () => {
    const db = mundo();
    db.colecao('almas').updateOne({ _id: 2 }, { $addToSet: { vinculos: { $each: ['poeta', 'ator', 'ator'] } } });
    expect(db.colecao('almas').findOne({ _id: 2 })!.vinculos).toEqual(['poeta', 'ator']);
  });

  it('$pull e $pop', () => {
    const db = mundo();
    const almas = db.colecao('almas');
    almas.updateMany({ setor: 'Limbo' }, { $pull: { vinculos: 'mãe' } });
    almas.updateOne({ _id: 1 }, { $pop: { audiencias: -1 } });
    expect(almas.findOne({ _id: 4 })!.vinculos).toEqual([]);
    expect(almas.findOne({ _id: 1 })!.audiencias).toEqual([{ parecer: 'Z', peso: 10 }]);
  });

  it('$push em campo que não é array', () => {
    expect(erroDe(() => mundo().colecao('almas').updateOne({ _id: 1 }, { $push: { nome: 'x' } })).message).toMatch(/must be an array but is of type string/);
  });

  it('posicional $ altera só o primeiro elemento que casou', () => {
    const db = mundo();
    db.colecao('almas').updateOne({ _id: 1, 'audiencias.parecer': 'Z' }, { $set: { 'audiencias.$.parecer': 'C' } });
    expect(db.colecao('almas').findOne({ _id: 1 })!.audiencias).toEqual([{ parecer: 'C', peso: 50 }, { parecer: 'Z', peso: 10 }]);
  });

  it('posicional $ sem o array no filtro', () => {
    expect(erroDe(() => mundo().colecao('almas').updateOne({ _id: 1 }, { $set: { 'audiencias.$.parecer': 'C' } })).message).toBe(
      'The positional operator did not find the match needed from the query.',
    );
  });

  it('arrayFilters altera todos os elementos que casam', () => {
    const db = mundo();
    db.colecao('almas').updateMany({}, { $set: { 'audiencias.$[a].parecer': 'C' } }, { arrayFilters: [{ 'a.parecer': 'Z' }] });
    expect(db.colecao('almas').findOne({ _id: 1 })!.audiencias).toEqual([{ parecer: 'C', peso: 50 }, { parecer: 'C', peso: 10 }]);
  });

  it('$[apelido] sem arrayFilters', () => {
    expect(erroDe(() => mundo().colecao('almas').updateMany({}, { $set: { 'audiencias.$[a].parecer': 'C' } })).message).toBe(
      "No array filter found for identifier 'a' in path 'audiencias.$[a].parecer'",
    );
  });
});

describe('replace e delete', () => {
  it('replaceOne mantém _id e apaga campos não informados', () => {
    const db = mundo();
    const r = db.colecao('almas').replaceOne({ _id: 2 }, { nome: 'Odorico' });
    expect(r).toMatchObject({ matchedCount: 1, modifiedCount: 1 });
    expect(db.colecao('almas').findOne({ _id: 2 })).toEqual({ _id: 2, nome: 'Odorico' });
  });

  it('replaceOne recusa operadores', () => {
    expect(erroDe(() => mundo().colecao('almas').replaceOne({ _id: 2 }, { $set: { a: 1 } })).message).toBe(
      'Replacement document must not contain atomic operators',
    );
  });

  it('deleteOne, deleteMany e drop', () => {
    const db = mundo();
    const almas = db.colecao('almas');
    expect(almas.deleteOne({ setor: 'Limbo' })).toEqual({ acknowledged: true, deletedCount: 1 });
    // '40' (string legada) não entra em $gt: 10 — comparação só entre números
    expect(almas.deleteMany({ anos: { $gt: 10 } }).deletedCount).toBe(1);
    expect(almas.countDocuments({})).toBe(2);
    expect(almas.drop()).toBe(true);
    expect(db.getCollectionNames()).toEqual([]);
    expect(db.colecao('almas').drop()).toBe(false);
  });

  it('deleteMany sem filtro exige {} explícito', () => {
    expect(erroDe(() => mundo().colecao('almas').deleteMany()).message).toMatch(/Missing required argument/);
  });

  it('deletar libera a chave do índice único', () => {
    const db = mundo();
    db.colecao('almas').deleteOne({ _id: 1 });
    expect(() => db.colecao('almas').insertOne({ _id: 1 })).not.toThrow();
  });
});

describe('aggregate', () => {
  it('match → group → match → sort → project', () => {
    const r = mundo()
      .colecao('almas')
      .aggregate([
        { $match: { anos: { $type: 'number' } } },
        { $group: { _id: '$setor', total: { $sum: 1 } } },
        { $match: { total: { $gte: 1 } } },
        { $sort: { total: -1, _id: 1 } },
        { $project: { _id: 0, setor: '$_id', total: 1 } },
      ])
      .toArray();
    expect(r).toEqual([{ total: 2, setor: 'Limbo' }, { total: 1, setor: 'Purgatório' }]);
  });

  it('$unwind + $group com $avg ignora string', () => {
    const r = mundo()
      .colecao('almas')
      .aggregate([{ $unwind: '$audiencias' }, { $group: { _id: '$audiencias.parecer', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      .toArray();
    expect(r).toEqual([{ _id: 'A', n: 1 }, { _id: 'C', n: 1 }, { _id: 'Z', n: 2 }]);
  });

  it('erros de pipeline', () => {
    const almas = mundo().colecao('almas');
    expect(erroDe(() => almas.aggregate({ $match: {} })).message).toMatch(/must be an array/);
    expect(erroDe(() => almas.aggregate([{ $match: {}, $sort: { a: 1 } }])).message).toMatch(/exactly one field/);
    expect(erroDe(() => almas.aggregate([{ $agrupar: {} }])).message).toBe("Unrecognized pipeline stage name: '$agrupar'");
    expect(erroDe(() => almas.aggregate([{ $unwind: 'audiencias' }])).message).toMatch(/prefixed with a '\$'/);
    expect(erroDe(() => almas.aggregate([{ $group: { total: { $sum: 1 } } }])).message).toBe('a group specification must include an _id');
    expect(erroDe(() => almas.aggregate([{ $project: { s: { $concat: ['x', '$anos'] } } }])).traducao).toMatch(/\$toString/);
  });

  it('$lookup resolve outra coleção', () => {
    const db = mundo();
    db.colecao('arquivistas').insertOne({ nome: 'Chefe', atende: 2 });
    const [r] = db.colecao('arquivistas').aggregate([{ $lookup: { from: 'almas', localField: 'atende', foreignField: '_id', as: 'almas' } }]).toArray();
    expect((r.almas as { nome: string }[])[0].nome).toBe('Odorico Paz');
  });

  it('o histórico guarda os estágios para as missões', () => {
    const db = mundo();
    db.colecao('almas').aggregate([{ $match: { setor: 'Limbo' } }, { $match: { anos: { $gt: 1 } } }]);
    expect(estagiosDoPipeline(db.historico.at(-1)!)).toEqual(['$match', '$match']);
  });
});

describe('índices únicos', () => {
  it('createIndex unique barra duplicata futura', () => {
    const db = new Database();
    const p = db.colecao('protocolos');
    p.insertOne({ numero: 'P-1' });
    expect(p.createIndex({ numero: 1 }, { unique: true })).toBe('numero_1');
    const e = erroDe(() => p.insertOne({ numero: 'P-1' }));
    expect(e.message).toBe("E11000 duplicate key error collection: iris.protocolos index: numero_1 dup key: { numero: 'P-1' }");
    expect(p.getIndexes().map((i) => i.name)).toEqual(['_id_', 'numero_1']);
  });

  it('createIndex falha se já existem duplicatas', () => {
    const db = new Database();
    db.colecao('p').insertMany([{ n: 1 }, { n: 1 }]);
    expect(erroDe(() => db.colecao('p').createIndex({ n: 1 }, { unique: true })).code).toBe(11000);
  });

  it('update que causaria duplicata é barrado', () => {
    const db = new Database();
    const p = db.colecao('p');
    p.insertMany([{ n: 1 }, { n: 2 }]);
    p.createIndex({ n: 1 }, { unique: true });
    expect(erroDe(() => p.updateOne({ n: 2 }, { $set: { n: 1 } })).code).toBe(11000);
    expect(p.countDocuments({ n: 2 })).toBe(1);
  });
});

describe('validação de schema', () => {
  const schema = {
    $jsonSchema: {
      bsonType: 'object',
      required: ['numero', 'situacao'],
      properties: {
        numero: { bsonType: 'string', pattern: '^P-\\d{4}$' },
        situacao: { enum: ['aberto', 'fechado'] },
      },
    },
  };

  function comValidador(extra: object = {}) {
    const db = new Database();
    db.createCollection('protocolos', { validator: schema, ...extra });
    return db;
  }

  it('createCollection com schema bloqueia documento inválido', () => {
    const db = comValidador();
    expect(() => db.colecao('protocolos').insertOne({ numero: 'P-0001', situacao: 'aberto' })).not.toThrow();
    const e = erroDe(() => db.colecao('protocolos').insertOne({ numero: 'P-1', situacao: 'aberto' }));
    expect(e).toBeInstanceOf(MongoServerError);
    expect(e.message).toBe('Document failed validation');
    expect(e.traducao).toMatch(/numero: "P-1" não segue o padrão/);
    expect((e.errInfo as { details: { operatorName: string } }).details.operatorName).toBe('$jsonSchema');
  });

  it('createCollection em coleção existente e schema com palavra errada', () => {
    const db = comValidador();
    expect(erroDe(() => db.createCollection('protocolos')).codeName).toBe('NamespaceExists');
    expect(erroDe(() => db.createCollection('outra', { validator: { $jsonSchema: { minlength: 1 } } })).message).toBe(
      'Unknown $jsonSchema keyword: minlength',
    );
  });

  it('A ARMADILHA: collMod substitui o validador inteiro', () => {
    const db = comValidador();
    db.runCommand({ collMod: 'protocolos', validator: { $jsonSchema: { properties: { canal: { enum: ['carta', 'sonho'] } } } } });
    // a regra antiga (required numero) sumiu: lixo passa
    expect(() => db.colecao('protocolos').insertOne({ canal: 'carta' })).not.toThrow();
    const log = db.log.find((l) => l.msg === 'collMod')!;
    expect(log.attr).toMatchObject({ validadorAnterior: schema });
  });

  it('strict bloqueia update em documento legado inválido; moderate permite', () => {
    const db = new Database();
    db.colecao('protocolos').insertOne({ _id: 'legado', numero: 'velho' });
    db.createCollection('temp'); // garante que createCollection não interfere
    db.runCommand({ collMod: 'protocolos', validator: schema, validationLevel: 'strict' });
    const p = db.colecao('protocolos');
    expect(erroDe(() => p.updateOne({ _id: 'legado' }, { $set: { obs: 'x' } })).code).toBe(121);

    db.runCommand({ collMod: 'protocolos', validationLevel: 'moderate' });
    expect(() => p.updateOne({ _id: 'legado' }, { $set: { obs: 'x' } })).not.toThrow();
    // moderate ainda barra inserção nova inválida
    expect(erroDe(() => p.insertOne({ numero: 'novo' })).code).toBe(121);
    // e barra update que torna inválido um documento que era válido
    p.insertOne({ _id: 'bom', numero: 'P-0002', situacao: 'aberto' });
    expect(erroDe(() => p.updateOne({ _id: 'bom' }, { $set: { situacao: 'perdido' } })).code).toBe(121);
  });

  it('validationAction warn grava no log e deixa passar', () => {
    const db = comValidador({ validationAction: 'warn' });
    db.colecao('protocolos').insertOne({ _id: 'x', numero: 'ruim' });
    expect(db.colecao('protocolos').countDocuments({})).toBe(1);
    const aviso = db.log.find((l) => l.s === 'W')!;
    expect(aviso.msg).toBe('Document would fail validation');
    expect((aviso.attr as { explicacao: string[] }).explicacao.join()).toMatch(/faltam os campos obrigatórios "situacao"/);
  });

  it('collMod valida nível e ação; coleção inexistente', () => {
    const db = comValidador();
    expect(erroDe(() => db.runCommand({ collMod: 'protocolos', validationLevel: 'rigido' })).message).toMatch(/not a valid value/);
    expect(erroDe(() => db.runCommand({ collMod: 'nada', validator: {} })).message).toBe('ns does not exist');
  });

  it('auditoria com $nor + $jsonSchema', () => {
    const db = new Database();
    db.colecao('protocolos').insertMany([{ numero: 'P-0001', situacao: 'aberto' }, { numero: 'X' }]);
    expect(db.colecao('protocolos').find({ $nor: [schema] }, { _id: 0 }).toArray()).toEqual([{ numero: 'X' }]);
  });

  it('getCollectionInfos mostra o validador atual', () => {
    const db = comValidador({ validationLevel: 'moderate' });
    expect(db.getCollectionInfos({ name: 'protocolos' })[0].options).toMatchObject({ validationLevel: 'moderate', validator: schema });
  });
});

describe('estado do mundo', () => {
  it('clonar é independente', () => {
    const db = mundo();
    const copia = db.clonar();
    copia.colecao('almas').deleteMany({});
    expect(db.colecao('almas').countDocuments({})).toBe(4);
  });

  it('snapshot EJSON ida e volta preserva docs, índices e validador', () => {
    const db = mundo();
    db.colecao('almas').insertOne({ _id: new ObjectId('65a1b2c3d4e5f60718293a4b'), d: new Date('2000-01-01') });
    db.colecao('almas').createIndex({ nome: 1 }, { unique: true });
    db.createCollection('protocolos', { validator: { $jsonSchema: { required: ['n'] } }, validationLevel: 'moderate' });
    const volta = Database.restaurar(JSON.parse(JSON.stringify(db.snapshot())));
    const doc = volta.colecao('almas').findOne({ _id: new ObjectId('65a1b2c3d4e5f60718293a4b') })!;
    expect(doc.d).toBeInstanceOf(Date);
    expect(erroDe(() => volta.colecao('almas').insertOne({ nome: 'Odorico Paz' })).code).toBe(11000);
    expect(erroDe(() => volta.colecao('protocolos').insertOne({})).code).toBe(121);
  });

  it('credencial bloqueia antes de executar', () => {
    const db = mundo();
    db.capitulo = 1;
    expect(erroDe(() => db.colecao('almas').deleteMany({})).name).toBe('CredencialError');
    expect(db.colecao('almas').countDocuments({})).toBe(4);
  });
});
