# 16 — Seeder de Dados de Exemplo

## 🎯 Objetivo

Popular o banco local com dados fictícios, com um único comando — útil para testar manualmente sem precisar recriar clientes/processos do zero a cada `docker compose down -v`.

## 📝 Código

Gere o esqueleto do seeder:

```bash
npx sequelize-cli seed:generate --name demo-clients-lawsuits-movements
```

Substitua o conteúdo por:

```javascript
// src/database/seeders/<timestamp>-demo-clients-lawsuits-movements.cjs
'use strict';
const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
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

  async down(queryInterface) {
    await queryInterface.bulkDelete('movements', null, {});
    await queryInterface.bulkDelete('lawsuits', null, {});
    await queryInterface.bulkDelete('clients', null, {});
  },
};
```

> 💡 **Por que gerar os UUIDs manualmente (`randomUUID()`) em vez de deixar o banco gerar sozinho (como a migration faz, via `defaultValue: UUIDV4`)?** Porque o seeder precisa **saber** o `id` do cliente para inseri-lo como `client_id` do processo — e o `id` do processo para inseri-lo como `lawsuit_id` da movimentação. Gerando o UUID manualmente, em JavaScript, antes do `bulkInsert`, o seeder consegue montar esses relacionamentos entre as três tabelas numa única execução, sem precisar fazer uma query extra "de volta" ao banco para descobrir qual `id` acabou de ser gerado.

Adicione os scripts ao `package.json`:

```json
{
  "scripts": {
    "db:seed": "sequelize-cli db:seed:all",
    "db:seed:undo": "sequelize-cli db:seed:undo:all"
  }
}
```

## ✅ Como confirmar que funcionou

```bash
npm run db:seed
curl "http://localhost:3000/api/clients?page=1&limit=10"
```

Deve listar os 2 clientes de exemplo. Confirme também o processo com movimentações:

```bash
curl http://localhost:3000/api/lawsuits/<ID_DO_LAWSUIT_1_NO_BANCO>
```

Deve retornar `"movements"` com 2 itens.

## 🔧 Commit sugerido

```bash
git add src/database/seeders package.json
git commit -m "feat: adicionar seeder de dados de exemplo"
```
