# 10 — Primeiro Model: Client

## 🎯 Objetivo

Criar o primeiro *schema*/model Mongoose de verdade (`Client`) — o menor "fim a fim" possível de dado persistido. Sem migration: no MongoDB, a coleção e seus índices nascem automaticamente na primeira vez que o model é usado.

## Passo a passo

**1.** Crie `src/models/client.model.ts`:

```typescript
// src/models/client.model.ts
import { Schema, model } from 'mongoose';

const clientSchema = new Schema(
  {
    name: { type: String, required: true },
    document: {
      // CPF ou CNPJ
      type: String,
      required: true,
      unique: true,
    },
    email: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      // O Mongoose serializa documentos com "_id" (ObjectId) e "__v"
      // (controle interno de versão) por padrão — nomes que vazam
      // detalhe de implementação do banco para a resposta HTTP. Esta
      // transformação troca "_id" por um "id" (string) mais limpo, e
      // remove "__v", em toda resposta JSON deste model.
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Client = model('Client', clientSchema);

export default Client;
```

> 💡 **Por que `id` é um ObjectId (via `_id` automático do MongoDB), em vez do UUID que a V2 gerava manualmente?** O MongoDB cria, por padrão, um campo `_id` do tipo `ObjectId` para todo documento — um identificador de 12 bytes (24 caracteres em hexadecimal) que já embute um timestamp de criação, um identificador de máquina/processo e um contador. Diferente do UUID v4 (totalmente aleatório) que a V2 usava, um `ObjectId` é *quase* ordenável por data de criação — um efeito colateral às vezes útil, às vezes irrelevante, mas sempre presente. Não há necessidade de configurar nada para ganhar isso: é o padrão do MongoDB.
>
> 💡 **`unique: true` aqui NÃO é uma garantia imediata, como era a constraint `UNIQUE` do Postgres.** O Mongoose traduz essa opção num **índice único do MongoDB**, e esse índice é construído em segundo plano, de forma assíncrona, na primeira vez que o model é usado — normalmente uma questão de milissegundos, mas tecnicamente não instantâneo. Você vai ver essa diferença de novo, de forma bem concreta, no passo 32 (testes automatizados).
>
> 💡 **Sem migration — por quê?** O MongoDB não exige uma estrutura de coleção predefinida: a coleção `clients` é criada automaticamente no banco na primeira vez que um documento é inserido (`Client.create(...)`), e o índice único de `document` é criado automaticamente assim que **este arquivo é importado** e a aplicação conecta ao banco (comportamento chamado de `autoIndex`, ligado por padrão fora de produção). Isso elimina uma categoria inteira de arquivos que a V2 precisava (`src/database/migrations/`) — o schema TypeScript acima **é** a única fonte da verdade sobre a estrutura dos dados.
>
> ⚠️ **"Assim que este arquivo é importado" é a parte que importa — e ainda não é o caso.** Igual ao `config/database.ts` no passo 09, `client.model.ts` só entra em ação quando alguma coisa o importa de verdade. `models/index.ts` (criado a seguir) importa `client.model.ts`, mas **nada, ainda, importa `models/index.ts`** — isso só começa a acontecer no passo 12, quando `client.controller.ts` faz `import { Client } from '../models/index.js'`. Rodar `npm run dev` agora sobe a API normalmente, mas o model `Client` nunca chega a ser registrado, e o índice único nunca chega a ser criado — é por isso que a confirmação abaixo usa um script dedicado, em vez de "suba a aplicação e veja".

**2.** Crie `src/models/index.ts` — ponto único de acesso aos models (ainda só um, mas a estrutura já nasce pronta para os próximos):

```typescript
// src/models/index.ts
import mongoose from '../config/database.js';
import Client from './client.model.js';

export { mongoose, Client };
```

## ✅ Como confirmar que funcionou

Crie um script temporário que importa o model (a única forma, por enquanto, de fazer isso acontecer):

```typescript
// src/teste-model-client.ts
import mongoose from './config/database.js';
import { Client } from './models/index.js';

async function main() {
  // Client.init() resolve só depois que o Mongoose termina de criar os
  // índices deste model no MongoDB — sem isso, o script poderia
  // terminar (e desconectar) antes do índice único de "document"
  // sequer começar a ser construído.
  await Client.init();
  console.log('Model Client registrado e índice único de "document" pronto.');
  await mongoose.disconnect();
}

main();
```

```bash
npx tsx src/teste-model-client.ts
```

Com o MongoDB do passo 08 rodando, deve imprimir a mensagem de sucesso. Depois, confirme o índice diretamente no banco:

```bash
docker exec -it jurisengine_mongo mongosh juris_db --eval "db.clients.getIndexes()"
```

Deve listar um índice `_id_` (padrão de toda coleção) e um índice único em `document`. Apague `src/teste-model-client.ts` depois — ele cumpriu seu papel de confirmação; a partir do passo 12, o model passa a ser carregado pela própria aplicação, sem precisar de nenhum script à parte.

## 🔧 Commit sugerido

```bash
git add src/models/client.model.ts src/models/index.ts
git commit -m "feat: criar model de clientes"
```
