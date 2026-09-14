# Cobertura de conteúdo

Cada item do checklist da disciplina → memorando(s) que o exercitam, com os ids reais do jogo
(`src/game/missoes/capNN.ts`). Todo memorando tem teste: a solução de referência passa e marca
todos os quadradinhos, e cada erro comum é recusado com diagnóstico (`tests/game/missoes.test.ts`).

Legenda: ✅ implementado e testado · 🧪 simulado (sem servidor real por trás)

## CRUD

| Operador / recurso | Memorandos | Engine |
|---|---|---|
| `find` | 1.1 | ✅ |
| projeção inclusiva + `_id: 0` | 1.2, 8.2 | ✅ |
| filtro por igualdade + projeção exclusiva | 1.3, 2.1 | ✅ |
| `findOne` | 1.4 | ✅ |
| `countDocuments` | 1.5 | ✅ |
| `insertOne` | 1.6 | ✅ |
| `insertMany` | 1.7 | ✅ |
| `ordered: false` | 1.8 | ✅ |
| `sort` / `skip` / `limit` | 2.12 | ✅ |
| `updateOne` | 4.1, 5.1 | ✅ |
| `updateMany` | 4.2, 4.3 | ✅ |
| `upsert` | 4.6 | ✅ |
| `replaceOne` | 4.7 | ✅ |
| `deleteOne` / `deleteMany` / `drop` | 4.8 | ✅ |

## Filtros

| Operador | Memorandos | Engine |
|---|---|---|
| dot notation | 2.2 | ✅ |
| `$gt` | 2.3 | ✅ |
| `$gte` / `$lte` (faixa) | 2.4 | ✅ |
| `$ne` | 2.5 | ✅ |
| `$or` | 2.6 | ✅ |
| `$nor` | 2.7, 7.8 | ✅ |
| `$and` | 2.8 | ✅ |
| `$in` / `$nin` | 2.9, 4.3 | ✅ |
| `$exists` | 2.10, 8.5 | ✅ |
| `$type` | 2.11, 9.5, 11.3 | ✅ |
| `$all` | 3.2 | ✅ |
| `$size` | 3.3, 11.6 | ✅ |
| `$elemMatch` | 3.4, 6.10 | ✅ |
| regex (`/.../` e `$regex`) | 6.1–6.11 | ✅ |
| `$not` | 6.11 | ✅ |
| `$expr` | 11.6, 11.7 | ✅ |

## Operadores de update

| Operador | Memorandos | Engine |
|---|---|---|
| `$set` | 4.1, 4.2 | ✅ |
| `$unset` | 4.3 | ✅ |
| `$inc` / `$mul` / `$min` / `$max` | 4.4 | ✅ |
| `$rename` / `$currentDate` | 4.5 | ✅ |
| update com pipeline (`$toInt`) | 7.8 | ✅ |

## Arrays

| Operador | Memorandos | Engine |
|---|---|---|
| `$push` | 5.1 | ✅ |
| `$each` + `$position` | 5.2 | ✅ |
| `$sort` + `$slice` (em `$push`) | 5.3 | ✅ |
| `$addToSet` | 5.4 | ✅ |
| `$pull` | 5.5 | ✅ |
| `$pop` (1 e -1) | 5.6 | ✅ |
| posicional `$` | 5.7 | ✅ |
| `arrayFilters` + `$[apelido]` | 5.8 | ✅ |

## Regex

| Recurso | Memorandos | Engine |
|---|---|---|
| `^`, `$`, `.*` | 6.1 | ✅ |
| `\d`, `{n,}` | 6.2 | ✅ |
| `[^...]` | 6.3 | ✅ |
| alternância `(a\|b)` | 6.4 | ✅ |
| `[A-Z]`, `{n}` | 6.5 | ✅ |
| escape (`\.`) + flag `i` | 6.6 | ✅ |
| `\s`, `[aeo]`, `?` | 6.7 | ✅ |
| `\w`, `+` | 6.8 | ✅ |
| `{n,m}` | 6.9 | ✅ |
| `$elemMatch` + regex | 6.10 | ✅ |
| `$not` + regex | 6.11 | ✅ |

## Validação de schema

| Recurso | Memorandos | Engine |
|---|---|---|
| `db.createCollection` + `$jsonSchema`, `required`, `bsonType` | 7.1 | ✅ |
| `enum`, `minimum` / `maximum`, `minLength`, `int` × `number` | 7.2 | ✅ |
| `minItems`, `items`, objeto aninhado | 7.3 | ✅ |
| `pattern` | 7.4 | ✅ |
| `createIndex({...}, { unique: true })` + E11000 | 7.5 | ✅ |
| `collMod` (substitui o validador inteiro) | 7.6 | ✅ |
| `validationLevel: moderate`, `validationAction: error / warn`, log | 7.7 | ✅ |
| auditoria `$nor` + `$jsonSchema`, `strict` | 7.8 | ✅ |

## Aggregate

| Recurso | Memorandos | Engine |
|---|---|---|
| `aggregate` + `$match` | 8.1 | ✅ |
| `$project` | 8.2, 9.3 | ✅ |
| `$sort` / `$skip` / `$limit` no pipeline | 8.3, 9.2 | ✅ |
| estágios repetidos (dois `$match`) | 8.4 | ✅ |
| `$concat` | 8.5 | ✅ |
| `$group` + `$sum` | 9.1 | ✅ |
| `$match` depois de `$group` (HAVING) | 9.4 | ✅ |
| `$first` / `$last` / `$addToSet` | 9.5 | ✅ |
| duplo `$group` / `_id` composto | 9.6, 10.6 | ✅ |
| `$count` | 9.7, 10.1 | ✅ |
| `$unwind` | 10.1–10.6 | ✅ |
| `$avg` / `$min` / `$max` | 10.4, 10.5 | ✅ |
| `$year` | 10.6 | ✅ |
| `$cond` (forma objeto) | 11.1 | ✅ |
| `$cond` (forma lista) | 11.2 | ✅ |
| `$cond` aninhado | 11.3 | ✅ |
| `$switch` | 11.4 | ✅ |
| `$sum` + `$cond` | 11.5 | ✅ |
| `$ifNull` | 11.6 | ✅ |
| `$push` (acumulador) + `$arrayToObject` | 11.8 | ✅ |
| `$lookup` *(bônus, só no terminal)* | — | ✅ |

## Teoria

| Tema | Memorandos | Engine |
|---|---|---|
| 3 Vs do Big Data | 12.1 | ✅ |
| replica set, eleição, número ímpar de membros | 12.2 | ✅ 🧪 |
| ACID × BASE, CAP, consistência eventual (`writeConcern`, `readConcern`, `readPreference`) | 12.3 | ✅ 🧪 |
| sharding, shard key, hotspot, `hashed` | 12.4 | ✅ 🧪 |
| chave-valor / documento / coluna larga / grafo | 12.5 | ✅ |
| revisão geral (Prova de Credenciamento) | 12.6 | ✅ |
