import { formatar } from '../../src/engine/format';
import { ObjectId } from '../../src/engine/bson';

describe('formatar (estilo mongosh)', () => {
  it('escalares e tipos BSON', () => {
    expect(formatar("d'Ávila")).toBe("'d\\'Ávila'");
    expect(formatar(42)).toBe('42');
    expect(formatar(null)).toBe('null');
    expect(formatar(new ObjectId('65a1b2c3d4e5f60718293a4b'))).toBe("ObjectId('65a1b2c3d4e5f60718293a4b')");
    expect(formatar(new Date('1938-04-02T00:00:00Z'))).toBe("ISODate('1938-04-02T00:00:00.000Z')");
    expect(formatar(/^A-\d{4}/i)).toBe('/^A-\\d{4}/i');
  });

  it('objeto curto em uma linha, com chaves não-identificadoras entre aspas', () => {
    expect(formatar({ nome: 'Iracema', 'endereco.cep': '01000-000' })).toBe(
      "{ nome: 'Iracema', 'endereco.cep': '01000-000' }",
    );
    expect(formatar({})).toBe('{}');
    expect(formatar([])).toBe('[]');
  });

  it('objeto longo quebra linhas com indentação', () => {
    const texto = formatar({
      protocolo: 'A-1938-0042',
      nome: 'Iracema Vilaverde',
      setor: 'Limbo',
      pendencia: 'Promessa não cumprida',
    });
    expect(texto).toBe(
      "{\n  protocolo: 'A-1938-0042',\n  nome: 'Iracema Vilaverde',\n  setor: 'Limbo',\n  pendencia: 'Promessa não cumprida'\n}",
    );
  });

  it('não entra em loop com referência circular', () => {
    const a: Record<string, unknown> = {};
    a.eu = a;
    expect(formatar(a)).toBe('{ eu: [Circular] }');
  });
});
