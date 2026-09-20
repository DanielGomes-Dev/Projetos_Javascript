# 05 — Express: Primeiro "Hello World"

## 🎯 Objetivo

Ter um servidor HTTP mínimo, de pé, respondendo a uma única rota — a menor coisa "de verdade" que se pode testar com `curl`. Nada de banco, nada de rotas de negócio ainda: só confirmar que a engrenagem HTTP funciona.

## 📦 Instalar

```bash
npm install express
npm install -D @types/express
```

## 📝 Código

Crie `src/app.ts` — a aplicação Express em si (rotas, middlewares). Repare que este arquivo **não** chama `.listen()`:

```typescript
// src/app.ts
import express, { Application, Request, Response } from 'express';

const app: Application = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'ONLINE' });
});

export default app;
```

Crie `src/server.ts` — o ponto de entrada, responsável por efetivamente abrir a porta:

```typescript
// src/server.ts
import app from './app.js';

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`[Server] Rodando na porta ${PORT}`);
});
```

> 💡 **Por que já separar `app.ts` de `server.ts`, se hoje eles fazem quase a mesma coisa?** Essa separação parece desnecessária agora (só um arquivo a mais), mas ela paga dividendos crescentes: mais adiante, testes automatizados (passo 32) vão importar `app.ts` diretamente e simular requisições **sem abrir uma porta de rede de verdade** — algo que só é possível porque `app.ts` nunca chama `.listen()`. Se você tivesse tudo num arquivo só, teria que "desligar" a parte de rede toda vez que fosse testar. É mais barato pagar esse preço pequeno agora do que reestruturar o projeto inteiro depois.

Atualize o script `dev` do `package.json` (substituindo o script temporário do passo 03):

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts"
  }
}
```

## ✅ Como confirmar que funcionou

```bash
npm run dev
```

Em outro terminal:

```bash
curl http://localhost:3000/health
```

Deve responder `{"status":"ONLINE"}`.

## 🔧 Commit sugerido

```bash
git add src/app.ts src/server.ts package.json package-lock.json
git commit -m "feat: adicionar servidor express basico com health check"
```

## 📚 Documentação Oficial

- **Express — "Hello World"**: https://expressjs.com/en/starter/hello-world.html
- **Express — guia de roteamento**: https://expressjs.com/en/guide/routing.html
- **Express — API reference**: https://expressjs.com/en/4x/api.html
