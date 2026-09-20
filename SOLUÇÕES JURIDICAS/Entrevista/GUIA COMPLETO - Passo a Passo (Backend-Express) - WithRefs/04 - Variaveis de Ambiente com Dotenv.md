# 04 — Variáveis de Ambiente com Dotenv

## 🎯 Objetivo

Parar de deixar valores de configuração (como a porta) "chumbados" (*hardcoded*) direto no código, e introduzir a primeira variável de ambiente do projeto: `PORT`. Cada variável nova, dos próximos capítulos em diante, entra exatamente no capítulo em que passa a ser necessária, nunca antes.

## 📦 Instalar

```bash
npm install dotenv
```

> **`dotenv`** — lê um arquivo `.env` na raiz do projeto e copia cada linha para `process.env`, como se você tivesse exportado aquelas variáveis manualmente no terminal antes de rodar o comando.

## 📝 Código

Crie `.env` na raiz (este arquivo é **local**, nunca vai para o Git):

```dotenv
PORT=3333
```

Crie também `.env.example` — o "modelo público", que **vai** para o Git, documentando quais variáveis existem sem expor valores reais/sensíveis:

```dotenv
PORT=3333
```

Adicione `.env` ao `.gitignore` (editando o arquivo do capítulo 02):

```gitignore
node_modules/
*.log
.DS_Store
.env
```

> ⚠️ **Por que `.env` nunca é commitado, mas `.env.example` sim?** `.env` guarda valores que, em projetos reais, incluem senhas de banco, chaves de API, tokens — segredos de verdade. Se um `.env` com segredos reais for parar no GitHub (mesmo que depois seja removido — o histórico do Git guarda tudo), qualquer pessoa com acesso ao repositório passa a ter esses segredos. `.env.example` resolve o problema oposto: sem nenhum arquivo de referência, a próxima pessoa a clonar o projeto não tem como saber quais variáveis o projeto espera.

Atualize `src/server.js` para ler a porta do ambiente, com um valor padrão como fallback:

```javascript
// src/server.js
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
```

> 💡 **Por que `dotenv.config()` é chamado aqui, e não dentro de `app.js`?** Porque `server.js` é o **ponto de entrada** — a primeira coisa que roda quando o processo inicia. Chamar `dotenv.config()` o mais cedo possível garante que qualquer outro arquivo importado depois (incluindo `app.js`, e mais adiante `config`s de banco/fila) já encontra `process.env` preenchido, caso também precise ler alguma variável.

## ✅ Como confirmar que funcionou

Troque temporariamente o valor no `.env` (ex.: `PORT=4000`), rode `npm run dev`, e confirme que o log mostra a porta nova e que `curl http://localhost:4000/health` responde. Depois volte para `PORT=3333`.

## 🔧 Commit sugerido

```bash
git add .env.example .gitignore src/server.js package.json package-lock.json
git commit -m "feat: adicionar suporte a variaveis de ambiente com dotenv"
```

(Repare que `.env` **não** entra no `git add` — ele nem aparece no `git status`, porque já está no `.gitignore`.)

## 📚 Documentação Oficial

- **dotenv — repositório e documentação**: https://github.com/motdotla/dotenv
- **dotenv — pacote no npm**: https://www.npmjs.com/package/dotenv
