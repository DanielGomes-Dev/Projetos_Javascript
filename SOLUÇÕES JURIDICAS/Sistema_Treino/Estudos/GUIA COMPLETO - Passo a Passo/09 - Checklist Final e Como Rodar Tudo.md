# Checklist Final — Do Zero ao Ar

> Este documento é o "resumo executivo": se você já seguiu as Fases 1 a 8 e só quer um roteiro rápido para rodar o projeto inteiro do zero (ou reconferir se não pulou nada), use esta lista.

---

## ✅ Checklist de arquivos criados (confira contra a sua pasta)

```
Sistema_Treino/
├── README.md                   ← Fase 8.1/8.2 (NOVO)
├── .env                        ← Fase 1.1 (não versionado)
├── .env.example                ← criado de fato na Fase 8.2 (documentado, mas ausente, desde a Fase 1)
├── .gitattributes               ← Fase 8.3 (NOVO)
├── .gitignore                  ← Fase 1.1  (+ Fase 7.1, coverage/)
├── .sequelizerc                ← Fase 2.1
├── docker-compose.yml          ← Fase 1.3  (+ Fase 4.1 e 4.2f, serviços redis/worker; + Fase 6.2c, correção do target do worker; + Fase 8.2, REDIS_HOST/PORT e env_file no serviço api)
├── Dockerfile                  ← Fase 1.3  (+ Fase 6.3, estágio production usa pm2-runtime)
├── ecosystem.config.cjs        ← Fase 6.1 (NOVO)
├── eslint.config.mts           ← Fase 1.2
├── jest.config.cjs             ← Fase 7.1 (NOVO)
├── package.json                ← todas as fases (scripts e dependências acumulados)
├── tsconfig.json                ← Fase 1.2
├── tsconfig.jest.json           ← Fase 7.1 (NOVO)
├── tests/
│   ├── setup/
│   │   ├── env.cjs                ← Fase 7.1 (NOVO)
│   │   └── testDatabase.ts         ← Fase 7.3 (NOVO)
│   ├── unit/
│   │   └── cnjNumber.test.ts        ← Fase 7.2 (NOVO)
│   └── integration/
│       ├── clients.test.ts           ← Fase 7.3 (NOVO)
│       └── lawsuits.test.ts           ← Fase 7.3 (NOVO)
└── src/
    ├── app.ts                   ← Fase 3.1  (+ Fase 4.3, monta o Bull Board)
    ├── server.ts                 ← Fase 3.1  (+ Fase 5.1, http.createServer + Socket.IO)
    ├── admin/
    │   └── bullBoard.ts           ← Fase 4.3
    ├── config/
    │   ├── config.cjs             ← Fase 2.1
    │   ├── database.ts             ← Fase 2.1
    │   └── redis.ts                ← Fase 4.1
    ├── controllers/
    │   ├── client.controller.ts    ← Fase 3.2
    │   └── lawsuit.controller.ts    ← Fase 3.3  (+ Fase 4.2e, fila real)
    ├── database/
    │   ├── migrations/
    │   │   ├── ...create-clients.cjs           ← Fase 2.2
    │   │   ├── ...create-lawsuits.cjs           ← Fase 2.2
    │   │   ├── ...create-movements.cjs          ← Fase 2.2
    │   │   └── ...create-dead-letter-jobs.cjs    ← Fase 4.2c
    │   └── seeders/
    │       └── ...demo-clients-lawsuits-movements.cjs ← Fase 2.4
    ├── middlewares/
    │   ├── AppError.ts             ← Fase 3.1
    │   ├── asyncHandler.ts          ← Fase 3.1
    │   └── errorHandler.ts          ← Fase 3.1
    ├── models/
    │   ├── client.model.ts          ← Fase 2.3
    │   ├── lawsuit.model.ts          ← Fase 2.3
    │   ├── movement.model.ts         ← Fase 2.3
    │   ├── deadLetterJob.model.ts     ← Fase 4.2c
    │   └── index.ts                    ← Fase 2.3  (+ Fase 4.2c, relação com DeadLetterJob)
    ├── queues/
    │   └── lawsuitSync.queue.ts        ← Fase 4.2a
    ├── routes/
    │   ├── index.ts                     ← Fase 3.2  (+ Fase 3.3)
    │   ├── client.routes.ts              ← Fase 3.2
    │   └── lawsuit.routes.ts              ← Fase 3.3
    ├── scripts/
    │   └── testeSocket.ts                 ← Fase 5.3 (script de teste manual, fora da aplicação)
    ├── utils/
    │   └── cnjNumber.ts                    ← Fase 7.2 (NOVO)
    ├── websocket/
    │   ├── socket.ts                       ← Fase 5.1 e 5.2  (+ Fase 6.2a/b, Redis Adapter + transports)
    │   └── lawsuitSyncEvents.ts             ← Fase 5.3
    └── workers/
        ├── lawsuitSync.worker.ts          ← Fase 4.2d  (+ Fase 5.3, retorna cnjNumber + movements)
        └── tribunalApi.simulator.ts        ← Fase 4.2b
```

---

## ✅ Checklist do `package.json` final (dependencies e scripts acumulados)

Ao final das 7 fases, seu `package.json` deve ter aproximadamente este formato (as versões exatas podem variar conforme a data em que você instalou cada pacote — use sempre `npm install <pacote>` sem fixar versão manualmente, para pegar a mais recente compatível):

```json
{
  "name": "sistema_treino",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "cross-env NODE_ENV=test jest --runInBand",
    "test:watch": "cross-env NODE_ENV=test jest --watch --runInBand",
    "test:coverage": "cross-env NODE_ENV=test jest --coverage --runInBand",
    "build": "rimraf dist && tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/**/*.ts",
    "worker": "tsx watch src/workers/lawsuitSync.worker.ts",
    "db:migrate": "sequelize-cli db:migrate",
    "db:migrate:undo": "sequelize-cli db:migrate:undo",
    "db:migrate:undo:all": "sequelize-cli db:migrate:undo:all",
    "db:migrate:test": "cross-env NODE_ENV=test sequelize-cli db:migrate",
    "db:seed": "sequelize-cli db:seed:all",
    "db:seed:undo": "sequelize-cli db:seed:undo:all",
    "prod": "pm2-runtime start ecosystem.config.cjs"
  },
  "devDependencies": {
    "@eslint/js": "*",
    "@types/express": "*",
    "@types/jest": "*",
    "@types/node": "*",
    "@types/supertest": "*",
    "cross-env": "*",
    "eslint": "*",
    "globals": "*",
    "jest": "*",
    "jiti": "*",
    "rimraf": "*",
    "sequelize-cli": "*",
    "socket.io-client": "*",
    "supertest": "*",
    "ts-jest": "*",
    "tsx": "*",
    "typescript": "*",
    "typescript-eslint": "*"
  },
  "dependencies": {
    "@bull-board/api": "*",
    "@bull-board/express": "*",
    "@socket.io/redis-adapter": "*",
    "bullmq": "*",
    "dotenv": "*",
    "express": "*",
    "express-basic-auth": "*",
    "ioredis": "*",
    "pg": "*",
    "pg-hstore": "*",
    "pm2": "*",
    "sequelize": "*",
    "socket.io": "*"
  }
}
```

> Os `"*"` acima são só para você conferir **quais pacotes** deveriam estar lá — na prática, o `npm install` já grava a versão exata instalada automaticamente; você nunca digita isso manualmente.

---

## ✅ Roteiro de "subir o projeto do zero" (num computador novo, ou depois de clonar do Git)

```bash
# 1. Clonar/entrar na pasta do projeto
cd Sistema_Treino

# 2. Criar o .env real a partir do modelo
cp .env.example .env
# (edite o .env se quiser trocar usuário/senha padrão do banco ou do Bull Board)

# 3. Instalar dependências (só necessário se for rodar algo FORA do Docker,
#    como o sequelize-cli — dentro do Docker, o Dockerfile já faz `npm ci`)
npm install

# 4. Subir toda a infraestrutura (api + worker + db + redis)
docker compose up --build

# 5. Em outro terminal: aplicar as migrations
npm run db:migrate

# 6. (opcional) Popular com dados de exemplo
npm run db:seed
```

A partir daqui:
- API disponível em `http://localhost:3000`
- Dashboard das filas em `http://localhost:3000/admin/queues`
- Postgres exposto em `localhost:5432`
- Redis exposto em `localhost:6379`

---

## ✅ Roteiro de testes manuais (do início ao fim, ponta a ponta)

```bash
# 1. A API está de pé?
curl http://localhost:3000/health

# 2. Criar um cliente
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Paula","document":"222.222.222-22","email":"ana@example.com"}'
# → copie o "id" da resposta

# 3. Listar clientes (paginado)
curl "http://localhost:3000/api/clients?page=1&limit=10"

# 4. Criar um processo vinculado ao cliente acima
curl -X POST http://localhost:3000/api/lawsuits \
  -H "Content-Type: application/json" \
  -d '{"cnjNumber":"0001111-22.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}'
# → copie o "id" do processo (status inicial deve ser "PENDING")

# 5. Consultar o processo (sem movimentações ainda)
curl http://localhost:3000/api/lawsuits/<ID_DO_PROCESSO>

# 6. (Fase 5) Em outro terminal, entre na sala do processo via WebSocket
#    e deixe rodando — vamos disparar a atualização no próximo passo
npx tsx src/scripts/testeSocket.ts 0001111-22.2024.8.19.0001

# 7. Disparar a importação em lote (isso enfileira o job de sincronização)
curl -X POST http://localhost:3000/api/lawsuits/batch-import \
  -H "Content-Type: application/json" \
  -d '{"items":[{"cnjNumber":"0001111-22.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}]}'

# 8. No terminal do passo 6, o evento "lawsuit:updated" deve aparecer
#    sozinho, em tempo real, assim que o worker terminar de processar.

# 9. Espere alguns segundos (o worker processa em background) e consulte de novo
curl http://localhost:3000/api/lawsuits/<ID_DO_PROCESSO>
# → status deve ter mudado para "UPDATED", com movimentações no array "movements"
```

Se todos os passos acima funcionaram, o projeto está 100% reproduzido e funcional, incluindo as notificações em tempo real.

---

## ✅ Roteiro de teste do modo produção (Fase 6 — PM2)

Este roteiro é **separado** do `docker compose up` de sempre — ele testa a imagem Docker de **produção**, com PM2 e múltiplas instâncias:

```bash
# 1. Garanta que db e redis do ambiente de dev já estão no ar
docker compose up -d db redis

# 2. Construa SÓ o estágio "production" do Dockerfile
docker build --target production -t jurisengine:prod .

# 3. Descubra o nome da rede criada pelo docker-compose
docker network ls | grep sistema_treino

# 4. Rode a imagem de produção conectada a essa rede
docker run --rm -it \
  --network sistema_treino_default \
  -p 3000:3000 \
  --env-file .env \
  -e DB_HOST=jurisengine_db \
  -e REDIS_HOST=jurisengine_redis \
  --name jurisengine_prod_test \
  jurisengine:prod

# 5. Em outro terminal: confirme a API respondendo normalmente
curl http://localhost:3000/health

# 6. Confirme múltiplas instâncias atendendo requisições em paralelo
for i in 1 2 3 4 5 6; do curl -s http://localhost:3000/health & done; wait
```

Você deve ver, no terminal do passo 4, a tabela do PM2 com várias linhas de `jurisengine-api` (uma por núcleo de CPU) e duas de `jurisengine-worker`, todas `online`. Encerre com `Ctrl+C` e confirme que aparecem as mensagens de encerramento gracioso (`Recebido SIGTERM, encerrando...`) de `server.ts` e do worker.

---

## ✅ Roteiro de teste da Fase 7 (Jest — testes automatizados)

Diferente dos roteiros anteriores (que testam o sistema rodando "de fora", com `curl`), este roteiro roda o **conjunto de testes automatizados** — unitários e de integração — que validam o comportamento do sistema sozinhos, sem você precisar digitar `curl` nenhum:

```bash
# 1. Suba SÓ a infraestrutura de dados (não precisa da api/worker rodando)
docker compose up -d db redis

# 2. Crie o banco de teste (juris_db_test) — só na primeira vez, ou depois
#    de um "docker compose down -v" que apague os volumes do Postgres.
#    Entre no container do Postgres e crie o banco manualmente:
docker compose exec db psql -U postgres -c "CREATE DATABASE juris_db_test;"
# (troque "postgres"/"juris_db_test" pelos valores reais do seu .env, se
#  você alterou o usuário ou o nome padrão do banco)

# 3. Rode as migrations DENTRO do banco de teste (repare no script diferente!)
npm run db:migrate:test

# 4. Rode a suíte de testes inteira (unitários + integração)
npm test

# 5. (opcional) Rode em modo "watch", reexecutando ao salvar um arquivo
npm run test:watch

# 6. (opcional) Gere um relatório de cobertura de testes
npm run test:coverage
```

O que você deve ver no passo 4: o Jest lista cada arquivo de teste (`tests/unit/cnjNumber.test.ts`, `tests/integration/clients.test.ts`, `tests/integration/lawsuits.test.ts`) com um `PASS` verde, seguido do total de "Test Suites" e "Tests" que passaram. Se algum teste falhar, o Jest mostra exatamente qual `expect(...)` não bateu e o valor recebido — comece a depuração por aí.

> ⚠️ Repare que este roteiro usa o banco `juris_db_test`, **completamente separado** do `juris_db` usado nos roteiros anteriores. Rodar `npm test` nunca apaga nem altera os dados que você criou manualmente testando a API — são bancos diferentes, isolados de propósito (Fase 7.1).

---

## ✅ Roteiro de publicação no GitHub (Fase 8)

```bash
# 1. Confira o que está pendente
git status

# 2. Adicione o .gitattributes e normalize terminações de linha
git add .gitattributes
git commit -m "chore: normalizar terminacao de linha (adicionar .gitattributes)"
git add --renormalize .
git commit -m "chore: renormalizar arquivos existentes para LF"

# 3. Commite a documentação e a correção do docker-compose.yml, em commits separados
git add README.md .env.example
git commit -m "docs: adicionar README com arquitetura e guia de execucao"

git add docker-compose.yml
git commit -m "fix: enviar REDIS_HOST/REDIS_PORT para o container da api"

# 4. Confira que o .env (com credenciais reais) NUNCA aparece pendente
git status

# 5. Crie o repositório no GitHub e conecte
git remote add origin https://github.com/<seu-usuario>/<seu-repositorio>.git
git branch -M main
git push -u origin main
```

Depois do push, abra o repositório no GitHub e confira que o `README.md` aparece na página inicial com os dois diagramas Mermaid **renderizados como imagem**, não como texto cru dentro de um bloco de código.

> ⚠️ Este roteiro só reescreve o **futuro** do histórico (novos commits) — ele não mexe nos commits que já existiam antes da Fase 8. Ver a seção 8.3 do guia (`08 - Fase 8...md`) para a explicação de por que reescrever o histórico antigo é uma decisão que você deveria tomar conscientemente, não algo automático.

---

## 🧠 Perguntas para testar seu entendimento (sem olhar o código)

Se você conseguir responder estas perguntas de cabeça, é sinal de que realmente entendeu a arquitetura, não só copiou o código:

1. Por que `app.ts` e `server.ts` são arquivos separados?
2. O que aconteceria se `app.use(errorHandler)` viesse **antes** de `app.use('/api', apiRoutes)` em vez de depois?
3. Por que a rota `POST /api/lawsuits/batch-import` responde `202` em vez de `200` ou `201`?
4. Se o Redis cair no meio de uma importação em lote, o que acontece com os clientes e processos já criados no Postgres? E com os jobs que ainda não foram processados?
5. Por que o `Worker` precisa rodar como um processo (`npm run worker`) separado da API (`npm run dev`), em vez de simplesmente chamar a função de sincronização direto dentro do controller `batchImportLawsuits`?
6. Qual é a diferença prática entre um job **falhar e ser tentado de novo** (retry) e um job **cair na DLQ**?
7. Por que a migration `create-lawsuits` usa `onDelete: 'CASCADE'`, mas a migration `create-dead-letter-jobs` usa `onDelete: 'SET NULL'` para relacionamentos parecidos (ambos referenciam `lawsuits`)?
8. O que o `underscored: true`, nos models, resolve exatamente?
9. Por que o Worker não pode simplesmente importar a instância do Socket.IO e chamar `.emit()` diretamente?
10. O que acontece com uma movimentação capturada pelo Worker se, naquele exato momento, a API estiver fora do ar? O dado se perde?
11. Por que a API roda em modo `cluster` no PM2, mas o Worker roda em modo `fork`?
12. Sem o Redis Adapter do Socket.IO, o que exatamente quebraria ao rodar a API com mais de uma instância?
13. Por que o `Dockerfile` usa `pm2-runtime` em vez do comando `pm2` normal?
14. Por que `CMD ["node_modules/.bin/pm2-runtime", ...]` é preferível a `CMD ["npm", "run", "prod"]` dentro do Dockerfile?
15. Por que os testes de integração (Fase 7.3) usam um banco Postgres real (`juris_db_test`) em vez de um banco SQLite em memória, que seria mais rápido de subir?
16. Por que `tests/unit/cnjNumber.test.ts` não chama `truncateAllTables()` nem `closeTestDatabase()`, mas os dois arquivos em `tests/integration/` chamam?
17. Por que o `afterEach` (limpar as tabelas) foi escolhido em vez do `beforeEach`, já que os dois rodam "entre" um teste e outro de qualquer forma?
18. `src/utils/cnjNumber.ts` existe e tem testes passando, mas `createLawsuit` continua aceitando qualquer texto no campo `cnjNumber`. Por que essa validação não foi conectada ao controller nesta fase?
19. Por que os scripts `test`, `test:watch` e `test:coverage` usam a flag `--runInBand` em vez de deixar o Jest rodar os arquivos de teste em paralelo (comportamento padrão)?
20. Por que `jest.config.cjs` e `tsconfig.jest.json` existem como arquivos **separados** de `tsconfig.json`, em vez de o Jest simplesmente reusar a configuração TypeScript principal do projeto (que compila para ESM)?
21. Por que o serviço `api` do `docker-compose.yml` precisava de `REDIS_HOST: redis` explícito, se o código já tem um fallback (`process.env.REDIS_HOST || 'localhost'`) em `src/config/redis.ts`?
22. Por que esse bug do Redis não aparecia ao rodar `npm run dev` fora do Docker, na sua máquina?
23. Um arquivo `.gitignore` e um `.env.example` cobrem propósitos diferentes, mesmo os dois estando relacionados ao `.env`. Qual é a diferença?
24. Por que o `.gitattributes` resolve o problema de terminação de linha "para sempre", em vez de só normalizar os arquivos uma vez?
25. Por que este guia recomenda **não** reescrever (`git rebase -i`) os commits antigos do histórico, mesmo eles não seguindo Conventional Commits?

---

## 🔧 Solução de problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `ReplyError: max retries per request limit reached` | Faltou `maxRetriesPerRequest: null` na conexão do `ioredis` usada pelo BullMQ | Confira `src/config/redis.ts` (Fase 4.1) |
| `Cannot use import statement outside a module` ao rodar uma migration | Um arquivo `.cjs` de migration/seeder contém sintaxe `import` (ESM) em vez de `require` (CommonJS) | Veja o alerta na Fase 4.2c sobre o arquivo `create-dead-letter-jobs.cjs` |
| API não conecta no banco, erro `ECONNREFUSED` | `DB_HOST` está como `localhost` mas a API roda **dentro** do Docker (ou vice-versa) | Dentro do Docker use `DB_HOST=db`; rodando a API fora do Docker (com `npm run dev` direto na sua máquina) use `DB_HOST=localhost` |
| `npm run db:migrate` não encontra as migrations | `.sequelizerc` ausente ou com caminhos errados | Confira a Fase 2.1 — o CLI só sabe onde procurar por causa deste arquivo |
| Job nunca aparece no Bull Board | Fila (`Queue`) e Worker apontando para nomes de fila diferentes, ou conectando em instâncias Redis diferentes | Confirme que `LAWSUIT_SYNC_QUEUE` é a mesma constante usada em `queues/lawsuitSync.queue.ts` e `workers/lawsuitSync.worker.ts`, e que ambos usam a mesma `redisConnection` |
| `403`/prompt de usuário e senha ao abrir `/admin/queues` | Comportamento esperado — Basic Auth protegendo o dashboard | Use as credenciais de `ADMIN_USER`/`ADMIN_PASS` do seu `.env` |
| `src/scripts/testeSocket.ts` conecta mas nunca recebe `lawsuit:updated` | `initLawsuitSyncEvents()` não foi chamada em `server.ts`, ou o CNJ usado no teste é diferente do CNJ do job disparado | Confira a Fase 5.3 — o nome da sala (`.to(cnjNumber)`) precisa ser IDÊNTICO ao valor passado em `join-lawsuit` |
| Evento chega, mas com `movements` vazio ou `undefined` | O Worker ainda está com a versão da Fase 4 (retornando só `{ movementsSaved }`) | Confira se `src/workers/lawsuitSync.worker.ts` foi atualizado conforme a Fase 5.3, retornando também `cnjNumber` e `movements` |
| `tsx: not found` (ou similar) ao subir o serviço `worker` do `docker-compose.yml` | O serviço estava buildando o estágio `production` (sem devDependencies) em vez de `dev` | Confira a Fase 6.2c — adicione `target: dev` ao `build:` do serviço `worker` |
| Container de produção encerra imediatamente após subir | Uso de `CMD ["pm2", ...]` (daemon, devolve o terminal na hora) em vez de `pm2-runtime` (roda em primeiro plano) | Confira a Fase 6.3 — o `Dockerfile` deve chamar `pm2-runtime`, nunca `pm2` puro |
| `docker stop` demora ~10s e força um `SIGKILL` no container de produção | O `CMD` estava passando por `npm run prod` (um `sh -c` no meio do caminho engole o SIGTERM) | Confira a Fase 6.3 — use a forma exec direta: `CMD ["node_modules/.bin/pm2-runtime", "start", "ecosystem.config.cjs"]` |
| Cliente WebSocket só recebe eventos quando conectado a UMA instância específica da API em produção | Faltou o Redis Adapter (`@socket.io/redis-adapter`) em `src/websocket/socket.ts` | Confira a Fase 6.2a |
| Conexão WebSocket falha ou demora muito para conectar em produção (modo cluster) | Cliente tentando long-polling por padrão, servidor só aceita `websocket` | Confira a Fase 6.2b — declare `{ transports: ['websocket'] }` também no cliente |
| `database "juris_db_test" does not exist` ao rodar `npm test` | O banco de teste nunca foi criado manualmente | Rode o passo 2 do "Roteiro de teste da Fase 7" (`CREATE DATABASE juris_db_test;`) |
| `npm test` roda mas fica pendurado (nunca volta ao prompt) | Alguma conexão (Sequelize, Redis ou a fila BullMQ) ficou aberta depois dos testes | Confira se `afterAll` está chamando `closeTestDatabase()` (Fase 7.3) em **todo** arquivo de integração — um único arquivo esquecido já é suficiente para o processo do Jest não encerrar |
| Erro `Cannot find module '../../src/app.js'` (ou similar) ao rodar `npm test`, mesmo o arquivo `app.ts` existindo | O `moduleNameMapper` de `jest.config.cjs` não está removendo a extensão `.js` dos imports (que existe por causa do `NodeNext` — Fase 1.2), e o `ts-jest` tenta resolver um arquivo `.js` que não existe | Confira a Fase 7.1 — o `moduleNameMapper` precisa mapear `^(\.{1,2}/.*)\.js$` de volta para `$1` |
| `SyntaxError: Cannot use import statement outside a module` ao rodar `npm test` (diferente do erro parecido da Fase 4) | `tsconfig.jest.json` ausente, ou `jest.config.cjs` não está apontando o `transform` para ele | Confira a Fase 7.1 — o `ts-jest` precisa compilar para `CommonJS` nos testes, mesmo o projeto sendo ESM em produção |
| `Cannot use import statement outside a module` ao rodar `npm run db:migrate:test` (não `npm test`), apontando para `20260101000004-create-dead-letter-jobs.cjs` | Esse é o bug real descrito no alerta da Fase 4.2c/`00 -...md` — o arquivo da migration ainda tinha o conteúdo errado (colado de `lawsuitSync.worker.ts`) | Já corrigido no seu projeto; se voltar a acontecer, copie o conteúdo correto da seção 4.2c da Fase 4 para `src/database/migrations/20260101000004-create-dead-letter-jobs.cjs` |
| `TS2593: Cannot find name 'describe'` / `TS2304: Cannot find name 'expect'` em TODOS os arquivos de teste, mesmo com `@types/jest` instalado | `tsconfig.jest.json` não declara `"types": ["jest", "node"]` — o `ts-jest` não carrega automaticamente os tipos globais do Jest neste projeto | Confira a Fase 7.1 — adicione `"types": ["jest", "node"]` em `compilerOptions` no `tsconfig.jest.json` |
| Testes de integração passam isolados (`npx jest tests/integration/clients.test.ts`) mas falham rodando a suíte inteira | Dois arquivos de teste truncando/lendo as mesmas tabelas ao mesmo tempo (condição de corrida) | Confirme que o script `test` usa `--runInBand` (Fase 7.1) — ele força o Jest a rodar os arquivos em sequência, não em paralelo, o que é necessário aqui porque todos os testes compartilham o mesmo banco `juris_db_test` |
| Teste de CNJ que "deveria" passar falha em `isValidCnjNumber` | O número usado no teste (ou num `curl` copiado de uma fase anterior) tem formato certo mas dígito verificador **matematicamente inválido** — os exemplos das Fases 3 a 6 são fictícios e não passam no checksum real | Use um dos números validados na Fase 7.2 (ex.: `0001234-72.2024.8.19.0001`) quando precisar de um CNJ que passe em `isValidCnjNumber` |
| `[redis] Erro de conexão: connect ECONNREFUSED` nos logs do container `jurisengine_api` (mas o serviço `redis` está `Up`/saudável) | O serviço `api` do `docker-compose.yml` não tinha `REDIS_HOST`/`REDIS_PORT`, então caía no fallback `localhost` — que, dentro do container, é o próprio container da API, não o Redis | Confira a Fase 8.2 — adicione `REDIS_HOST: redis` e `REDIS_PORT: 6379` ao `environment:` do serviço `api` |
| `git status` mostra dezenas de arquivos "modificados" com o mesmo número de inserções e remoções, mas você não lembra de ter mudado o conteúdo deles | Terminação de linha inconsistente (CRLF vs LF) — comum ao editar o mesmo repositório em Windows e depois em outro sistema, ou com editores configurados de formas diferentes | Confira a Fase 8.3 — adicione `.gitattributes` (`* text=auto eol=lf`) e rode `git add --renormalize .` |
| `fatal: Unable to create '.git/index.lock': File exists` ao tentar `git add`/`git commit` | Um `.git/index.lock` de uma operação anterior (interrompida ou travada) ficou para trás | Apague o arquivo `.git/index.lock` manualmente (ex.: `del .git\index.lock` no PowerShell, ou pelo Explorer) e tente de novo — é seguro apagar esse arquivo quando você tem certeza de que nenhum outro comando `git` está rodando no momento |

---

Fim do guia. Se quiser aprofundar algum tópico específico (ESLint, Docker, Sequelize, etc.) com mais detalhes conversacionais, os arquivos da sua pasta `Estudos/` (00 a 08) continuam disponíveis como material complementar — este guia foi escrito para amarrar tudo numa sequência única, reproduzível do zero.
