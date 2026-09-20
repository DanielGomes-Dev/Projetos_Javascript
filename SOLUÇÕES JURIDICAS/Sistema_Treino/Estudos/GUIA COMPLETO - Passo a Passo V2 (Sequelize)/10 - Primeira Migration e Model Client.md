# 10 — Primeira Migration e Model: Client

## 🎯 Objetivo

Criar a primeira tabela de verdade (`clients`) e o model Sequelize correspondente — o menor "fim a fim" possível de dado persistido.

## Passo a passo

**1.** Gere o esqueleto da migration:

```bash
npx sequelize-cli migration:generate --name create-clients
```

Isso cria um arquivo em `src/database/migrations/`, com um nome prefixado por timestamp (ex.: `20260101000001-create-clients.cjs`). Substitua o conteúdo gerado por:

```javascript
// src/database/migrations/<timestamp>-create-clients.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clients', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      document: {
        // CPF ou CNPJ
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('clients');
  },
};
```

> 💡 **Por que `id` é `UUID` (com `defaultValue: UUIDV4`), em vez do clássico `id` inteiro autoincremental?** Um UUID pode ser gerado **antes** de o registro ser salvo no banco (útil quando você precisa referenciar o id em outro lugar antes de persistir), não revela "quantos registros existem" só olhando o valor (um problema real de um `id` sequencial em APIs públicas), e evita colisão se um dia você precisar migrar/mesclar dados de bancos diferentes. O custo (índices um pouco maiores que inteiros) é aceitável para este projeto.
>
> 💡 **Por que `created_at`/`updated_at` em `snake_case` na migration, mas `createdAt`/`updatedAt` em `camelCase` no model (próximo bloco)?** SQL tradicionalmente usa `snake_case` para nomes de coluna; JavaScript/TypeScript usa `camelCase` para nomes de propriedade. A opção `underscored: true` do model (abaixo) faz essa tradução automaticamente nos dois sentidos — você nunca escreve `client.created_at` no código, sempre `client.createdAt`.

**2.** Rode a migration:

```bash
npm run db:migrate
```

(Adicione o script ao `package.json`, se ainda não existir: `"db:migrate": "sequelize-cli db:migrate"`.)

**3.** Crie `src/models/client.model.ts`:

```typescript
// src/models/client.model.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface ClientAttributes {
  id: string;
  name: string;
  document: string;
  email: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// "Optional" marca quais campos NÃO são obrigatórios ao CRIAR um registro
// (id e email têm valor padrão/são opcionais) — Client.create({...}) só
// exige name e document.
type ClientCreationAttributes = Optional<ClientAttributes, 'id' | 'email'>;

class Client extends Model<ClientAttributes, ClientCreationAttributes> implements ClientAttributes {
  declare id: string;
  declare name: string;
  declare document: string;
  declare email: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

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
    sequelize,
    modelName: 'Client',
    tableName: 'clients',
    underscored: true,
  }
);

export default Client;
```

**4.** Crie `src/models/index.ts` — ponto único de acesso aos models (ainda só um, mas a estrutura já nasce pronta para os próximos):

```typescript
// src/models/index.ts
import sequelize from '../config/database.js';
import Client from './client.model.js';

export { sequelize, Client };
```

## ✅ Como confirmar que funcionou

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "\d clients"
```

Deve listar as colunas `id`, `name`, `document`, `email`, `created_at`, `updated_at`, com `document` marcado como `UNIQUE`.

## 🔧 Commit sugerido

```bash
git add src/database/migrations src/models/client.model.ts src/models/index.ts
git commit -m "feat: criar model e migration de clientes"
```
