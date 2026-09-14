import type { Capitulo } from './tipos';
import { historicoTem, noCluster, objetivo, validarPorObjetivos, type Conferencia, type Objetivo } from '../objetivos';
import { distribuicao } from '../../engine/cluster';

type Decisoes = Record<string, string | undefined>;
const decisao = (grupo: 'vs' | 'modelos', chave: string, valor: string) => noCluster((c) => (c.decisoes[grupo] as Decisoes | undefined)?.[chave] === valor);

const obj121: Objetivo[] = [
  objetivo('A Guerra dos Anjos (milhares de óbitos por segundo): o V certo.', decisao('vs', 'guerra', 'velocidade')),
  objetivo('O Acervo desde a Criação (petabytes de fichas): o V certo.', decisao('vs', 'acervo', 'volume')),
  objetivo('Os formatos misturados (pergaminho, áudio, sonho): o V certo.', decisao('vs', 'formatos', 'variedade')),
];

const obj122: Objetivo[] = [
  objetivo('Replica set com pelo menos 3 membros, em número ímpar.', noCluster((c) => !!c.replicaSet && c.replicaSet.membros.length >= 3 && c.replicaSet.membros.length % 2 === 1)),
  objetivo('Simulou a queda do primário…', noCluster((c) => !!c.ultimaQueda && c.ultimaQueda.membros >= 3)),
  objetivo('…e um novo primário foi eleito.', noCluster((c) => !!c.ultimaQueda?.sobreviveu && !!c.primario)),
];

const obj123: Objetivo[] = [
  objetivo("indenizacoes: consistência forte (w 'majority', readConcern 'majority', leitura no primário).", noCluster((c) => {
    const f = c.fluxos.indenizacoes;
    return !!f && f.w === 'majority' && f.readConcern === 'majority' && f.readPreference === 'primary';
  })),
  objetivo('mural: disponibilidade (w 1 e leitura em secundários).', noCluster((c) => {
    const f = c.fluxos.mural;
    return !!f && f.w === 1 && f.readPreference.startsWith('secondary');
  })),
  objetivo('Simulou a partição: indenizações consistentes, mural disponível.', noCluster((c) => c.particao?.indenizacoes === 'consistente' && c.particao?.mural === 'disponivel')),
];

const equilibrada: Conferencia = (ctx) => {
  const chave = ctx.mundo.cluster.sharding.colecoes['iris.almas'];
  return !!chave && Math.max(...distribuicao(ctx.mundo, 'almas', chave).map((p) => p.percentual)) <= 40;
};

const obj124: Objetivo[] = [
  objetivo('Fragmentação habilitada no banco iris.', noCluster((c) => c.sharding.habilitado)),
  objetivo('Testou a chave por setor e viu o hotspot.', historicoTem((o) => /^sh\.(shard|reshard)Collection$/.test(o.metodo) && JSON.stringify(o.args[1] ?? {}).includes('setor'))),
  objetivo('iris.almas fragmentada sem hotspot (nenhuma caldeira com mais de 40%).', equilibrada),
];

const obj125: Objetivo[] = [
  objetivo('Balcão de senhas (consulta por número, milhões por minuto).', decisao('modelos', 'balcao', 'chave-valor')),
  objetivo('Árvore de vínculos (quem conhece quem, até 6 graus).', decisao('modelos', 'vinculos', 'grafo')),
  objetivo('Telemetria das caldeiras (bilhões de leituras por tempo).', decisao('modelos', 'caldeiras', 'coluna larga')),
  objetivo('Fichas das almas (registros ricos e variados).', decisao('modelos', 'fichas', 'documento')),
];

const prova = () => (c: { decisoes: Record<string, unknown> }) => c.decisoes.prova as { nota: number; respondidas: number } | undefined;
const obj126: Objetivo[] = [
  objetivo('Respondeu às 8 questões.', noCluster((c) => (prova()(c)?.respondidas ?? 0) >= 8)),
  objetivo('Acertou pelo menos 6.', noCluster((c) => (prova()(c)?.nota ?? 0) >= 6)),
];

export const capitulo12: Capitulo = {
  numero: 12,
  titulo: 'A Diretoria',
  fase: 4,
  abertura:
    'Seu nome subiu para a pauta do Conselho. Chega de fichas: agora você decide como o Departamento inteiro funciona — quantos prédios guardam cópias, o que acontece quando um cai, como o arquivo se divide entre as caldeiras do subsolo. No fim, a Prova de Credenciamento. Aurélio Vilaverde, o arquivista que espera desde 1953, observa da porta.',
  missoes: [
    {
      id: '12.1',
      titulo: 'Os três Vs',
      assunto: 'Pauta nº 1 — o tamanho do problema',
      corpo:
        'Classifique cada situação com o V do Big Data que ela mais representa (`volume`, `velocidade` ou `variedade`):\n- `guerra`: na Guerra dos Anjos chegam milhares de óbitos POR SEGUNDO;\n- `acervo`: o acervo guarda fichas desde a Criação — petabytes;\n- `formatos`: chegam pergaminhos, gravações de voz e relatos de sonhos, cada um num formato.\n\nResponda com `diretoria.classificar({ guerra: ..., acervo: ..., formatos: ... })`.',
      objetivos: obj121,
      requer: ['teoria'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj121),
      solucaoReferencia: "diretoria.classificar({ guerra: 'velocidade', acervo: 'volume', formatos: 'variedade' })",
      solucoesErradas: [{ codigo: "diretoria.classificar({ guerra: 'velocidade', acervo: 'variedade', formatos: 'volume' })", porque: 'trocou volume e variedade' }],
      dicas: [
        'Pergunte a cada situação: o problema é QUANTO, QUÃO RÁPIDO ou QUÃO DIFERENTE?',
        'Volume = quantidade guardada. Velocidade = ritmo de chegada. Variedade = diversidade de formatos.',
        "diretoria.classificar({ guerra: 'velocidade', acervo: 'volume', formatos: 'variedade' })",
      ],
      recompensa: 5,
      licao: 'Os 3 Vs: volume (quanto), velocidade (quão rápido chega), variedade (quantos formatos).',
    },
    {
      id: '12.2',
      titulo: 'A Segunda Repartição',
      assunto: 'Pauta nº 2 — e se o arquivo pegar fogo?',
      corpo:
        'Hoje existe um único servidor de arquivo. Crie um replica set com `rs.initiate()`, adicione membros com `rs.add("arquivo-2:27017")` (e mais quantos julgar necessário) e prove que ele aguenta: `diretoria.simularQueda()` derruba o primário. O Conselho só aprova se um novo primário for eleito.',
      objetivos: obj122,
      requer: ['replicacao'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj122),
      solucaoReferencia: "rs.initiate()\nrs.add('arquivo-2:27017')\nrs.add('arquivo-3:27017')\nrs.status()\ndiretoria.simularQueda()",
      solucoesErradas: [
        { codigo: "rs.initiate(); rs.add('arquivo-2:27017'); diretoria.simularQueda()", porque: 'dois membros não formam maioria sem o primário' },
        { codigo: 'diretoria.simularQueda()', porque: 'derrubou o servidor único' },
      ],
      dicas: [
        'Rode com 2 membros e leia o parecer da queda. Por que ninguém foi eleito?',
        'Uma eleição precisa da MAIORIA dos membros. Com 2, sobra 1 de 2 — não é maioria. Com 3, sobram 2 de 3.',
        "rs.initiate(); rs.add('arquivo-2:27017'); rs.add('arquivo-3:27017'); diretoria.simularQueda()",
      ],
      recompensa: 6,
      licao: 'Replica set: um primário e secundários com cópias; se o primário cai, a maioria elege outro. Por isso, número ímpar.',
    },
    {
      id: '12.3',
      titulo: 'O Tratado de Consistência',
      assunto: 'Pauta nº 3 — indenizações e velas',
      corpo:
        'Dois fluxos, duas prioridades:\n- `indenizacoes`: o Tesouro Celeste NUNCA pode pagar em dobro — consistência acima de tudo;\n- `mural`: o mural de velas acesas pode mostrar números diferentes por um tempo, mas não pode sair do ar.\n\nConfigure cada um com `diretoria.configurar(fluxo, { writeConcern: { w }, readConcern: { level }, readPreference })` e depois rode `diretoria.simularParticao()`.',
      objetivos: obj123,
      requer: ['consistencia'],
      depoisDe: ['12.2'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj123),
      solucaoReferencia: [
        "diretoria.configurar('indenizacoes', { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' }, readPreference: 'primary' })",
        "diretoria.configurar('mural', { writeConcern: { w: 1 }, readConcern: { level: 'local' }, readPreference: 'secondary' })",
        'diretoria.simularParticao()',
      ].join('\n'),
      solucoesErradas: [
        {
          codigo:
            "diretoria.configurar('indenizacoes', { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' }, readPreference: 'primary' }); diretoria.configurar('mural', { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' }, readPreference: 'primary' }); diretoria.simularParticao()",
          porque: 'o mural travou na partição',
        },
        {
          codigo: "diretoria.configurar('indenizacoes', { writeConcern: { w: 1 }, readPreference: 'secondary' }); diretoria.configurar('mural', { writeConcern: { w: 1 }, readPreference: 'secondary' }); diretoria.simularParticao()",
          porque: 'pagou indenização em dobro',
        },
      ],
      dicas: [
        'Teorema CAP: durante uma partição, cada fluxo escolhe entre Consistência e Disponibilidade. Leia os relatos da simulação.',
        "Consistência forte (ACID): w 'majority' + readConcern 'majority' + readPreference 'primary'. Disponibilidade (BASE): w 1 e leitura em 'secondary'.",
        "diretoria.configurar('indenizacoes', { writeConcern: { w: 'majority' }, readConcern: { level: 'majority' }, readPreference: 'primary' }); diretoria.configurar('mural', { writeConcern: { w: 1 }, readConcern: { level: 'local' }, readPreference: 'secondary' }); diretoria.simularParticao()",
      ],
      recompensa: 7,
      licao: 'CAP na prática: majority/primary garante consistência (CP, ACID); w 1 e secundários mantêm disponibilidade (AP, BASE, consistência eventual).',
    },
    {
      id: '12.4',
      titulo: 'A Partilha das Caldeiras',
      assunto: 'Pauta nº 4 — o arquivo não cabe numa caldeira só',
      corpo:
        'O Conselho quer dividir `almas` entre três caldeiras. Habilite com `sh.enableSharding("iris")` e, por sugestão do chefe de setor, fragmente primeiro por `setor`: `sh.shardCollection("iris.almas", { setor: 1 })`. Leia o parecer. Depois troque a chave por uma que espalhe as fichas por igual (`sh.reshardCollection`).',
      objetivos: obj124,
      requer: ['fragmentacao'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj124),
      solucaoReferencia: "sh.enableSharding('iris')\nsh.shardCollection('iris.almas', { setor: 1 })\nsh.reshardCollection('iris.almas', { protocolo: 'hashed' })\nsh.status()",
      solucoesErradas: [
        { codigo: "sh.enableSharding('iris'); sh.shardCollection('iris.almas', { setor: 1 })", porque: 'ficou com o hotspot' },
        { codigo: "sh.enableSharding('iris'); sh.shardCollection('iris.almas', { protocolo: 'hashed' })", porque: 'pulou o experimento com setor' },
      ],
      dicas: [
        'Com { setor: 1 }, todas as fichas do Limbo precisam ficar juntas. Quanto do arquivo é Limbo?',
        'Uma chave de alta cardinalidade (muitos valores diferentes), com "hashed", espalha por igual. protocolo é quase único.',
        "sh.enableSharding('iris'); sh.shardCollection('iris.almas', { setor: 1 }); sh.reshardCollection('iris.almas', { protocolo: 'hashed' })",
      ],
      recompensa: 7,
      licao: 'Sharding divide a coleção pela shard key. Baixa cardinalidade gera hotspot; chave "hashed" de alta cardinalidade distribui por igual.',
    },
    {
      id: '12.5',
      titulo: 'Um banco para cada guichê',
      assunto: 'Pauta nº 5 — nem tudo é documento',
      corpo:
        'Recomende um modelo NoSQL (`chave-valor`, `documento`, `coluna larga` ou `grafo`) para cada departamento:\n- `balcao`: o balcão de senhas consulta a senha pelo número, milhões de vezes por minuto;\n- `vinculos`: a árvore de vínculos quer saber quem conhece quem, até 6 graus de distância;\n- `caldeiras`: a telemetria grava bilhões de leituras de temperatura por caldeira e horário;\n- `fichas`: as fichas das almas são registros ricos, com listas e subdocumentos que variam.\n\nUse `diretoria.recomendar({ balcao: ..., vinculos: ..., caldeiras: ..., fichas: ... })`.',
      objetivos: obj125,
      requer: ['teoria'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj125),
      solucaoReferencia: "diretoria.recomendar({ balcao: 'chave-valor', vinculos: 'grafo', caldeiras: 'coluna larga', fichas: 'documento' })",
      solucoesErradas: [{ codigo: "diretoria.recomendar({ balcao: 'documento', vinculos: 'grafo', caldeiras: 'chave-valor', fichas: 'documento' })", porque: 'balcão e caldeiras no modelo errado' }],
      dicas: [
        'Pense no ACESSO: por uma chave? por relações? por tempo em volume gigante? por registros ricos?',
        'Chave-valor: busca direta por chave (Redis). Grafo: caminhos entre nós (Neo4j). Coluna larga: séries enormes por chave e tempo (Cassandra). Documento: fichas flexíveis (MongoDB).',
        "diretoria.recomendar({ balcao: 'chave-valor', vinculos: 'grafo', caldeiras: 'coluna larga', fichas: 'documento' })",
      ],
      recompensa: 6,
      licao: 'Chave-valor para acesso por chave; documento para registros ricos; coluna larga para séries massivas; grafo para relações.',
    },
    {
      id: '12.6',
      titulo: 'A Prova de Credenciamento',
      assunto: 'Última pauta — o carimbo definitivo',
      corpo:
        'Chegou a hora. Leia as questões com `prova.questoes()` e entregue suas respostas, na ordem, com `prova.responder(["a", "b", ...])`. São 8 questões; o Conselho aprova com 6 acertos. Se não passar, reinicie o memorando e tente de novo — no Purgatório, tempo é o que não falta.',
      objetivos: obj126,
      requer: ['teoria'],
      depoisDe: ['12.1', '12.2', '12.3', '12.4', '12.5'],
      tipo: 'escrita',
      validar: validarPorObjetivos(obj126),
      solucaoReferencia: "prova.questoes()\nprova.responder(['b', 'a', 'b', 'b', 'b', 'b', 'c', 'b'])",
      solucoesErradas: [{ codigo: "prova.responder(['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'])", porque: 'chutou tudo na letra a' }],
      dicas: [
        'Cada questão retoma uma pauta deste capítulo. Releia as lições no Manual antes de responder.',
        'Dinheiro que não pode duplicar pede ACID; partição obriga a escolher entre C e A; maioria decide eleições; baixa cardinalidade gera hotspot; relações pedem grafo.',
        'Leia o enunciado de cada questão com prova.questoes(): a correção mostra qual era a certa, e você pode reiniciar o memorando para tentar de novo.',
      ],
      recompensa: 8,
      licao: 'Teoria NoSQL é decisão de arquitetura: CAP, ACID × BASE, replicação, sharding e o modelo certo para cada acesso.',
    },
  ],
};
