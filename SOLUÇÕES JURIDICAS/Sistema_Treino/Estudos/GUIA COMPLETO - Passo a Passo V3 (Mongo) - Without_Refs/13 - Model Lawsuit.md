# 13 — Model: Lawsuit

## 🎯 Objetivo

Criar o schema `Lawsuit` (processos), referenciando `Client` — o primeiro relacionamento do projeto.

## 📝 Código

Crie `src/models/lawsuit.model.ts`:

```typescript
// src/models/lawsuit.model.ts
import { Schema, model } from 'mongoose';

const lawsuitSchema = new Schema(
  {
    cnjNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: ['PENDING', 'UPDATED'], default: 'PENDING' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual populate: expõe o cliente vinculado sob a chave "client" no
// JSON de resposta (usado no passo 14), sem precisar guardar o cliente
// duplicado dentro do processo — só a referência (clientId) fica salva
// no banco; o Mongoose "junta" o cliente na hora da consulta, quando
// pedido explicitamente com .populate('client').
lawsuitSchema.virtual('client', {
  ref: 'Client',
  localField: 'clientId',
  foreignField: '_id',
  justOne: true,
});

const Lawsuit = model('Lawsuit', lawsuitSchema);

export default Lawsuit;
```

> 💡 **`ref: 'Client'` — o equivalente Mongoose ao `belongsTo` do Sequelize, com uma diferença importante.** Ele diz ao Mongoose QUAL coleção `clientId` aponta para, habilitando `.populate(...)` (usado no passo 14). Mas, diferente de uma chave estrangeira no Postgres, o **MongoDB não valida essa referência em nenhum momento** — não existe, no banco, nenhum mecanismo nativo que impeça salvar um `clientId` que aponta para um cliente inexistente. É por isso que a checagem explícita `Client.findById(clientId)` (passo 14, mantida da V2) é ainda mais importante aqui: ela não é só uma forma de dar um erro mais amigável do que o banco daria — no MongoDB, ela é a **única** coisa impedindo uma referência quebrada.
>
> 💡 **Virtual populate, em detalhe.** Um campo "virtual" não é salvo no banco — ele só existe em memória, calculado a partir de outros dados, quando alguém pede. Aqui, `client` não é uma coluna nem um campo real do documento: é uma instrução dizendo "se alguém chamar `.populate('client')` numa consulta, busque na coleção `clients` o documento cujo `_id` bate com o `clientId` deste processo, e monte um campo `client` com o resultado". Isso reproduz o mesmo formato de resposta que o `include: [{ model: Client, as: 'client' }]` do Sequelize produzia na V2 — o campo enviado na criação continua se chamando `clientId`, mas a consulta que busca o processo pode expor o cliente completo sob a chave `client`.

Atualize `src/models/index.ts` (editando o arquivo do passo 10):

```typescript
// src/models/index.ts
import mongoose from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';

export { mongoose, Client, Lawsuit };
```

## ✅ Como confirmar que funcionou

Suba a aplicação (`npm run dev`) e confira o índice único:

```bash
docker exec -it jurisengine_mongo mongosh juris_db --eval "db.lawsuits.getIndexes()"
```

Deve listar um índice único em `cnjNumber`.

## 🔧 Commit sugerido

```bash
git add src/models/lawsuit.model.ts src/models/index.ts
git commit -m "feat: criar model de processos"
```
