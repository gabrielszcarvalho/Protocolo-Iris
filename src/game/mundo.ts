/**
 * O mundo do jogo: gerado de forma determinística (mesma semente ⇒ mesmas almas).
 *
 * Fase 1 — "O Limbo": 8 fichas escritas à mão, pequenas o bastante para ler inteiras.
 * Fase 2 — "O Porão": ~300 fichas digitadas às pressas, em todos os setores. O Arquivo Morto
 *          concentra a sujeira legada de propósito (é conteúdo, não bug).
 */

import { Database } from '../engine/database';
import { ObjectId, canonico } from '../engine/bson';

export const SETORES = ['Limbo', 'Purgatório', 'Ante-Sala', 'Arquivo Morto', 'Correspondência'] as const;
export type Setor = (typeof SETORES)[number];

export interface Fase {
  numero: number;
  titulo: string;
  setoresAbertos: Setor[];
}

export const FASES: Fase[] = [
  { numero: 1, titulo: 'O Limbo', setoresAbertos: ['Limbo', 'Purgatório'] },
  { numero: 2, titulo: 'O Porão', setoresAbertos: [...SETORES] },
  { numero: 3, titulo: 'A Repartição', setoresAbertos: [...SETORES] },
  { numero: 4, titulo: 'O Regulamento', setoresAbertos: [...SETORES] },
  { numero: 5, titulo: 'O Juízo', setoresAbertos: [...SETORES] },
];

// ---------------------------------------------------------------------------
// Aleatoriedade determinística
// ---------------------------------------------------------------------------

export class Rng {
  private estado: number;

  constructor(semente: number) {
    this.estado = semente >>> 0;
  }

  /** mulberry32 */
  proximo(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  inteiro(min: number, max: number): number {
    return min + Math.floor(this.proximo() * (max - min + 1));
  }

  escolher<T>(lista: readonly T[]): T {
    return lista[Math.floor(this.proximo() * lista.length)];
  }

  chance(p: number): boolean {
    return this.proximo() < p;
  }

  ponderado<T>(opcoes: readonly (readonly [T, number])[]): T {
    const total = opcoes.reduce((s, [, p]) => s + p, 0);
    let r = this.proximo() * total;
    for (const [valor, peso] of opcoes) {
      r -= peso;
      if (r <= 0) return valor;
    }
    return opcoes[opcoes.length - 1][0];
  }

  amostra<T>(lista: readonly T[], n: number): T[] {
    const copia = [...lista];
    const saida: T[] = [];
    while (saida.length < n && copia.length) saida.push(copia.splice(Math.floor(this.proximo() * copia.length), 1)[0]);
    return saida;
  }

  objectId(): ObjectId {
    let hex = '';
    for (let i = 0; i < 24; i++) hex += Math.floor(this.proximo() * 16).toString(16);
    return new ObjectId(hex);
  }
}

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

const PRIMEIROS = [
  'Iracema', 'Odorico', 'Benedita', 'Zulmira', 'Aurélio', 'Celeste', 'Gaspar', 'Josefina', 'Anselmo', 'Dalva',
  'Eulália', 'Firmino', 'Glória', 'Honório', 'Idalina', 'Jovelino', 'Leocádia', 'Macário', 'Noêmia', 'Olegário',
  'Perpétua', 'Quitéria', 'Raimundo', 'Salete', 'Teodoro', 'Umbelina', 'Valdemar', 'Zenaide', 'Maria', 'José',
  'Antônia', 'Sebastião', 'Luzia', 'Cândido', 'Ermelinda', 'Deolindo', 'Otília', 'Bráulio', 'Cacilda', 'Lindolfo',
];

const SOBRENOMES = [
  'Vilaverde', 'Paz', 'Sousa', 'Reis', 'Amaral', 'Mendonça', 'Figueiredo', 'Albuquerque', 'Carvalho', 'Nogueira',
  'Bittencourt', 'Pacheco', 'Queiroz', 'Rangel', 'Siqueira', 'Toledo', 'Valente', 'Xavier', 'Moura', 'Cordeiro',
  'da Silva', 'dos Santos', 'de Oliveira', 'das Neves', 'do Carmo',
];

const PENDENCIAS = [
  'Promessa não cumprida', 'Carta não entregue', 'Dívida de jogo', 'Segredo de família', 'Receita perdida',
  'Relógio não devolvido', 'Declaração não feita', 'Herança disputada', 'Briga sem reconciliação', 'Livro emprestado',
];

const VINCULOS = [
  'mãe', 'pai', 'avó', 'avô', 'poeta', 'sindicalista', 'contrabandista', 'ex-cônjuge', 'ex-sócio', 'vizinha',
  'padeiro', 'testemunha', 'músico', 'professora', 'tia', 'irmão',
];

const ENDERECOS = [
  { bairro: 'Bexiga', uf: 'SP', cep: '01317' },
  { bairro: 'Lapa', uf: 'RJ', cep: '20241' },
  { bairro: 'Pelourinho', uf: 'BA', cep: '40026' },
  { bairro: 'Recife Antigo', uf: 'PE', cep: '50030' },
  { bairro: 'Cidade Baixa', uf: 'RS', cep: '90050' },
  { bairro: 'Savassi', uf: 'MG', cep: '30140' },
  { bairro: 'Centro', uf: 'PA', cep: '66010' },
  { bairro: 'Praia de Iracema', uf: 'CE', cep: '60060' },
];

const RUAS = ['Rua das Almas', 'Travessa do Relógio', 'Rua Direita', 'Beco do Esquecimento', 'Av. Sete de Setembro', 'Rua da Saudade', 'Ladeira do Carmo', 'Rua do Aqueduto'];

const PESO_SETOR = [['Limbo', 45], ['Purgatório', 20], ['Ante-Sala', 15], ['Arquivo Morto', 12], ['Correspondência', 8]] as const;
const PESO_PARECER = [['A', 30], ['B', 30], ['C', 25], ['Z', 15]] as const;

const dataUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);

// ---------------------------------------------------------------------------
// Fase 1: fichas escritas à mão
// ---------------------------------------------------------------------------

/** ObjectIds fixos usados por memorandos (ex.: o lote reenviado da missão 1.4). */
export const IDS = {
  iracema: new ObjectId('5f1953000000000000000001'),
  odorico: new ObjectId('5f1953000000000000000002'),
  aurelio: new ObjectId('5f1953000000000000000005'),
};

export function fichasDaFase1() {
  return [
    {
      _id: IDS.iracema, protocolo: 'A-1938-0042', nome: 'Iracema Vilaverde', setor: 'Limbo',
      pendencia: 'Promessa não cumprida', anos_pendentes: 37, falecimento: dataUTC('1938-04-02'),
      endereco: { rua: 'Rua das Almas', numero: '12', bairro: 'Bexiga', cep: '01317-000', uf: 'SP' },
      vinculos: ['mãe', 'sindicalista'],
      audiencias: [{ parecer: 'Z', peso: 44, data: dataUTC('1960-01-10') }, { parecer: 'C', peso: 12, data: dataUTC('1999-07-07') }],
      ativo: true,
    },
    {
      _id: IDS.odorico, protocolo: 'A-1951-0007', nome: 'Odorico Paz', setor: 'Purgatório',
      pendencia: 'Carta não entregue', anos_pendentes: 12, falecimento: dataUTC('1951-11-30'),
      endereco: { rua: 'Travessa do Relógio', numero: '3', bairro: 'Lapa', cep: '20241-110', uf: 'RJ' },
      vinculos: ['poeta'],
      audiencias: [{ parecer: 'A', peso: 5, data: dataUTC('1980-03-03') }],
      ativo: true,
    },
    {
      _id: new ObjectId('5f1953000000000000000003'), protocolo: 'A-1919-0001', nome: 'Benedita Sousa', setor: 'Limbo',
      pendencia: 'Receita perdida', anos_pendentes: 71, falecimento: dataUTC('1919-06-21'),
      endereco: { rua: 'Rua da Saudade', numero: '88', bairro: 'Pelourinho', cep: '40026-280', uf: 'BA' },
      vinculos: ['avó', 'padeiro'],
      audiencias: [],
      ativo: true,
    },
    {
      _id: new ObjectId('5f1953000000000000000004'), protocolo: 'A-2003-0311', nome: 'Zulmira Reis', setor: 'Limbo',
      pendencia: 'Dívida de jogo', anos_pendentes: 2, falecimento: dataUTC('2003-02-14'),
      endereco: { rua: 'Av. Sete de Setembro', numero: '700', bairro: 'Centro', cep: '66010-000', uf: 'PA' },
      vinculos: ['mãe', 'contrabandista', 'poeta'],
      audiencias: [{ parecer: 'C', peso: 31, data: dataUTC('2010-10-10') }, { parecer: 'B', peso: 18, data: dataUTC('2015-05-05') }],
      ativo: true,
    },
    {
      _id: IDS.aurelio, protocolo: 'B-1953-0000', nome: 'Aurélio Vilaverde', setor: 'Limbo',
      pendencia: 'Relatório não entregue', anos_pendentes: 0, falecimento: dataUTC('1953-09-13'),
      endereco: { rua: 'Rua do Aqueduto', numero: 's/n', bairro: 'Lapa', cep: '20241-000', uf: 'RJ' },
      vinculos: ['arquivista'],
      audiencias: [],
      ativo: true,
    },
    {
      _id: new ObjectId('5f1953000000000000000006'), protocolo: 'A-1977-0100', nome: 'Anselmo Figueiredo', setor: 'Purgatório',
      pendencia: 'Livro emprestado', anos_pendentes: 21, falecimento: dataUTC('1977-08-16'),
      endereco: { rua: 'Rua Direita', numero: '1', bairro: 'Savassi', cep: '30140-010', uf: 'MG' },
      vinculos: ['professora', 'vizinha'],
      audiencias: [{ parecer: 'Z', peso: 50, data: dataUTC('1990-12-24') }],
      ativo: true,
    },
    {
      _id: new ObjectId('5f1953000000000000000007'), protocolo: 'A-1964-0033', nome: 'Dalva Nogueira', setor: 'Purgatório',
      pendencia: 'Briga sem reconciliação', anos_pendentes: 44, falecimento: dataUTC('1964-03-31'),
      endereco: { rua: 'Ladeira do Carmo', numero: '45', bairro: 'Recife Antigo', cep: '50030-150', uf: 'PE' },
      vinculos: ['irmão', 'músico'],
      audiencias: [{ parecer: 'B', peso: 22, data: dataUTC('1970-01-01') }, { parecer: 'A', peso: 9, data: dataUTC('2001-09-09') }],
      ativo: false,
    },
    {
      _id: new ObjectId('5f1953000000000000000008'), protocolo: 'A-1988-0512', nome: 'Firmino Toledo', setor: 'Limbo',
      pendencia: 'Segredo de família', anos_pendentes: 9, falecimento: dataUTC('1988-10-05'),
      endereco: { rua: 'Beco do Esquecimento', numero: '7', bairro: 'Cidade Baixa', cep: '90050-000', uf: 'RS' },
      vinculos: ['pai', 'ex-sócio'],
      audiencias: [{ parecer: 'A', peso: 3, data: dataUTC('1995-02-02') }],
      ativo: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Fase 2: o porão
// ---------------------------------------------------------------------------

function dataEntre(rng: Rng, anoMin: number, anoMax: number): Date {
  const ano = rng.inteiro(anoMin, anoMax);
  const mes = rng.inteiro(0, 11);
  const dia = rng.inteiro(1, 28);
  return new Date(Date.UTC(ano, mes, dia));
}

export function gerarFichasDaFase2(quantidade = 292, semente = 0x1a15): Record<string, unknown>[] {
  const rng = new Rng(semente);
  const fichas: Record<string, unknown>[] = [];
  const contadorPorAno = new Map<number, number>();

  for (let i = 0; i < quantidade; i++) {
    const setor = rng.ponderado(PESO_SETOR);
    const legado = setor === 'Arquivo Morto';
    const falecimento = dataEntre(rng, 1890, 2020);
    const ano = falecimento.getUTCFullYear();
    const seq = (contadorPorAno.get(ano) ?? 0) + 1;
    contadorPorAno.set(ano, seq);
    const letra = rng.chance(0.85) ? 'A' : 'B';
    const lugar = rng.escolher(ENDERECOS);

    const ficha: Record<string, unknown> = {
      _id: rng.objectId(),
      protocolo: `${letra}-${ano}-${String(seq).padStart(4, '0')}`,
      nome: `${rng.escolher(PRIMEIROS)} ${rng.escolher(SOBRENOMES)}`,
      setor,
      pendencia: rng.escolher(PENDENCIAS),
      anos_pendentes: rng.inteiro(0, 90),
      falecimento,
      endereco: {
        rua: rng.escolher(RUAS),
        numero: String(rng.inteiro(1, 999)),
        bairro: lugar.bairro,
        cep: `${lugar.cep}-${String(rng.inteiro(0, 999)).padStart(3, '0')}`,
        uf: lugar.uf,
      },
      vinculos: rng.amostra(VINCULOS, rng.inteiro(0, 5)),
      audiencias: Array.from({ length: rng.inteiro(0, 5) }, () => ({
        parecer: rng.ponderado(PESO_PARECER),
        peso: rng.inteiro(0, 50),
        data: dataEntre(rng, Math.max(ano, 1900), 2025),
      })).sort((a, b) => a.data.getTime() - b.data.getTime()),
      ativo: rng.chance(0.85),
    };

    // Sujeira comum a todos os setores: CEP esquecido.
    if (rng.chance(0.06)) delete (ficha.endereco as Record<string, unknown>).cep;

    // Sujeira concentrada no Arquivo Morto.
    if (legado) {
      if (rng.chance(0.4)) ficha.anos_pendentes = String(ficha.anos_pendentes);
      if (rng.chance(0.3)) delete ficha.endereco;
      if (rng.chance(0.25)) ficha.pendencia = `${ficha.pendencia} `;
      if (rng.chance(0.2)) ficha.falecimento = (ficha.falecimento as Date).toISOString().slice(0, 10);
      if (rng.chance(0.15) && fichas.length) ficha.protocolo = rng.escolher(fichas).protocolo; // duplicata
    }
    fichas.push(ficha);
  }
  return fichas;
}

/**
 * Protocolo que aparece exatamente duas vezes, nas duas cópias com ativo: true (assim nenhuma
 * outra missão de gravação toca nessas fichas antes do Expurgo, no capítulo 4).
 */
export const PROTOCOLO_DUPLICADO: string = (() => {
  const fichas = gerarFichasDaFase2();
  const porProtocolo = new Map<string, Record<string, unknown>[]>();
  for (const f of fichas) porProtocolo.set(f.protocolo as string, [...(porProtocolo.get(f.protocolo as string) ?? []), f]);
  for (const [protocolo, copias] of porProtocolo) {
    if (copias.length === 2 && copias.every((c) => c.ativo === true)) return protocolo;
  }
  throw new Error('O gerador precisa produzir um protocolo duplicado com as duas cópias ativas.');
})();

// ---------------------------------------------------------------------------
// Fase 3: a repartição (capítulo 4 em diante)
// ---------------------------------------------------------------------------

const HABILIDADES = ['caligrafia', 'carimbo', 'paciência', 'latim', 'datilografia', 'exorcismo', 'contabilidade', 'arquivologia'];
const SELOS = ['Mérito Póstumo', 'Mérito Burocrático', 'Carimbo de Ouro', 'Assiduidade Eterna'];
const TURNOS = ['manhã', 'tarde', 'noite', 'madrugada'];
const PESO_CARGO = [
  ['Arquivista', 14],
  ['Carimbador', 6],
  ['Carimbador-Auxiliar', 2],
  ['Mensageiro', 5],
  ['Mensageiro Noturno', 2],
  ['Escrivão', 5],
  ['Chefe de Setor', 4],
] as const;

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function fixo(n: number, nome: string, cargo: string, setor: string, turno: string, creditos: number, habilidades: string[], email: string, ramal: string) {
  return {
    _id: new ObjectId(`5f1953a000000000000000${String(n).padStart(2, '0')}`),
    nome, cargo, setor, turno, creditos,
    admissao: dataUTC(`19${String(40 + n).padStart(2, '0')}-03-03`),
    ativo: true, habilidades, selos: [], contato: { email, ramal },
  };
}

export function gerarArquivistas(semente = 0x5e10): Record<string, unknown>[] {
  const rng = new Rng(semente);
  const lista: Record<string, unknown>[] = [
    {
      _id: new ObjectId('5f1953a00000000000000001'), nome: 'Custódia Ramos', cargo: 'Arquivista-Chefe Interina', setor: 'Limbo', turno: 'noite',
      creditos: 840, admissao: dataUTC('1921-02-02'), ativo: true, habilidades: ['caligrafia', 'paciência'],
      selos: [{ nome: 'Mérito Póstumo', ano: 1992 }], contato: { email: 'custodia.ramos@iris.gov', ramal: '0042' },
    },
    {
      _id: new ObjectId('5f1953a00000000000000002'), nome: 'Ananias Pacheco', cargo: 'Carimbador', setor: 'Correspondência', turno: 'manhã',
      creditos: 60, admissao: dataUTC('1960-07-10'), ativo: true, habilidades: ['carimbo'], selos: [],
      contato: { email: 'ananias.pacheco@iris.com', ramal: '311' },
    },
    {
      _id: new ObjectId('5f1953a00000000000000003'), nome: 'Belarmino Queiroz', cargo: 'Chefe de Setor', setor: 'Purgatório', turno: 'tarde',
      creditos: 1080, admissao: dataUTC('1938-12-01'), ativo: true, habilidades: ['latim', 'contabilidade'],
      selos: [{ nome: 'Carimbo de Ouro', ano: 1975 }, { nome: 'Mérito Burocrático', ano: 2001 }], contato: { email: 'belarmino.queiroz@Iris.Gov', ramal: '1200' },
    },
    fixo(4, 'Olímpio Caronte', 'Mensageiro', 'Correspondência', 'madrugada', 300, ['latim'], 'mensageiro@iris.gov', '5150'),
    fixo(5, 'Zacarias Lume', 'Carimbador-Auxiliar', 'Purgatório', 'tarde', 410, ['carimbo'], 'zacarias_lume@iris.gov', '212'),
    fixo(6, 'Dorotéia Vaz', 'Mensageiro Noturno', 'Limbo', 'noite', 520, ['exorcismo'], 'doroteia.vaz@irisXgov', '8080'),
    // Chefes com ramais legados (os únicos que mantêm ramal depois do memorando Sigilo).
    fixo(7, 'Epaminondas Feitosa', 'Chefe de Setor', 'Arquivo Morto', 'manhã', 700, ['arquivologia'], 'epaminondas.feitosa@iris.gov.br', '42'),
    fixo(8, 'Filomena Brandão', 'Chefe de Setor', 'Ante-Sala', 'noite', 650, ['paciência'], 'filomena.brandao@iris.gov', '00042'),
    fixo(9, 'Gumercindo Paiva', 'Chefe de Setor', 'Limbo', 'madrugada', 880, ['contabilidade'], 'gumercindo.paiva@Iris.Gov', 'r-311'),
  ];
  const usados = new Set(lista.map((a) => a.nome));
  const dominios = ['@iris.gov', '@iris.gov', '@iris.gov', '@iris.gov', '@Iris.Gov', '@iris.gov.br', '@irisXgov'];
  while (lista.length < 40) {
    const primeiro = rng.escolher(PRIMEIROS);
    const sobrenome = rng.escolher(SOBRENOMES);
    const nome = `${primeiro} ${sobrenome}`;
    if (usados.has(nome)) continue;
    usados.add(nome);
    const i = lista.length;
    const usuario = semAcento(`${primeiro}.${sobrenome.replace(/\s+/g, '')}`).toLowerCase();
    const turno = rng.escolher(TURNOS);
    const habilidades = rng.amostra(HABILIDADES, rng.inteiro(1, 3));
    lista.push({
      _id: rng.objectId(),
      nome,
      cargo: rng.ponderado(PESO_CARGO),
      setor: rng.ponderado(PESO_SETOR),
      turno,
      creditos: rng.inteiro(100, 990),
      admissao: dataEntre(rng, 1900, 2020),
      ativo: rng.chance(0.85),
      habilidades,
      selos: rng.amostra(SELOS, rng.inteiro(0, 2)).map((s) => ({ nome: s, ano: rng.inteiro(1950, 2020) })),
      contato: {
        email: `${usuario}${dominios[i % dominios.length]}`,
        ramal: i % 5 === 0 ? String(rng.inteiro(100, 999)) : String(rng.inteiro(1000, 9999)),
      },
    });
  }
  return lista;
}

export function gerarRascunhos(): Record<string, unknown>[] {
  return Array.from({ length: 30 }, (_, i) => ({ titulo: `Rascunho ${i + 1}`, texto: 'Ilegível. Parece ter sido escrito durante o incêndio.' }));
}

/** Fichas digitadas com erro de grafia (conteúdo do capítulo 6) e casos de arrays do capítulo 5. */
export function fichasEspeciaisDaFase3(): Record<string, unknown>[] {
  const base = (i: number, protocolo: string, nome: string): Record<string, unknown> => ({
    _id: new ObjectId(`5f1953b000000000000000${String(i).padStart(2, '0')}`),
    protocolo,
    nome,
    setor: 'Arquivo Morto',
    pendencia: 'Segredo de família',
    anos_pendentes: 20 + i,
    falecimento: dataUTC(`19${String(30 + i).padStart(2, '0')}-05-05`),
    endereco: { rua: 'Rua da Saudade', numero: String(i), bairro: 'Centro', cep: '66010-000', uf: 'PA' },
    vinculos: ['vizinha'],
    audiencias: [{ parecer: 'B', peso: 10 + i, data: dataUTC('1999-01-01') }],
    ativo: true,
  });
  const grafia: [string, string][] = [
    ['a-1932-0007', 'BENEDITA DAS NEVES'],
    ['A1932-0017', 'josé do carmo'],
    ['A-32-0027', 'Maria de Souza'],
    ['A-1932-7', 'Cândido dos Santos'],
    [' A-1932-0037', 'Deolindo Valente'],
    ['A-1932-0047 ', 'Valdemar Siqueira'],
    ['XA-1932-0057', 'Otília Rangel'],
    ['A-1932-0067-B', 'Bráulio da Silva'],
    ['C-1950-0001', 'Cacilda Moura'],
    ['1950-0002', 'Lindolfo Xavier'],
    ['A-1919-00037', 'Ermelinda Toledo'],
    ['A–1920-0001', 'Salete Cordeiro'],
  ];
  const fichas = grafia.map(([protocolo, nome], i) => base(i + 1, protocolo, nome));
  // Almas com DUAS audiências de parecer Z e peso acima de 45 (o posicional $ só pega a primeira).
  fichas.push(
    {
      ...base(20, 'A-1945-0020', 'Custódio Albuquerque'),
      setor: 'Purgatório',
      audiencias: [
        { parecer: 'Z', peso: 48, data: dataUTC('1950-01-01') },
        { parecer: 'A', peso: 3, data: dataUTC('1960-01-01') },
        { parecer: 'Z', peso: 50, data: dataUTC('1970-01-01') },
      ],
    },
    {
      ...base(21, 'A-1946-0021', 'Honorata Bittencourt'),
      setor: 'Limbo',
      audiencias: [
        { parecer: 'Z', peso: 46, data: dataUTC('1951-01-01') },
        { parecer: 'Z', peso: 30, data: dataUTC('1961-01-01') },
        { parecer: 'Z', peso: 49, data: dataUTC('1971-01-01') },
      ],
    },
  );
  return fichas;
}

// ---------------------------------------------------------------------------
// Fase 4: o regulamento (capítulo 7 em diante)
// ---------------------------------------------------------------------------

export const NORMA_REQUERIMENTOS = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['codigo', 'requerente', 'situacao', 'valor'],
    properties: {
      codigo: { bsonType: 'string', pattern: '^RQ-\\d{4}$' },
      requerente: { bsonType: 'string', minLength: 3 },
      situacao: { enum: ['aberto', 'deferido', 'indeferido'] },
      valor: { bsonType: ['int', 'double'], minimum: 0 },
    },
  },
};

export function gerarRequerimentos(semente = 0x7e9): Record<string, unknown>[] {
  const rng = new Rng(semente);
  return Array.from({ length: 40 }, (_, i) => {
    const n = i + 1;
    const doc: Record<string, unknown> = {
      _id: new ObjectId(`5f1953c0000000000000${String(n).padStart(4, '0')}`),
      codigo: `RQ-${String(n).padStart(4, '0')}`,
      requerente: `${rng.escolher(PRIMEIROS)} ${rng.escolher(SOBRENOMES)}`,
      situacao: rng.escolher(['aberto', 'deferido', 'indeferido']),
      valor: rng.inteiro(10, 5000),
      criadoEm: dataEntre(rng, 1953, 2020),
    };
    // Legado: valor como texto, situação em caixa alta, requerente esquecido.
    if ([3, 7, 12, 19, 25].includes(n)) doc.valor = String(doc.valor);
    if ([5, 14, 22, 33].includes(n)) doc.situacao = 'ABERTO';
    if ([9, 28, 36].includes(n)) delete doc.requerente;
    return doc;
  });
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fase 5: o Juízo (capítulo 13) — almas plantadas para derrubar os erros clássicos
// ---------------------------------------------------------------------------

export const IDS_DO_JUIZO = {
  serafina: new ObjectId('5f1953c00000000000000001'),
  anacleto: new ObjectId('5f1953c00000000000000002'),
  belmiro: new ObjectId('5f1953c00000000000000003'),
  olinda: new ObjectId('5f1953c00000000000000004'),
  rufino: new ObjectId('5f1953c00000000000000005'),
  tobias: new ObjectId('5f1953c00000000000000006'),
};

export function almasDoJuizo(): Record<string, unknown>[] {
  const endereco = (rua: string, numero: string, bairro: string, cep: string, uf: string) => ({ rua, numero, bairro, cep, uf });
  return [
    {
      // Merece o Céu (só pareceres A e B), mas o protocolo tem um espaço no começo: a norma das sentenças recusa.
      _id: IDS_DO_JUIZO.serafina, protocolo: ' A-1960-0144', nome: 'Serafina Luz', setor: 'Ante-Sala',
      pendencia: 'Promessa não cumprida', anos_pendentes: 64, falecimento: dataUTC('1960-02-11'),
      endereco: endereco('Rua das Almas', '144', 'Bexiga', '01317-144', 'SP'),
      vinculos: ['avó', 'poeta'],
      audiencias: [{ parecer: 'A', peso: 30, data: dataUTC('1970-03-03') }, { parecer: 'B', peso: 22, data: dataUTC('1990-04-04') }],
      ativo: true,
    },
    {
      // Tem um parecer A, mas também um C: não vai para o Céu (derruba "pelo menos uma audiência boa").
      _id: IDS_DO_JUIZO.anacleto, protocolo: 'A-1971-0321', nome: 'Anacleto Cinza', setor: 'Ante-Sala',
      pendencia: 'Relógio não devolvido', anos_pendentes: 53, falecimento: dataUTC('1971-07-21'),
      endereco: endereco('Travessa do Relógio', '321', 'Lapa', '20241-321', 'RJ'),
      vinculos: ['padeiro'],
      audiencias: [{ parecer: 'A', peso: 40, data: dataUTC('1980-01-01') }, { parecer: 'C', peso: 2, data: dataUTC('2000-01-01') }],
      ativo: true,
    },
    {
      // Condenado (Z com peso 48 e dívida). Tem mãe: recorre. O Z de 48 continua Z depois do recurso.
      _id: IDS_DO_JUIZO.belmiro, protocolo: 'B-1911-0666', nome: 'Belmiro Trevas', setor: 'Correspondência',
      pendencia: 'Dívida de jogo', anos_pendentes: 88, falecimento: dataUTC('1911-06-06'),
      endereco: endereco('Beco do Esquecimento', '666', 'Cidade Baixa', '90050-666', 'RS'),
      vinculos: ['mãe', 'ex-sócio'],
      audiencias: [{ parecer: 'Z', peso: 48, data: dataUTC('1930-06-06') }, { parecer: 'A', peso: 5, data: dataUTC('1950-06-06') }],
      ativo: true,
    },
    {
      // Mesmo protocolo de Belmiro (só uma sentença entra), anos_pendentes em texto e DOIS Z abaixo de 45.
      _id: IDS_DO_JUIZO.olinda, protocolo: 'B-1911-0666', nome: 'Olinda Brasa', setor: 'Arquivo Morto',
      pendencia: 'Herança disputada', anos_pendentes: '52', falecimento: dataUTC('1911-06-07'),
      endereco: endereco('Rua do Aqueduto', '13', 'Centro', '66010-013', 'PA'),
      vinculos: ['mãe'],
      audiencias: [{ parecer: 'Z', peso: 41, data: dataUTC('1920-02-02') }, { parecer: 'Z', peso: 12, data: dataUTC('1921-02-02') }],
      ativo: true,
    },
    {
      // Um Z leve e um peso alto em OUTRA audiência: com dot notation, iria para o Inferno por engano.
      _id: IDS_DO_JUIZO.rufino, protocolo: 'A-1942-0808', nome: 'Rufino Vapor', setor: 'Purgatório',
      pendencia: 'Herança disputada', anos_pendentes: 70, falecimento: dataUTC('1942-08-08'),
      endereco: endereco('Ladeira do Carmo', '808', 'Recife Antigo', '50030-808', 'PE'),
      vinculos: ['pai'],
      audiencias: [{ parecer: 'Z', peso: 10, data: dataUTC('1950-08-08') }, { parecer: 'A', peso: 42, data: dataUTC('1960-08-08') }],
      ativo: true,
    },
    {
      // Continua entre os dois: é o caso garantido do último despacho.
      _id: IDS_DO_JUIZO.tobias, protocolo: 'A-1988-0909', nome: 'Tobias dos Anjos', setor: 'Purgatório',
      pendencia: 'Carta não entregue', anos_pendentes: 61, falecimento: dataUTC('1988-09-09'),
      endereco: endereco('Rua Direita', '909', 'Savassi', '30140-909', 'MG'),
      vinculos: ['pai'],
      audiencias: [
        { parecer: 'B', peso: 20, data: dataUTC('1995-09-09') },
        { parecer: 'C', peso: 15, data: dataUTC('2005-09-09') },
        { parecer: 'B', peso: 8, data: dataUTC('2015-09-09') },
      ],
      ativo: true,
    },
  ];
}

export function criarMundo(fase = 1): Database {
  const db = new Database();
  db.colecao('almas').insertMany(fichasDaFase1());
  for (let f = 2; f <= fase; f++) aplicarFase(db, f);
  db.historico.length = 0;
  db.log.length = 0;
  return db;
}

/** Aplica o crescimento do mundo ao entrar numa fase (idempotente e cumulativo). */
export function aplicarFase(db: Database, fase: number): void {
  const verificador = db.verificador;
  db.verificador = undefined; // crescimento do mundo não passa pela credencial do jogador
  try {
    const almas = db.colecao('almas');
    // A fase 2 conta como aplicada se QUALQUER ficha do porão ainda existir (o jogador pode ter apagado algumas).
    const doPorao = gerarFichasDaFase2();
    const idsDoPorao = new Set(doPorao.map((f) => canonico(f._id)));
    if (fase >= 2 && !almas.docs.some((d) => idsDoPorao.has(canonico(d._id)))) almas.insertMany(doPorao);
    if (fase >= 3 && !db.existe('arquivistas')) {
      db.colecao('arquivistas').insertMany(gerarArquivistas());
      db.colecao('rascunhos').insertMany(gerarRascunhos());
      almas.insertMany(fichasEspeciaisDaFase3());
    }
    if (fase >= 4 && !db.existe('requerimentos')) db.colecao('requerimentos').insertMany(gerarRequerimentos());
    const idsDoJuizo = new Set(Object.values(IDS_DO_JUIZO).map((id) => canonico(id)));
    if (fase >= 5 && !almas.docs.some((d) => idsDoJuizo.has(canonico(d._id)))) almas.insertMany(almasDoJuizo());
  } finally {
    db.verificador = verificador;
    db.historico.length = 0;
  }
}
