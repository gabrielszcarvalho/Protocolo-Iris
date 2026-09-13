# PROTOCOLO ÍRIS — Documento de Design

> *Departamento de Almas Extraviadas — Circular Interna nº 001/∞*
> *"Todo registro é eterno. Nem todo registro é válido."*

---

## 1. Visão geral

Jogo web single-player (Vite + React + TypeScript, sem backend) em que o jogador digita comandos
reais de MongoDB num terminal. Os comandos rodam contra um banco simulado no navegador
(mingo + camada própria), o resultado é validado **pelo efeito** e o mapa do Departamento reage.

- 12 capítulos, **65 missões de campanha**; a prova de credenciamento (12.6) é modo opcional,
  fora da campanha.
- Cada capítulo desbloqueia operadores; usar um operador bloqueado gera erro diegético:
  `CredencialError: Comando '$unwind' não consta no seu nível de credenciamento (exige: Capítulo 10).`
- Sandbox independente da campanha, com reset do mundo.

---

## 2. O mundo (dados)

### 2.1 Coleções

| Coleção       | Qtd. inicial | Papel didático                                                        |
|---------------|-------------:|-----------------------------------------------------------------------|
| `almas`       | ~2.500       | Coleção principal: filtros, arrays, regex, aggregate (≈ `restaurants`) |
| `arquivistas` | ~40          | CRUD, subdocumentos, arrays (≈ `funcionarios`)                        |
| `protocolos`  | 0 (criada no cap. 7) | Validação de schema criada pelo jogador                       |
| `rascunhos`   | ~30          | Lixo temporário — existe para ser `drop()`ada (4.8)                   |
| `fila`        | dinâmica     | Backlog vivo: novas almas chegando a cada expediente                  |

```js
// almas
{
  _id, protocolo: "A-1938-0042",
  nome: "Iracema Vilaverde",
  setor: "Limbo",                 // Limbo | Purgatório | Ante-Sala | Arquivo Morto | Correspondência
  pendencia: "Promessa não cumprida",
  anos_pendentes: NumberInt(37),  // escalar numérico para os exercícios de comparação
  falecimento: ISODate(...),      // data de nível superior
  endereco: { rua, numero, bairro, cep, uf, coord: [lng, lat] },
  vinculos: ["mãe", "sindicalista"],
  audiencias: [ { parecer: "A"|"B"|"C"|"Z", peso: NumberInt(0..50), data: ISODate() } ],
  ativo: true
}

// arquivistas
{ nome, cargo, setor, turno, creditos, admissao, ativo,
  habilidades: [...], selos: [ { nome, ano } ], contato: { email, ramal } }
```

O array `audiencias` fica reservado para `$unwind` e `$elemMatch`; comparações escalares usam
`anos_pendentes`.

### 2.2 Seed determinístico

- PRNG `mulberry32` com seed fixa, listas de nomes/sobrenomes/bairros/pendências em português
  embutidas no código. Mesmo seed ⇒ mesmo mundo (testado).
- Distribuição desigual: **Limbo ≈ 45%** das almas (hotspot do capítulo 12.4).

### 2.3 Sujeira legada (conteúdo pedagógico, não bug)

Concentrada no **Arquivo Morto**, para o jogador aprender a desconfiar de um setor específico:

| Sujeira                                              | Explorada em      |
|------------------------------------------------------|-------------------|
| documentos sem `endereco` / sem `endereco.cep`       | 2.6, 7.8          |
| `anos_pendentes` gravado como string (`"37"`)        | 2.6, 7.7, 7.8     |
| `pendencia` com espaço no fim                        | 2.5, 8.x, 9.2     |
| protocolos duplicados                                | 1.4, 7.5          |
| protocolos fora do padrão                            | 6.4, 6.6, 7.8     |

### 2.4 Tipos numéricos (decisão técnica)

No mongosh, `5` é **double**. Para `$type: "int"` e `bsonType: "int"` fazerem sentido, a engine
guarda inteiros criados via `NumberInt()`/`NumberLong()` com marca de tipo (transparente para
comparação e aritmética). O seed usa `NumberInt`; literais digitados pelo jogador são `double`,
**igual ao mongosh real** — a pegadinha que aparece na prática em 7.1.

---

## 3. Loop de jogo

1. **Memorando** (missão). 2. Jogador escreve no **terminal** (`Ctrl+Enter`).
3. Resultado técnico + resultado diegético (mapa anima). 4. **Validação pelo efeito**.
5. Carimbo + desbloqueio.

### 3.1 Expediente e backlog vivo
- Cada comando de escrita ou missão concluída = 1 **turno**; a cada 3 turnos entram N almas na
  `fila` (a partir do capítulo 2, N cresce por capítulo).
- Backlog acima do limite ⇒ o setor mais cheio entra em **colapso** (luz apagada no mapa; missões
  daquele setor ganham documentos sujos extras — mais difícil, nunca impossível).
- Soluções em lote gastam 1 turno; 40 `updateOne` gastam 40.

### 3.2 Carimbos (1–3)
`Metricas = { docsExaminados, estagiosPipeline, comandosUsados, dicasUsadas, tentativasFalhas }`.
`docsExaminados` vem de um explain simplificado (scan completo vs. intervalo de índice).
Padrão: 3 = no nível da referência sem dica final; 2 = até 2× a referência; 1 = passou.

### 3.3 Modo Expediente
Missões concluídas com parâmetros sorteados, contra o relógio. Placar em IndexedDB.

### 3.4 Sandbox
Mundo clonado do seed, todos os operadores liberados, botão **"Incinerar e reabrir o arquivo"**.

---

## 4. Validação — regras

- **Consulta**: o validador roda a `solucaoReferencia` sobre `mundoAntes` e compara **conjuntos**
  de documentos normalizados (ordem só se a missão pede). Nenhuma contagem hardcoded.
- **Escrita**: diff `mundoAntes → mundoDepois` comparado ao diff da referência. Anti-cheat: a
  missão é re-executada num mundo perturbado (mesmo critério, `_id`s diferentes) para derrubar
  soluções com `_id` hardcoded.
- **Schema**: validação comportamental — documentos-sonda válidos e inválidos por regra são
  inseridos/atualizados e o validador confere aceites e rejeições.
- Exigência de estágio/operador verificada no **AST já parseado** do pipeline/filtro.
- Falha sempre diagnóstica (extras/faltantes agrupados pelo campo que melhor os separa).

---

## 5. Mapa de missões

Base: `MISSOES.md`. Ajustes para fechar o checklist marcados com **(+)**.

### Cap. 1 — Admissão
| id | título | objetivo | operadores |
|---|---|---|---|
| 1.1 | Primeiro expediente | Abrir o arquivo e listar o que sobrou | `find()` |
| 1.2 | Ficha de entrada | Registrar uma alma recém-chegada | `insertOne` |
| 1.3 | Lote da madrugada | Registrar 3 almas de uma vez | `insertMany` |
| 1.4 | Protocolo repetido | O lote tem um protocolo já existente; salvar o resto mesmo assim | `insertMany` + `ordered:false` |
| 1.5 | Papelada mínima | Relação de nomes e setores, sem `_id`, e a contagem total; **(+)** ficha sem `audiencias` (projeção exclusiva) | projeção inclusiva/exclusiva, `_id:0`, `findOne`, `countDocuments` |

### Cap. 2 — Triagem
| id | título | objetivo | operadores |
|---|---|---|---|
| 2.1 | Quem está no Limbo | Filtro de igualdade simples | igualdade implícita |
| 2.2 | Pendências antigas | Almas com mais de N anos de pendência | `$gt` `$gte` `$lt` `$lte` `$ne` **(+)** `$eq` |
| 2.3 | Dois critérios | Setor + faixa de anos, AND implícito e depois com `$and` | AND implícito, `$and` |
| 2.4 | Ou um, ou outro | Duas alas em um relatório só; **(+)** e o complemento: nem uma, nem outra | `$or`, **(+)** `$nor` |
| 2.5 | Lista fechada | Pendências dentro (e fora) de uma lista | `$in`, `$nin` |
| 2.6 | Fichas rasgadas | Quem não tem `endereco.cep` e quem tem `anos_pendentes` como string | `$exists`, `$type` |
| 2.7 | Endereço conhecido | Filtrar por campo de subdocumento | dot notation |
| 2.8 | Fila do balcão | Paginar a fila: 10 por página, ordenada | `sort`, `limit`, `skip` |

### Cap. 3 — Inventário
| id | título | objetivo | operadores |
|---|---|---|---|
| 3.1 | Um vínculo | Quem tem determinado vínculo | busca exata em array |
| 3.2 | Todos os vínculos | Quem tem dois vínculos simultâneos | `$all` |
| 3.3 | Ficha completa | Quem tem exatamente 4 vínculos | `$size` |
| 3.4 | Mesma audiência | Parecer C **e** peso > 30 no mesmo elemento (armadilha: sem `$elemMatch` dá falso positivo) | `$elemMatch` |

### Cap. 4 — Retificação
| id | título | objetivo | operadores |
|---|---|---|---|
| 4.1 | Correção pontual | Corrigir o setor de uma alma | `updateOne` + `$set` |
| 4.2 | Circular interna | Reclassificar um setor inteiro de uma vez | `updateMany` + `$set` |
| 4.3 | Sigilo | Remover o ramal dos arquivistas não-chefes | `$unset` |
| 4.4 | Gratificação | Créditos +500 para um setor; depois reajuste de 10%; **(+)** aplicar piso e teto | `$inc`, `$mul`, **(+)** `$min`, `$max` |
| 4.5 | Nova nomenclatura | `cargo` vira `funcao` e carimbar a data da mudança | `$rename`, `$currentDate` |
| 4.6 | Cadastro fantasma | Atualizar quem talvez não exista | `upsert:true` |
| 4.7 | O formulário em branco | **Armadilha**: `replaceOne` apaga os campos não informados; comparar com `$set` | `replaceOne` |
| 4.8 | Expurgo | Conferir com `find` antes, depois apagar de fato; **(+)** incinerar a coleção `rascunhos` | `deleteOne`, `deleteMany`, **(+)** `drop` |

### Cap. 5 — Anexos
| id | título | objetivo | operadores |
|---|---|---|---|
| 5.1 | Novo vínculo | Acrescentar um vínculo | `$push` |
| 5.2 | Em ordem e no topo | Dois vínculos na posição 0, ordenar A-Z, manter só 5 | `$each`, `$position`, `$sort`, `$slice` |
| 5.3 | Sem repetir | Acrescentar sem duplicar | `$addToSet` |
| 5.4 | Vínculo revogado | Remover um vínculo de todos de um setor | `$pull` + `updateMany` |
| 5.5 | Pela ponta | Remover o último e depois o primeiro | `$pop: 1`, `$pop: -1` |
| 5.6 | Retificação cirúrgica | Trocar um vínculo específico pelo nome novo | posicional `$` |
| 5.7 | Vários de uma vez | Trocar todo parecer `Z` por `C` dentro de `audiencias` | `arrayFilters` + `$[apelido]` |

> Nota 5.2: `$position` com `$sort` na mesma operação — no MongoDB o `$sort` é aplicado depois
> do `$position`, então a posição é "perdida". O memorando explora isso de propósito.

### Cap. 6 — Grafologia
| id | título | objetivo | operadores |
|---|---|---|---|
| 6.1 | Âncoras | Protocolos que começam com `A-19`; e-mails que terminam no domínio da repartição | `^`, `$` |
| 6.2 | Classes | Protocolos que começam com A ou B; e os que **não** começam | `[AB]`, `[^AB]`, `.` |
| 6.3 | Alternância | Dois cargos em um só padrão, sem `$in` | `\|` |
| 6.4 | Contagem de caracteres | Protocolo bem formado: letra + 4 dígitos + hífen + 4 dígitos; **(+)** nomes com sufixo opcional/repetido | `{n}`, `{n,}`, `{n,m}`, `\d`, `\w`, `\s`, **(+)** `*`, `+`, `?` |
| 6.5 | O ponto traiçoeiro | Por que `.com$` casa demais, e como escapar; busca sem caixa | escape `\.`, `$options:"i"` |
| 6.6 | Exclusão e array | Quem **não** casa com o padrão; e quem tem um selo cujo nome casa | `$not` + regex, `$elemMatch` + regex |

### Cap. 7 — O Regulamento
| id | título | objetivo | operadores |
|---|---|---|---|
| 7.1 | A norma nasce | Criar `protocolos` com campos obrigatórios e tipados | `createCollection`, `$jsonSchema`, `required`, `bsonType` |
| 7.2 | Valores permitidos | `situacao` só aceita uma lista; faixas numéricas; nome mínimo | `enum`, `minimum`, `maximum`, `minLength` |
| 7.3 | Estruturas | Lista com no mínimo 1 item, itens validados, subdocumento obrigatório | `minItems`, `items`, `object` aninhado |
| 7.4 | Formato oficial | Protocolo, CEP e UF só no formato correto | `pattern` |
| 7.5 | Protocolo é único | Impedir duplicata — e descobrir que isso não é schema, é índice | `createIndex({unique:true})`, E11000 |
| 7.6 | **A circular incompleta** | `collMod` só com a regra nova, inserir lixo que passa, explicar o porquê e restaurar o validator inteiro | `collMod` substitui 100% |
| 7.7 | Tolerância ao legado | `moderate + error`: prever PERMITE/BLOQUEIA em 5 operações antes de rodar; depois `warn` e conferir o log | `validationLevel`, `validationAction` |
| 7.8 | Endurecer a norma | Auditar pendências, corrigir, confirmar lista vazia, migrar para `strict` | `$nor` + `$jsonSchema`, `$exists`, `$type` |

> 7.7 tem uma etapa de **previsão**: antes de rodar, o jogador marca PERMITE/BLOQUEIA para cada
> uma das 5 operações num formulário do memorando; só depois executa e compara.

### Cap. 8 — Relatórios I
| id | título | objetivo | operadores |
|---|---|---|---|
| 8.1 | A esteira | O mesmo filtro do cap. 2, agora como pipeline | `aggregate`, `$match` |
| 8.2 | Relatório limpo | Filtrar e projetar três campos sem `_id` | `$project` |
| 8.3 | Os cinco primeiros | Filtrar, ordenar, cortar | `$sort`, `$limit`, `$skip` |
| 8.4 | Peneira dupla | **Dois** `$match` no mesmo pipeline; a ordem muda o resultado? | `$match` repetido |
| 8.5 | Endereço por extenso | Criar `enderecoCompleto` com `$concat` e filtrar pelo CEP depois | `$concat`, `$match` pós-`$project` |

### Cap. 9 — Relatórios II
| id | título | objetivo | operadores |
|---|---|---|---|
| 9.1 | Censo | Quantas almas por setor | `$group`, `$sum:1` |
| 9.2 | Ranking | Top 5 pendências mais comuns | `$group` + `$sort` + `$limit` |
| 9.3 | Saída apresentável | Renomear `_id` para `setor` e esconder o resto | `$project` pós-`$group` |
| 9.4 | Filtro depois da conta | Só pendências com mais de 50 casos **(+)** entre as almas ativas | **(+)** `$match` → `$group` → `$match` |
| 9.5 | Sem repetir | Pendências distintas por setor; o nome de uma alma representativa; **(+)** a mais antiga e a mais recente | `$addToSet`, `$push`, `$first`, **(+)** `$last` |
| 9.6 | Dois agrupamentos | Quantos bairros distintos por setor | duplo `$group`, `_id` composto |
| 9.7 | Só o número | Contagem final do pipeline | `$count` |

### Cap. 10 — Desdobramento
| id | título | objetivo | operadores |
|---|---|---|---|
| 10.1 | Uma linha por audiência | Comparar contagem com e sem `$unwind` | `$unwind`, `$count` |
| 10.2 | Pareceres | Quantas audiências por parecer (A/B/C/Z) | `$unwind` + `$group` |
| 10.3 | Só os A | Quantos pareceres A cada setor recebeu, ordenado | `$unwind` → `$match` → `$group` → `$sort` |
| 10.4 | Peso médio | Média, mínimo e máximo de peso por setor | `$avg`, `$min`, `$max` |
| 10.5 | Os piores casos | Top 5 almas por peso médio, com nome legível | `$group` → `$sort` → `$limit` → `$project` |
| 10.6 | Retrospectiva | Audiências por ano e por parecer | `$year`, `_id` composto |

### Cap. 11 — Parecer
| id | título | objetivo | operadores |
|---|---|---|---|
| 11.1 | Deferido ou indeferido | Classificar peso em duas faixas | `$cond` (forma objeto) |
| 11.2 | É A ou não é | Campo booleano a partir do parecer | `$cond` (forma array), `$eq` |
| 11.3 | Quatro faixas | Excelente / Bom / Regular / Crítico com `$cond` aninhado | `$cond` aninhado |
| 11.4 | A tabela oficial | Refazer 11.3 de forma legível | `$switch` |
| 11.5 | Contagem condicional | Por alma: total, totalA, totalB, totalPesado, no mesmo `$group` | `$sum` + `$cond` |
| 11.6 | Ficha limpa | Almas que só tiveram parecer A (`total == totalA`), e resumo pivotado por setor | `$expr`, `$arrayToObject` |

### Cap. 12 — A Diretoria
Teoria virando decisão de jogo, com consequência mecânica. Comandos simulados com sintaxe real
quando ela existe (`rs.initiate()`, `rs.add()`, `sh.shardCollection()`, `writeConcern`,
`readConcern`, `readPref`) e um objeto `diretoria` para decisões sem comando equivalente.

| id | título | objetivo | conteúdo |
|---|---|---|---|
| 12.1 | Volume, velocidade, variedade | O backlog explode; escolher onde investir | 3 Vs |
| 12.2 | Segunda repartição | Abrir uma filial: replicar ou não | replica set, failover, disponibilidade |
| 12.3 | O carimbo atrasado | Ler dado desatualizado e sofrer com isso | ACID x BASE, consistência eventual, CAP |
| 12.4 | Como fatiar o arquivo | Shard key por `setor` (hotspot) vs por `protocolo` | sharding |
| 12.5 | Escolha do arquivo | Três departamentos vizinhos pedem um banco; recomendar chave-valor, documento, coluna larga ou grafo | modelos NoSQL |
| 12.6 | Credenciamento *(opcional, fora da campanha)* | Prova objetiva sorteando do banco de questões | revisão geral |

### Bônus (se sobrar fôlego)
- **$lookup** entre `almas` e `arquivistas` (qual arquivista atendeu qual alma). A engine já
  suporta via mingo; a missão fica para depois da etapa 7.

---

## 6. Matriz de cobertura (tabela completa em `CONTEUDO.md`)

| Grupo | Itens → missões |
|-------|-----------------|
| CRUD | insertOne 1.2 · insertMany 1.3 · ordered:false 1.4 · find 1.1 · findOne 1.5 · projeção incl./excl. 1.5 · `_id:0` 1.5 · countDocuments 1.5 · sort/limit/skip 2.8 · updateOne 4.1 · updateMany 4.2 · replaceOne 4.7 · upsert 4.6 · deleteOne/deleteMany 4.8 · drop 4.8 |
| Filtros | $eq/$ne/$gt/$gte/$lt/$lte 2.2 · $and 2.3 · $or/$nor 2.4 · $not 6.6 · $in/$nin 2.5 · $exists/$type 2.6 · dot notation 2.7 · $all 3.2 · $size 3.3 · $elemMatch 3.4 · $regex+$options 6.5 · $expr 11.6 |
| Update | $set 4.1 · $unset 4.3 · $inc/$mul/$min/$max 4.4 · $rename/$currentDate 4.5 |
| Arrays | $push 5.1 · $each/$position/$sort/$slice 5.2 · $addToSet 5.3 · $pull 5.4 · $pop 5.5 · `$` 5.6 · arrayFilters 5.7 |
| Regex | ^ $ 6.1 · . [] [^] 6.2 · \| 6.3 · {n} {n,} {n,m} \d \w \s * + ? 6.4 · escape, i 6.5 |
| Validação | createCollection/$jsonSchema/required/bsonType 7.1 · enum/minimum/maximum/minLength 7.2 · minItems/items/object 7.3 · pattern 7.4 · unique 7.5 · collMod 7.6 · moderate/error/warn 7.7 · strict + auditoria $nor+$jsonSchema 7.8 |
| Aggregate | $match 8.1 · $project 8.2 · $sort/$limit/$skip 8.3 · estágios repetidos 8.4 · $concat 8.5 · $group/$sum 9.1 · match→group→match 9.4 · $first/$last/$push/$addToSet 9.5 · duplo $group 9.6 · $count 9.7 · $unwind 10.1 · $avg/$min/$max 10.4 · $year 10.6 · $cond objeto 11.1 · $cond array 11.2 · aninhado 11.3 · $switch 11.4 · $sum+$cond 11.5 · $expr/$arrayToObject 11.6 |
| Teoria | 3 Vs 12.1 · replica set 12.2 · ACID×BASE/CAP 12.3 · sharding 12.4 · chave-valor/documento/coluna larga/grafo 12.5 |

---

## 7. Arquitetura técnica

```
src/
  engine/
    bson.ts           ObjectId, NumberInt/Long (marca de tipo), ISODate, $type, clone, comparação
    errors.ts         mensagens fiéis ao mongosh + tradução didática pt-BR
    jsonSchema.ts     validador $jsonSchema próprio
    indexes.ts        índices únicos + E11000
    collection.ts     insert*/find*/update*/replace/delete*/aggregate/distinct/createIndex/drop
    cursor.ts         cursor preguiçoso: sort/limit/skip/count/toArray
    database.ts       coleções, createCollection, runCommand({collMod}), getCollectionNames
    shell.ts          parseShell: new Function num escopo controlado
    credenciais.ts    operadores por capítulo; varre o AST de filtro/update/pipeline
    explain.ts        docsExaminados simplificado
    persist.ts        IndexedDB nativo (sem lib)
  world/seed.ts       PRNG + gerador determinístico + sujeira
  content/capitulos/  cap01.ts … cap12.ts
  ui/                 Mapa, Terminal (CodeMirror 6), Memorando, Log, Manual, Inspetor
```

Pontos de atenção:
- `mingo` não aplica `$jsonSchema` com semântica de `validationLevel`; o validador é próprio e o
  mesmo código é registrado como operador de consulta `$jsonSchema` para a auditoria (7.8).
- `updateMany` com pipeline (7.8) usa o aggregate do mingo por documento.
- Ordem natural = ordem de inserção.
- `new Function` não é sandbox de segurança; é suficiente para um jogo local sem rede.

---

## 8. Entregas

1. Scaffold + engine + testes da engine. **← parar e mostrar**
2. Seed + inspetor + terminal sandbox.
3. Sistema de missões + capítulos 1–3.
4. Capítulos 4–6. 5. Capítulo 7. 6. Capítulos 8–11. 7. Capítulo 12 + Expediente + polimento.
