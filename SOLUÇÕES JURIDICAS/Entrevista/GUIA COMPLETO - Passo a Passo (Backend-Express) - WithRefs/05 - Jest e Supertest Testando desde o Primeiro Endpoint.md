# 05 — Jest e Supertest: Testando desde o Primeiro Endpoint

## 🎯 Objetivo

Configurar a infraestrutura de testes automatizados **antes** de escrever qualquer regra de negócio nova — a partir daqui, todo comportamento novo do projeto nasce de um teste que falha primeiro (🔴 vermelho), seguido do código mínimo que o faz passar (🟢 verde).

## 📦 Instalar

```bash
npm install -D jest supertest
```

> **`jest`** — o test runner: descobre arquivos de teste, roda, compara resultados (`expect`), reporta o que passou/falhou. **`supertest`** — simula requisições HTTP reais contra um `app` do Express **sem abrir uma porta de rede** — é por isso que `src/app.js` nunca chama `.listen()` (capítulo 03).

## 📝 Configuração

Adicione a seção `jest` e os scripts de teste ao `package.json`:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand --detectOpenHandles",
    "test:watch": "jest --watch",
    "test:coverage": "jest --runInBand --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "testTimeout": 120000,
    "coveragePathIgnorePatterns": ["/node_modules/", "/tests/"]
  }
}
```

> 💡 **Por que `--runInBand`?** Por padrão, o Jest roda arquivos de teste em paralelo, em processos separados. Isso é ótimo para testes unitários independentes, mas perigoso para testes de integração que vão compartilhar o **mesmo** banco de dados (a partir do capítulo 07) — dois arquivos rodando ao mesmo tempo poderiam se atropelar. `--runInBand` roda tudo sequencialmente: mais lento, porém previsível.
>
> 💡 **Por que `testTimeout: 120000` (120 segundos), tão mais alto que o padrão do Jest (5s)?** A partir do capítulo 07 os testes de integração vão subir um MongoDB **em memória** (`mongodb-memory-server`), e a primeiríssima execução, numa máquina nova, pode precisar baixar o binário do MongoDB — isso pode levar bem mais que 5 segundos. Um timeout generoso evita falso-negativo nessa primeira vez.
>
> 💡 **`coveragePathIgnorePatterns`** — quando `test:coverage` rodar (capítulo 20), a pasta `tests/` não deve contar como "código de produção não coberto" (ela é o próprio teste).

## 🔴 Teste (Red) — primeiro ciclo TDD do projeto

O comportamento que ainda não existe: uma rota inexistente deve responder `404` com um corpo JSON previsível — hoje, o Express (sem nenhuma configuração extra) devolve uma página HTML de erro, não JSON.

Crie `tests/health.test.js`:

```javascript
// tests/health.test.js
const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('deve retornar status 200 e informações básicas', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('deve retornar 404 em JSON para rotas inexistentes', async () => {
    const response = await request(app).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Rota não encontrada');
  });
});
```

Rode:

```bash
npm test
```

O primeiro teste (`GET /health`) já passa — o endpoint existe desde o capítulo 03, e isso é uma boa confirmação de que o Supertest está funcionando de ponta a ponta. O segundo teste **falha**: o Express devolve `404`, mas com corpo HTML, então `response.body` vem como um objeto vazio (`{}`) e `toHaveProperty('error', ...)` não encontra a chave. É esse vermelho que o próximo bloco resolve.

## 🟢 Código (Green)

Adicione um middleware de "rota não encontrada" ao final de `src/app.js` (depois de todas as rotas registradas):

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

app.use((req, res) => {
  return res.status(404).json({ error: 'Rota não encontrada' });
});

module.exports = app;
```

> 💡 **Por que um `app.use(...)` sem caminho, no final do arquivo, funciona como "pega tudo que sobrou"?** O Express testa os middlewares/rotas **na ordem em que foram registrados**, e passa para o próximo só se o atual não responder. Um `app.use` sem um caminho específico, colocado por último, só é alcançado se nenhuma rota anterior combinou com a requisição — exatamente a definição de "rota não encontrada". A partir de agora, toda rota nova deste projeto precisa ser registrada **antes** deste middleware.

## ✅ Como confirmar que funcionou

```bash
npm test
```

Os dois testes de `tests/health.test.js` devem passar (`PASS`).

## 🔧 Commit sugerido

Como a mudança de comportamento (o handler de 404) e o teste que a exige nasceram juntos, dois commits pequenos e coerentes:

```bash
git add package.json package-lock.json tests/health.test.js
git commit -m "test: adicionar suite de testes e teste de rota inexistente"

git add src/app.js
git commit -m "feat: adicionar handler json para rotas nao encontradas"
```

## 📚 Documentação Oficial

- **Jest — documentação geral**: https://jestjs.io/docs/getting-started
- **Jest — arquivo de configuração**: https://jestjs.io/docs/configuration
- **Jest — `expect`**: https://jestjs.io/docs/expect
- **Jest — `--runInBand`**: https://jestjs.io/docs/cli#--runinband
- **supertest — repositório e documentação**: https://github.com/ladjs/supertest
