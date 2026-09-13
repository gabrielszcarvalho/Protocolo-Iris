/**
 * Configuração do mingo usada por toda a engine.
 *
 * Montamos o contexto de operadores à mão (em vez de usar o `Query` padrão do pacote) porque
 * precisamos SUBSTITUIR operadores: no merge de contextos do mingo, o primeiro registrado vence.
 *
 * Substituições:
 *  - `$type`: segue a regra de números do mongosh (inteiro = int, fracionário = double) e
 *    reconhece objectId. O `$type` original do mingo casa "double" com qualquer número.
 *  - `$jsonSchema`: usa o nosso validador (jsonSchema.ts).
 */

import { Context, ProcessingMode } from 'mingo';
import { Query } from 'mingo/query';
import { Aggregator } from 'mingo/aggregator';
import * as accumulator from 'mingo/operators/accumulator';
import * as expression from 'mingo/operators/expression';
import * as pipeline from 'mingo/operators/pipeline';
import * as projection from 'mingo/operators/projection';
import * as query from 'mingo/operators/query';
import * as window from 'mingo/operators/window';
import type { Options } from 'mingo/types';
import { lerCaminhoExpandido, valorEhDoTipo, aliasDeTipoValido } from './bson';
import { validarSchema, verificarSchema, type Schema } from './jsonSchema';
import { erros } from './errors';

type Predicado = (obj: Record<string, unknown>) => boolean;

function $typeBson(selector: string, valor: unknown): Predicado {
  const tipos = (Array.isArray(valor) ? valor : [valor]) as (string | number)[];
  for (const t of tipos) {
    if (!aliasDeTipoValido(t)) {
      throw erros.valorInvalido(`Unknown type name alias: ${String(t)}`, `"${String(t)}" não é um tipo BSON. Exemplos: "string", "int", "double", "date", "array".`);
    }
  }
  return (obj) =>
    lerCaminhoExpandido(obj, selector).some((v) => {
      if (v === undefined) return false;
      if (Array.isArray(v)) {
        // "array" casa com o próprio array; os demais tipos casam com qualquer elemento.
        return tipos.some((t) => valorEhDoTipo(v, t)) || v.some((item) => tipos.some((t) => valorEhDoTipo(item, t)));
      }
      return tipos.some((t) => valorEhDoTipo(v, t));
    });
}

const CONTEXTO = Context.init({
  accumulator,
  expression,
  pipeline,
  projection,
  query: { ...query, $type: $typeBson },
  window,
} as unknown as Parameters<typeof Context.init>[0]);

function validadorJsonSchema(schema: Record<string, unknown>) {
  verificarSchema(schema);
  return (obj: unknown) => validarSchema(schema as Schema, obj).length === 0;
}

export type ResolvedorColecao = (nome: string) => Record<string, unknown>[];

export function opcoesMingo(resolver?: ResolvedorColecao): Partial<Options> {
  return {
    idKey: '_id',
    context: CONTEXTO,
    scriptEnabled: false, // $where/$function desligados: o jogo não executa código arbitrário no servidor
    useStrictMode: true,
    processingMode: ProcessingMode.CLONE_INPUT,
    jsonSchemaValidator: validadorJsonSchema as Options['jsonSchemaValidator'],
    collectionResolver: resolver as Options['collectionResolver'],
  };
}

export function criarQuery(filtro: Record<string, unknown>, resolver?: ResolvedorColecao): Query {
  return new Query(filtro, opcoesMingo(resolver));
}

export function criarAggregator(estagios: Record<string, unknown>[], resolver?: ResolvedorColecao): Aggregator {
  return new Aggregator(estagios, opcoesMingo(resolver));
}
