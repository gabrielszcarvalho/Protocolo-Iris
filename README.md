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
   mongosh, e a **planta do Departamento** acende as fichas encontradas ou alteradas.
3. Quando a resposta confere, o memorando é **deferido** e rende **carimbos**. Dicas e protocolos
   recusados reduzem o prêmio.
4. Na **Árvore de Credenciamento** você troca carimbos por comandos novos (`findOne`,
   `countDocuments`, `$gt`, `$elemMatch`…). Você começa só com o `find`.
5. Ao terminar um capítulo, o arquivo cresce: novos setores abrem e centenas de fichas chegam.

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

## Conteúdo desta versão (0.2)

| Capítulo | Tema | Memorandos |
|---|---|---|
| 1. Admissão | `find`, projeção, `findOne`, `countDocuments`, `insertOne`, `insertMany`, `ordered` | 8 |
| 2. Triagem | igualdade, dot notation, `$gt`…`$ne`, `$and`/`$or`/`$nor`, `$in`/`$nin`, `$exists`, `$type`, `sort`/`skip`/`limit` | 12 |
| 3. Inventário | arrays, `$all`, `$size`, `$elemMatch` | 4 |
| 4–12 | Retificação, Anexos, Grafologia, Regulamento, Relatórios, Diretoria | em preparação |

O motor já suporta todo o conteúdo dos capítulos futuros (updates, arrays, regex, validação de
schema, aggregate); falta escrever os memorandos. Veja [`CONTEUDO.md`](CONTEUDO.md).

## Estrutura

```
src/engine/   banco MongoDB simulado (mingo + validação de schema, índices, erros do mongosh, shell)
src/game/     regras: mundo em fases, Árvore de Credenciamento, memorandos, validação, progresso
src/ui/       React: telas (título, abertura, mesa), terminal CodeMirror, mapa, tutorial, painéis
tests/        engine, missões (referência passa / erro comum falha) e fluxo completo do jogo
```

## Documentos

- [`DESIGN.md`](DESIGN.md) — design do jogo e mapa das 65 missões.
- [`CONTEUDO.md`](CONTEUDO.md) — cobertura: cada operador da disciplina → missão.

## Fidelidade ao MongoDB (e limites conhecidos)

- Números seguem o mongosh: inteiro = `int`, fracionário = `double`.
- `collMod` substitui o validador inteiro; `validationLevel`/`validationAction` têm a semântica real.
- `updateMany`/`insertMany` não são atômicos: o que foi gravado antes de um erro permanece.
- Não simulados: transações reais, `$out`/`$merge`, índices de texto/geo, collation.
- O escopo do terminal bloqueia globais do navegador, mas **não é uma sandbox de segurança**.
