# 13 — Migration e Model: Lawsuit

## 🎯 Objetivo

Criar a tabela `lawsuits` (processos), vinculada a `clients` por uma chave estrangeira — o primeiro relacionamento do projeto.

## Passo a passo

**1.** Gere e edite a migration:

```bash
npx sequelize-cli migration:generate --name create-lawsuits
```

```javascript
// src/database/migrations/<timestamp>-create-lawsuits.cjs
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
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDING',
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'clients',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    await queryInterface.addIndex('lawsuits', ['client_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lawsuits');
  },
};
```

> 💡 **`onDelete: 'CASCADE'`, em detalhe.** Se um cliente for apagado, todos os processos vinculados a ele são apagados automaticamente pelo **próprio banco** — sem precisar de nenhum código adicional na aplicação para "limpar atrás". Isso é o oposto da decisão que a Dead Letter Queue (passo 22) vai tomar (`SET NULL` em vez de `CASCADE`) — cada relacionamento merece essa pergunta feita explicitamente: "faz sentido apagar isso em cascata, ou é melhor manter o registro histórico e só desvincular?".
>
> 💡 **Por que `addIndex` em `client_id`?** Toda vez que a aplicação buscar "todos os processos de um cliente" (algo que vai acontecer, mesmo que não exista um endpoint específico para isso ainda), o Postgres precisa varrer a coluna `client_id`. Sem índice, isso significa examinar a tabela inteira linha por linha; com índice, a busca é praticamente instantânea mesmo com milhões de linhas.

**2.** Rode a migration:

```bash
npm run db:migrate
```

**3.** Crie `src/models/lawsuit.model.ts`:

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
      field: 'cnj_number',
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

**4.** Atualize `src/models/index.ts`, adicionando o model e o relacionamento com `Client`:

```typescript
// src/models/index.ts
import sequelize from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';

// Client 1:N Lawsuit
Client.hasMany(Lawsuit, { foreignKey: 'clientId', as: 'lawsuits' });
Lawsuit.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

export { sequelize, Client, Lawsuit };
```

> 💡 **`hasMany`/`belongsTo` — por que os dois lados, e não só um?** O relacionamento no banco (a chave estrangeira) já existe só com a migration. As chamadas `hasMany`/`belongsTo` são o que ensina o **Sequelize** (em memória, no código) a navegar essa relação nos dois sentidos: `client.getLawsuits()` (implícito, via `include`) e `lawsuit.getClient()`. Sem declarar os dois lados, só um sentido de navegação funcionaria.

## ✅ Como confirmar que funcionou

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "\d lawsuits"
```

Deve mostrar a coluna `client_id` com uma constraint de chave estrangeira referenciando `clients(id)`.

## 🔧 Commit sugerido

```bash
git add src/database/migrations src/models/lawsuit.model.ts src/models/index.ts
git commit -m "feat: criar model e migration de processos"
```
