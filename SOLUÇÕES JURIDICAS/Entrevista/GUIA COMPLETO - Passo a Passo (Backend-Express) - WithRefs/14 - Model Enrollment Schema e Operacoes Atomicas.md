# 14 — Model Enrollment: Schema e Operações Atômicas

## 🎯 Objetivo

Criar o model de matrícula — a peça mais delicada do projeto, porque ela precisa proteger, no próprio banco, as duas garantias de concorrência que os capítulos 16 e 17 vão explorar: a capacidade de um curso nunca é ultrapassada, e um cancelamento nunca produz efeito duplicado. Ainda sem nenhum endpoint HTTP usando este model — este capítulo é só sobre o schema e os métodos atômicos existirem e funcionarem, confirmados diretamente.

## Por que este capítulo não começa por um teste HTTP

Diferente dos capítulos anteriores, aqui ainda não existe nenhuma rota consumindo o model — `POST /enrollments` só nasce no capítulo 15. Testar via `supertest` agora seria testar uma rota que não existe. Em vez disso, a confirmação deste capítulo é um script descartável que exercita o model diretamente (o mesmo princípio usado nos capítulos 07 e 09 para confirmar a conexão e o índice de `Course`) — o teste automatizado "de verdade" para este comportamento chega nos capítulos 15 a 17, quando os métodos abaixo passam a ser usados por um fluxo HTTP real.

## 📝 Código

Crie `src/models/Enrollment.js`:

```javascript
// src/models/Enrollment.js
const mongoose = require('mongoose');

const STATUSES = ['CONFIRMADA', 'FILA_ESPERA', 'CANCELADA'];
const ACTIVE_STATUSES = ['CONFIRMADA', 'FILA_ESPERA'];

const enrollmentSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  status: { type: String, enum: STATUSES, required: true },
  percentualBolsa: { type: Number, required: true, min: 0, max: 1 },
  valorFinal: { type: Number, required: true, min: 0 },
  activeKey: { type: String }
}, { timestamps: true });

enrollmentSchema.index(
  { activeKey: 1 },
  { unique: true, partialFilterExpression: { activeKey: { $exists: true } } }
);

enrollmentSchema.index({ cursoId: 1, status: 1, createdAt: 1, _id: 1 });
enrollmentSchema.index({ alunoId: 1 });

function buildActiveKey(alunoId, cursoId) {
  return `${alunoId}:${cursoId}`;
}

enrollmentSchema.statics.findActiveByAlunoAndCurso = function findActiveByAlunoAndCurso(alunoId, cursoId) {
  return this.findOne({ alunoId, cursoId, status: { $in: ACTIVE_STATUSES } });
};

enrollmentSchema.statics.findFirstWaiting = function findFirstWaiting(cursoId) {
  return this.findOne({ cursoId, status: 'FILA_ESPERA' }).sort({ createdAt: 1, _id: 1 });
};

enrollmentSchema.statics.updateStatusIfCurrent = function updateStatusIfCurrent(id, fromStatus, toStatus) {
  const update = { $set: { status: toStatus } };
  if (toStatus === 'CANCELADA') {
    update.$unset = { activeKey: '' };
  }
  return this.findOneAndUpdate({ _id: id, status: fromStatus }, update, { new: true });
};

enrollmentSchema.statics.createActive = function createActive({ alunoId, cursoId, status, percentualBolsa, valorFinal }) {
  return this.create({
    alunoId,
    cursoId,
    status,
    percentualBolsa,
    valorFinal,
    activeKey: buildActiveKey(alunoId, cursoId)
  });
};

const Enrollment = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
Enrollment.ACTIVE_STATUSES = ACTIVE_STATUSES;
Enrollment.STATUSES = STATUSES;

module.exports = Enrollment;
```

> 💡 **O índice único parcial em `activeKey` é a peça mais importante deste arquivo — e a mais fácil de subestimar.** `activeKey` é uma string derivada (`"${alunoId}:${cursoId}"`), gravada **só** enquanto a matrícula está `CONFIRMADA` ou `FILA_ESPERA` (`createActive` sempre define; `updateStatusIfCurrent` remove com `$unset` ao cancelar). O `partialFilterExpression: { activeKey: { $exists: true } }` diz ao Mongo "aplique a unicidade só nos documentos que têm este campo" — matrículas canceladas, sem `activeKey`, não entram nessa contagem. O efeito prático: o mesmo par aluno/curso pode ter **uma** matrícula ativa por vez, mas pode ser matriculado, cancelado e matriculado de novo à vontade, sem nunca colidir com o próprio histórico. Sem o filtro parcial, um índice único comum em `activeKey` impediria essa re-matrícula depois do primeiro cancelamento — porque o valor antigo (agora "morto") ainda ocuparia o índice.
>
> 💡 **Por que um índice único no aplicativo (`findActiveByAlunoAndCurso`, checado no service, capítulo 15) *e também* este índice no banco?** A mesma defesa em duas camadas do capítulo 11 (CPF/e-mail): a consulta prévia dá uma mensagem de erro clara no caminho comum; o índice único é a garantia que sobrevive a duas requisições concorrentes tentando matricular o mesmo aluno no mesmo curso ao mesmo tempo — só uma delas grava, a outra recebe o erro `11000` do Mongo, traduzido em `409` pelo service.
>
> 💡 **`updateStatusIfCurrent(id, fromStatus, toStatus)` é um *compare-and-swap*: só atualiza se o status atual for exatamente o esperado.** `findOneAndUpdate({ _id: id, status: fromStatus }, ...)` só encontra (e só então atualiza) o documento se ele **ainda** estiver no status de origem no momento exato da escrita. Se duas chamadas concorrentes tentarem cancelar a mesma matrícula `CONFIRMADA` ao mesmo tempo, só a primeira encontra `status: 'CONFIRMADA'` e consegue trocar para `CANCELADA`; a segunda, executando um instante depois, já encontra `status: 'CANCELADA'` — não bate com o `fromStatus` esperado — e recebe `null` de volta, sem produzir nenhum efeito duplicado. Esse padrão é a base de todo o capítulo 17.
>
> 💡 **Por que `alunoId`/`cursoId` são `mongoose.Schema.Types.ObjectId` com `ref`, mas o Mongo não impede gravar uma referência quebrada?** Diferente de uma chave estrangeira num banco relacional, `ref: 'Student'` é só uma instrução para o Mongoose saber **qual** model usar caso alguém peça um `.populate()` — não é validado automaticamente na escrita. A responsabilidade de garantir que `alunoId`/`cursoId` apontam para documentos que realmente existem é da aplicação (o service, capítulo 15, confirma isso com um `findById` antes de criar a matrícula).

## ✅ Como confirmar que funcionou

Atualize `tests/helpers/mongo.js` para também esperar o índice de `Enrollment`:

```javascript
// tests/helpers/mongo.js
const Student = require('../../src/models/Student');
const Course = require('../../src/models/Course');
const Enrollment = require('../../src/models/Enrollment');

// ... dentro de connectTestDatabase, depois de mongoose.connect(...):
await Promise.all([Student.init(), Course.init(), Enrollment.init()]);
```

```bash
npm test
```

A suíte inteira continua passando (nada mudou de comportamento visível ainda — só a infraestrutura de índices ficou mais completa).

Crie um script temporário `src/_teste-model-enrollment.js` para confirmar o schema e o índice único parcial diretamente:

```javascript
// src/_teste-model-enrollment.js — APAGAR depois de usar
require('dotenv').config();
const mongoose = require('mongoose');
const Enrollment = require('./models/Enrollment');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27028/desafio_senior');
  await Enrollment.init();
  console.log('Model Enrollment registrado e índices prontos.');
  await mongoose.disconnect();
}

main();
```

```bash
npm run db:up
node src/_teste-model-enrollment.js
```

Deve imprimir a mensagem de sucesso. Confirme os índices diretamente no banco:

```bash
docker exec -it $(docker compose ps -q mongodb) mongosh desafio_senior --eval "db.enrollments.getIndexes()"
```

Deve listar `_id_`, o índice único parcial em `activeKey`, e os dois índices compostos. Depois, **apague** `src/_teste-model-enrollment.js` — ele cumpriu seu papel de confirmação pontual; a partir do capítulo 15, o model passa a ser exercitado pelos próprios testes de integração de matrícula.

## 🔧 Commit sugerido

```bash
git add tests/helpers/mongo.js
git commit -m "test: aguardar indices do model enrollment no banco de teste"

git add src/models/Enrollment.js
git commit -m "feat: adicionar model de matricula com operacoes atomicas"
```

## 📚 Documentação Oficial

- **Mongoose — Schemas e `statics`**: https://mongoosejs.com/docs/guide.html#statics
- **MongoDB — índices únicos parciais (`partialFilterExpression`)**: https://www.mongodb.com/docs/manual/core/index-partial/
- **Mongoose — `findOneAndUpdate` (compare-and-swap)**: https://mongoosejs.com/docs/api/model.html#Model.findOneAndUpdate()
- **Mongoose — Populate e `ref`**: https://mongoosejs.com/docs/populate.html
