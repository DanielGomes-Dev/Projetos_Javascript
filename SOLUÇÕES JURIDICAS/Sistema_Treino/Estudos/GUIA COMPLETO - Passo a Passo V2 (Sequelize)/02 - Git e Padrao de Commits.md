# 02 — Git e Padrão de Commits

## 🎯 Objetivo

Inicializar o repositório Git e estabelecer, **desde o primeiro commit**, o padrão de mensagens que todo o resto do projeto vai seguir — Conventional Commits. Fazer isso agora, e não "depois, quando organizar o repositório", é a diferença entre ter um histórico limpo de verdade e ter que arrumar uma bagunça no fim (foi exatamente o que aconteceu no projeto original — ver a Fase 8 do guia V1).

## Passo a passo

**1.** Inicialize o repositório:

```bash
git init
git branch -M main
```

**2.** Crie o `.gitignore` — a primeira versão, cobrindo só o que já existe até agora (ele vai crescer nos próximos passos, conforme novas ferramentas geram novos arquivos que não devem ser versionados):

```gitignore
# .gitignore
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
| `feat:` | uma funcionalidade nova (ex.: `feat: adicionar endpoint de criacao de clientes`) |
| `fix:` | correção de um bug (ex.: `fix: corrigir validacao de email duplicado`) |
| `docs:` | mudanças só de documentação |
| `test:` | adicionar ou ajustar testes, sem mudar comportamento |
| `chore:` | manutenção que não afeta o código de produção (config, dependências, `.gitignore`) |
| `refactor:` | mudança interna de código sem alterar comportamento externo |

Regras práticas:
- **Um commit, uma mudança coerente.** Se a descrição do commit precisa da palavra "e" para caber tudo (`feat: adicionar clientes e processos e corrigir lint`), provavelmente deveria ser dois ou três commits.
- **Imperativo, não passado.** `feat: adicionar rota` (não `feat: adicionada rota` nem `feat: adiciona rota`).
- Cada arquivo deste guia, a partir de agora, termina com o commit exato daquele passo — siga-os e seu histórico nasce limpo.

> 💡 **Por que isso importa de verdade, e não é só estética?** Um histórico de commits bem-feito é uma **ferramenta de trabalho**: `git log --oneline` vira uma lista legível do que o projeto faz: você consegue achar rapidamente em qual commit um bug foi introduzido (`git bisect`), gerar um changelog automaticamente a partir dos tipos (`feat`/`fix`), e revisar um Pull Request entendendo a intenção de cada mudança sem precisar ler o diff inteiro.

## ✅ Como confirmar que funcionou

```bash
git status
```

Deve mostrar `On branch main`, `No commits yet`, e `package.json`/`.gitignore` como "Untracked files".

## 🔧 Commit sugerido

```bash
git add package.json .gitignore
git commit -m "chore: inicializar projeto"
```
