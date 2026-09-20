# 09 — Sequelize: Conectando ao Banco

## 🎯 Objetivo

Instalar o ORM e configurar a conexão com o Postgres — ainda **sem nenhuma tabela**. Este passo é só sobre a "cola" entre a aplicação e o banco existir e funcionar.

## 📦 Instalar

```bash
npm install sequelize pg pg-hstore
npm install -D sequelize-cli
```

> - **`sequelize`** — o ORM: mapeia tabelas para classes/objetos TypeScript.
> - **`pg`** / **`pg-hstore`** — o driver de baixo nível que o Sequelize usa por baixo dos panos para falar com o Postgres especificamente (o Sequelize suporta vários bancos; esses dois pacotes são o "conector" do Postgres).
> - **`sequelize-cli`** — a ferramenta de linha de comando que gera e roda **migrations** (o "Git" da estrutura do banco — você vai usar isso a partir do passo 10).

## 📝 Código

Crie `.sequelizerc` na raiz — diz ao `sequelize-cli` onde encontrar cada peça (por padrão, ele procura numa estrutura de pastas diferente da que este projeto usa):

```javascript
// .sequelizerc
const path = require('path');

module.exports = {
  'config': path.resolve('src', 'config', 'config.cjs'),
  'models-path': path.resolve('src', 'models'),
  'seeders-path': path.resolve('src', 'database', 'seeders'),
  'migrations-path': path.resolve('src', 'database', 'migrations'),
};
```

> 💡 **Por que `.sequelizerc` é `.js` puro (CommonJS), nunca `.ts`?** O `sequelize-cli` é uma ferramenta externa ao seu código de aplicação — ela roda **antes** de qualquer compilação TypeScript acontecer, e só sabe interpretar JavaScript. É a primeira de várias vezes, neste guia, em que uma ferramenta de configuração externa exige CommonJS mesmo o projeto sendo ESM (`"type": "module"`, passo 01).

Crie `src/config/config.cjs` — a configuração que o `sequelize-cli` usa (diferente por ambiente: `development`, `test`, `production`):

```javascript
// src/config/config.cjs
require('dotenv').config();

const common = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'juris_db',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
};

module.exports = {
  development: { ...common },
  test: { ...common, database: `${common.database}_test` },
  production: { ...common },
};
```

> 💡 **Por que já existe um bloco `test` com um banco de nome diferente (`_test`), se este projeto ainda nem tem testes automatizados?** Definir essa convenção agora, junto com a configuração "principal", custa três linhas — e paga dividendos lá na frente (passo 30), quando o Jest precisar de um banco isolado. Adiar isso significaria voltar aqui, meses depois, para adicionar algo que já poderia ter nascido pronto.

Crie `src/config/database.ts` — a instância do Sequelize usada pela **aplicação** (diferente do `config.cjs` acima, que é só para o `sequelize-cli`):

```typescript
// src/config/database.ts
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'juris_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

export default sequelize;
```

> 💡 **Por que existem DUAS configurações separadas (`config.cjs` para o CLI e `database.ts` para a aplicação), lendo as mesmas variáveis de ambiente?** Porque são dois "consumidores" diferentes: o `sequelize-cli` roda como um processo de linha de comando isolado, fora do ciclo de vida da sua aplicação Express, e não consegue importar um arquivo `.ts` diretamente. Duplicar a leitura das variáveis (em vez de tentar compartilhar um único arquivo entre os dois) é a abordagem mais simples e é exatamente o padrão oficial recomendado pela documentação do Sequelize.

## ✅ Como confirmar que funcionou

Crie um script temporário para testar a conexão:

```typescript
// src/teste-conexao.ts
import sequelize from './config/database.js';

async function main() {
  await sequelize.authenticate();
  console.log('Conexão com o banco estabelecida com sucesso!');
  await sequelize.close();
}

main();
```

```bash
npx tsx src/teste-conexao.ts
```

Com o Postgres do passo 08 rodando (`docker compose up -d db`) e a variável `DB_HOST` apontando para onde ele está acessível (`localhost`, se você estiver rodando este script **fora** do Docker), deve imprimir a mensagem de sucesso. Apague `src/teste-conexao.ts` depois.

## 🔧 Commit sugerido

```bash
git add .sequelizerc src/config/config.cjs src/config/database.ts package.json package-lock.json
git commit -m "feat: configurar sequelize e conexao com o banco"
```
