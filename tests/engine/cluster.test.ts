import { Database } from '../../src/engine/database';
import { Sessao } from '../../src/engine/shell';
import { distribuicao, normalizarResposta } from '../../src/engine/cluster';

function sessao() {
  const db = new Database();
  db.colecao('almas').insertMany(
    Array.from({ length: 200 }, (_, i) => ({ protocolo: `A-${1900 + (i % 100)}-${String(i).padStart(4, '0')}`, setor: i < 100 ? 'Limbo' : ['Purgatório', 'Ante-Sala', 'Arquivo Morto'][i % 3] })),
  );
  return new Sessao(db);
}

describe('cluster simulado', () => {
  it('replica set de 3 membros sobrevive à queda do primário', () => {
    const s = sessao();
    s.executar("rs.initiate(); rs.add('arquivo-2:27017'); rs.add('arquivo-3:27017')");
    const r = s.executar('diretoria.simularQueda()');
    expect(r.valor).toMatchObject({ ok: 1 });
    expect(s.db.cluster.primario).toBe('arquivo-2:27017');
    expect(s.db.cluster.ultimaQueda).toMatchObject({ sobreviveu: true, membros: 3 });
  });

  it('com 2 membros não há maioria; sem replica set o arquivo sai do ar', () => {
    const s = sessao();
    expect(s.executar('diretoria.simularQueda()').valor).toMatchObject({ ok: 0 });
    s.executar("rs.initiate(); rs.add('arquivo-2:27017')");
    s.executar('diretoria.simularQueda()');
    expect(s.db.cluster.ultimaQueda).toMatchObject({ sobreviveu: false, membros: 2 });
  });

  it('rs.add antes de iniciar dá erro real', () => {
    expect(sessao().executar("rs.add('x:1')").saida[0].texto).toMatch(/no replset config has been received/);
  });

  it('shard key de baixa cardinalidade gera hotspot; hashed equilibra', () => {
    const s = sessao();
    s.executar("sh.enableSharding('iris')");
    s.executar("sh.shardCollection('iris.almas', { setor: 1 })");
    expect(Math.max(...distribuicao(s.db, 'almas', { setor: 1 }).map((p) => p.percentual))).toBeGreaterThan(40);
    s.executar("sh.reshardCollection('iris.almas', { protocolo: 'hashed' })");
    expect(Math.max(...distribuicao(s.db, 'almas', { protocolo: 'hashed' }).map((p) => p.percentual))).toBeLessThanOrEqual(40);
    expect(s.db.cluster.sharding.colecoes['iris.almas']).toEqual({ protocolo: 'hashed' });
  });

  it('partição: fluxo majoritário fica consistente, o outro fica disponível', () => {
    const s = sessao();
    s.executar("rs.initiate({ _id: 'rs', members: [{ host: 'a:1' }, { host: 'b:1' }, { host: 'c:1' }] })");
    s.executar("diretoria.configurar('indenizações', { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' }, readPreference: 'primary' })");
    s.executar("diretoria.configurar('mural', { writeConcern: { w: 1 }, readPreference: 'secondary' })");
    s.executar('diretoria.simularParticao()');
    expect(s.db.cluster.particao).toEqual({ indenizacoes: 'consistente', mural: 'disponivel' });
  });

  it('decisões e prova aceitam sinônimos e sem acento', () => {
    const s = sessao();
    s.executar("diretoria.recomendar({ balcão: 'Key-Value', vinculos: 'Graph', caldeiras: 'colunar', fichas: 'Documentos' })");
    expect(s.db.cluster.decisoes.modelos).toEqual({ balcao: 'chave-valor', vinculos: 'grafo', caldeiras: 'coluna larga', fichas: 'documento' });
    s.executar("prova.responder(['b', 'a', 'b', 'b', 'b', 'b', 'c', 'b'])");
    expect(s.db.cluster.decisoes.prova).toMatchObject({ nota: 8 });
    expect(normalizarResposta('  Indenizações ')).toBe('indenizacoes');
  });

  it('estado do cluster sobrevive a clone e snapshot', () => {
    const s = sessao();
    s.executar('rs.initiate()');
    expect(s.db.clonar().cluster.replicaSet?.membros).toHaveLength(1);
    expect(Database.restaurar(JSON.parse(JSON.stringify(s.db.snapshot()))).cluster.primario).toBe('arquivo-1:27017');
  });

  it('operação que falha fica marcada no histórico', () => {
    const s = sessao();
    s.executar("db.createCollection('p', { validator: { $jsonSchema: { required: ['n'] } } })");
    s.executar('db.p.insertOne({})');
    expect(s.db.historico.at(-1)).toMatchObject({ metodo: 'insertOne', erro: 'DocumentValidationFailure' });
  });
});
