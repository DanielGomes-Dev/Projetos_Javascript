# 15 — Movimentações Embutidas no Processo

## 🎯 Objetivo

Dar ao processo um lugar para guardar suas movimentações — o terceiro e último pedaço de estrutura de dados "estática" do projeto (a partir daqui, movimentações passam a ser criadas pelo Worker, não por um endpoint HTTP direto).

## Uma decisão de modelagem diferente da V2

Na V2 (PostgreSQL), `movements` era uma **tabela própria**, ligada a `lawsuits` por chave estrangeira — porque um banco relacional não tem outro jeito natural de representar "muitos itens pertencendo a um item pai".

Bancos orientados a documento, como o MongoDB, oferecem uma segunda opção: **embutir** os itens filhos dentro do próprio documento pai, como um array. A regra prática para escolher entre as duas abordagens é: dados que são **sempre lidos junto** do pai, e cujo volume por documento é limitado (dezenas ou poucas centenas de itens — não milhões), são bons candidatos a embutir.

É exatamente o caso aqui: toda vez que alguém busca um processo (`GET /api/lawsuits/:id`), as movimentações são exibidas junto — não existe (e não vai existir neste projeto) um caso de uso que busque só as movimentações, isoladas do processo. Por isso, esta V3 embute.

> 💡 **E se um processo real pudesse ter dezenas de milhares de movimentações?** Aí a resposta mudaria para uma coleção separada, com paginação — o mesmo tipo de decisão que o `separate: true` representava na V2, só que tomada na hora de desenhar o schema, e não na hora de escrever a query.

## 📝 Código

Crie `src/models/movement.schema.ts` — não é um "model" (não vira uma coleção própria no banco): é o *schema* do subdocumento que vai viver dentro de cada `Lawsuit`.

```typescript
// src/models/movement.schema.ts
import { Schema } from 'mongoose';

export const movementSchema = new Schema(
  {
    description: { type: String, required: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);
```

Atualize `src/models/lawsuit.model.ts` (editando o arquivo do passo 13), acrescentando o campo `movements`:

```typescript
// src/models/lawsuit.model.ts
import { Schema, model } from 'mongoose';
import { movementSchema } from './movement.schema.js';

const lawsuitSchema = new Schema(
  {
    cnjNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: ['PENDING', 'UPDATED'], default: 'PENDING' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    movements: { type: [movementSchema], default: [] },
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

lawsuitSchema.virtual('client', {
  ref: 'Client',
  localField: 'clientId',
  foreignField: '_id',
  justOne: true,
});

const Lawsuit = model('Lawsuit', lawsuitSchema);

export default Lawsuit;
```

> 💡 **Nenhuma mudança necessária em `getLawsuitById` (passo 14).** Diferente da V2 — que precisou adicionar `separate: true` a um `include` para trazer as movimentações junto do processo — aqui as movimentações **já vêm dentro do documento**, sempre, porque literalmente fazem parte dele. Buscar um processo sem as movimentações seria preciso fazer um esforço **extra** (`.select('-movements')`), não o contrário.

## ✅ Como confirmar que funcionou

Ainda não existe nenhum jeito de criar uma movimentação via API (isso só existe a partir do Worker, passo 20) — por enquanto, confirme só que o campo existe e que `GET /api/lawsuits/:id` retorna `"movements": []`:

```bash
docker exec -it jurisengine_mongo mongosh juris_db --eval "db.lawsuits.findOne()"
curl http://localhost:3000/api/lawsuits/<ID_DE_UM_PROCESSO_JA_CRIADO>
```

## 🔧 Commit sugerido

```bash
git add src/models/movement.schema.ts src/models/lawsuit.model.ts
git commit -m "feat: embutir movimentacoes no schema de processos"
```

## 📚 Documentação Oficial

- **MongoDB Manual — modelagem de dados (embutir vs. referenciar)**: https://www.mongodb.com/docs/manual/core/data-modeling-introduction/
- **Mongoose — Subdocumentos**: https://mongoosejs.com/docs/subdocs.html
