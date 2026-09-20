# 16 — Seed de Dados de Exemplo

## 🎯 Objetivo

Popular o banco local com dados fictícios, com um único comando — útil para testar manualmente sem precisar recriar clientes/processos do zero a cada `docker compose down -v`.

## 📝 Código

Diferente da V2 (que usava `sequelize-cli seed:generate` + `db:seed:all`), o Mongoose não tem uma ferramenta de linha de comando dedicada a "seeders" — o script abaixo é só um programa Node comum, que usa os **mesmos** models da aplicação.

Crie `src/database/seed.ts`:

```typescript
// src/database/seed.ts
import mongoose from '../config/database.js';
import { Client, Lawsuit } from '../models/index.js';

async function seed() {
  await mongoose.connection.asPromise(); // espera a conexão abrir antes de limpar/inserir

  await Client.deleteMany({});
  await Lawsuit.deleteMany({});

  const maria = await Client.create({
    name: 'Maria Oliveira',
    document: '123.456.789-00',
    email: 'maria.oliveira@example.com',
  });

  const alfa = await Client.create({
    name: 'Construtora Alfa Ltda',
    document: '12.345.678/0001-90',
    email: 'contato@alfaconstrutora.example.com',
  });

  await Lawsuit.create({
    cnjNumber: '0001234-56.2024.8.19.0001',
    status: 'UPDATED',
    clientId: maria._id,
    movements: [
      { description: 'Citação enviada à parte ré.', date: new Date('2024-03-10') },
      { description: 'Juntada de contestação.', date: new Date('2024-04-02') },
    ],
  });

  await Lawsuit.create({
    cnjNumber: '0007654-32.2023.8.19.0002',
    status: 'PENDING',
    clientId: alfa._id,
    movements: [{ description: 'Processo distribuído.', date: new Date('2023-11-20') }],
  });

  console.log('Seed concluído: 2 clientes, 2 processos.');
  await mongoose.disconnect();
}

seed().catch((err: unknown) => {
  console.error('Falha ao rodar o seed:', err);
  process.exit(1);
});
```

> 💡 **Por que este seeder é bem mais simples que o da V2 (que precisava gerar UUIDs manualmente para linkar três tabelas numa única execução)?** Porque movimentações agora são um campo do próprio documento (passo 15) — não existe mais um "id do processo" que precisa ser conhecido **antes** de inserir a movimentação. `Lawsuit.create({..., movements: [...] })` insere o processo e todas as suas movimentações num único comando, num único documento. O único id que ainda importa "descobrir antes" é o do cliente (`maria._id`), porque `clientId` é uma referência de verdade entre dois documentos.
>
> 💡 **Por que não existe um `db:seed:undo` equivalente ao da V2?** Este script já limpa as coleções (`deleteMany({})`) antes de inserir — rodar `npm run db:seed` de novo é sempre seguro e idempotente, então não há necessidade de um comando "desfazer" separado.

Adicione o script ao `package.json`:

```json
{
  "scripts": {
    "db:seed": "tsx src/database/seed.ts"
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
git add src/database/seed.ts package.json
git commit -m "feat: adicionar seed de dados de exemplo"
```
