# Protocolo Íris

> Parabéns: sua aprovação saiu. Você é o novo **Arquivista-Chefe do Departamento de Almas
> Extraviadas**. O arquivo de papel pegou fogo em 1953 e o que sobrou virou um banco MongoDB
> cheio de erros. Sua única ferramenta é o terminal.

Jogo web single-player para estudar MongoDB (disciplina de Banco de Dados NoSQL), inspirado em
*The Farmer Was Replaced*: você escreve comandos **reais** do MongoDB, o mundo reage, e novos
comandos vão sendo desbloqueados conforme você progride. Sem backend, sem rede.

## Como jogar

1. **Memorandos** chegam da Diretoria: cada um é uma tarefa (listar fichas, contar, registrar…).
2. Você escreve o comando no **terminal** e executa (`Ctrl+Enter`). A resposta aparece como no
   mongosh, e a **planta do Departamento** acende as fichas encontradas ou alteradas. Executar
   não envia nada: analise se voltou mesmo o que foi pedido.
3. Quando estiver seguro, clique em **Protocolar resposta** (`Ctrl+Shift+Enter`). Se estiver certa,
   o memorando é **deferido** e rende **carimbos**. Se não, volta indeferida com um parecer, e os
   quadradinhos de "A entregar" mostram o que já estava certo (✓) e o que falta (✗). Dicas e
   protocolos recusados reduzem o prêmio, mas nunca impedem de avançar.
4. Na **Árvore de Credenciamento** você troca carimbos por comandos novos (`findOne`,
   `countDocuments`, `$gt`, `$elemMatch`…). Você começa só com o `find`.
5. Ao terminar um capítulo, o arquivo cresce: novos setores abrem, centenas de fichas chegam e
   aparecem coleções novas (`arquivistas`, `requerimentos`, `protocolos`).
6. No **Menu** há dois modos que trabalham numa cópia do arquivo e nunca mexem na campanha:
   - **Sala de Treino** — terminal livre, com as suas credenciais ou todas liberadas (modo estudo),
     e **Gerar memorando**: exercícios sorteados por assunto (consultas, arrays, regex, gravações,
     relatórios), corrigidos como na campanha. Dá para abrir vários, pular, descartar e ver a
     solução; cada memorando tem o seu próprio arquivo e o "Restaurar" vale só para o aberto;
   - **Expediente contra o relógio** — as consultas que você já deferiu, embaralhadas, em 5
     minutos. O recorde fica salvo.

Atalhos: `Ctrl+Enter` executa · `↑`/`↓` histórico · `Ctrl+Espaço` sugestões · `Ctrl+K` Manual ·
`Ctrl+B` Árvore · `Esc` menu.

## Como rodar

Requisitos: Node.js 20+.

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # testes (engine, missões e regras do jogo)
npm run typecheck
npm run build      # build de produção em dist/
```

O progresso fica salvo no IndexedDB do navegador.

## Conteúdo (versão 1.0)

| Capítulo | Tema | Memorandos |
|---|---|---|
| 1. Admissão | `find`, projeção, `findOne`, `countDocuments`, `insertOne`, `insertMany`, `ordered` | 8 |
| 2. Triagem | igualdade, dot notation, `$gt`…`$ne`, `$and`/`$or`/`$nor`, `$in`/`$nin`, `$exists`, `$type`, `sort`/`skip`/`limit` | 12 |
| 3. Inventário | arrays, `$all`, `$size`, `$elemMatch` | 4 |
| 4. Retificação | `updateOne`/`updateMany`, `$set`, `$unset`, `$inc`, `$mul`, `$min`/`$max`, `$rename`, `$currentDate`, `upsert`, `replaceOne`, `delete*`, `drop` | 8 |
| 5. Anexos | `$push`, `$each`, `$position`, `$sort`/`$slice`, `$addToSet`, `$pull`, `$pop`, `$`, `arrayFilters` | 8 |
| 6. Grafologia | regex: âncoras, classes, quantificadores, alternância, escape, flag `i`, `$not`, `$elemMatch` | 11 |
| 7. O Regulamento | `createCollection` + `$jsonSchema`, índice único, `collMod`, `validationLevel`/`validationAction`, auditoria | 8 |
| 8. A Esteira | `aggregate`, `$match`, `$project`, `$sort`/`$skip`/`$limit`, `$concat` | 5 |
| 9. O Censo | `$group`, `$sum`, `$first`/`$last`, `$push`/`$addToSet`, duplo `$group`, `$count` | 7 |
| 10. As Audiências | `$unwind`, `$avg`/`$min`/`$max`, `_id` composto, `$year` | 6 |
| 11. O Parecer | `$cond` (objeto, lista, aninhado), `$switch`, `$sum`+`$cond`, `$expr`, `$arrayToObject` | 8 |
| 12. A Diretoria | 3 Vs, replica set e failover, ACID × BASE e CAP, sharding, modelos NoSQL, prova | 6 |
| 13. Entre o Céu e o Inferno | tudo misturado e difícil: o Juízo das almas (aggregate com `$cond`, `$nin`/`$elemMatch` em arrays, norma + índice único + `ordered: false`, `$position` + `arrayFilters`, `$ifNull`/`$toInt`, `distinct` + `$in`, `$expr`) | 7 |

Cada operador da disciplina aponta para o memorando que o exercita em [`CONTEUDO.md`](CONTEUDO.md).

## Estrutura

```
src/engine/   banco MongoDB simulado (mingo + validação de schema, índices, erros do mongosh, shell)
src/game/     regras: mundo em fases, Árvore de Credenciamento, memorandos, validação, progresso,
              Sala de Treino e Expediente
src/ui/       React: telas (título, abertura, mesa), terminal CodeMirror, mapa, tutorial, painéis
tests/        engine, missões (referência passa / erro comum falha) e fluxo completo do jogo
```

## Documentos

- [`DESIGN.md`](DESIGN.md) — design do jogo e mapa original das missões.
- [`CONTEUDO.md`](CONTEUDO.md) — cobertura: cada operador da disciplina → missão.

## Fidelidade ao MongoDB (e limites conhecidos)

- Números seguem o mongosh: inteiro = `int`, fracionário = `double`.
- `collMod` substitui o validador inteiro; `validationLevel`/`validationAction` têm a semântica real.
- `updateMany`/`insertMany` não são atômicos: o que foi gravado antes de um erro permanece.
- Não simulados: transações reais, `$out`/`$merge`, índices de texto/geo, collation.
- Replica set, sharding e partições de rede (capítulo 12) são **simulados**: `rs.*`, `sh.*` e
  `diretoria.*` imitam a sintaxe real, e as consequências são calculadas a partir da configuração.
- O escopo do terminal bloqueia globais do navegador, mas **não é uma sandbox de segurança**.
