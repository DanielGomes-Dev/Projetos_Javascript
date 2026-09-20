# 02 — Git e Padrão de Commits

## 🎯 Objetivo

Inicializar o repositório Git e estabelecer, **desde o primeiro commit**, o padrão de mensagens que todo o resto do projeto vai seguir — Conventional Commits, aplicado desde o começo em vez de "arrumado" no final.

## Passo a passo

**1.** Inicialize o repositório:

```bash
git init
git branch -M main
```

**2.** Crie o `.gitignore` — a primeira versão, cobrindo só o que já existe até agora (ele cresce nos próximos capítulos):

```gitignore
node_modules/
*.log
.DS_Store
```

**3.** Configure seu nome/e-mail no Git, se ainda não tiver feito globalmente:

```bash
git config user.name "Seu Nome"
git config user.email "seu@email.com"
```

## 🧠 O padrão: Conventional Commits

A partir de agora, **toda** mensagem de commit segue o formato:

```
<tipo>: <descrição no imperativo, minúscula, sem ponto final>
```

| Tipo | Quando usar |
|---|---|
| `feat:` | uma funcionalidade nova (ex.: `feat: adicionar endpoint de cadastro de alunos`) |
| `fix:` | correção de um bug |
| `test:` | adicionar ou ajustar testes, sem mudar comportamento de produção |
| `docs:` | mudanças só de documentação |
| `chore:` | manutenção que não afeta código de produção (config, dependências, `.gitignore`) |
| `refactor:` | mudança interna de código sem alterar comportamento externo |

Regras práticas:

- **Um commit, uma mudança coerente.** Se a mensagem precisa da palavra "e" para caber tudo, provavelmente são dois commits.
- **Imperativo, não passado.** `feat: adicionar rota` (não `feat: adicionada rota`).
- **No fluxo TDD deste guia, teste e implementação costumam virar dois commits separados** — um `test:` (o vermelho) seguido de um `feat:`/`fix:` (o verde) — porque são duas mudanças logicamente diferentes, mesmo lado a lado no tempo. Cada capítulo a partir do 05 é explícito sobre quando separar.

> 💡 **Por que isso importa de verdade, e não é só estética?** Um histórico de commits bem-feito é uma ferramenta de trabalho: `git log --oneline` vira uma lista legível do que o projeto faz, `git bisect` consegue localizar em qual commit um bug foi introduzido, e revisar um Pull Request fica mais rápido porque a intenção de cada mudança já está na mensagem, sem precisar reconstruir isso lendo o diff inteiro.

## ✅ Como confirmar que funcionou

```bash
git status
```

Deve mostrar `On branch main`, `No commits yet`, e `package.json`/`.gitignore`/as pastas de `src`/`tests` como pendentes de commit.

## 🔧 Commit sugerido

```bash
git add package.json .gitignore
git commit -m "chore: inicializar projeto"
```

(As pastas vazias de `src`/`tests` não aparecem no `git status` — o Git não versiona diretórios vazios, só arquivos. Elas voltam a aparecer sozinhas conforme os próximos capítulos criam arquivos dentro delas.)

## 📚 Documentação Oficial

- **Git — documentação completa (Pro Git book)**: https://git-scm.com/doc
- **Git — `git init`**: https://git-scm.com/docs/git-init
- **Git — `.gitignore`**: https://git-scm.com/docs/gitignore
- **Conventional Commits — especificação oficial**: https://www.conventionalcommits.org/en/v1.0.0/
