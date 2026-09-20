# Decisões da solução

Documento complementar ao `README.md` (que é o enunciado do desafio e não foi alterado), descrevendo o que foi implementado e por quê.

## Arquitetura

```
route -> controller -> service -> model
```

- **routes/** só define os caminhos HTTP e aponta para o controller.
- **controllers/** são finos: extraem `req.body`/`req.params`/`req.query`, chamam o service e traduzem o retorno em status HTTP. Usam `utils/asyncHandler.js` para encaminhar qualquer erro assíncrono para o middleware global de erros (`src/app.js`), evitando `try/catch` repetido.
- **services/** concentram as regras de negócio (validação, cálculo de idade/bolsa, capacidade, fila, cancelamento/repescagem). São a camada testável sem HTTP — ver `tests/unit/validators.test.js` para as funções puras usadas por eles.
- **models/** carregam schema + os métodos de acesso ao Mongo que precisam ser atômicos (`Course.incrementIfHasCapacity`, `Course.decrementIfPositive`, `Enrollment.updateStatusIfCurrent`, etc.), para que a lógica de concorrência fique perto dos dados que ela protege.
- **utils/** funções puras de validação (`validators.js`) e erros de negócio tipados (`httpErrors.js`, uma `AppError` com `status`/`name`/`message` que o middleware global já sabe formatar).
- **queue/** a fila técnica (Redis/BullMQ) usada para serializar as mutações de matrícula — ver seção "Concorrência" abaixo.

`GET /courses` e o healthcheck seguem exatamente como estavam prontos; o restante (`students`, `enrollments`) foi implementado do zero em cima do esqueleto que já existia.

## Regras de negócio

- **Alunos**: todos os campos obrigatórios, strings vazias rejeitadas, `dataNascimento` validada como data civil real (não só regex) e não pode estar no futuro, `rendaFamiliar >= 0` com no máximo duas casas decimais, CPF normalizado (só dígitos, exatamente 11) e único, e-mail normalizado (trim + lowercase) e único. Unicidade é checada antes de gravar (para devolver `409` com boa mensagem) **e** garantida pelo índice único do Mongo em `cpf`/`email` (o `E11000` de uma corrida vira `409` do mesmo jeito).
- **Matrículas**: aluno e curso precisam existir (`404`), curso precisa estar `ABERTO` (`422`), idade mínima calculada na data da matrícula por ano/mês/dia — não por diferença de anos nem por `dias / 365` (ver `calculateAge` e os testes de fronteira do aniversário). Bolsa calculada pelas três faixas de renda e a mensalidade final é armazenada na matrícula junto com o percentual.
- **Capacidade e fila**: se há vaga, a matrícula nasce `CONFIRMADA` e `vagasOcupadas` é incrementado; se não há, nasce `FILA_ESPERA` sem tocar o contador.
- **Cancelamento e repescagem**: cancelar uma matrícula `CONFIRMADA` promove o primeiro da fila (`createdAt` asc, `_id` asc como desempate) mantendo `vagasOcupadas` igual; sem fila, decrementa exatamente uma vez. Cancelar uma matrícula em `FILA_ESPERA` não mexe no contador nem promove ninguém.
- **Cancelamento de matrícula já cancelada**: decisão explícita — retorna **`200`** com o estado atual, sem novos efeitos (idempotente). A alternativa (`409`) também é válida pelo enunciado; optei por `200` porque, do ponto de vista do cliente, "a matrícula está cancelada" já é o estado desejado, e evita que um retry inofensivo pareça um erro.
- **Listagem de matrículas**: filtros opcionais `cursoId`, `alunoId`, `status`, validados individualmente (ObjectId malformado ou status fora do enum -> `400`).

## Concorrência

O enunciado descreve corretamente o risco: `buscar curso -> verificar vagas -> atualizar curso` não é seguro sob concorrência. A solução tem duas camadas, deliberadamente redundantes:

### 1. Updates atômicos no MongoDB (garantia definitiva)

- **Capacidade**: `Course.incrementIfHasCapacity` faz um único `findOneAndUpdate` cujo filtro inclui `$expr: { $lt: ['$vagasOcupadas', '$capacidadeVagas'] }`. O MongoDB serializa escritas no mesmo documento, então, com uma vaga e duas requisições simultâneas, só uma delas encontra o documento (e incrementa); a outra recebe `null` e vira `FILA_ESPERA`. Não há leitura seguida de escrita em dois passos.
- **Cancelamento/promoção**: `Enrollment.updateStatusIfCurrent` é um compare-and-swap (`findOneAndUpdate({_id, status: from}, {status: to})`). Duas chamadas concorrentes ou repetidas para o mesmo `id` só deixam uma delas efetivar a mudança; a outra recebe `null` e devolve o estado atual sem repetir o decremento/promoção. Ao promover, `promoteNextOrRelease` tenta novamente com o próximo candidato da fila se o CAS falhar — isso cobre o caso de dois cancelamentos de matrículas `CONFIRMADA`s do mesmo curso acontecendo ao mesmo tempo e ambos "verem" a mesma pessoa como primeira da fila.
- **Matrícula ativa duplicada**: além da checagem prévia (`findActiveByAlunoAndCurso`), existe um índice único parcial em `Enrollment` no campo `activeKey` (só existe enquanto a matrícula está `CONFIRMADA`/`FILA_ESPERA`, removido no cancelamento). Duas requisições concorrentes de matrícula para o mesmo aluno/curso podem passar pela checagem em memória ao mesmo tempo, mas só uma delas consegue gravar — a outra recebe `E11000` do Mongo, que é traduzido em `409` (e a vaga eventualmente reservada é devolvida, se for o caso).

Essas garantias valem independentemente de quantas instâncias do processo Node estejam rodando, porque vivem no banco.

### 2. Fila técnica com Redis + BullMQ (camada adicional)

Por pedido explícito, a serialização das mutações que afetam capacidade (`POST /enrollments` e `PATCH /enrollments/:id/cancel`) também passa por uma fila BullMQ (`src/queue/enrollmentQueue.js`) com um único `Worker` (`concurrency: 1`) consumindo a fila `enrollments`. O controller enfileira um job e aguarda o resultado (`job.waitUntilFinished`), então o contrato HTTP não muda — a resposta continua síncrona. Isso serializa essas operações em nível de aplicação, complementando (não substituindo) os updates atômicos acima.

**Limitação conhecida e escolha deliberada**: a fila é global (um único worker para todos os cursos), não uma fila por curso — suficiente para o volume deste desafio, mas o próximo passo natural seria particionar por `cursoId` (ex.: várias filas nomeadas ou um lock distribuído por curso) para não serializar operações de cursos diferentes sem necessidade.

**Testes e Redis**: para manter a suíte independente de Docker — garantia que o próprio `README.md` já dá para o MongoDB —, `src/queue/enrollmentQueue.js` troca automaticamente para um driver em memória quando `NODE_ENV=test` (o que o Jest já define sozinho), com a mesma interface e a mesma garantia de serialização, só que limitada a um processo. Em desenvolvimento/produção (`npm run dev` / `npm start`), o driver padrão é o Redis/BullMQ de verdade, exigindo `npm run db:up` (o `docker-compose.yml` agora sobe Mongo **e** Redis) e a variável `REDIS_URL` (já presente em `.env`/`.env.example`, apontando para `redis://localhost:6380`). Isso pode ser forçado com `QUEUE_DRIVER=redis` ou `QUEUE_DRIVER=memory` quando for útil.

### Outras notas de concorrência

- Como o worker do BullMQ processa jobs com "pelo menos uma vez" (at-least-once), os handlers de criação/cancelamento foram escritos para serem seguros a reprocessamento: a criação é protegida pelo índice único de `activeKey`, e o cancelamento pelo compare-and-swap de status — reprocessar o mesmo job não duplica efeitos.
- Não foi necessário usar transações do Mongo (`session.withTransaction`): cada operação sensível já é atômica por ser uma única escrita condicional em um documento.

## Como rodar

Além dos passos do `README.md`, agora é preciso que o Redis também esteja de pé (já incluso no `docker-compose.yml`):

```bash
npm ci
cp .env.example .env
npm run db:up      # sobe MongoDB e Redis
npm run seed
npm run dev
```

`npm test` continua não dependendo de Docker (nem de Mongo nem de Redis).
