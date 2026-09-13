import { validarSchema, verificarSchema, explicarFalhas } from '../../src/engine/jsonSchema';
import { ObjectId } from '../../src/engine/bson';
import { ErroShell } from '../../src/engine/errors';

const schemaProtocolo = {
  bsonType: 'object',
  required: ['numero', 'setor', 'prioridade'],
  properties: {
    numero: { bsonType: 'string', pattern: '^P-\\d{4}$' },
    setor: { enum: ['Limbo', 'Purgatório', 'Ante-Sala'] },
    prioridade: { bsonType: 'int', minimum: 1, maximum: 5 },
    requerente: {
      bsonType: 'object',
      required: ['nome'],
      properties: {
        nome: { bsonType: 'string', minLength: 3 },
        documentos: { bsonType: 'array', minItems: 1, items: { bsonType: 'string' } },
      },
    },
  },
};

const valido = {
  _id: new ObjectId(),
  numero: 'P-0001',
  setor: 'Limbo',
  prioridade: 3,
  requerente: { nome: 'Iracema', documentos: ['certidão'] },
};

describe('validarSchema', () => {
  it('aceita documento válido', () => {
    expect(validarSchema(schemaProtocolo, valido)).toEqual([]);
  });

  it('required lista os campos ausentes', () => {
    const [f] = validarSchema(schemaProtocolo, { setor: 'Limbo', prioridade: 1 });
    expect(f.operatorName).toBe('required');
    expect(f.missingProperties).toEqual(['numero']);
  });

  it('bsonType int rejeita double (3.5) e aceita inteiro (3)', () => {
    const falhas = validarSchema(schemaProtocolo, { ...valido, prioridade: 3.5 });
    expect(falhas[0].operatorName).toBe('properties');
    expect(falhas[0].propertiesNotSatisfied![0].details[0]).toMatchObject({
      operatorName: 'bsonType',
      consideredType: 'double',
    });
  });

  it('enum, minimum, maximum e pattern', () => {
    const nomes = (doc: object) =>
      validarSchema(schemaProtocolo, doc)
        .flatMap((f) => f.propertiesNotSatisfied ?? [])
        .flatMap((p) => p.details.map((d) => `${p.propertyName}:${d.operatorName}`));
    expect(nomes({ ...valido, setor: 'Céu' })).toEqual(['setor:enum']);
    expect(nomes({ ...valido, prioridade: 0 })).toEqual(['prioridade:minimum']);
    expect(nomes({ ...valido, prioridade: 9 })).toEqual(['prioridade:maximum']);
    expect(nomes({ ...valido, numero: 'p-1' })).toEqual(['numero:pattern']);
  });

  it('valida subdocumento, minLength, minItems e items', () => {
    const det = (requerente: object) =>
      validarSchema(schemaProtocolo, { ...valido, requerente })[0]?.propertiesNotSatisfied?.[0].details[0];
    expect(det({ nome: 'Al' })!.propertiesNotSatisfied![0].details[0].operatorName).toBe('minLength');
    expect(det({ nome: 'Alda', documentos: [] })!.propertiesNotSatisfied![0].details[0].operatorName).toBe('minItems');
    expect(det({ nome: 'Alda', documentos: ['ok', 42] })!.propertiesNotSatisfied![0].details[0]).toMatchObject({
      operatorName: 'items',
      itemIndex: 1,
    });
    expect(det({ documentos: ['x'] })!.operatorName).toBe('required');
  });

  it('palavras-chave de um tipo ignoram valores de outro tipo (semântica do MongoDB)', () => {
    // minimum não se aplica a string: por isso "37" passa se não houver bsonType.
    expect(validarSchema({ properties: { anos: { minimum: 1 } } }, { anos: '37' })).toEqual([]);
    expect(validarSchema({ properties: { anos: { bsonType: 'number', minimum: 1 } } }, { anos: '37' })).toHaveLength(1);
  });

  it('bsonType aceita lista e "number" cobre int e double', () => {
    expect(validarSchema({ bsonType: ['int', 'double'] }, 2.5)).toEqual([]);
    expect(validarSchema({ bsonType: 'number' }, 7)).toEqual([]);
    expect(validarSchema({ bsonType: 'date' }, '1938-04-02')).toHaveLength(1);
  });

  it('anyOf, not e additionalProperties', () => {
    expect(validarSchema({ anyOf: [{ bsonType: 'string' }, { bsonType: 'null' }] }, 1)).toHaveLength(1);
    expect(validarSchema({ not: { bsonType: 'string' } }, 'x')).toHaveLength(1);
    const fechado = { bsonType: 'object', properties: { a: {} }, additionalProperties: false };
    expect(validarSchema(fechado, { a: 1, b: 2 })[0].operatorName).toBe('additionalProperties');
  });
});

describe('verificarSchema', () => {
  it('recusa palavra-chave com grafia errada', () => {
    expect(() => verificarSchema({ properties: { nome: { minlength: 3 } } })).toThrow(/Unknown \$jsonSchema keyword: minlength/);
  });

  it('recusa type "integer" com tradução didática', () => {
    try {
      verificarSchema({ type: 'integer' });
      expect.unreachable();
    } catch (e) {
      expect((e as ErroShell).traducao).toMatch(/bsonType: "int"/);
    }
  });

  it('recusa bsonType desconhecido e required vazio', () => {
    expect(() => verificarSchema({ bsonType: 'inteiro' })).toThrow(/Unknown type name alias/);
    expect(() => verificarSchema({ required: [] })).toThrow(/required/);
  });

  it('aceita o schema completo', () => {
    expect(() => verificarSchema(schemaProtocolo)).not.toThrow();
  });
});

describe('explicarFalhas', () => {
  it('gera frases em português com o caminho do campo', () => {
    const linhas = explicarFalhas(
      validarSchema(schemaProtocolo, { numero: 'P-0001', setor: 'Céu', prioridade: 2.5, requerente: { nome: 'Al' } }),
    );
    expect(linhas).toContain('setor: "Céu" não está na lista permitida ["Limbo","Purgatório","Ante-Sala"]');
    expect(linhas.some((l) => l.startsWith('prioridade: esperado bsonType "int", mas veio double'))).toBe(true);
    expect(linhas.some((l) => l.startsWith('requerente.nome: texto "Al"'))).toBe(true);
  });
});
