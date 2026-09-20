# 15 — Migration e Model: Movement

## 🎯 Objetivo

Criar a tabela `movements` (movimentações processuais) — o terceiro e último model "estático" do projeto (a partir daqui, movimentações passam a ser criadas pelo Worker, não por um endpoint HTTP direto).

## Passo a passo

**1.** Gere e edite a migration:

```bash
npx sequelize-cli migration:generate --name create-movements
```

```javascript
// src/database/migrations/<timestamp>-create-movements.cjs
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
        onDelete: 'CASCADE',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      date: {
        type: Sequelize.DATE,
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

> 💡 **`description` é `TEXT`, não `STRING` como os outros campos textuais do projeto — por quê?** No Postgres, `STRING` (que o Sequelize traduz para `VARCHAR(255)`) tem um limite de tamanho; `TEXT` não tem limite prático. A descrição de uma movimentação processual real (o texto de um despacho, por exemplo) pode facilmente passar de 255 caracteres — um limite ali seria um bug esperando para acontecer.

**2.** Rode a migration:

```bash
npm run db:migrate
```

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

**4.** Atualize `src/models/index.ts` (editando o arquivo do passo 13) e o `getLawsuitById` para incluir as movimentações na resposta:

```typescript
// src/models/index.ts
import sequelize from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';
import Movement from './movement.model.js';

Client.hasMany(Lawsuit, { foreignKey: 'clientId', as: 'lawsuits' });
Lawsuit.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Lawsuit 1:N Movement
Lawsuit.hasMany(Movement, { foreignKey: 'lawsuitId', as: 'movements' });
Movement.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

export { sequelize, Client, Lawsuit, Movement };
```

```typescript
// src/controllers/lawsuit.controller.ts — atualize só o import e o getLawsuitById
import { Client, Lawsuit, Movement } from '../models/index.js';

export async function getLawsuitById(req: Request<{ id: string }>, res: Response) {
  const lawsuit = await Lawsuit.findByPk(req.params.id, {
    include: [
      { model: Client, as: 'client' },
      { model: Movement, as: 'movements', separate: true, order: [['date', 'ASC']] },
    ],
  });

  if (!lawsuit) {
    throw new AppError('Processo não encontrado.', 404);
  }

  return res.status(200).json(lawsuit);
}
```

> 💡 **`separate: true` — o que isso muda?** Sem essa opção, o Sequelize faria um único `JOIN` SQL entre `lawsuits` e `movements`; com múltiplas movimentações por processo, isso **duplicaria** os dados do processo (uma linha inteira do processo repetida para cada movimentação), e o `ORDER BY` de uma tabela interfere na ordem da outra. `separate: true` faz o Sequelize disparar uma **segunda query**, dedicada só a buscar as movimentações já ordenadas — mais previsível e mais fácil de otimizar individualmente.

## ✅ Como confirmar que funcionou

Ainda não existe nenhum jeito de criar uma movimentação via API (isso só existe a partir do Worker, passo 20) — por enquanto, confirme só que a tabela existe e que `GET /api/lawsuits/:id` retorna `"movements": []`:

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "\d movements"
curl http://localhost:3000/api/lawsuits/<ID_DE_UM_PROCESSO_JA_CRIADO>
```

## 🔧 Commit sugerido

```bash
git add src/database/migrations src/models/movement.model.ts src/models/index.ts src/controllers/lawsuit.controller.ts
git commit -m "feat: criar model e migration de movimentacoes"
```
