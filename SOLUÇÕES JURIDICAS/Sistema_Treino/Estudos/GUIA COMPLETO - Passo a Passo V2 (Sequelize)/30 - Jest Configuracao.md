# 30 — Jest: Configuração

## 🎯 Objetivo

Preparar a infraestrutura de testes automatizados — Jest rodando TypeScript, contra um banco de dados isolado — antes de escrever qualquer teste de verdade (isso vem nos passos 31 e 32).

## Três problemas a resolver antes do primeiro teste

1. O código é TypeScript — o Jest, puro, só entende JavaScript.
2. O projeto é ESM (`"type": "module"`, passo 01) — uma combinação que historicamente dá dor de cabeça com Jest.
3. Testes de integração precisam de banco de dados, mas rodar contra o banco de **desenvolvimento** seria perigoso (um teste malfeito poderia apagar dados reais) e não-determinístico.

## 📦 Instalar

```bash
npm install -D jest ts-jest @types/jest supertest @types/supertest cross-env
```

> - **`jest`** — o test runner. **`ts-jest`** — transpila `.ts` em memória, sem gerar `dist/`. **`@types/jest`** — tipos das globais `describe`/`it`/`expect`. **`supertest`** — simula requisições HTTP contra um `Application` do Express sem abrir porta de rede. **`cross-env`** — define `NODE_ENV=test` de um jeito que funciona igual no Windows e no Unix.

## 📝 Código

Crie `tsconfig.jest.json` na raiz:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": ".",
    "rewriteRelativeImportExtensions": false,
    "types": ["jest", "node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

> 💡 **`types: ["jest", "node"]` — não pule esta linha.** Mesmo com `@types/jest` instalado, sem declarar `types` explicitamente o `ts-jest` pode falhar ao rodar com `TS2593: Cannot find name 'describe'` em todo arquivo de teste. É um erro fácil de perder tempo depurando — declare de propósito, desde o início.

Crie `jest.config.cjs` na raiz:

```javascript
// jest.config.cjs
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup/env.cjs'],

  // O código-fonte usa a sintaxe NodeNext (imports terminando em ".js"
  // mesmo apontando para arquivos ".ts" — passo 03). O ts-jest, rodando
  // em CommonJS, não entende essa reescrita automaticamente. Este mapa
  // diz "quando vir um import terminando em .js, procure o arquivo SEM
  // essa extensão" — deixando o Jest resolver para o .ts real.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },

  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
};
```

Crie o banco de teste — a mesma convenção `_test` que `src/config/config.cjs` (passo 09) já define desde o início:

```bash
docker exec -it jurisengine_db psql -U postgres -c "CREATE DATABASE juris_db_test;"
```

Adicione o script `db:migrate:test` ao `package.json`:

```json
{
  "scripts": {
    "db:migrate:test": "cross-env NODE_ENV=test sequelize-cli db:migrate"
  }
}
```

```bash
npm run db:migrate:test
```

Crie `tests/setup/env.cjs` — o arquivo referenciado em `setupFiles`, acima:

```javascript
// tests/setup/env.cjs
//
// Roda ANTES de qualquer teste (e antes de qualquer módulo da
// aplicação) ser importado — o único lugar seguro para preparar
// variáveis de ambiente que config/database.ts, config/redis.ts, etc.
// vão ler durante o import.

process.env.NODE_ENV = 'test';

// Os testes SEMPRE rodam no HOST (fora do Docker) — "db"/"redis" só
// resolvem dentro da rede do Compose; do lado de fora usamos localhost.
process.env.DB_HOST = 'localhost';
process.env.REDIS_HOST = 'localhost';

// dotenv.config() NUNCA sobrescreve uma variável que já existe em
// process.env — como este arquivo roda primeiro, isto garante que o
// valor lido do .env não "vence" por engano.
process.env.DB_NAME = `${process.env.DB_NAME || 'juris_db'}_test`;
```

Adicione os scripts de teste restantes ao `package.json` (substituindo o placeholder do passo 01):

```json
{
  "scripts": {
    "test": "cross-env NODE_ENV=test jest --runInBand",
    "test:watch": "cross-env NODE_ENV=test jest --watch --runInBand",
    "test:coverage": "cross-env NODE_ENV=test jest --coverage --runInBand"
  }
}
```

> 💡 **Por que `--runInBand`?** Por padrão, o Jest roda arquivos de teste em paralelo, em processos separados. Ótimo para testes unitários; perigoso para testes de integração que compartilham o **mesmo** banco — dois arquivos rodando ao mesmo tempo poderiam se atropelar (um limpando dados que o outro está usando naquele instante). `--runInBand` roda tudo sequencialmente — mais lento, porém previsível.

Adicione `coverage/` ao `.gitignore`.

## ✅ Como confirmar que funcionou

```bash
npm test
```

Ainda não existe nenhum teste — deve reportar `No tests found`, **sem erros de configuração**. Isso já confirma que `ts-jest`, `moduleNameMapper` e a conexão com o banco de teste estão prontos.

## 🔧 Commit sugerido

```bash
git add jest.config.cjs tsconfig.jest.json tests/setup/env.cjs package.json package-lock.json .gitignore
git commit -m "chore: configurar jest com banco de teste isolado"
```
