# 📗 Guia Completo V3 — Construção Incremental do Zero, com MongoDB

> Este é mais um complemento do guia principal (pasta `GUIA COMPLETO - Passo a Passo/`) — ao lado da V2 (`GUIA COMPLETO - Passo a Passo V2/`), não uma substituição de nenhum dos dois. A V2 reconstrói o projeto inteiro, passo a passo, usando **PostgreSQL + Sequelize** (a stack real do projeto). Esta V3 faz a **mesma** reconstrução, na **mesma** ordem de dependência, com a **mesma** estrutura de arquivo — só que usando **MongoDB + Mongoose** no lugar do banco relacional.

## Por que uma V3, e não só "trocar o banco na V2"

Trocar de banco relacional para orientado a documento não é só trocar um driver — é revisitar decisões de modelagem que fazem sentido de um jeito num banco e de outro jeito no outro. Alguns exemplos concretos que você vai encontrar ao longo deste guia:

- **Sem migrations.** O MongoDB não exige uma estrutura de coleção predefinida — o schema TypeScript do Mongoose *é* a única fonte da verdade. Isso elimina uma pasta inteira que a V2 precisava (`src/database/migrations/`).
- **Movimentações embutidas, não numa tabela própria.** A V2 tinha uma tabela `movements` ligada por chave estrangeira. Aqui, cada processo carrega suas movimentações dentro do próprio documento — uma decisão de modelagem genuína (explicada em detalhe no passo 15), não uma tradução mecânica.
- **Sem chave estrangeira garantida pelo banco.** Referências entre documentos (`clientId` apontando para um `Client`) não são validadas pelo MongoDB — ao contrário do Postgres, nada impede salvar uma referência quebrada a não ser o próprio código da aplicação. Isso é discutido explicitamente nos passos 13, 14 e 22.
- **Atomicidade por documento, não por transação explícita.** Como as movimentações vivem dentro do processo, salvar as duas coisas juntas (passo 20) é um único write atômico — sem precisar da transação Sequelize que a V2 usava.
- **Índices únicos são assíncronos.** `unique: true` no Mongoose não é uma garantia imediata como a constraint `UNIQUE` do Postgres — o índice é construído em segundo plano. Isso tem uma consequência prática real nos testes automatizados (passo 32).

Nenhuma dessas diferenças é "MongoDB pior" ou "MongoDB melhor" que Postgres — são trade-offs diferentes. O objetivo desta V3 é te dar a experiência de sentir esses trade-offs construindo o mesmo sistema duas vezes, não só ler uma comparação teórica.

## O que continua igual à V2

Os princípios de construção da V2 continuam valendo integralmente aqui:

1. **Passos pequenos**, cada um testável e commitável isoladamente.
2. **Variáveis de ambiente aparecem aos poucos** — cada uma só entra no passo em que passa a ser necessária pela primeira vez.
3. **A ordem segue dependência técnica**, não a numeração de nenhum TODO — por isso a numeração dos arquivos não precisa bater com a V1.
4. **Cada arquivo termina com um commit sugerido**, no padrão Conventional Commits, desde o primeiro arquivo.

Tudo o que **não** envolve o banco de dados — Express, ESLint, Docker, Redis/BullMQ, WebSockets, PM2, Jest (a ferramenta em si) — é **idêntico** à V2, arquivo por arquivo. Você vai notar isso ao seguir os passos: a diferença real se concentra nos passos 08 a 22 e 30/32 (tudo que toca o banco), e em pequenos ajustes pontuais em outros passos.

## Como usar

Siga os arquivos **em ordem numérica**. Cada um pressupõe que todos os anteriores já foram feitos e testados.

Cada arquivo segue sempre a mesma estrutura:

- **🎯 Objetivo** — o que este passo entrega, em uma frase.
- **📦 Instalar** (quando aplicável) — o(s) comando(s) `npm install` exato(s).
- **📝 Código** — o conteúdo completo de cada arquivo criado/alterado neste passo, comentado.
- **✅ Como confirmar que funcionou** — um comando (ou `curl`) e o resultado esperado.
- **🔧 Commit sugerido** — o comando `git add`/`git commit` exato para fechar o passo.

## Índice completo

| # | Arquivo | Entrega | Muda em relação à V2? |
|---|---|---|---|
| 01 | Iniciando o Projeto | `npm init`, `package.json`, ESM (`"type": "module"`) | nota pequena |
| 02 | Git e Padrão de Commits | `git init`, primeiro `.gitignore`, Conventional Commits desde o commit zero | não |
| 03 | Configurando TypeScript | `tsconfig.json`, primeiro script `.ts` rodando | não |
| 04 | Configurando ESLint | `eslint.config.mts`, typescript-eslint, `jiti` | não |
| 05 | Express — Primeiro "Hello World" | `express`, `app.ts`/`server.ts` mínimos, `/health` | não |
| 06 | Variáveis de Ambiente com Dotenv | `dotenv`, `.env`/`.env.example` (só `PORT`, por enquanto) | não |
| 07 | Docker — Ambiente de Desenvolvimento | `Dockerfile` (estágio dev), `docker-compose.yml` (só `api`) | não |
| 08 | Adicionando MongoDB ao Compose | serviço `mongo`, variável `MONGODB_URI` | **sim** |
| 09 | Mongoose — Conectando ao Banco | `mongoose`, `src/config/database.ts` | **sim** |
| 10 | Primeiro Model: Client | schema Mongoose, sem migration | **sim** |
| 11 | Middlewares de Tratamento de Erros | `AppError`, `asyncHandler`, `errorHandler` (erros do Mongoose/MongoDB) | **sim** |
| 12 | Endpoints de Clientes | criar, listar (paginado), buscar por id | **sim** |
| 13 | Model: Lawsuit | `lawsuits` referenciando `clients`, virtual populate | **sim** |
| 14 | Endpoints de Processos | criar, buscar por id | **sim** |
| 15 | Movimentações Embutidas no Processo | array `movements` dentro do próprio documento `Lawsuit` | **sim (modelagem diferente)** |
| 16 | Seed de Dados de Exemplo | popular o banco local com um script Node simples | **sim** |
| 17 | Redis e a Fila BullMQ | `ioredis`, `bullmq`, `REDIS_HOST`/`REDIS_PORT` | nota pequena |
| 18 | Simulador da API do Tribunal | latência + falha aleatória, sem depender de nada externo | não |
| 19 | Endpoint de Importação em Lote | `POST /api/lawsuits/batch-import` (`202`), upsert via `findOneAndUpdate` | **sim** |
| 20 | O Worker de Sincronização | consome a fila, `$push` atômico das movimentações | **sim** |
| 21 | Docker — Adicionando o Worker | serviço `worker` no compose | nota pequena |
| 22 | Dead Letter Queue | jobs definitivamente falhos, coleção própria | **sim** |
| 23 | Bull Board — Dashboard das Filas | `ADMIN_USER`/`ADMIN_PASS`, `/admin/queues` | não |
| 24 | WebSockets — Configuração Inicial | Socket.IO, salas por número CNJ | não |
| 25 | Ponte Worker → WebSocket | BullMQ `QueueEvents`, notificação em tempo real | nota pequena |
| 26 | Script de Teste do WebSocket | cliente de terminal para validar manualmente | não |
| 27 | PM2 — Cluster e Fork | `ecosystem.config.cjs`, API em cluster, Worker em fork | não |
| 28 | Dockerfile de Produção | multi-stage, `pm2-runtime` | nota pequena |
| 29 | Socket.IO em Cluster — Redis Adapter | por que o WebSocket quebra com mais de uma instância, e como resolver | não |
| 30 | Jest — Configuração | `jest.config.cjs`, `tsconfig.jest.json`, banco de teste isolado (sem migrations) | **sim** |
| 31 | Testes Unitários — Número CNJ | validador + dígito verificador oficial | não |
| 32 | Testes de Integração — API | clientes e processos, ponta a ponta, índices assíncronos | **sim** |
| 33 | README e Publicação no GitHub | documentação final, `.gitattributes`, primeiro push | nota pequena |

## Pré-requisitos

Os mesmos da V2, com uma adição: Node.js 22+, Docker Desktop, um editor de código, um cliente HTTP (`curl` ou Postman) — e não é preciso instalar o MongoDB na sua máquina separadamente, ele roda inteiramente containerizado a partir do passo 08.

Pronto? Comece por `01 - Iniciando o Projeto.md`.
