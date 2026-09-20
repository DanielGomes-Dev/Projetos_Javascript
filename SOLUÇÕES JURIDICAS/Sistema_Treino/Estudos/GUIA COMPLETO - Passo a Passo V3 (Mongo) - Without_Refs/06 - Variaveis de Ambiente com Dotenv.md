# 06 — Variáveis de Ambiente com Dotenv

## 🎯 Objetivo

Parar de deixar valores de configuração (como a porta) "chumbados" (*hardcoded*) direto no código, e introduzir a primeira variável de ambiente do projeto: `PORT`. **Só ela por enquanto** — cada variável nova, dos próximos passos em diante, é adicionada exatamente no passo em que passa a ser necessária, nunca antes.

## 📦 Instalar

```bash
npm install dotenv
```

> **`dotenv`** — lê um arquivo `.env` na raiz do projeto e copia cada linha para `process.env`, como se você tivesse exportado aquelas variáveis manualmente no terminal antes de rodar o comando.

## 📝 Código

Crie `.env` na raiz (este arquivo é **local**, nunca vai para o Git — o próximo bloco explica por quê):

```dotenv
PORT=3000
```

Crie também `.env.example` — o "modelo público", que **vai** para o Git, documentando quais variáveis existem sem expor valores reais/sensíveis:

```dotenv
PORT=3000
```

Adicione `.env` ao `.gitignore` (editando o arquivo criado no passo 02):

```gitignore
node_modules/
.env
*.log
.DS_Store
```

> ⚠️ **Por que `.env` nunca é commitado, mas `.env.example` sim?** `.env` guarda valores que, em projetos reais, incluem senhas de banco, chaves de API, tokens — segredos de verdade. Se um `.env` com segredos reais for parar no GitHub (mesmo que depois seja removido — o histórico do Git guarda tudo), qualquer pessoa com acesso ao repositório passa a ter esses segredos. `.env.example` resolve o problema oposto: sem **nenhum** arquivo de referência, a próxima pessoa a clonar o projeto não tem como saber quais variáveis o projeto espera — ela só vai descobrir na marra, lendo erros de "variável undefined" um por um.

Atualize `src/server.ts` para ler a porta do ambiente, com um valor padrão como fallback:

```typescript
// src/server.ts
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Server] Rodando na porta ${PORT}`);
});
```

> 💡 **Por que `dotenv.config()` é chamado aqui, e não dentro de `app.ts`?** Porque `server.ts` é o **ponto de entrada** — a primeira coisa que roda quando o processo inicia. Chamar `dotenv.config()` o mais cedo possível garante que qualquer outro arquivo importado depois (incluindo `app.ts`) já encontra `process.env` preenchido, caso também precise ler alguma variável no futuro.

## ✅ Como confirmar que funcionou

Troque temporariamente o valor no `.env` (ex.: `PORT=4000`), rode `npm run dev`, e confirme que o log mostra a porta nova e que `curl http://localhost:4000/health` responde. Depois volte para `PORT=3000`.

## 🔧 Commit sugerido

```bash
git add .env.example .gitignore src/server.ts package.json package-lock.json
git commit -m "feat: adicionar suporte a variaveis de ambiente com dotenv"
```

(Repare que `.env` **não** entra no `git add` — ele nem aparece no `git status`, porque já está no `.gitignore`.)
