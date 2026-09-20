# Fase 2 — Banco de Dados Relacional e ORM (Sequelize + PostgreSQL)

> Objetivo desta fase: definir a "planta baixa" dos dados — quais tabelas existem, quais colunas, quais relacionamentos — e ter uma forma de **versionar** essas mudanças de estrutura (migrations), além de um jeito programático (models) de ler/escrever nessas tabelas a partir do TypeScript.

---

## 2.1. Configuração do Sequelize

### O que vamos construir e por quê

O **Sequelize** é um ORM (*Object-Relational Mapper*): ele traduz entre "tabelas e linhas SQL" e "classes e objetos TypeScript", para que você escreva `Client.create({ name: 'Maria' })` em vez de `INSERT INTO clients (name) VALUES ('Maria')`. Ele também vem com um CLI (`sequelize-cli`) para gerenciar **migrations** — arquivos que descrevem, passo a passo e no tempo, como a estrutura do banco evoluiu (é literalmente o "histórico de commits" do schema do banco).

### Passo a passo

**1.** Instale as dependências:

```bash
npm install sequelize pg pg-hstore
npm install -D sequelize-cli
```

> - **`sequelize`** — o ORM em si.
> - **`pg`** — o driver de baixo nível que fala o protocolo do PostgreSQL (o Sequelize não conversa direto com o banco, ele delega para o driver do dialeto escolhido).
> - **`pg-hstore`** — serializa/desserializa o tipo `hstore` do Postgres (usado internamente pelo Sequelize com Postgres, mesmo que você não use `hstore` diretamente).
> - **`sequelize-cli`** — a ferramenta de linha de comando (`sequelize-cli db:migrate`, `db:seed`, etc.), instalada como dependência de desenvolvimento (não é necessária em produção rodando o app, só para administrar o banco).

**2.** Crie o arquivo `.sequelizerc` na **raiz** do projeto. Ele diz ao `sequelize-cli` onde encontrar cada peça (por padrão, ele procuraria numa pasta `config/` na raiz — nós preferimos manter tudo dentro de `src/`):

```javascript
const path = require('path');

module.exports = {
  'config': path.resolve('src', 'config', 'config.cjs'),
  'models-path': path.resolve('src', 'models'),
  'seeders-path': path.resolve('src', 'database', 'seeders'),
  'migrations-path': path.resolve('src', 'database', 'migrations'),
};
```

> ⚠️ Este arquivo usa `require`/`module.exports` (CommonJS) de propósito — o próprio `sequelize-cli` ainda o carrega dessa forma internamente, independente do `"type": "module"` do resto do projeto. É por isso que ele **não** tem extensão `.ts` nem `.mjs`.

**3.** Crie `src/config/config.cjs` — a configuração de conexão que o **CLI** usa (é separada da configuração que a **aplicação** usa, porque o CLI roda fora do runtime do TypeScript/tsx, então precisa ser um `.cjs` puro, sem `import`):

```javascript
// src/config/config.cjs
//
// Configuração LIDA PELO sequelize-cli (comandos db:migrate, db:seed, etc.).
// Note que é CommonJS puro (require), pois o CLI não passa pelo tsx/TypeScript.

require('dotenv').config();   // carrega o .env manualmente, já que o CLI não roda o server.ts

const common = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'juris_db',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
};

// O Sequelize CLI espera um objeto com uma chave por "ambiente"
// (development / test / production). Usamos os mesmos valores em todos,
// exceto o "test", que aponta para um banco separado (_test) para nunca
// misturar dados de teste com dados reais.
module.exports = {
  development: { ...common },
  test: { ...common, database: `${common.database}_test` },
  production: { ...common },
};
```

**4.** Crie `src/config/database.ts` — a conexão que a **aplicação de verdade** (API e Worker) usa, escrita em TypeScript:

```typescript
// src/config/database.ts
//
// Instância única (singleton) do Sequelize, importada por todos os
// models. Separada do config.cjs porque este arquivo roda DENTRO do
// runtime da aplicação (via tsx/tsc), enquanto o config.cjs só é lido
// pelo sequelize-cli.

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();   // lê o arquivo .env e injeta as variáveis em process.env

const sequelize = new Sequelize(
  process.env.DB_NAME || 'juris_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,   // desliga o log de cada SQL executado no console (deixe "true" ou "console.log" para depurar)
  }
);

export default sequelize;
```

### Como confirmar que deu certo

```bash
npx sequelize-cli db:migrate:status
```

Não deve dar erro de conexão (mesmo que ainda diga "No migrations were executed" — ainda não criamos nenhuma).

---

## 2.2. Criação das Migrations (Modelagem Relacional)

### O que é uma migration, exatamente?

Uma **migration** é um arquivo com duas funções, `up` e `down`:
- `up` — o que fazer para **aplicar** essa mudança na estrutura do banco (ex.: criar uma tabela).
- `down` — como **desfazer** essa mudança (ex.: apagar a tabela), caso precise reverter.

Migrations são numeradas por data/hora e aplicadas **em ordem**. Isso permite que qualquer pessoa (ou qualquer ambiente — sua máquina, o CI, o servidor de produção) chegue à **mesma estrutura de banco**, rodando `npx sequelize-cli db:migrate`, não importa de onde estejam partindo.

### Passo a passo

**1.** Gere o esqueleto da primeira migration (tabela `clients`):

```bash
npx sequelize-cli migration:generate --name create-clients
```

> Isso cria um arquivo em `src/database/migrations/` com o nome `<timestamp>-create-clients.js` (renomeie a extensão para `.cjs`, já que o projeto todo é ESM por padrão — arquivos de migration do Sequelize CLI usam `require`, então precisam ser explicitamente CommonJS).

Substitua o conteúdo gerado por:

```javascript
// src/database/migrations/20260101000001-create-clients.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // up(): roda quando executamos `npx sequelize-cli db:migrate`
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clients', {
      id: {
        type: Sequelize.UUID,             // identificador universal único (128 bits), em vez de um inteiro sequencial
        defaultValue: Sequelize.UUIDV4,     // o próprio Postgres/Sequelize gera o UUID na inserção (versão 4 = aleatório)
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      document: {
        // CPF ou CNPJ — texto porque tem pontuação (pontos, traço, barra)
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,   // não deixa cadastrar dois clientes com o mesmo CPF/CNPJ
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,   // opcional
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),   // o próprio banco preenche com a data/hora atual
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  // down(): desfaz o que o up() fez — usado em `db:migrate:undo`
  async down(queryInterface) {
    await queryInterface.dropTable('clients');
  },
};
```

> 💡 **Por que `UUID` em vez de um `id` numérico incremental (`1, 2, 3...`)?** Em sistemas distribuídos (ou quando você pode ter múltiplas fontes gerando registros, como importações em lote), UUIDs evitam colisão de IDs e não revelam "quantos registros existem" (um `id` sequencial vazando publicamente, tipo `/clients/42`, deixa óbvio que só existem ~42 clientes).

> 💡 **Por que `created_at`/`updated_at` com `snake_case`, se o resto do código usa `camelCase` (`createdAt`)?** É uma convenção comum em bancos SQL usar `snake_case` para nomes de coluna, enquanto o código TypeScript usa `camelCase`. Vamos ver na seção 2.3 como o Sequelize faz essa "tradução" automaticamente com a opção `underscored: true`.

**2.** Gere e edite a migration da tabela `lawsuits` (processos):

```bash
npx sequelize-cli migration:generate --name create-lawsuits
```

```javascript
// src/database/migrations/20260101000002-create-lawsuits.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lawsuits', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      cnj_number: {
        // Número único do processo no padrão do CNJ (Conselho Nacional de Justiça)
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,   // o mesmo processo nunca pode ser cadastrado duas vezes
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDING',   // todo processo recém-cadastrado começa como "pendente de sincronização"
      },
      client_id: {
        // Chave estrangeira (FK): conecta este processo a um cliente
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'clients',   // nome da TABELA (não do model TS) referenciada
          key: 'id',
        },
        onUpdate: 'CASCADE',   // se o id do cliente mudar, propaga a mudança aqui (raro com UUID, mas é boa prática)
        onDelete: 'CASCADE',   // se o cliente for apagado, apaga também os processos dele
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Índice na coluna de FK: acelera consultas do tipo
    // "todos os processos de um cliente específico" (SELECT ... WHERE client_id = ?).
    await queryInterface.addIndex('lawsuits', ['client_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lawsuits');
  },
};
```

> 💡 **`onDelete: 'CASCADE'` é sempre a escolha certa?** Não — aqui faz sentido porque um processo "órfão" (sem cliente) não tem utilidade no domínio jurídico. Em outros contextos, você poderia preferir `onDelete: 'RESTRICT'` (impede apagar o cliente enquanto existirem processos vinculados) ou `onDelete: 'SET NULL'`. É uma decisão de negócio, não só técnica.

**3.** Gere e edite a migration da tabela `movements` (movimentações processuais):

```bash
npx sequelize-cli migration:generate --name create-movements
```

```javascript
// src/database/migrations/20260101000003-create-movements.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('movements', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      lawsuit_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'lawsuits',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',   // se o processo for apagado, apaga o histórico de movimentações dele também
      },
      description: {
        type: Sequelize.TEXT,   // TEXT em vez de STRING: movimentações podem ter textos longos, sem limite fixo de caracteres
        allowNull: false,
      },
      date: {
        type: Sequelize.DATE,   // data em que a movimentação ocorreu no tribunal (diferente de created_at, que é quando NÓS a capturamos)
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('movements', ['lawsuit_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('movements');
  },
};
```

**4.** Aplique as três migrations no banco:

```bash
npm run db:migrate
```

(Vamos criar esse script no `package.json` já na próxima seção — por enquanto pode rodar diretamente com `npx sequelize-cli db:migrate`.)

### Como confirmar que deu certo

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "\dt"
```

Deve listar as tabelas `clients`, `lawsuits`, `movements` e uma tabela extra `SequelizeMeta` (criada automaticamente pelo Sequelize CLI — é onde ele guarda **quais migrations já rodaram**, para nunca rodar a mesma migration duas vezes).

---

## 2.3. Modelos e Relacionamentos

### O que vamos construir e por quê

As **migrations** definem a estrutura no banco (SQL puro). Os **models** são a ponte para o **código**: classes TypeScript que representam cada tabela, com os campos tipados e os relacionamentos declarados (para que o Sequelize saiba gerar automaticamente os `JOIN`s corretos quando você pedir, por exemplo, "me dê o processo com o cliente incluído").

### Passo a passo

**1.** Crie `src/models/client.model.ts`:

```typescript
// src/models/client.model.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

// Formato COMPLETO de um Client (como ele existe depois de salvo no banco).
interface ClientAttributes {
  id: string;
  name: string;
  document: string;
  email: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Formato aceito ao CRIAR um Client: `id` e `email` são opcionais na
// criação (o `id` é gerado automaticamente; `email` pode ficar de fora).
// `Optional<T, K>` é um utilitário do Sequelize: pega o tipo T e torna
// as chaves K opcionais.
type ClientCreationAttributes = Optional<ClientAttributes, 'id' | 'email'>;

// A classe do model: estende `Model` do Sequelize, parametrizada com os
// dois tipos acima, e implementa a interface para garantir que todo
// campo declarado abaixo (em `Client.init`) bate com o TypeScript.
class Client extends Model<ClientAttributes, ClientCreationAttributes> implements ClientAttributes {
  // `declare` diz ao TypeScript "esta propriedade existe, mas não gere
  // código para inicializá-la aqui" — quem cria o valor de verdade é o
  // Sequelize internamente (via getters/setters mágicos), não o construtor da classe.
  declare id: string;
  declare name: string;
  declare document: string;
  declare email: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

// `Client.init(...)` registra o model no Sequelize: mapeia cada
// propriedade TypeScript para uma definição de coluna.
Client.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    document: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,                // a instância de conexão criada em config/database.ts
    modelName: 'Client',       // nome do model dentro do Sequelize (usado em mensagens de erro, por exemplo)
    tableName: 'clients',       // nome REAL da tabela no banco (sem isso, o Sequelize tentaria pluralizar/inferir sozinho)
    underscored: true,           // traduz createdAt <-> created_at, updatedAt <-> updated_at automaticamente
  }
);

export default Client;
```

**2.** Crie `src/models/lawsuit.model.ts` seguindo exatamente o mesmo padrão:

```typescript
// src/models/lawsuit.model.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface LawsuitAttributes {
  id: string;
  cnjNumber: string;
  status: string;
  clientId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Ao criar, `id` é gerado sozinho e `status` tem valor padrão — ambos opcionais.
type LawsuitCreationAttributes = Optional<LawsuitAttributes, 'id' | 'status'>;

class Lawsuit extends Model<LawsuitAttributes, LawsuitCreationAttributes> implements LawsuitAttributes {
  declare id: string;
  declare cnjNumber: string;
  declare status: string;
  declare clientId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Lawsuit.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    cnjNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'cnj_number',   // o Sequelize usa `cnjNumber` no código, mas lê/escreve a coluna `cnj_number` no banco
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING',
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'client_id',
    },
  },
  {
    sequelize,
    modelName: 'Lawsuit',
    tableName: 'lawsuits',
    underscored: true,
  }
);

export default Lawsuit;
```

> 💡 **Por que `field: 'cnj_number'` explícito, se `underscored: true` já converte `camelCase` para `snake_case` automaticamente?** Na maioria dos casos, `underscored: true` já resolve sozinho (`clientId` -> `client_id`). O `field` explícito aqui é redundante, mas serve como **documentação** — deixa claro, olhando só para a definição da coluna, qual é o nome real dela no banco, sem precisar confiar "de cabeça" na regra de conversão automática.

**3.** Crie `src/models/movement.model.ts`:

```typescript
// src/models/movement.model.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface MovementAttributes {
  id: string;
  lawsuitId: string;
  description: string;
  date: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type MovementCreationAttributes = Optional<MovementAttributes, 'id'>;

class Movement extends Model<MovementAttributes, MovementCreationAttributes> implements MovementAttributes {
  declare id: string;
  declare lawsuitId: string;
  declare description: string;
  declare date: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Movement.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lawsuitId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'lawsuit_id',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Movement',
    tableName: 'movements',
    underscored: true,
  }
);

export default Movement;
```

**4.** Crie `src/models/index.ts` — o arquivo que **importa todos os models e declara os relacionamentos entre eles**. É importante que os relacionamentos fiquem centralizados aqui (e não dentro de cada arquivo de model individual), para evitar dependência circular entre os arquivos (`Client` "conhecendo" `Lawsuit` e vice-versa):

```typescript
// src/models/index.ts
import sequelize from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';
import Movement from './movement.model.js';

// Client 1:N Lawsuit
// Um cliente pode ter vários processos; cada processo pertence a um único cliente.
Client.hasMany(Lawsuit, { foreignKey: 'clientId', as: 'lawsuits' });
Lawsuit.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Lawsuit 1:N Movement
// Um processo pode ter várias movimentações; cada movimentação pertence a um único processo.
Lawsuit.hasMany(Movement, { foreignKey: 'lawsuitId', as: 'movements' });
Movement.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

// Reexporta tudo por um único ponto de entrada — o resto do projeto
// importa de 'models/index.js', nunca direto do arquivo de cada model.
export { sequelize, Client, Lawsuit, Movement };
```

> 💡 **O que `as: 'lawsuits'` / `as: 'client'` fazem?** É o "apelido" usado quando você pede para o Sequelize **incluir** (fazer o `JOIN`) esse relacionamento numa consulta — por exemplo `Client.findByPk(id, { include: 'lawsuits' })` retorna o cliente com um array `.lawsuits` já populado. Sem o `as`, o Sequelize usaria o nome do model (`Lawsuit`), o que fica menos natural de ler no código.

> ℹ️ Vamos voltar a este arquivo na Fase 4, para acrescentar o model `DeadLetterJob` e seu relacionamento com `Lawsuit` — ele só entra em cena quando construirmos o sistema de filas.

### Como confirmar que deu certo

Crie um script temporário `src/scripts/teste-models.ts` (pode apagar depois):

```typescript
import { sequelize, Client } from '../models/index.js';

async function main() {
  await sequelize.authenticate();
  console.log('Conexão com o banco OK.');

  const cliente = await Client.create({
    name: 'Teste da Silva',
    document: '000.000.000-00',
  });
  console.log('Cliente criado:', cliente.toJSON());

  await cliente.destroy();   // limpa o registro de teste
  process.exit(0);
}

main();
```

Rode com:

```bash
npx tsx src/scripts/teste-models.ts
```

Se aparecer "Conexão com o banco OK." e o objeto do cliente criado, os models e a conexão estão corretos.

---

## 2.4. Seeders para Teste

### O que vamos construir e por quê

Migrations descrevem **estrutura**. **Seeders** inserem **dados de exemplo** — úteis para testar a API localmente sem precisar cadastrar tudo manualmente toda vez que você recria o banco do zero.

### Passo a passo

**1.** Gere o esqueleto do seeder:

```bash
npx sequelize-cli seed:generate --name demo-clients-lawsuits-movements
```

**2.** Substitua o conteúdo por:

```javascript
// src/database/seeders/20260101010000-demo-clients-lawsuits-movements.cjs
'use strict';
const { randomUUID } = require('crypto');   // gera UUIDs nativamente, sem depender de libs externas

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Geramos os IDs ANTES de inserir, porque precisamos reutilizá-los
    // como chave estrangeira (client_id, lawsuit_id) nas tabelas filhas.
    const client1Id = randomUUID();
    const client2Id = randomUUID();
    const lawsuit1Id = randomUUID();
    const lawsuit2Id = randomUUID();

    await queryInterface.bulkInsert('clients', [
      {
        id: client1Id,
        name: 'Maria Oliveira',
        document: '123.456.789-00',
        email: 'maria.oliveira@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: client2Id,
        name: 'Construtora Alfa Ltda',
        document: '12.345.678/0001-90',
        email: 'contato@alfaconstrutora.example.com',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('lawsuits', [
      {
        id: lawsuit1Id,
        cnj_number: '0001234-56.2024.8.19.0001',
        status: 'ACTIVE',
        client_id: client1Id,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: lawsuit2Id,
        cnj_number: '0007654-32.2023.8.19.0002',
        status: 'PENDING',
        client_id: client2Id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('movements', [
      {
        id: randomUUID(),
        lawsuit_id: lawsuit1Id,
        description: 'Citação enviada à parte ré.',
        date: new Date('2024-03-10'),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: randomUUID(),
        lawsuit_id: lawsuit1Id,
        description: 'Juntada de contestação.',
        date: new Date('2024-04-02'),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: randomUUID(),
        lawsuit_id: lawsuit2Id,
        description: 'Processo distribuído.',
        date: new Date('2023-11-20'),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  // down(): reverte o seeder, na ordem INVERSA de inserção (apaga
  // primeiro quem depende de FK, senão o banco recusa por violação de
  // integridade referencial).
  async down(queryInterface) {
    await queryInterface.bulkDelete('movements', null, {});
    await queryInterface.bulkDelete('lawsuits', null, {});
    await queryInterface.bulkDelete('clients', null, {});
  },
};
```

**3.** Adicione os scripts de banco de dados que faltam no `package.json` (complementando os de build/dev da Fase 1):

```json
{
  "scripts": {
    "db:migrate": "sequelize-cli db:migrate",
    "db:migrate:undo": "sequelize-cli db:migrate:undo",
    "db:migrate:undo:all": "sequelize-cli db:migrate:undo:all",
    "db:seed": "sequelize-cli db:seed:all",
    "db:seed:undo": "sequelize-cli db:seed:undo:all"
  }
}
```

**4.** Rode o seeder:

```bash
npm run db:seed
```

### Como confirmar que deu certo

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "SELECT name, document FROM clients;"
```

Deve listar "Maria Oliveira" e "Construtora Alfa Ltda".

> 🔁 **Para recomeçar do zero a qualquer momento** (útil durante o aprendizado, se você quiser testar de novo): `npm run db:seed:undo && npm run db:migrate:undo:all && npm run db:migrate && npm run db:seed`.

---

✅ **Fim da Fase 2.** O banco de dados está com sua estrutura completa (`clients`, `lawsuits`, `movements`), os models TypeScript já conversam com ele, e você tem dados de exemplo para testar. Siga para `03 - Fase 3 - API REST.md`.
