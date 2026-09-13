# Cobertura de conteúdo

Cada item do checklist da disciplina → missão(ões) que o exercitam (ids do [`DESIGN.md`](DESIGN.md)).
A coluna **Engine** indica se o recurso já está implementado e testado no motor.

Legenda: ✅ implementado e testado · 🧪 simulado (sem equivalente executável real) · ⏳ etapa futura

## CRUD

| Operador / recurso | Missões | Engine |
|---|---|---|
| `insertOne` | 1.2 | ✅ |
| `insertMany` | 1.3 | ✅ |
| `ordered: false` | 1.4 | ✅ |
| `find` | 1.1 | ✅ |
| `findOne` | 1.5 | ✅ |
| projeção inclusiva | 1.5 | ✅ |
| projeção exclusiva | 1.5 | ✅ |
| `_id: 0` | 1.5 | ✅ |
| `countDocuments` | 1.5 | ✅ |
| `sort` | 2.8 | ✅ |
| `limit` | 2.8 | ✅ |
| `skip` | 2.8 | ✅ |
| `updateOne` | 4.1 | ✅ |
| `updateMany` | 4.2 | ✅ |
| `replaceOne` | 4.7 | ✅ |
| `upsert` | 4.6 | ✅ |
| `deleteOne` | 4.8 | ✅ |
| `deleteMany` | 4.8 | ✅ |
| `drop` | 4.8 | ✅ |

## Filtros

| Operador | Missões | Engine |
|---|---|---|
| `$eq` | 2.2 | ✅ |
| `$ne` | 2.2 | ✅ |
| `$gt` | 2.2 | ✅ |
| `$gte` | 2.2 | ✅ |
| `$lt` | 2.2 | ✅ |
| `$lte` | 2.2 | ✅ |
| `$and` | 2.3 | ✅ |
| `$or` | 2.4 | ✅ |
| `$nor` | 2.4, 7.8 | ✅ |
| `$not` | 6.6 | ✅ |
| `$in` | 2.5 | ✅ |
| `$nin` | 2.5 | ✅ |
| `$exists` | 2.6, 7.8 | ✅ |
| `$type` | 2.6, 7.8 | ✅ |
| dot notation | 2.7 | ✅ |
| `$all` | 3.2 | ✅ |
| `$size` | 3.3 | ✅ |
| `$elemMatch` | 3.4, 6.6 | ✅ |
| `$regex` + `$options` | 6.5 | ✅ |
| `$expr` | 11.6 | ✅ |

## Operadores de update

| Operador | Missões | Engine |
|---|---|---|
| `$set` | 4.1, 4.2 | ✅ |
| `$unset` | 4.3 | ✅ |
| `$inc` | 4.4 | ✅ |
| `$mul` | 4.4 | ✅ |
| `$min` | 4.4 | ✅ |
| `$max` | 4.4 | ✅ |
| `$rename` | 4.5 | ✅ |
| `$currentDate` | 4.5 | ✅ |

## Arrays

| Operador | Missões | Engine |
|---|---|---|
| `$push` | 5.1 | ✅ |
| `$each` | 5.2 | ✅ |
| `$position` | 5.2 | ✅ |
| `$sort` (em `$push`) | 5.2 | ✅ |
| `$slice` (em `$push`) | 5.2 | ✅ |
| `$addToSet` | 5.3 | ✅ |
| `$pull` | 5.4 | ✅ |
| `$pop` | 5.5 | ✅ |
| posicional `$` | 5.6 | ✅ |
| `arrayFilters` + `$[apelido]` | 5.7 | ✅ |

## Regex

| Recurso | Missões | Engine |
|---|---|---|
| `^` | 6.1 | ✅ |
| `$` | 6.1 | ✅ |
| `.` | 6.2 | ✅ |
| `[abc]` | 6.2 | ✅ |
| `[^abc]` | 6.2 | ✅ |
| `\|` | 6.3 | ✅ |
| `*` `+` `?` | 6.4 | ✅ |
| `{n}` `{n,}` `{n,m}` | 6.4 | ✅ |
| `\d` `\w` `\s` | 6.4 | ✅ |
| escape (`\.`) | 6.5 | ✅ |
| flag `i` / `$options: "i"` | 6.5 | ✅ |
| `$not` + regex | 6.6 | ✅ |
| `$elemMatch` + regex | 6.6 | ✅ |

## Validação de schema

| Recurso | Missões | Engine |
|---|---|---|
| `db.createCollection` | 7.1 | ✅ |
| `$jsonSchema` | 7.1 | ✅ |
| `required` | 7.1 | ✅ |
| `bsonType` | 7.1 | ✅ |
| `enum` | 7.2 | ✅ |
| `minimum` / `maximum` | 7.2 | ✅ |
| `minLength` | 7.2 | ✅ |
| `minItems` | 7.3 | ✅ |
| `items` | 7.3 | ✅ |
| objeto aninhado | 7.3 | ✅ |
| `pattern` | 7.4 | ✅ |
| `createIndex({...}, { unique: true })` | 7.5 | ✅ |
| `collMod` (substitui 100%) | 7.6 | ✅ |
| `validationLevel: strict / moderate` | 7.7, 7.8 | ✅ |
| `validationAction: error / warn` | 7.7 | ✅ |
| auditoria `$nor` + `$jsonSchema` | 7.8 | ✅ |

## Aggregate

| Recurso | Missões | Engine |
|---|---|---|
| `$match` | 8.1 | ✅ |
| `$project` | 8.2, 9.3 | ✅ |
| `$sort` | 8.3 | ✅ |
| `$limit` | 8.3 | ✅ |
| `$skip` | 8.3 | ✅ |
| estágios repetidos (dois `$match`) | 8.4 | ✅ |
| `$concat` | 8.5 | ✅ |
| `$group` | 9.1 | ✅ |
| `$sum` | 9.1 | ✅ |
| `$match` depois de `$group` | 9.4 | ✅ |
| `$push` / `$addToSet` (acumuladores) | 9.5 | ✅ |
| `$first` / `$last` | 9.5 | ✅ |
| duplo `$group` / `_id` composto | 9.6 | ✅ |
| `$count` | 9.7, 10.1 | ✅ |
| `$unwind` | 10.1–10.6 | ✅ |
| `$avg` / `$min` / `$max` | 10.4 | ✅ |
| `$year` | 10.6 | ✅ |
| `$cond` (forma objeto) | 11.1 | ✅ |
| `$cond` (forma array) | 11.2 | ✅ |
| `$cond` aninhado | 11.3 | ✅ |
| `$switch` | 11.4 | ✅ |
| `$sum` + `$cond` | 11.5 | ✅ |
| `$expr` | 11.6 | ✅ |
| `$arrayToObject` | 11.6 | ✅ |
| `$lookup` *(bônus)* | — | ✅ |

## Teoria

| Tema | Missões | Engine |
|---|---|---|
| 3 Vs do Big Data | 12.1 | ⏳ |
| replica set, failover | 12.2 | ⏳ 🧪 |
| ACID × BASE, CAP, consistência eventual | 12.3 | ⏳ 🧪 |
| sharding, shard key | 12.4 | ⏳ 🧪 |
| chave-valor / documento / coluna larga / grafo | 12.5 | ⏳ |
| revisão geral (prova opcional) | 12.6 | ⏳ |
