import {
  ObjectId,
  ISODate,
  NumberInt,
  NumberLong,
  tipoBson,
  valorEhDoTipo,
  clonar,
  paraEJSON,
  deEJSON,
  canonico,
  lerCaminho,
  lerCaminhoExpandido,
  BSONError,
} from '../../src/engine/bson';

describe('ObjectId', () => {
  it('gera hex de 24 caracteres e únicos', () => {
    const a = new ObjectId();
    const b = new ObjectId();
    expect(a.toHexString()).toMatch(/^[0-9a-f]{24}$/);
    expect(a.equals(b)).toBe(false);
  });

  it('aceita hex existente e compara por valor', () => {
    const hex = '65a1b2c3d4e5f60718293a4b';
    expect(new ObjectId(hex).equals(new ObjectId(hex))).toBe(true);
    expect(new ObjectId(hex).getTimestamp()).toBeInstanceOf(Date);
  });

  it('rejeita hex inválido como o driver', () => {
    expect(() => new ObjectId('xyz')).toThrow(BSONError);
  });
});

describe('construtores do shell', () => {
  it('ISODate converte string e falha em data inválida', () => {
    expect(ISODate('1938-04-02').toISOString()).toBe('1938-04-02T00:00:00.000Z');
    expect(() => ISODate('ontem')).toThrow(BSONError);
  });

  it('NumberInt trunca para 32 bits e NumberLong trunca', () => {
    expect(NumberInt('42')).toBe(42);
    expect(NumberInt(3.9)).toBe(3);
    expect(NumberLong('9000000000')).toBe(9000000000);
  });
});

describe('tipoBson', () => {
  it('segue a regra do mongosh para números', () => {
    expect(tipoBson(500)).toBe('int');
    expect(tipoBson(500.5)).toBe('double');
    expect(tipoBson(2 ** 40)).toBe('long');
  });

  it('identifica os demais tipos', () => {
    expect(tipoBson('x')).toBe('string');
    expect(tipoBson(true)).toBe('bool');
    expect(tipoBson(null)).toBe('null');
    expect(tipoBson(undefined)).toBe('undefined');
    expect(tipoBson([])).toBe('array');
    expect(tipoBson({})).toBe('object');
    expect(tipoBson(new Date())).toBe('date');
    expect(tipoBson(/x/)).toBe('regex');
    expect(tipoBson(new ObjectId())).toBe('objectId');
  });

  it('aceita aliases e códigos numéricos', () => {
    expect(valorEhDoTipo(3, 'number')).toBe(true);
    expect(valorEhDoTipo(3.5, 'number')).toBe(true);
    expect(valorEhDoTipo(3, 'double')).toBe(false);
    expect(valorEhDoTipo('37', 2)).toBe(true);
    expect(valorEhDoTipo(3, 16)).toBe(true);
  });
});

describe('clonagem e EJSON', () => {
  const original = {
    _id: new ObjectId('65a1b2c3d4e5f60718293a4b'),
    d: new Date('2020-01-01T00:00:00Z'),
    r: /^A-\d{4}/i,
    sub: { lista: [1, { x: 2 }] },
  };

  it('clonar é profundo e preserva tipos', () => {
    const c = clonar(original);
    expect(c).not.toBe(original);
    expect(c.sub.lista).not.toBe(original.sub.lista);
    expect(c.d).toBeInstanceOf(Date);
    expect(c.d).not.toBe(original.d);
    expect(c.r.flags).toBe('i');
  });

  it('ida e volta em EJSON preserva o documento', () => {
    const json = JSON.parse(JSON.stringify(paraEJSON(original)));
    const volta = deEJSON(json) as typeof original;
    expect(volta._id.equals(original._id)).toBe(true);
    expect(volta.d.getTime()).toBe(original.d.getTime());
    expect(volta.r.source).toBe(original.r.source);
    expect(canonico(volta)).toBe(canonico(original));
  });

  it('canonico ignora a ordem das chaves', () => {
    expect(canonico({ a: 1, b: 2 })).toBe(canonico({ b: 2, a: 1 }));
    expect(canonico({ a: [1, 2] })).not.toBe(canonico({ a: [2, 1] }));
  });
});

describe('caminhos', () => {
  const doc = { endereco: { cep: '01000-000' }, audiencias: [{ peso: 10 }, { peso: 40 }] };

  it('lerCaminho segue dot notation e índices numéricos', () => {
    expect(lerCaminho(doc, 'endereco.cep')).toBe('01000-000');
    expect(lerCaminho(doc, 'audiencias.1.peso')).toBe(40);
    expect(lerCaminho(doc, 'endereco.rua')).toBeUndefined();
  });

  it('lerCaminhoExpandido desce em arrays (multikey)', () => {
    expect(lerCaminhoExpandido(doc, 'audiencias.peso')).toEqual([10, 40]);
    expect(lerCaminhoExpandido(doc, 'endereco.cep')).toEqual(['01000-000']);
  });
});
