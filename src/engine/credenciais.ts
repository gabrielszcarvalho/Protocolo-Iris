/**
 * Inspeção das operações executadas.
 *
 * A engine não decide o que está liberado — quem decide é o jogo (Árvore de Credenciamento),
 * através do `Database.verificador`. Aqui ficam só as ferramentas para:
 *  - listar tudo o que uma operação usa (métodos, operadores, opções);
 *  - traduzir cada item para uma "chave de credencial" (o mesmo nome pode significar coisas
 *    diferentes: `$sort` dentro de `$push` é outra credencial que o estágio `$sort`);
 *  - ler o "AST" de um pipeline — ex.: conferir que ele tem dois `$match` — sem olhar a string.
 */

import { ehObjetoSimples } from './bson';

export interface Operacao {
  colecao?: string;
  metodo: string;
  args: unknown[];
}

export type Contexto = 'crud' | 'agregacao';

/** Nomes que mudam de significado dentro de um aggregate. */
const AMBIGUOS_EM_AGREGACAO = new Set(['$sort', '$slice', '$addToSet', '$push', '$min', '$max', '$set', '$unset']);

const OPCOES_RELEVANTES = ['ordered', 'upsert', 'arrayFilters', 'validator', 'validationLevel', 'validationAction'];

export function contextoDa(op: Operacao): Contexto {
  return op.metodo === 'aggregate' ? 'agregacao' : 'crud';
}

export function chaveDoOperador(nome: string, contexto: Contexto): string {
  return contexto === 'agregacao' && AMBIGUOS_EM_AGREGACAO.has(nome) ? `${nome}@agregacao` : nome;
}

/** Caminhos de update com $, $[] ou $[apelido]. */
function operadoresDeCaminho(caminho: string): string[] {
  const achados: string[] = [];
  for (const parte of caminho.split('.')) {
    if (parte === '$') achados.push('$ (posicional)');
    else if (parte === '$[]') achados.push('$[]');
    else if (/^\$\[\w+\]$/.test(parte)) achados.push('$[<apelido>]');
  }
  return achados;
}

function varrer(valor: unknown, achados: string[]): void {
  if (valor instanceof RegExp) {
    achados.push('$regex');
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) varrer(item, achados);
    return;
  }
  if (!ehObjetoSimples(valor)) return;
  for (const [k, v] of Object.entries(valor)) {
    if (k.startsWith('$') && !k.startsWith('$[')) achados.push(k);
    else if (k.includes('$')) achados.push(...operadoresDeCaminho(k));
    varrer(v, achados);
  }
}

/** Lista (com repetição, na ordem em que aparecem) tudo o que a operação usa. */
export function operadoresDaOperacao(op: Operacao): string[] {
  const achados = [op.metodo];
  if (op.metodo === 'runCommand' && ehObjetoSimples(op.args[0])) {
    achados.push(Object.keys(op.args[0])[0]);
  }
  for (const arg of op.args) {
    if (ehObjetoSimples(arg)) {
      for (const opcao of OPCOES_RELEVANTES) if (opcao in arg) achados.push(opcao);
    }
    varrer(arg, achados);
  }
  return achados;
}

/** Chaves de credencial, sem repetição, na ordem em que aparecem. */
export function chavesDaOperacao(op: Operacao): { nome: string; chave: string }[] {
  const contexto = contextoDa(op);
  const vistos = new Set<string>();
  const saida: { nome: string; chave: string }[] = [];
  for (const nome of operadoresDaOperacao(op)) {
    const chave = chaveDoOperador(nome, contexto);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push({ nome, chave });
  }
  return saida;
}

/** Estágios de um pipeline, na ordem. */
export function estagiosDoPipeline(op: Operacao): string[] {
  if (op.metodo !== 'aggregate' || !Array.isArray(op.args[0])) return [];
  return (op.args[0] as unknown[]).map((e) => (ehObjetoSimples(e) ? Object.keys(e)[0] ?? '?' : '?'));
}
