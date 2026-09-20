# 20 — Cobertura, Documentação e Publicação no GitHub

## 🎯 Objetivo

Fechar o projeto: rodar a suíte com cobertura, escrever a documentação que explica as decisões tomadas ao longo do guia (não só "o que" o código faz, mas "por quê"), e publicar no GitHub com um histórico de commits que, se você seguiu este guia do início, já nasceu limpo.

## ✅ Rodando a suíte completa, com cobertura

O script `test:coverage` já existe desde o capítulo 05. Rode:

```bash
npm run test:coverage
```

Deve mostrar todos os arquivos de teste passando (`health.test.js`, `students.test.js`, `enrollments.test.js`, `tests/unit/*.test.js`) e uma tabela de cobertura por arquivo — `coveragePathIgnorePatterns` (capítulo 05) garante que a própria pasta `tests/` não entra nessa contagem.

> 💡 **Não existe uma meta obrigatória de cobertura percentual para este desafio.** Uma cobertura alta é uma consequência natural de ter seguido TDD do capítulo 05 em diante — cada linha de `src/` nasceu para fazer um teste específico passar — não um objetivo a ser perseguido separadamente no final. Vale mais a pena revisar a tabela procurando **lacunas de comportamento** (um branch de erro nunca exercitado, por exemplo) do que perseguir um número redondo.

Adicione `coverage/` ao `.gitignore` (editando o arquivo do capítulo 02):

```gitignore
node_modules/
*.log
.DS_Store
.env
coverage/
```

## 📝 Documentação final

Crie `.gitattributes` na raiz, para evitar problemas de terminação de linha entre sistemas operacionais diferentes:

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.pdf binary
```

O projeto original que este guia reconstrói separa a documentação em duas camadas — vale a pena reproduzir essa separação:

- **`README.md`** — o enunciado/contrato do desafio: pré-requisitos, comandos de inicialização, contrato HTTP (tabela de endpoints e status esperados), regras de negócio.
- **`SOLUTION.md`** — um documento **complementar**, descrevendo o que foi implementado e por quê: a arquitetura em camadas (`route -> controller -> service -> model`), como cada regra de negócio foi resolvida, e — a parte mais importante — a seção de **concorrência**, explicando explicitamente as duas camadas de proteção (updates atômicos no capítulo 16, fila técnica no capítulo 13) e as limitações conhecidas (por exemplo: a fila técnica é global, não particionada por curso — suficiente para este projeto, mas um próximo passo natural seria uma fila por `cursoId`).

> 💡 **Por que dois documentos, e não um `README.md` só?** Misturar "o que o desafio pede" com "o que eu decidi fazer" torna difícil, para quem revisa depois, separar requisito de decisão de implementação. Manter os dois separados também significa que o `README.md` original (o enunciado) não precisa ser reescrito — só o `SOLUTION.md`, que é seu, cresce à medida que decisões são tomadas.

## Publicando no GitHub

```bash
# 1. Confira o que está pendente
git status
git log --oneline -30   # revise seu histórico — deve estar limpo, seguindo Conventional Commits

# 2. Crie o repositório no GitHub (pela interface web, ou via GitHub CLI)
git remote add origin https://github.com/<seu-usuario>/<seu-repositorio>.git
git branch -M main
git push -u origin main
```

> ⚠️ Antes do `push`, confira `git status` uma última vez e confirme que `.env` (com credenciais/URLs locais) **nunca** aparece como algo a adicionar — ele deve estar no `.gitignore` desde o capítulo 04.

## ✅ Checklist final — contrato HTTP completo

Confirme, manualmente ou revisando a suíte, que todos os endpoints do desafio estão implementados e testados:

| Método | Endpoint | Sucesso | Capítulo |
|---|---|---:|---|
| `GET` | `/health` | `200` (banco ok) / `503` (banco indisponível) | 05, 07 |
| `GET` | `/courses` | `200` | 09 |
| `POST` | `/students` | `201` | 11 |
| `GET` | `/students` | `200` | 11 |
| `POST` | `/enrollments` | `201` | 15, 16 |
| `PATCH` | `/enrollments/:id/cancel` | `200` | 17 |
| `GET` | `/enrollments` | `200` | 18 |

```bash
git add .gitattributes README.md SOLUTION.md .gitignore
git commit -m "docs: adicionar documentacao final e decisoes da solucao"
```

## 🔧 Commit sugerido

```bash
git add .gitattributes README.md SOLUTION.md .gitignore package.json
git commit -m "docs: adicionar readme, decisoes da solucao e cobertura de testes"
```

---

✅ **Fim do guia.** Se você seguiu os 20 capítulos, na ordem, commitando a cada ciclo vermelho/verde, você reconstruiu o projeto inteiro do zero — com uma suíte de testes que nasceu junto com cada regra de negócio, não depois dela, e um histórico de commits genuinamente limpo, sem precisar de nenhuma "fase de organização" no final.

A peça mais valiosa deste guia não é nenhum arquivo individual — é a sequência em que as decisões precisaram ser tomadas: por que a idade é calculada por calendário e não por diferença de anos (capítulo 10), por que existe um índice único **parcial** em vez de um índice único comum (capítulo 14), e por que a capacidade de um curso é protegida por um update atômico condicional **e** por uma fila técnica ao mesmo tempo (capítulo 16) — deliberadamente redundante, não por acidente.

## 📚 Documentação Oficial

- **Jest — cobertura de testes (`--coverage`)**: https://jestjs.io/docs/cli#--coverageboolean
- **Git — `.gitattributes`**: https://git-scm.com/docs/gitattributes
- **GitHub Docs — criando um novo repositório**: https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- **GitHub Docs — adicionando um remote**: https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories
