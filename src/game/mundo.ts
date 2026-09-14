/**
 * O mundo do jogo: gerado de forma determinística (mesma semente ⇒ mesmas almas).
 *
 * Fase 1 — "O Limbo": 8 fichas escritas à mão, pequenas o bastante para ler inteiras.
 * Fase 2 — "O Porão": ~300 fichas digitadas às pressas, em todos os setores. O Arquivo Morto
 *          concentra a sujeira legada de propósito (é conteúdo, não bug).
 */

import { Database } from '../engine/database';
import { ObjectId } from '../engine/bson';

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

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export function criarMundo(fase = 1): Database {
  const db = new Database();
  db.colecao('almas').insertMany(fichasDaFase1());
  if (fase >= 2) aplicarFase(db, 2);
  db.historico.length = 0;
  db.log.length = 0;
  return db;
}

/** Aplica o crescimento do mundo ao entrar numa fase (idempotente). */
export function aplicarFase(db: Database, fase: number): void {
  const verificador = db.verificador;
  db.verificador = undefined; // crescimento do mundo não passa pela credencial do jogador
  try {
    const almas = db.colecao('almas');
    const primeira = gerarFichasDaFase2(1)[0];
    if (fase >= 2 && !almas.findOne({ _id: primeira._id })) almas.insertMany(gerarFichasDaFase2());
  } finally {
    db.verificador = verificador;
    db.historico.length = 0;
  }
}
