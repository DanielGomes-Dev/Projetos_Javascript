# 16 — Capacidade e Fila de Espera sob Concorrência

## 🎯 Objetivo

Provar, com um teste, que a implementação do capítulo 15 não é segura sob concorrência — e corrigi-la com updates atômicos condicionais no MongoDB, mais a fila técnica do capítulo 13 como camada extra de proteção.

## O problema, em uma frase

`ler vagasOcupadas -> decidir se há vaga -> gravar` é uma sequência de três passos separados por pontos de espera assíncronos (`await`). Duas requisições concorrentes podem, cada uma, executar o passo 1 **antes** de qualquer uma delas terminar o passo 3 — as duas leem "há vaga", as duas decidem `CONFIRMADA`, as duas gravam. O resultado: `vagasOcupadas` ultrapassa `capacidadeVagas`, e o desafio proíbe explicitamente esse cenário.

## 🔴 Teste (Red)

Adicione este teste a `tests/enrollments.test.js` (dentro do `describe('POST /enrollments', ...)` do capítulo 15):

```javascript
// tests/enrollments.test.js — dentro de describe('POST /enrollments', ...)
it('não permite que vagasOcupadas ultrapasse a capacidade sob concorrência', async () => {
  const curso = await createCourse({ capacidadeVagas: 1 });
  const aluno1 = await createStudent();
  const aluno2 = await createStudent();

  const [res1, res2] = await Promise.all([
    request(app).post('/enrollments').send({ alunoId: aluno1._id.toString(), cursoId: curso._id.toString() }),
    request(app).post('/enrollments').send({ alunoId: aluno2._id.toString(), cursoId: curso._id.toString() })
  ]);

  const statuses = [res1.body.status, res2.body.status].sort();
  expect(statuses).toEqual(['CONFIRMADA', 'FILA_ESPERA']);

  const cursoAtualizado = await Course.findById(curso._id);
  expect(cursoAtualizado.vagasOcupadas).toBe(1);
});
```

Rode `npm test -- enrollments`. Diferente dos testes anteriores (que disparavam requisições uma de cada vez, com `await` sequencial), aqui as duas requisições são disparadas **ao mesmo tempo** com `Promise.all`. Com a implementação do capítulo 15, este teste falha de forma consistente — não é *flaky*, é sempre errado do mesmo jeito: as duas respostas vêm com `status: 'CONFIRMADA'`, e `cursoAtualizado.vagasOcupadas` termina em `2`, não `1`. As duas requisições leram `vagasOcupadas: 0` antes de qualquer uma delas gravar.

## 🟢 Código (Green) — parte 1: updates atômicos no model

Adicione dois métodos estáticos a `src/models/Course.js` (editando o arquivo do capítulo 09):

```javascript
// src/models/Course.js
// ... schema sem alteração (capítulo 09), adicione antes do module.exports:

courseSchema.statics.incrementIfHasCapacity = function incrementIfHasCapacity(cursoId) {
  return this.findOneAndUpdate(
    {
      _id: cursoId,
      status: 'ABERTO',
      $expr: { $lt: ['$vagasOcupadas', '$capacidadeVagas'] }
    },
    { $inc: { vagasOcupadas: 1 } },
    { new: true }
  );
};

courseSchema.statics.decrementIfPositive = function decrementIfPositive(cursoId) {
  return this.findOneAndUpdate(
    { _id: cursoId, vagasOcupadas: { $gt: 0 } },
    { $inc: { vagasOcupadas: -1 } },
    { new: true }
  );
};

module.exports = mongoose.models.Course || mongoose.model('Course', courseSchema);
```

> 💡 **Por que isso resolve o problema, se ainda existe um `findOneAndUpdate` que, por dentro, também "lê e depois escreve"?** A diferença crucial: aqui a leitura (o filtro `$expr: { $lt: [...] }`) e a escrita (`$inc`) acontecem como **uma única operação atômica no MongoDB**, não como dois comandos separados vindos da aplicação. O MongoDB processa escritas no mesmo documento de forma serializada internamente — então, com uma vaga e duas chamadas concorrentes a `incrementIfHasCapacity`, o banco garante que só uma delas encontra o documento satisfazendo `vagasOcupadas < capacidadeVagas` **no exato instante em que tenta gravar**; a outra, avaliada um instante depois (já com o contador incrementado pela primeira), não encontra nenhum documento correspondente e recebe `null`. Não há uma janela de tempo em que as duas "acham" que há vaga — a checagem e a reserva são a mesma operação.

## 🟢 Código (Green) — parte 2: reescrevendo o service em cima dos updates atômicos

Reescreva `src/services/enrollments.service.js` — a lógica de negócio (idade, bolsa, validações) não muda; o que muda é como a capacidade é reservada, e a introdução de um "envelope" de resultado que permite passar essa operação pela fila técnica do capítulo 13:

```javascript
// src/services/enrollments.service.js
const mongoose = require('mongoose');

const Student = require('../models/Student');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { calculateAge, calculateScholarshipPercentage } = require('../utils/validators');
const { AppError, badRequest, notFound, conflict, unprocessable } = require('../utils/httpErrors');
const { buildDriver } = require('../queue/enrollmentQueue');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

function ok(data) {
  return { ok: true, data };
}

function fail(error) {
  if (error instanceof AppError) {
    return { ok: false, status: error.status, name: error.name, message: error.message };
  }
  throw error; // erro inesperado (infra, bug): propaga como 500 mesmo.
}

function unwrap(envelope) {
  if (envelope.ok) return envelope.data;
  throw new AppError(envelope.status, envelope.name, envelope.message);
}

async function performCreateEnrollment({ alunoId, cursoId } = {}) {
  try {
    if (!isValidObjectId(alunoId) || !isValidObjectId(cursoId)) {
      throw badRequest('alunoId/cursoId inválido');
    }

    const [aluno, curso] = await Promise.all([
      Student.findById(alunoId),
      Course.findById(cursoId)
    ]);
    if (!aluno) throw notFound('Aluno não encontrado');
    if (!curso) throw notFound('Curso não encontrado');

    if (curso.status !== 'ABERTO') {
      throw unprocessable('Curso encerrado para novas matrículas');
    }

    const idade = calculateAge(aluno.dataNascimento);
    if (idade < curso.idadeMinima) {
      throw unprocessable('Aluno não possui idade mínima exigida pelo curso');
    }

    const matriculaAtiva = await Enrollment.findActiveByAlunoAndCurso(alunoId, cursoId);
    if (matriculaAtiva) {
      throw conflict('Aluno já possui matrícula ativa neste curso');
    }

    const percentualBolsa = calculateScholarshipPercentage(aluno.rendaFamiliar);
    const valorFinal = Math.round(curso.valorMensalidade * (1 - percentualBolsa) * 100) / 100;

    const cursoComVagaReservada = await Course.incrementIfHasCapacity(cursoId);
    const status = cursoComVagaReservada ? 'CONFIRMADA' : 'FILA_ESPERA';

    try {
      const matricula = await Enrollment.createActive({ alunoId, cursoId, status, percentualBolsa, valorFinal });
      return ok(matricula.toObject());
    } catch (error) {
      if (status === 'CONFIRMADA') {
        await Course.decrementIfPositive(cursoId);
      }
      if (error.code === 11000) {
        throw conflict('Aluno já possui matrícula ativa neste curso');
      }
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}

const queue = buildDriver({ createEnrollment: performCreateEnrollment });

async function createEnrollment(payload) {
  const envelope = await queue.enqueue('createEnrollment', payload || {});
  return unwrap(envelope);
}

module.exports = { createEnrollment };
```

> 💡 **Por que `performCreateEnrollment` retorna um "envelope" (`{ ok, data }` ou `{ ok: false, status, name, message }`), em vez de simplesmente lançar o `AppError` como antes?** Porque, a partir deste capítulo, `performCreateEnrollment` não roda mais diretamente dentro do `controller` — ela roda **dentro do handler da fila técnica** (capítulo 13), e no driver Redis/BullMQ, o valor de retorno (ou o erro) precisa atravessar uma fronteira de serialização (o job é gravado no Redis, o worker o processa, o resultado volta pelo `job.waitUntilFinished`). Um objeto simples (`{ ok, data }`) sobrevive a essa viagem de ida e volta sem perder informação; uma instância de `AppError` — uma classe customizada com campos extras (`status`, `name`) — não tem essa garantia depois de serializada e desserializada. O envelope é reconstituído de volta num `AppError` de verdade só no fim, por `unwrap`, já no processo que fez a chamada original — onde o `asyncHandler`/middleware de erros sabe lidar com ele normalmente.
>
> 💡 **Por que reservar a vaga (`incrementIfHasCapacity`) *depois* de todas as validações, mas *antes* de criar a matrícula — e por que desfazer (`decrementIfPositive`) se `Enrollment.createActive` falhar?** A ordem minimiza o custo de reverter: só reservamos uma vaga depois de já sabermos que o aluno/curso existem, o curso está aberto, a idade bate e não há duplicidade óbvia. Ainda assim, entre reservar a vaga e gravar a matrícula, o índice único parcial de `activeKey` (capítulo 14) pode rejeitar a gravação — por exemplo, se uma segunda requisição para o **mesmo** aluno/curso venceu a corrida no meio do caminho. Nesse caso, a vaga já reservada precisa voltar (`decrementIfPositive`), senão o contador ficaria "vazando" vagas fantasmas que nunca viram matrícula nenhuma.
>
> 💡 **A fila técnica (`buildDriver`, capítulo 13) entra aqui como uma segunda camada, redundante de propósito.** `Course.incrementIfHasCapacity` sozinho já garante que a capacidade nunca é ultrapassada, mesmo com múltiplas instâncias do processo Node rodando ao mesmo tempo — essa garantia vive no banco, não na aplicação. A fila adiciona serialização **em nível de aplicação**: com um único worker (`concurrency: 1`) processando uma matrícula de cada vez, simplifica ainda mais o raciocínio sobre condições de corrida dentro de um mesmo processo, por pedido explícito do desafio. As duas camadas não competem entre si — a garantia do banco é a que realmente importa; a fila é um reforço.

## ✅ Como confirmar que funcionou

```bash
npm test -- enrollments
```

Todos os testes de `tests/enrollments.test.js`, incluindo o novo teste de concorrência, devem passar — rode algumas vezes seguidas (`npm test -- enrollments --testNamePattern="concorrencia"` não existe como tal, mas repetir `npm test` algumas vezes ajuda a ganhar confiança de que não é *flaky*).

## 🔧 Commit sugerido

```bash
git add tests/enrollments.test.js
git commit -m "test: adicionar teste de concorrencia na ultima vaga do curso"

git add src/models/Course.js src/services/enrollments.service.js
git commit -m "fix: proteger capacidade do curso com update atomico e fila tecnica"
```

## 📚 Documentação Oficial

- **MongoDB — atomicidade de operações de escrita**: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- **MongoDB — `$expr` em consultas**: https://www.mongodb.com/docs/manual/reference/operator/query/expr/
- **Mongoose — `findOneAndUpdate` com filtros condicionais**: https://mongoosejs.com/docs/api/model.html#Model.findOneAndUpdate()
- **BullMQ — `waitUntilFinished`**: https://docs.bullmq.io/guide/queues/adding-jobs
