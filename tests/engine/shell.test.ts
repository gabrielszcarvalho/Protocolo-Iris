import { Sessao, dividirInstrucoes } from '../../src/engine/shell';
import { Database } from '../../src/engine/database';
import { CredencialError } from '../../src/engine/errors';

function sessao() {
  const db = new Database();
  db.colecao('almas').insertMany(
    Array.from({ length: 25 }, (_, i) => ({ _id: i + 1, nome: `Alma ${String(i + 1).padStart(2, '0')}`, setor: i % 2 ? 'Limbo' : 'Purgatório' })),
  );
  return new Sessao(db);
}

const textos = (r: { saida: { texto: string }[] }) => r.saida.map((l) => l.texto).join('\n');

describe('dividirInstrucoes', () => {
  it('separa por ; e por quebra de linha, mas não no meio de encadeamento', () => {
    expect(dividirInstrucoes('a = 1; b = 2')).toEqual(['a = 1', 'b = 2']);
    expect(dividirInstrucoes('db.almas\n  .find({})\n  .limit(2)\nx')).toEqual(['db.almas\n  .find({})\n  .limit(2)', 'x']);
    expect(dividirInstrucoes('db.almas.find({\n  a: 1,\n  b: 2\n})')).toHaveLength(1);
  });

  it('respeita strings, comentários, template e regex com ; e /', () => {
    expect(dividirInstrucoes("f('a;b'); g(/x;y\\/z/i); h(`${1;}`)")).toHaveLength(3);
    expect(dividirInstrucoes('// só comentário\nx // fim')).toEqual(['x // fim']);
    expect(dividirInstrucoes('a = 10 / 2; b = /c/')).toEqual(['a = 10 / 2', 'b = /c/']);
  });
});

describe('Sessao', () => {
  it('executa find, imprime 20 e pagina com it', () => {
    const s = sessao();
    const r = s.executar('db.almas.find({}, { nome: 1, _id: 0 })');
    expect(r.ok).toBe(true);
    expect((r.valor as unknown[]).length).toBe(25);
    expect(textos(r)).toContain("{ nome: 'Alma 20' }");
    expect(textos(r)).not.toContain("'Alma 21'");
    expect(textos(r)).toContain('Type "it" for more');
    const r2 = s.executar('it');
    expect(textos(r2)).toContain("'Alma 25'");
    expect(textos(r2)).not.toContain('Type "it"');
  });

  it('encadeamento em várias linhas e valor da última expressão', () => {
    const r = sessao().executar(`
      // os três primeiros do Limbo
      db.almas
        .find({ setor: 'Limbo' })
        .sort({ nome: -1 })
        .limit(3)
    `);
    expect((r.valor as { _id: number }[]).map((d) => d._id)).toEqual([24, 22, 20]);
  });

  it('variáveis sobrevivem entre comandos', () => {
    const s = sessao();
    expect(s.executar('const alvo = db.almas.findOne({ _id: 7 })').valor).toBeUndefined();
    expect(s.executar('alvo.nome').valor).toBe('Alma 07');
    s.executar('let total = db.almas.countDocuments({}); total = total + 1');
    expect(s.executar('total').valor).toBe(26);
  });

  it('construtores do shell funcionam com e sem new', () => {
    const r = sessao().executar("[ObjectId().toHexString().length, new ObjectId('65a1b2c3d4e5f60718293a4b').toHexString(), ISODate('2020-01-01').getUTCFullYear(), NumberInt('7')]");
    expect(r.valor).toEqual([24, '65a1b2c3d4e5f60718293a4b', 2020, 7]);
  });

  it('regex literal no filtro', () => {
    expect(sessao().executar('db.almas.countDocuments({ nome: /^alma 0/i })').valor).toBe(9);
  });

  it('print e printjson vão para a saída', () => {
    const r = sessao().executar("print('total:', db.almas.countDocuments({})); printjson({ a: 1 })");
    expect(r.saida.map((l) => l.texto)).toEqual(['total: 25', '{ a: 1 }']);
  });

  it('não expõe globais do navegador nem do Node', () => {
    const s = sessao();
    for (const nome of ['window', 'globalThis', 'fetch', 'document', 'process', 'require']) {
      const r = s.executar(nome);
      expect(r.ok).toBe(false);
      expect(r.erro!.name).toBe('ReferenceError');
    }
    expect(s.executar('this').valor).toEqual({});
  });

  it('ReferenceError traduzido sugere db.<colecao>', () => {
    const r = sessao().executar('almas.find()');
    expect(r.saida[0].texto).toBe('ReferenceError: almas is not defined');
    expect(r.saida[0].traducao).toMatch(/db\.almas/);
  });

  it('método com grafia errada vira TypeError traduzido', () => {
    const r = sessao().executar('db.almas.insertone({})');
    expect(r.erro!.name).toBe('TypeError');
    expect(r.saida[0].traducao).toMatch(/insertOne/);
  });

  it('erro de sintaxe', () => {
    const r = sessao().executar('db.almas.find({ nome: "x" )');
    expect(r.erro!.name).toBe('SyntaxError');
  });

  it('erro de validação mostra Additional information', () => {
    const s = sessao();
    s.executar("db.createCollection('protocolos', { validator: { $jsonSchema: { required: ['numero'] } } })");
    const r = s.executar("db.protocolos.insertOne({ nome: 'sem número' })");
    expect(textos(r)).toMatch(/^MongoServerError: Document failed validation\nAdditional information: /);
    expect(textos(r)).toContain("missingProperties: [ 'numero' ]");
  });

  it('insertMany com erro mostra o resumo do lote', () => {
    const r = sessao().executar('db.almas.insertMany([{ _id: 100 }, { _id: 1 }, { _id: 101 }], { ordered: false })');
    expect(textos(r)).toMatch(/^MongoBulkWriteError: E11000 duplicate key error/);
    expect(textos(r)).toContain('insertedCount: 2');
  });

  it('show collections, use e help', () => {
    const s = sessao();
    expect(textos(s.executar('show collections'))).toBe('almas');
    expect(textos(s.executar('use iris'))).toBe('already on db iris');
    expect(s.executar('use admin').saida[0].tipo).toBe('erro');
    expect(s.executar('cls').limparTela).toBe(true);
  });

  it('devolve as operações executadas para as missões', () => {
    const r = sessao().executar("db.almas.updateMany({ setor: 'Limbo' }, { $set: { revisado: true } }); db.almas.find({ revisado: true }).count()");
    expect(r.operacoes.map((o) => o.metodo)).toEqual(['updateMany', 'find', 'count']);
    expect(r.valor).toBe(12);
  });

  it('não deixa sobrescrever db nem acessar internos da coleção', () => {
    const s = sessao();
    expect(s.executar('db = 1').ok).toBe(false);
    expect(s.executar('db.almas.docs').valor).toBeUndefined();
  });

  it('credencial não comprada aparece como erro diegético', () => {
    const s = sessao();
    s.db.verificador = (op) => {
      if (op.metodo === 'aggregate') throw new CredencialError('aggregate', 'Relatórios I');
    };
    const r = s.executar("db.almas.aggregate([{ $match: { setor: 'Limbo' } }])");
    expect(r.saida[0].texto).toBe("CredencialError: Comando 'aggregate' não consta no seu nível de credenciamento (requer: Relatórios I).");
  });
});
