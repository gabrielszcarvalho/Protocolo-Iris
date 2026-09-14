/**
 * Simulação da infraestrutura do Departamento para o Capítulo 12 (teoria NoSQL como decisão).
 *
 * Não existe servidor de verdade: o estado abaixo registra o que o jogador configurou e as
 * consequências são calculadas a partir dele. Os comandos imitam a sintaxe real do mongosh
 * (rs.initiate, rs.add, sh.shardCollection...) e cada chamada passa pelo mesmo registro de
 * operações do banco — ou seja, pelo credenciamento e pelo histórico usado nas missões.
 */

import { canonico, clonar, ehObjetoSimples } from './bson';
import { erros } from './errors';
import type { Database } from './database';

export interface EstadoCluster {
  replicaSet: { nome: string; membros: string[] } | null;
  primario: string | null;
  ultimaQueda?: { host: string; sobreviveu: boolean; membros: number };
  sharding: { habilitado: boolean; colecoes: Record<string, Record<string, 1 | -1 | 'hashed'>> };
  fluxos: Record<string, { w: number | 'majority'; readConcern: string; readPreference: string }>;
  particao?: Record<string, 'consistente' | 'disponivel'>;
  decisoes: Record<string, unknown>;
}

export function clusterInicial(): EstadoCluster {
  return { replicaSet: null, primario: null, sharding: { habilitado: false, colecoes: {} }, fluxos: {}, decisoes: {} };
}

export const SHARDS = ['caldeira-1', 'caldeira-2', 'caldeira-3'];

/** Normaliza respostas digitadas: minúsculas, sem acento, sem espaços extras. */
export function normalizarResposta(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\s-]+/g, ' ')
    .trim();
}

const SINONIMOS_MODELO: Record<string, string> = {
  'chave valor': 'chave-valor',
  'key value': 'chave-valor',
  kv: 'chave-valor',
  documento: 'documento',
  documentos: 'documento',
  document: 'documento',
  'coluna larga': 'coluna larga',
  colunar: 'coluna larga',
  'wide column': 'coluna larga',
  'familia de colunas': 'coluna larga',
  'column family': 'coluna larga',
  grafo: 'grafo',
  grafos: 'grafo',
  graph: 'grafo',
};

export const RESPOSTAS_3VS: Record<string, string> = { guerra: 'velocidade', acervo: 'volume', formatos: 'variedade' };
export const RESPOSTAS_MODELOS: Record<string, string> = { balcao: 'chave-valor', vinculos: 'grafo', caldeiras: 'coluna larga', fichas: 'documento' };

export const PROVA = [
  {
    enunciado: 'O Tesouro Celeste não pode pagar a mesma indenização duas vezes. Esse fluxo precisa priorizar:',
    alternativas: { a: 'BASE', b: 'ACID', c: 'apenas velocidade', d: 'sharding por setor' },
    correta: 'b',
  },
  {
    enunciado: 'Pelo teorema CAP, durante uma partição de rede um sistema distribuído precisa escolher entre:',
    alternativas: { a: 'consistência e disponibilidade', b: 'volume e velocidade', c: 'índice e schema', d: 'réplica e shard' },
    correta: 'a',
  },
  {
    enunciado: '"Consistência eventual" significa que:',
    alternativas: { a: 'os dados nunca ficam iguais', b: 'as réplicas convergem para o mesmo valor com o tempo', c: 'toda leitura é sempre a mais recente', d: 'só existe em bancos relacionais' },
    correta: 'b',
  },
  {
    enunciado: 'Num replica set de 3 membros, o primário cai. O que acontece?',
    alternativas: { a: 'o banco para até alguém religar', b: 'os secundários elegem um novo primário', c: 'os dados são apagados', d: 'vira sharding automaticamente' },
    correta: 'b',
  },
  {
    enunciado: 'Por que replica sets costumam ter número ímpar de membros?',
    alternativas: { a: 'economia de disco', b: 'para garantir maioria nas eleições', c: 'o MongoDB não aceita número par', d: 'para dividir os dados entre eles' },
    correta: 'b',
  },
  {
    enunciado: 'Uma shard key de baixa cardinalidade (ex.: setor, com 5 valores) tende a causar:',
    alternativas: { a: 'distribuição equilibrada', b: 'hotspot e chunks gigantes', c: 'mais réplicas', d: 'validação de schema' },
    correta: 'b',
  },
  {
    enunciado: 'Qual modelo NoSQL é mais indicado para "quem conhece quem, até 6 graus de distância"?',
    alternativas: { a: 'chave-valor', b: 'coluna larga', c: 'grafo', d: 'documento' },
    correta: 'c',
  },
  {
    enunciado: 'Os 3 Vs do Big Data são:',
    alternativas: { a: 'validação, versão e visão', b: 'volume, velocidade e variedade', c: 'vetor, vértice e valor', d: 'volume, validade e verdade' },
    correta: 'b',
  },
];

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Quantos documentos cada shard receberia com a chave escolhida. */
export function distribuicao(db: Database, colecao: string, chave: Record<string, 1 | -1 | 'hashed'>) {
  const [campo, tipo] = Object.entries(chave)[0];
  const docs = db.colecao(colecao).docs;
  const contagem = SHARDS.map(() => 0);
  if (tipo === 'hashed') {
    for (const d of docs) contagem[hash(canonico(d[campo] ?? null)) % SHARDS.length]++;
  } else {
    // Faixas (chunks) contíguas. Um mesmo valor nunca se divide: é aí que nasce o hotspot.
    const grupos = new Map<string, number>();
    for (const d of docs) {
      const c = canonico(d[campo] ?? null);
      grupos.set(c, (grupos.get(c) ?? 0) + 1);
    }
    const ordenados = [...grupos.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const alvo = docs.length / SHARDS.length;
    let shard = 0;
    let acumulado = 0;
    for (const [, n] of ordenados) {
      if (shard < SHARDS.length - 1 && acumulado >= alvo * (shard + 1)) shard++;
      contagem[shard] += n;
      acumulado += n;
    }
  }
  return SHARDS.map((nome, i) => ({
    shard: nome,
    documentos: contagem[i],
    percentual: docs.length ? Math.round((contagem[i] / docs.length) * 100) : 0,
  }));
}

// ---------------------------------------------------------------------------
// APIs do terminal
// ---------------------------------------------------------------------------

export function criarApisDoCluster(db: Database) {
  const estado = () => db.cluster;
  const registrar = (metodo: string, args: unknown[]) => db.inspecionar({ metodo, args: args.filter((a) => a !== undefined) });

  const exigirReplica = () => {
    if (!estado().replicaSet) {
      throw erros.valorInvalido('no replset config has been received', 'Ainda não existe replica set. Comece com rs.initiate().');
    }
    return estado().replicaSet!;
  };

  const rs = {
    initiate(config?: unknown) {
      registrar('rs.initiate', [config]);
      if (estado().replicaSet) throw erros.valorInvalido('already initialized', 'O replica set já foi iniciado. Use rs.add("host") para adicionar membros.');
      let nome = 'rsPurgatorio';
      let membros = ['arquivo-1:27017'];
      if (ehObjetoSimples(config)) {
        if (typeof config._id === 'string') nome = config._id;
        if (Array.isArray(config.members)) {
          membros = config.members.map((m) => (ehObjetoSimples(m) && typeof m.host === 'string' ? m.host : '')).filter(Boolean);
        }
      }
      estado().replicaSet = { nome, membros };
      estado().primario = membros[0];
      return { ok: 1, set: nome, membros: membros.length, parecer: `Replica set "${nome}" iniciado com ${membros.length} membro(s). ${membros[0]} é o primário.` };
    },
    add(host: unknown) {
      registrar('rs.add', [host]);
      const rsAtual = exigirReplica();
      const nome = ehObjetoSimples(host) && typeof host.host === 'string' ? host.host : String(host);
      if (rsAtual.membros.includes(nome)) throw erros.valorInvalido(`Found two member configurations with same host field: ${nome}`, 'Esse membro já faz parte do replica set.');
      rsAtual.membros.push(nome);
      return { ok: 1, membros: rsAtual.membros.length };
    },
    status() {
      registrar('rs.status', []);
      const rsAtual = exigirReplica();
      return {
        set: rsAtual.nome,
        members: rsAtual.membros.map((m) => ({ name: m, stateStr: m === estado().primario ? 'PRIMARY' : 'SECONDARY' })),
        ok: 1,
      };
    },
  };

  const sh = {
    enableSharding(nomeDb: unknown) {
      registrar('sh.enableSharding', [nomeDb]);
      if (nomeDb !== db.nome) throw erros.valorInvalido(`database ${String(nomeDb)} not found`, `O banco do Departamento se chama "${db.nome}".`);
      estado().sharding.habilitado = true;
      return { ok: 1 };
    },
    shardCollection(ns: unknown, chave: unknown) {
      registrar('sh.shardCollection', [ns, chave]);
      return fragmentar(ns, chave);
    },
    reshardCollection(ns: unknown, chave: unknown) {
      registrar('sh.reshardCollection', [ns, chave]);
      return fragmentar(ns, chave);
    },
    status() {
      registrar('sh.status', []);
      const colecoes = Object.entries(estado().sharding.colecoes).map(([ns, chave]) => {
        const partes = distribuicao(db, ns.split('.')[1], chave);
        const maior = Math.max(...partes.map((p) => p.percentual));
        return {
          colecao: ns,
          chave,
          shards: partes.map((p) => ({ shard: p.shard, documentos: p.documentos, percentual: `${p.percentual}%` })),
          alerta: maior > 40 ? `HOTSPOT: um shard concentra ${maior}% dos documentos.` : 'Distribuição equilibrada.',
        };
      });
      return { shards: SHARDS, fragmentacaoHabilitada: estado().sharding.habilitado, colecoes };
    },
  };

  function fragmentar(ns: unknown, chave: unknown) {
    if (typeof ns !== 'string' || !/^iris\.\w+$/.test(ns)) {
      throw erros.valorInvalido(`Invalid namespace: ${String(ns)}`, 'Informe banco.coleção, por exemplo "iris.almas".');
    }
    if (!estado().sharding.habilitado) {
      throw erros.valorInvalido(`sharding not enabled for db ${db.nome}`, 'Antes, habilite a fragmentação do banco: sh.enableSharding("iris").');
    }
    if (!ehObjetoSimples(chave) || Object.keys(chave).length !== 1 || ![1, -1, 'hashed'].includes(Object.values(chave)[0] as number)) {
      throw erros.valorInvalido('Invalid shard key', 'A shard key é um objeto com um campo: { protocolo: "hashed" } ou { setor: 1 }.');
    }
    const colecao = ns.split('.')[1];
    estado().sharding.colecoes[ns] = clonar(chave) as Record<string, 1 | -1 | 'hashed'>;
    const partes = distribuicao(db, colecao, chave as Record<string, 1 | -1 | 'hashed'>);
    const maior = Math.max(...partes.map((p) => p.percentual));
    return {
      ok: 1,
      distribuicao: partes.map((p) => `${p.shard}: ${p.documentos} docs (${p.percentual}%)`),
      parecer:
        maior > 40
          ? `Uma caldeira ficou com ${maior}% das fichas e está superaquecendo. Chave de baixa cardinalidade gera hotspot.`
          : 'As fichas se espalharam por igual entre as caldeiras.',
    };
  }

  const diretoria = {
    classificar(respostas: unknown) {
      registrar('diretoria.classificar', [respostas]);
      if (!ehObjetoSimples(respostas)) throw erros.valorInvalido('respostas must be an object', 'Use um objeto: diretoria.classificar({ guerra: "...", acervo: "...", formatos: "..." }).');
      const normal = Object.fromEntries(Object.entries(respostas).map(([k, v]) => [normalizarResposta(k), normalizarResposta(v)]));
      estado().decisoes.vs = normal;
      return Object.fromEntries(
        Object.keys(RESPOSTAS_3VS).map((k) => [k, normal[k] === RESPOSTAS_3VS[k] ? 'correto' : normal[k] ? 'não é bem isso' : 'sem resposta']),
      );
    },
    recomendar(respostas: unknown) {
      registrar('diretoria.recomendar', [respostas]);
      if (!ehObjetoSimples(respostas)) throw erros.valorInvalido('respostas must be an object', 'Use um objeto: diretoria.recomendar({ balcao: "...", vinculos: "...", caldeiras: "...", fichas: "..." }).');
      const normal = Object.fromEntries(
        Object.entries(respostas).map(([k, v]) => [normalizarResposta(k), SINONIMOS_MODELO[normalizarResposta(v)] ?? normalizarResposta(v)]),
      );
      estado().decisoes.modelos = normal;
      return Object.fromEntries(
        Object.keys(RESPOSTAS_MODELOS).map((k) => [k, normal[k] === RESPOSTAS_MODELOS[k] ? 'aprovado' : normal[k] ? 'a Diretoria discorda' : 'sem resposta']),
      );
    },
    simularQueda(host?: unknown) {
      registrar('diretoria.simularQueda', [host]);
      const rsAtual = estado().replicaSet;
      if (!rsAtual) {
        estado().ultimaQueda = { host: 'arquivo-unico', sobreviveu: false, membros: 1 };
        return { ok: 0, parecer: 'O único servidor caiu. O Departamento ficou fora do ar por três dias úteis — e aqui os dias são eternos.' };
      }
      const alvo = typeof host === 'string' ? host : estado().primario ?? rsAtual.membros[0];
      if (!rsAtual.membros.includes(alvo)) throw erros.valorInvalido(`host ${alvo} is not a member`, 'Esse host não faz parte do replica set. Veja os membros com rs.status().');
      const total = rsAtual.membros.length;
      const vivos = total - 1;
      const sobreviveu = vivos >= Math.floor(total / 2) + 1;
      estado().ultimaQueda = { host: alvo, sobreviveu, membros: total };
      if (!sobreviveu) {
        estado().primario = null;
        return { ok: 0, parecer: `${alvo} caiu. Restaram ${vivos} de ${total}: sem maioria, ninguém foi eleito. O arquivo ficou só para leitura.` };
      }
      if (alvo === estado().primario) estado().primario = rsAtual.membros.find((m) => m !== alvo) ?? null;
      return { ok: 1, parecer: `${alvo} caiu. Eleição relâmpago: ${estado().primario} é o novo primário. As almas nem perceberam.` };
    },
    configurar(fluxo: unknown, opcoes: unknown) {
      registrar('diretoria.configurar', [fluxo, opcoes]);
      const nome = normalizarResposta(fluxo);
      if (nome !== 'indenizacoes' && nome !== 'mural') {
        throw erros.valorInvalido(`unknown flow: ${String(fluxo)}`, 'Os fluxos que a Diretoria quer configurar são "indenizacoes" e "mural".');
      }
      const o = ehObjetoSimples(opcoes) ? opcoes : {};
      const wc = ehObjetoSimples(o.writeConcern) ? o.writeConcern.w : o.w;
      const rc = ehObjetoSimples(o.readConcern) ? o.readConcern.level : o.readConcern;
      estado().fluxos[nome] = {
        w: wc === 'majority' ? 'majority' : Number(wc ?? 1),
        readConcern: normalizarResposta(rc ?? 'local'),
        readPreference: normalizarResposta(o.readPreference ?? 'primary'),
      };
      return { ok: 1, fluxo: nome, configuracao: estado().fluxos[nome] };
    },
    simularParticao() {
      registrar('diretoria.simularParticao', []);
      const rsAtual = estado().replicaSet;
      if (!rsAtual || rsAtual.membros.length < 3) {
        return { ok: 0, parecer: 'Sem um replica set de pelo menos 3 membros não há partição para simular — e também não há alta disponibilidade.' };
      }
      const resultados: Record<string, 'consistente' | 'disponivel'> = {};
      const relatos: Record<string, string> = {};
      for (const nome of ['indenizacoes', 'mural']) {
        const f = estado().fluxos[nome] ?? { w: 1, readConcern: 'local', readPreference: 'primary' };
        const forte = f.w === 'majority' && f.readConcern === 'majority' && f.readPreference === 'primary';
        resultados[nome] = forte ? 'consistente' : 'disponivel';
        relatos[nome] =
          nome === 'indenizacoes'
            ? forte
              ? 'Durante a partição, 12 pagamentos ficaram em espera. Nenhuma indenização saiu em dobro (consistência, ACID).'
              : 'Os dois prédios aprovaram a mesma indenização. O Tesouro Celeste pagou em dobro.'
            : forte
              ? 'O mural travou durante a partição: ninguém conseguiu acender uma vela (faltou disponibilidade).'
              : 'O mural seguiu funcionando; uns viram 41 velas, outros 43, até sincronizar (consistência eventual, BASE).';
      }
      estado().particao = resultados;
      return { ok: 1, resultados, relatos };
    },
    status() {
      registrar('diretoria.status', []);
      return clonar(estado());
    },
  };

  const prova = {
    questoes() {
      registrar('prova.questoes', []);
      return PROVA.map((q, i) => ({ numero: i + 1, enunciado: q.enunciado, alternativas: q.alternativas }));
    },
    responder(respostas: unknown) {
      registrar('prova.responder', [respostas]);
      const lista = Array.isArray(respostas) ? respostas : ehObjetoSimples(respostas) ? PROVA.map((_, i) => respostas[i + 1] ?? respostas[String(i + 1)]) : [];
      const acertos = PROVA.map((q, i) => normalizarResposta(lista[i]) === q.correta);
      const nota = acertos.filter(Boolean).length;
      estado().decisoes.prova = { nota, total: PROVA.length, respondidas: lista.filter((r) => r !== undefined).length };
      return {
        nota: `${nota} de ${PROVA.length}`,
        aprovado: nota >= 6,
        correcao: PROVA.map((q, i) => ({ questao: i + 1, sua: lista[i] ?? null, resultado: acertos[i] ? 'certa' : `errada (era ${q.correta})` })),
      };
    },
  };

  return { rs, sh, diretoria, prova };
}
