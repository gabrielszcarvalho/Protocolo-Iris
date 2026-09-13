/**
 * Mundo PROVISÓRIO para demonstrar a engine na etapa 1.
 * O seed determinístico completo (~2.500 almas) chega na etapa 2 e substitui este arquivo.
 */

import { Database } from '../engine/database';
import { ISODate } from '../engine/bson';

export function criarMundoDemo(): Database {
  const db = new Database();
  db.colecao('almas').insertMany([
    {
      protocolo: 'A-1938-0042', nome: 'Iracema Vilaverde', setor: 'Limbo', pendencia: 'Promessa não cumprida',
      anos_pendentes: 37, falecimento: ISODate('1938-04-02'),
      endereco: { rua: 'Rua das Almas', numero: '12', bairro: 'Bexiga', cep: '01317-000', uf: 'SP' },
      vinculos: ['mãe', 'sindicalista'],
      audiencias: [{ parecer: 'Z', peso: 44, data: ISODate('1960-01-10') }, { parecer: 'C', peso: 12, data: ISODate('1999-07-07') }],
      ativo: true,
    },
    {
      protocolo: 'A-1951-0007', nome: 'Odorico Paz', setor: 'Purgatório', pendencia: 'Carta não entregue',
      anos_pendentes: 12, falecimento: ISODate('1951-11-30'),
      endereco: { rua: 'Travessa do Relógio', numero: '3', bairro: 'Lapa', cep: '20241-110', uf: 'RJ' },
      vinculos: ['poeta'],
      audiencias: [{ parecer: 'A', peso: 5, data: ISODate('1980-03-03') }],
      ativo: true,
    },
    {
      protocolo: 'a1938/42', nome: 'BENEDITA SOUSA', setor: 'Arquivo Morto', pendencia: 'Promessa não cumprida ',
      anos_pendentes: '40', falecimento: '1938-04-02',
      vinculos: ['ex-cônjuge'], audiencias: [], ativo: false,
    },
    {
      protocolo: 'A-2003-0311', nome: 'Zulmira Reis', setor: 'Limbo', pendencia: 'Dívida de jogo',
      anos_pendentes: 2, falecimento: ISODate('2003-02-14'),
      endereco: { rua: 'Av. Sete', numero: '700', bairro: 'Centro', uf: 'BA' },
      vinculos: ['mãe', 'contrabandista', 'poeta'],
      audiencias: [{ parecer: 'C', peso: 31, data: ISODate('2010-10-10') }, { parecer: 'B', peso: 18, data: ISODate('2015-05-05') }],
      ativo: true,
    },
    {
      protocolo: 'B-1977-0100', nome: 'Aurélio Vilaverde', setor: 'Correspondência', pendencia: 'Carta não entregue',
      anos_pendentes: 21, falecimento: ISODate('1977-08-16'),
      endereco: { rua: 'Rua Direita', numero: '1', bairro: 'Sé', cep: '01002-000', uf: 'SP' },
      vinculos: ['sindicalista', 'avô'],
      audiencias: [{ parecer: 'Z', peso: 50, data: ISODate('1990-12-24') }],
      ativo: true,
    },
  ]);
  db.colecao('arquivistas').insertMany([
    { nome: 'Dona Custódia', cargo: 'Arquivista-Chefe Interina', setor: 'Limbo', turno: 'noite', creditos: 840, ativo: true, habilidades: ['caligrafia', 'paciência'], selos: [{ nome: 'Mérito Póstumo', ano: 1992 }], contato: { email: 'custodia.ramos@iris.gov', ramal: '0042' } },
    { nome: 'Seu Ananias', cargo: 'Carimbador', setor: 'Correspondência', turno: 'manhã', creditos: 120, ativo: true, habilidades: ['carimbo'], selos: [], contato: { email: 'ananias@iris.com', ramal: '311' } },
  ]);
  db.log.length = 0;
  db.historico.length = 0;
  return db;
}
