# Protocolo Íris

> Você é o novo **Arquivista-Chefe do Departamento de Almas Extraviadas**. O arquivo pegou fogo
> há décadas; o que sobrou é um banco MongoDB corrompido. Sua única ferramenta é o terminal.

Jogo web single-player para estudar MongoDB (disciplina de Banco de Dados NoSQL): o jogador
escreve queries, updates e pipelines **reais**, que rodam contra um banco simulado no navegador.
Sem backend, sem rede em tempo de execução.

## Como rodar

Requisitos: Node.js 20+.

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # suíte de testes (Vitest)
npm run typecheck  # verificação de tipos
npm run build      # build de produção em dist/
```

## Estado atual

| Etapa | Conteúdo | Situação |
|------:|----------|----------|
| 1 | Scaffold + engine (`parseShell`, `db.*`, mingo, IndexedDB) + testes | ✅ concluída |
| 2 | Seed do mundo + inspetor de coleção + terminal sandbox | ⏳ |
| 3 | Sistema de missões + capítulos 1–3 | ⏳ |
| 4 | Capítulos 4–6 | ⏳ |
| 5 | Capítulo 7 (validação de schema) | ⏳ |
| 6 | Capítulos 8–11 (aggregate) | ⏳ |
| 7 | Capítulo 12 + modo Expediente + polimento | ⏳ |

Na etapa 1 a tela é uma **bancada da engine**: um terminal com um mundo de demonstração
pequeno, painel de coleções e log do servidor. O estado é salvo no IndexedDB do navegador;
o botão "Incinerar e reabrir o arquivo" restaura o mundo inicial.

## Estrutura

```
src/engine/       motor de banco simulado (sem React)
  bson.ts         ObjectId, ISODate, NumberInt, tipos BSON, EJSON
  errors.ts       erros no formato do mongosh + tradução didática
  jsonSchema.ts   validador $jsonSchema com semântica do MongoDB
  indexes.ts      índices únicos (E11000)
  mingoCtx.ts     configuração do mingo ($type e $jsonSchema próprios)
  cursor.ts       cursores preguiçosos (sort/skip/limit, paginação "it")
  collection.ts   CRUD, aggregate, validação, índices
  database.ts     coleções, createCollection, runCommand/collMod, log, snapshot
  credenciais.ts  operadores liberados por capítulo + inspeção do pipeline
  explain.ts      documentos examinados (para os carimbos de eficiência)
  format.ts       impressão no estilo do mongosh
  shell.ts        o terminal: escopo controlado, múltiplas instruções, show/use/it
  persist.ts      IndexedDB
src/ui/           interface React
tests/engine/     testes da engine
```

## Documentos

- [`DESIGN.md`](DESIGN.md) — design do jogo e mapa das 65 missões.
- [`CONTEUDO.md`](CONTEUDO.md) — cobertura: cada operador da disciplina → missão que o exercita.

## Fidelidade ao MongoDB (e limites conhecidos)

- Números seguem o mongosh: inteiro = `int`, fracionário = `double`.
- `collMod` substitui o validador inteiro; `validationLevel`/`validationAction` têm a semântica real.
- `updateMany`/`insertMany` não são atômicos: o que foi gravado antes de um erro permanece.
- Não simulados: transações reais, `$out`/`$merge`, índices de texto/geo, collation.
- O escopo do terminal bloqueia globais do navegador, mas **não é uma sandbox de segurança**;
  é adequado para um jogo local, sem rede e sem dados sensíveis.
