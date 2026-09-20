# 03 — Express: Primeiro "Hello World"

## 🎯 Objetivo

Ter um servidor HTTP mínimo, de pé, respondendo a uma única rota — a menor coisa "de verdade" que se pode confirmar com `curl`. Nada de banco, nada de testes automatizados ainda (isso começa no capítulo 05): só confirmar que a engrenagem HTTP funciona.

## 📦 Instalar

```bash
npm install express cors
npm install -D nodemon
```

> **`express`** — o framework HTTP. **`cors`** — middleware que adiciona os cabeçalhos `Access-Control-Allow-*`, liberando a API para ser chamada por um front-end rodando em outra origem (outra porta/domínio) — sem ele, um navegador bloquearia essas chamadas por política de mesma origem. **`nodemon`** — reinicia o processo automaticamente a cada alteração de arquivo, só usado em desenvolvimento (por isso `-D`).

## 📝 Código

Crie `src/app.js` — a aplicação Express em si (rotas, middlewares). Repare que este arquivo **não** chama `.listen()`:

```javascript
// src/app.js
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'ok' });
});

module.exports = app;
```

> 💡 **Por que `cors()` sem nenhuma opção — liberando qualquer origem?** Para o tamanho e o objetivo deste projeto (um desafio técnico, sem um front-end específico servido a partir de um domínio conhecido), restringir `origin` a uma lista fixa adicionaria configuração sem benefício real. Num projeto com um front-end de produção definido, vale a pena passar `{ origin: 'https://seu-dominio.com' }` para não liberar a API para qualquer site.

Crie `src/server.js` — o ponto de entrada, responsável por efetivamente abrir a porta:

```javascript
// src/server.js
const app = require('./app');

const PORT = 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
```

> 💡 **Por que separar `app.js` de `server.js`, se hoje eles fazem quase a mesma coisa?** Essa separação parece desnecessária agora (só um arquivo a mais), mas paga dividendos crescentes: a partir do capítulo 05, os testes automatizados vão importar `app.js` diretamente e simular requisições com o Supertest **sem abrir uma porta de rede de verdade** — algo que só é possível porque `app.js` nunca chama `.listen()`. Se tudo estivesse num arquivo só, seria preciso "desligar" a parte de rede toda vez que fosse testar. É mais barato pagar esse preço pequeno agora do que reestruturar o projeto inteiro depois.
>
> 💡 **Por que ainda não há TDD neste capítulo, se o guia promete TDD do início ao fim?** TDD testa *comportamento* — e ainda não existe suíte de testes (ela nasce no capítulo 05). Escrever os dois arquivos mínimos acima é puro andaime (scaffolding): não há regra de negócio para descrever num teste ainda. A partir do próximo endpoint de verdade, todo comportamento novo nasce de um teste vermelho primeiro.

Atualize o script `dev` do `package.json` (ele já existe desde o capítulo 01, só troque a implementação):

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
```

## ✅ Como confirmar que funcionou

```bash
npm run dev
```

Em outro terminal:

```bash
curl http://localhost:3333/health
```

Deve responder `{"status":"ok"}`.

## 🔧 Commit sugerido

```bash
git add src/app.js src/server.js package.json package-lock.json
git commit -m "feat: adicionar servidor express basico com health check"
```

## 📚 Documentação Oficial

- **Express — "Hello World"**: https://expressjs.com/en/starter/hello-world.html
- **Express — guia de roteamento**: https://expressjs.com/en/guide/routing.html
- **Express — API reference**: https://expressjs.com/en/4x/api.html
- **nodemon**: https://github.com/remy/nodemon
