/**
 * Implementação própria de $jsonSchema com a semântica do MongoDB (não do JSON Schema "puro").
 *
 * Diferenças didáticas importantes em relação ao JSON Schema da web:
 *  - `bsonType` existe e distingue int, long, double, date, objectId...;
 *  - `type: "integer"` NÃO é suportado pelo MongoDB;
 *  - palavras-chave de um tipo só se aplicam a valores daquele tipo: `minimum` ignora strings,
 *    `minLength` ignora números. Por isso `{ minimum: 1 }` sozinho não barra `"37"`;
 *  - `exclusiveMinimum`/`exclusiveMaximum` são booleanos (estilo draft 4);
 *  - palavra-chave desconhecida (ex.: `minlength` minúsculo) é ERRO ao criar o validador.
 *
 * O formato das falhas imita o `errInfo.details` do servidor (MongoDB 5+).
 */

import { aliasDeTipoValido, canonico, tipoBson, valorEhDoTipo, ehObjetoSimples } from './bson';
import { erros } from './errors';

export type Schema = Record<string, unknown>;

export interface Falha {
  operatorName: string;
  specifiedAs?: Record<string, unknown>;
  reason?: string;
  consideredValue?: unknown;
  consideredType?: string;
  missingProperties?: string[];
  propertiesNotSatisfied?: { propertyName: string; details: Falha[] }[];
  itemIndex?: number;
  details?: Falha[];
}

const PALAVRAS_CHAVE = new Set([
  'bsonType', 'type', 'required', 'properties', 'minProperties', 'maxProperties',
  'patternProperties', 'additionalProperties', 'enum', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'pattern',
  'minItems', 'maxItems', 'uniqueItems', 'items', 'additionalItems', 'allOf',
  'anyOf', 'oneOf', 'not', 'dependencies', 'title', 'description', 'multipleOf',
]);

const TIPOS_JSON = new Set(['object', 'array', 'number', 'boolean', 'string', 'null']);

// ---------------------------------------------------------------------------
// Verificação estrutural do schema (acontece no createCollection / collMod)
// ---------------------------------------------------------------------------

export function verificarSchema(schema: unknown, caminho = '$jsonSchema'): void {
  if (!ehObjetoSimples(schema)) {
    throw erros.valorInvalido(`${caminho} must be an object`, 'O $jsonSchema precisa ser um objeto { ... }.');
  }
  for (const [chave, valor] of Object.entries(schema)) {
    if (!PALAVRAS_CHAVE.has(chave)) {
      throw erros.valorInvalido(
        `Unknown $jsonSchema keyword: ${chave}`,
        `"${chave}" não é uma palavra-chave de $jsonSchema. Confira maiúsculas: minLength, bsonType, minItems...`,
      );
    }
    const exigirNumero = () => {
      if (typeof valor !== 'number') {
        throw erros.valorInvalido(
          `$jsonSchema keyword '${chave}' must be a number`,
          `"${chave}" recebe um número, não ${tipoBson(valor)}.`,
        );
      }
    };
    switch (chave) {
      case 'bsonType': {
        const tipos = Array.isArray(valor) ? valor : [valor];
        for (const t of tipos) {
          if (!aliasDeTipoValido(t)) {
            throw erros.valorInvalido(
              `Unknown type name alias: ${String(t)}`,
              `"${String(t)}" não é um bsonType. Use: "string", "int", "double", "long", "number", "bool", "date", "object", "array", "objectId", "null".`,
            );
          }
        }
        break;
      }
      case 'type': {
        const tipos = Array.isArray(valor) ? valor : [valor];
        for (const t of tipos) {
          if (typeof t !== 'string' || !TIPOS_JSON.has(t)) {
            throw erros.valorInvalido(
              `Unknown type name alias: ${String(t)}`,
              t === 'integer'
                ? 'O MongoDB não aceita type: "integer". Use bsonType: "int".'
                : `"${String(t)}" não é um type válido. Prefira bsonType.`,
            );
          }
        }
        break;
      }
      case 'required':
        if (!Array.isArray(valor) || valor.length === 0 || valor.some((v) => typeof v !== 'string')) {
          throw erros.valorInvalido(
            "$jsonSchema keyword 'required' must be an array of strings",
            'required é uma lista de nomes de campo: required: ["nome", "setor"].',
          );
        }
        break;
      case 'enum':
        if (!Array.isArray(valor) || valor.length === 0) {
          throw erros.valorInvalido(
            "$jsonSchema keyword 'enum' must be a non-empty array",
            'enum é uma lista com os valores permitidos: enum: ["aberto", "fechado"].',
          );
        }
        break;
      case 'minimum': case 'maximum': case 'minLength': case 'maxLength':
      case 'minItems': case 'maxItems': case 'minProperties': case 'maxProperties': case 'multipleOf':
        exigirNumero();
        break;
      case 'exclusiveMinimum': case 'exclusiveMaximum': case 'uniqueItems':
        if (typeof valor !== 'boolean') {
          throw erros.valorInvalido(
            `$jsonSchema keyword '${chave}' must be a boolean`,
            `No MongoDB, ${chave} é true/false e acompanha minimum/maximum.`,
          );
        }
        break;
      case 'pattern':
        if (typeof valor !== 'string' && !(valor instanceof RegExp)) {
          throw erros.valorInvalido("$jsonSchema keyword 'pattern' must be a string", 'pattern recebe a expressão como string: pattern: "^A-\\\\d{4}$".');
        }
        break;
      case 'properties': case 'patternProperties':
        if (!ehObjetoSimples(valor)) {
          throw erros.valorInvalido(`$jsonSchema keyword '${chave}' must be an object`, `${chave} é um objeto: { campo: { ...regras } }.`);
        }
        for (const [nome, sub] of Object.entries(valor)) verificarSchema(sub, `${caminho}.${chave}.${nome}`);
        break;
      case 'items':
        if (Array.isArray(valor)) valor.forEach((s, i) => verificarSchema(s, `${caminho}.items.${i}`));
        else verificarSchema(valor, `${caminho}.items`);
        break;
      case 'additionalProperties': case 'additionalItems':
        if (typeof valor !== 'boolean') verificarSchema(valor, `${caminho}.${chave}`);
        break;
      case 'allOf': case 'anyOf': case 'oneOf':
        if (!Array.isArray(valor) || valor.length === 0) {
          throw erros.valorInvalido(`$jsonSchema keyword '${chave}' must be a non-empty array`, `${chave} recebe uma lista de schemas.`);
        }
        valor.forEach((s, i) => verificarSchema(s, `${caminho}.${chave}.${i}`));
        break;
      case 'not':
        verificarSchema(valor, `${caminho}.not`);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

function tipoJson(v: unknown): string {
  const t = tipoBson(v);
  if (t === 'int' || t === 'long' || t === 'double') return 'number';
  if (t === 'bool') return 'boolean';
  if (t === 'array' || t === 'null' || t === 'string' || t === 'object') return t;
  return t;
}

function comoRegex(p: unknown): RegExp {
  return p instanceof RegExp ? p : new RegExp(String(p), 'u');
}

/** Retorna a lista de regras não satisfeitas (vazia = válido). */
export function validarSchema(schema: Schema, valor: unknown): Falha[] {
  const falhas: Falha[] = [];
  const tipo = tipoBson(valor);
  const ehNumero = tipo === 'int' || tipo === 'long' || tipo === 'double';

  if (schema.bsonType !== undefined) {
    const tipos = (Array.isArray(schema.bsonType) ? schema.bsonType : [schema.bsonType]) as string[];
    if (!tipos.some((t) => valorEhDoTipo(valor, t))) {
      falhas.push({
        operatorName: 'bsonType',
        specifiedAs: { bsonType: schema.bsonType },
        reason: 'type did not match',
        consideredValue: valor,
        consideredType: tipo,
      });
    }
  }

  if (schema.type !== undefined) {
    const tipos = (Array.isArray(schema.type) ? schema.type : [schema.type]) as string[];
    if (!tipos.includes(tipoJson(valor))) {
      falhas.push({
        operatorName: 'type',
        specifiedAs: { type: schema.type },
        reason: 'type did not match',
        consideredValue: valor,
        consideredType: tipo,
      });
    }
  }

  if (schema.enum !== undefined) {
    const aceitos = (schema.enum as unknown[]).map(canonico);
    if (!aceitos.includes(canonico(valor))) {
      falhas.push({
        operatorName: 'enum',
        specifiedAs: { enum: schema.enum },
        reason: 'value was not found in enum',
        consideredValue: valor,
      });
    }
  }

  for (const sub of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (schema[sub] === undefined) continue;
    const resultados = (schema[sub] as Schema[]).map((s) => validarSchema(s, valor));
    const satisfeitos = resultados.filter((r) => r.length === 0).length;
    const ok =
      sub === 'allOf' ? satisfeitos === resultados.length : sub === 'anyOf' ? satisfeitos > 0 : satisfeitos === 1;
    if (!ok) {
      falhas.push({
        operatorName: sub,
        specifiedAs: { [sub]: schema[sub] },
        reason:
          sub === 'allOf'
            ? 'at least one clause did not match'
            : sub === 'anyOf'
              ? 'no clause matched'
              : satisfeitos === 0 ? 'no clause matched' : 'more than one clause matched',
        details: resultados.flat(),
      });
    }
  }

  if (schema.not !== undefined && validarSchema(schema.not as Schema, valor).length === 0) {
    falhas.push({ operatorName: 'not', specifiedAs: { not: schema.not }, reason: 'child schema matched', consideredValue: valor });
  }

  // --- números
  if (ehNumero) {
    const n = valor as number;
    if (typeof schema.minimum === 'number') {
      const exclusivo = schema.exclusiveMinimum === true;
      if (exclusivo ? n <= schema.minimum : n < schema.minimum) {
        falhas.push({
          operatorName: 'minimum',
          specifiedAs: { minimum: schema.minimum, ...(exclusivo ? { exclusiveMinimum: true } : {}) },
          reason: 'comparison failed',
          consideredValue: n,
        });
      }
    }
    if (typeof schema.maximum === 'number') {
      const exclusivo = schema.exclusiveMaximum === true;
      if (exclusivo ? n >= schema.maximum : n > schema.maximum) {
        falhas.push({
          operatorName: 'maximum',
          specifiedAs: { maximum: schema.maximum, ...(exclusivo ? { exclusiveMaximum: true } : {}) },
          reason: 'comparison failed',
          consideredValue: n,
        });
      }
    }
    if (typeof schema.multipleOf === 'number' && n % schema.multipleOf !== 0) {
      falhas.push({ operatorName: 'multipleOf', specifiedAs: { multipleOf: schema.multipleOf }, reason: 'considered value is not a multiple of the specified value', consideredValue: n });
    }
  }

  // --- strings
  if (tipo === 'string') {
    const s = valor as string;
    const tamanho = [...s].length; // conta caracteres, não unidades UTF-16
    if (typeof schema.minLength === 'number' && tamanho < schema.minLength) {
      falhas.push({ operatorName: 'minLength', specifiedAs: { minLength: schema.minLength }, reason: 'specified string length was not satisfied', consideredValue: s });
    }
    if (typeof schema.maxLength === 'number' && tamanho > schema.maxLength) {
      falhas.push({ operatorName: 'maxLength', specifiedAs: { maxLength: schema.maxLength }, reason: 'specified string length was not satisfied', consideredValue: s });
    }
    if (schema.pattern !== undefined && !comoRegex(schema.pattern).test(s)) {
      falhas.push({ operatorName: 'pattern', specifiedAs: { pattern: String(schema.pattern) }, reason: 'regular expression did not match', consideredValue: s });
    }
  }

  // --- arrays
  if (tipo === 'array') {
    const arr = valor as unknown[];
    if (typeof schema.minItems === 'number' && arr.length < schema.minItems) {
      falhas.push({ operatorName: 'minItems', specifiedAs: { minItems: schema.minItems }, reason: 'array did not match specified length', consideredValue: arr });
    }
    if (typeof schema.maxItems === 'number' && arr.length > schema.maxItems) {
      falhas.push({ operatorName: 'maxItems', specifiedAs: { maxItems: schema.maxItems }, reason: 'array did not match specified length', consideredValue: arr });
    }
    if (schema.uniqueItems === true && new Set(arr.map(canonico)).size !== arr.length) {
      falhas.push({ operatorName: 'uniqueItems', specifiedAs: { uniqueItems: true }, reason: 'found a duplicate item', consideredValue: arr });
    }
    if (schema.items !== undefined) {
      if (Array.isArray(schema.items)) {
        const tupla = schema.items as Schema[];
        tupla.forEach((s, i) => {
          if (i >= arr.length) return;
          const det = validarSchema(s, arr[i]);
          if (det.length) falhas.push({ operatorName: 'items', reason: 'At least one item did not match the sub-schema', itemIndex: i, details: det });
        });
        if (schema.additionalItems === false && arr.length > tupla.length) {
          falhas.push({ operatorName: 'additionalItems', specifiedAs: { additionalItems: false }, reason: 'found additional items', consideredValue: arr.slice(tupla.length) });
        }
      } else {
        for (let i = 0; i < arr.length; i++) {
          const det = validarSchema(schema.items as Schema, arr[i]);
          if (det.length) {
            // O servidor reporta apenas o primeiro item que falhou.
            falhas.push({ operatorName: 'items', reason: 'At least one item did not match the sub-schema', itemIndex: i, details: det });
            break;
          }
        }
      }
    }
  }

  // --- objetos
  if (tipo === 'object') {
    const obj = valor as Record<string, unknown>;
    if (schema.required !== undefined) {
      const faltando = (schema.required as string[]).filter((k) => !(k in obj));
      if (faltando.length) {
        falhas.push({ operatorName: 'required', specifiedAs: { required: schema.required }, missingProperties: faltando });
      }
    }
    const nChaves = Object.keys(obj).length;
    if (typeof schema.minProperties === 'number' && nChaves < schema.minProperties) {
      falhas.push({ operatorName: 'minProperties', specifiedAs: { minProperties: schema.minProperties }, reason: 'specified number of properties was not satisfied', consideredValue: obj });
    }
    if (typeof schema.maxProperties === 'number' && nChaves > schema.maxProperties) {
      falhas.push({ operatorName: 'maxProperties', specifiedAs: { maxProperties: schema.maxProperties }, reason: 'specified number of properties was not satisfied', consideredValue: obj });
    }

    const props = (schema.properties ?? {}) as Record<string, Schema>;
    const naoSatisfeitas: { propertyName: string; details: Falha[] }[] = [];
    for (const [nome, sub] of Object.entries(props)) {
      if (!(nome in obj)) continue; // ausência é problema do `required`, não de `properties`
      const det = validarSchema(sub, obj[nome]);
      if (det.length) naoSatisfeitas.push({ propertyName: nome, details: det });
    }
    if (naoSatisfeitas.length) falhas.push({ operatorName: 'properties', propertiesNotSatisfied: naoSatisfeitas });

    const padroes = (schema.patternProperties ?? {}) as Record<string, Schema>;
    for (const [padrao, sub] of Object.entries(padroes)) {
      const re = new RegExp(padrao, 'u');
      for (const [k, v] of Object.entries(obj)) {
        if (!re.test(k)) continue;
        const det = validarSchema(sub, v);
        if (det.length) falhas.push({ operatorName: 'patternProperties', propertiesNotSatisfied: [{ propertyName: k, details: det }] });
      }
    }

    if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
      const extras = Object.keys(obj).filter(
        (k) => !(k in props) && !Object.keys(padroes).some((p) => new RegExp(p, 'u').test(k)),
      );
      if (schema.additionalProperties === false) {
        if (extras.length) {
          falhas.push({ operatorName: 'additionalProperties', specifiedAs: { additionalProperties: false }, reason: 'found additional properties', consideredValue: extras } as Falha);
        }
      } else {
        for (const k of extras) {
          const det = validarSchema(schema.additionalProperties as Schema, obj[k]);
          if (det.length) falhas.push({ operatorName: 'additionalProperties', propertiesNotSatisfied: [{ propertyName: k, details: det }] });
        }
      }
    }

    if (schema.dependencies !== undefined) {
      for (const [campo, dep] of Object.entries(schema.dependencies as Record<string, unknown>)) {
        if (!(campo in obj)) continue;
        if (Array.isArray(dep)) {
          const faltando = (dep as string[]).filter((k) => !(k in obj));
          if (faltando.length) falhas.push({ operatorName: 'dependencies', reason: 'missing dependency', missingProperties: faltando });
        } else {
          const det = validarSchema(dep as Schema, obj);
          if (det.length) falhas.push({ operatorName: 'dependencies', reason: 'dependent schema not satisfied', details: det });
        }
      }
    }
  }

  return falhas;
}

// ---------------------------------------------------------------------------
// Explicação em português (log do servidor e tradução do erro)
// ---------------------------------------------------------------------------

function fmt(v: unknown): string {
  if (typeof v === 'string') return `"${v}"`;
  if (v instanceof Date) return `ISODate("${v.toISOString()}")`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function explicarFalhas(falhas: Falha[], prefixo = ''): string[] {
  const linhas: string[] = [];
  const onde = prefixo ? `${prefixo}: ` : 'documento: ';
  for (const f of falhas) {
    switch (f.operatorName) {
      case 'required':
        linhas.push(`${onde}faltam os campos obrigatórios ${f.missingProperties!.map((p) => `"${p}"`).join(', ')}`);
        break;
      case 'properties':
      case 'patternProperties':
        for (const p of f.propertiesNotSatisfied ?? []) {
          linhas.push(...explicarFalhas(p.details, prefixo ? `${prefixo}.${p.propertyName}` : p.propertyName));
        }
        break;
      case 'bsonType':
      case 'type':
        linhas.push(`${onde}esperado ${f.operatorName} ${fmt(f.specifiedAs![f.operatorName])}, mas veio ${f.consideredType} (${fmt(f.consideredValue)})`);
        break;
      case 'enum':
        linhas.push(`${onde}${fmt(f.consideredValue)} não está na lista permitida ${fmt(f.specifiedAs!.enum)}`);
        break;
      case 'minimum':
        linhas.push(`${onde}${fmt(f.consideredValue)} é menor que o mínimo ${f.specifiedAs!.minimum}`);
        break;
      case 'maximum':
        linhas.push(`${onde}${fmt(f.consideredValue)} é maior que o máximo ${f.specifiedAs!.maximum}`);
        break;
      case 'minLength':
        linhas.push(`${onde}texto ${fmt(f.consideredValue)} tem menos de ${f.specifiedAs!.minLength} caracteres`);
        break;
      case 'maxLength':
        linhas.push(`${onde}texto ${fmt(f.consideredValue)} tem mais de ${f.specifiedAs!.maxLength} caracteres`);
        break;
      case 'pattern':
        linhas.push(`${onde}${fmt(f.consideredValue)} não segue o padrão /${f.specifiedAs!.pattern}/`);
        break;
      case 'minItems':
        linhas.push(`${onde}a lista precisa de pelo menos ${f.specifiedAs!.minItems} item(ns)`);
        break;
      case 'maxItems':
        linhas.push(`${onde}a lista aceita no máximo ${f.specifiedAs!.maxItems} item(ns)`);
        break;
      case 'items':
        linhas.push(...explicarFalhas(f.details ?? [], `${prefixo || 'lista'}[${f.itemIndex}]`));
        break;
      case 'additionalProperties':
        if (f.propertiesNotSatisfied) {
          for (const p of f.propertiesNotSatisfied) linhas.push(...explicarFalhas(p.details, prefixo ? `${prefixo}.${p.propertyName}` : p.propertyName));
        } else {
          linhas.push(`${onde}campos não previstos no schema: ${fmt(f.consideredValue)}`);
        }
        break;
      default:
        linhas.push(`${onde}regra ${f.operatorName} não satisfeita${f.reason ? ` (${f.reason})` : ''}`);
    }
  }
  return linhas;
}
