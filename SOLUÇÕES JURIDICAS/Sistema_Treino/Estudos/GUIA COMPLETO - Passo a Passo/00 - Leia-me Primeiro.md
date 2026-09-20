# 📘 Guia Completo de Reprodução — JurisEngine (Motor Jurídico Assíncrono)

> Este guia foi escrito para que você consiga **recriar este projeto inteiro do zero, em uma pasta vazia, sem precisar de IA**, apenas seguindo os passos na ordem em que eles aparecem. Cada arquivo criado vem acompanhado do código completo, comentado linha a linha como se um professor estivesse explicando ao seu lado.
>
> Ele foi organizado exatamente na ordem do seu `TODO` original (Fase 1 → Fase 2 → Fase 3 → Fase 4), porque foi exatamente nessa ordem que o projeto real foi construído — cada fase depende da anterior.

---

## 🧭 Como usar este guia

Este guia está dividido em **10 documentos**, dentro desta mesma pasta. Leia-os **nesta ordem**:

| Arquivo | O que você vai aprender |
|---|---|
| `00 - Leia-me Primeiro.md` | Este arquivo. Visão geral do projeto, pré-requisitos e mapa mental de como tudo se conecta. |
| `01 - Fase 1 - Ambiente e Infraestrutura.md` | Iniciar o projeto Node, configurar ESLint, Docker e Docker Compose. |
| `02 - Fase 2 - Banco de Dados.md` | Instalar Sequelize, criar as migrations, os models e o seeder (PostgreSQL). |
| `03 - Fase 3 - API REST.md` | Montar o servidor Express, rotas, controllers e tratamento de erros. |
| `04 - Fase 4 - Processamento Assincrono.md` | Filas com BullMQ + Redis, o Worker jurídico, retries e Dead Letter Queue (DLQ). |
| `05 - Fase 5 - WebSockets (Tempo Real).md` | Socket.IO, salas por número CNJ, e a ponte Worker → API → cliente em tempo real. |
| `06 - Fase 6 - PM2 (Producao).md` | PM2, modo cluster/fork, Redis Adapter do Socket.IO, e a imagem Docker de produção. |
| `07 - Fase 7 - Testes Automatizados (Jest).md` | Jest + ts-jest + supertest, banco de teste isolado, validador de número CNJ e testes unitários/de integração. |
| `08 - Fase 8 - Documentacao e Publicacao no GitHub.md` | README com diagramas de arquitetura, guia de execução com um único comando, padrão de commits e publicação no GitHub. |
| `09 - Checklist Final e Como Rodar Tudo.md` | Passo a passo final para subir o projeto do zero e testar cada peça, incluindo a suíte de testes. |

Cada seção de código, ao longo do guia, segue sempre o mesmo formato:

1. **O que vamos construir e por quê** (a intenção, em português simples).
2. **Comando(s) de terminal** a executar, na ordem exata.
3. **O código completo do arquivo**, com comentários numerados explicando cada trecho.
4. **Como confirmar que deu certo** (o "teste manual" daquele passo).

---

## 🗺️ O que é o JurisEngine, em uma frase

O **JurisEngine** é uma **API + Worker assíncrono** que recebe números de processos judiciais (número CNJ) vinculados a clientes, e — em segundo plano, sem travar a API — vai até uma fonte externa (aqui, simulada) buscar as movimentações mais recentes de cada processo, salva essas movimentações no banco de dados e atualiza o status do processo. Se a fonte externa falhar repetidamente, o job "morto" é guardado numa tabela de **Dead Letter Queue (DLQ)** para investigação manual — nada se perde silenciosamente.

Pense nele como um sistema de "captação de andamentos processuais" que você encontraria por trás de qualquer software jurídico (tipo Projuris, Astrea, etc.), só que em miniatura e para fins de estudo.

### Por que ele é "assíncrono"?

Consultar um tribunal (ou qualquer API externa) é **lento** e **não confiável** — pode demorar segundos, pode cair, pode dar timeout. Se a API HTTP do JurisEngine fizesse essa consulta *na hora* que o cliente pede (síncrono), uma requisição de importar 500 processos deixaria o usuário esperando minutos, e qualquer falha de rede quebraria a resposta inteira.

A solução profissional é **desacoplar**: a API apenas grava a intenção ("processe estes CNJs") numa **fila** e responde imediatamente ("ok, recebi, vou processar"). Um processo separado — o **Worker** — fica consumindo essa fila em background, no seu próprio ritmo, com **retry automático** se algo falhar. É o mesmo padrão usado por filas de e-mail, geração de boletos, processamento de imagem, etc.

---

## 🧱 Visão geral da arquitetura (mapa mental)

```
                    ┌──────────────────────────┐
  Cliente HTTP ───► │   API (Express + TS)     │
 (Postman/curl)     │   src/app.ts             │
                    └────────────┬──────────────┘
                                 │
                 grava no Postgres (Client / Lawsuit)
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  Fila "lawsuit-sync"      │
                    │  (BullMQ, guardada no     │
                    │   Redis)                  │
                    └────────────┬──────────────┘
                                 │  o Worker consome os jobs
                                 ▼
                    ┌──────────────────────────┐
                    │  Worker                   │
                    │  src/workers/             │
                    │  lawsuitSync.worker.ts    │
                    └────────────┬──────────────┘
                                 │
             consulta "Tribunal" (simulado) e grava Movement
                                 │
                     ┌───────────┴────────────┐
                     ▼                         ▼
              sucesso: status              falha após todas
              vira "UPDATED"              as tentativas: registro
                                          na tabela dead_letter_jobs
```

Três processos rodam ao mesmo tempo (cada um numa "caixinha" do Docker Compose):

1. **`api`** — o servidor HTTP (Express), quem recebe as requisições REST.
2. **`worker`** — um processo Node **separado**, que só fica escutando a fila e processando jobs. Repare que ele roda o mesmo código-fonte (`src/`), mas com outro *entrypoint* (`npm run worker` em vez de `npm run dev`).
3. **`db`** (PostgreSQL) e **`redis`** — a infraestrutura de dados: o Postgres guarda os dados "de verdade" (clientes, processos, movimentações), o Redis guarda o **estado da fila** (quais jobs estão esperando, rodando, etc.).

Entender essa separação em **4 papéis** (API, Worker, Banco relacional, Fila) é a coisa mais importante deste projeto — o resto é "só" código de cada peça.

---

## 🛠️ Pré-requisitos (o que instalar na sua máquina antes de começar)

| Ferramenta | Para quê | Como verificar se já tem |
|---|---|---|
| **Node.js** (versão 22 LTS ou superior) | Rodar o projeto localmente / rodar `npm` | `node -v` no terminal |
| **npm** (vem junto com o Node) | Gerenciador de pacotes | `npm -v` |
| **Docker Desktop** | Subir Postgres, Redis, API e Worker em containers, sem instalar nada "na unha" | `docker -v` e `docker compose version` |
| **Git** (opcional, mas recomendado) | Versionar o código enquanto você reproduz | `git -v` |
| Um editor de código (VS Code recomendado) | Escrever os arquivos | — |
| Um cliente HTTP (Postman, Insomnia, ou `curl` no terminal) | Testar os endpoints da API | — |

> 💡 **Você não precisa instalar PostgreSQL nem Redis na sua máquina.** O Docker Compose (Fase 1) sobe os dois prontos, em containers isolados. É assim que o projeto original foi feito.

---

## 📦 Stack tecnológica usada (e por que cada peça foi escolhida)

| Categoria | Tecnologia | Por quê |
|---|---|---|
| Linguagem | **TypeScript** | Tipagem estática pega erros em tempo de desenvolvimento (ex.: esquecer um campo obrigatório) antes de eles virarem bugs em produção. |
| Runtime | **Node.js 22** | LTS mais recente no momento da criação do projeto. |
| Framework HTTP | **Express 5** | Simples, maduro, com o maior ecossistema de middlewares do Node. |
| ORM | **Sequelize** | Mapeia tabelas SQL para classes/objetos TypeScript, com sistema de *migrations* versionadas (o "Git" da estrutura do banco). |
| Banco de dados | **PostgreSQL** | Banco relacional robusto, com suporte nativo a `UUID` e `JSONB` (usado na DLQ). |
| Fila / Jobs | **BullMQ** (sobre **Redis**) | Biblioteca de filas madura para Node, com retry, backoff exponencial e um dashboard de observação pronto (Bull Board). |
| Containerização | **Docker + Docker Compose** | Reproduzir o ambiente inteiro (API + Worker + Postgres + Redis) com um único comando, igual em qualquer máquina. |
| Qualidade de código | **ESLint + typescript-eslint** | Padroniza o estilo do código e evita erros comuns. |
| Execução em dev | **tsx** | Roda arquivos `.ts` diretamente, sem precisar compilar a cada mudança (com `watch` para reiniciar sozinho). |

---

## 🚦 A ordem real de construção (o "como cheguei até aqui")

O projeto **não** foi construído de cima para baixo lendo a pasta `src/` na ordem alfabética. Ele foi construído resolvendo **uma camada de cada vez**, sempre validando antes de avançar — exatamente como o seu `TODO` documenta:

1. **Fase 1 — Fundação**: primeiro garante-se que existe um projeto Node válido, com padrão de código (ESLint) e um jeito de reproduzir o ambiente em qualquer máquina (Docker). Sem isso, tudo que vem depois é construído em cima de areia.
2. **Fase 2 — Dados**: antes de existir qualquer rota HTTP, o **formato dos dados** precisa estar definido — quais tabelas existem, quais campos, quais relacionamentos. É a "planta baixa" do sistema.
3. **Fase 3 — API**: com o banco pronto, constrói-se a camada que **expõe** esses dados para o mundo externo via HTTP (rotas, controllers, validação, erros).
4. **Fase 4 — Assíncrono**: só faz sentido criar filas e workers **depois** de já existir a tabela `movements` e o endpoint que vai disparar a importação em lote — é a fase que "liga" tudo.
5. **Fase 5 — Tempo real**: só faz sentido notificar o cliente sobre uma movimentação **depois** de existir um Worker que captura movimentações (Fase 4) — a Fase 5 não cria nenhuma lógica de negócio nova, ela só "escuta" o que o BullMQ já produzia e repassa para quem estiver conectado.
6. **Fase 6 — Produção/escala**: só faz sentido decidir "quantas cópias de cada processo rodar" **depois** de todo o sistema (API, Worker, WebSocket) já estar funcionando com uma única cópia de cada — a Fase 6 também não cria lógica de negócio nova, ela decide **como** o código existente roda em escala.
7. **Fase 7 — Testes automatizados**: só depois de o sistema inteiro estar funcionando (Fases 1 a 6) é que faz sentido "engessar" esse comportamento em testes automatizados — eles existem para travar uma alarme se alguém (você, ou uma IA) quebrar sem querer algo que já funcionava. Também é a fase que finalmente formaliza, em código testado, a validação do número CNJ que até então só existia como texto livre.
8. **Fase 8 — Documentação e publicação**: a última fase, e de propósito — só faz sentido escrever "como rodar este projeto" depois que ele já roda de verdade, e só faz sentido publicar num repositório quando há algo publicável. Curiosamente, foi justamente o exercício de **documentar honestamente** o passo a passo de execução que revelou um bug real (Redis mal configurado no `docker-compose.yml` do serviço `api`) que nenhuma fase anterior tinha pego — documentação, quando escrita com o cuidado de "isso realmente funciona assim?", também é uma forma de teste.

Siga essa mesma ordem nos próximos arquivos. Não pule etapas — cada uma pressupõe que a anterior já está funcionando (testada) na sua máquina.

---

## 📁 Estrutura final de pastas (para onde você está indo)

```
Sistema_Treino/
├── README.md                   # porta de entrada do projeto (Fase 8): arquitetura, como rodar, padrão de commits
├── .env                       # variáveis de ambiente reais (NUNCA vai pro Git)
├── .env.example                # modelo público de .env (criado de fato na Fase 8, embora documentado desde a Fase 1)
├── .gitattributes               # normaliza terminação de linha (LF) no repositório (Fase 8.3)
├── .gitignore
├── .sequelizerc                 # diz ao Sequelize CLI onde estão config/models/migrations/seeders
├── docker-compose.yml           # orquestra api + worker + db + redis (Fase 8: corrigido REDIS_HOST/PORT do serviço api)
├── Dockerfile                   # imagem Docker multi-stage (dev / build / production)
├── eslint.config.mts            # regras de lint
├── package.json
├── tsconfig.json
├── ecosystem.config.cjs      # (Fase 6) config do PM2: cluster mode (api) + fork mode (worker)
├── jest.config.cjs           # (Fase 7) config do Jest (preset ts-jest, mapeamento de módulos)
├── tsconfig.jest.json        # (Fase 7) tsconfig específico dos testes (compila para CommonJS)
├── tests/
│   ├── setup/
│   │   ├── env.cjs             # (Fase 7) variáveis de ambiente fixas para o ambiente de teste
│   │   └── testDatabase.ts      # (Fase 7) helpers truncateAllTables()/closeTestDatabase()
│   ├── unit/
│   │   └── cnjNumber.test.ts     # (Fase 7) testes unitários do validador de número CNJ
│   └── integration/
│       ├── clients.test.ts        # (Fase 7) testes de integração da API de clientes
│       └── lawsuits.test.ts        # (Fase 7) testes de integração da API de processos
└── src/
    ├── app.ts                   # monta o Express (rotas, middlewares) — não escuta porta
    ├── server.ts                 # ponto de entrada: cria o httpServer, liga Socket.IO e chama .listen()
    ├── admin/
    │   └── bullBoard.ts           # dashboard visual da fila (Bull Board)
    ├── config/
    │   ├── config.cjs             # config do Sequelize CLI (migrations/seeders)
    │   ├── database.ts             # instância do Sequelize usada pela aplicação
    │   └── redis.ts                # conexão Redis compartilhada (Queue + Worker)
    ├── controllers/
    │   ├── client.controller.ts
    │   └── lawsuit.controller.ts
    ├── database/
    │   ├── migrations/             # histórico versionado da estrutura do banco
    │   └── seeders/                # dados fictícios para popular o banco local
    ├── middlewares/
    │   ├── AppError.ts             # classe de erro "de negócio" com status HTTP
    │   ├── asyncHandler.ts          # elimina try/catch repetido nos controllers
    │   └── errorHandler.ts          # converte qualquer erro numa resposta JSON padronizada
    ├── models/
    │   ├── client.model.ts
    │   ├── lawsuit.model.ts
    │   ├── movement.model.ts
    │   ├── deadLetterJob.model.ts
    │   └── index.ts                 # define os relacionamentos entre os models
    ├── queues/
    │   └── lawsuitSync.queue.ts      # define a fila BullMQ e a função de enfileirar
    ├── routes/
    │   ├── index.ts
    │   ├── client.routes.ts
    │   └── lawsuit.routes.ts
    ├── scripts/
    │   └── testeSocket.ts             # (Fase 5) cliente de teste via terminal, fora da aplicação
    ├── utils/
    │   └── cnjNumber.ts                # (Fase 7) validador de formato + dígito verificador do CNJ
    ├── websocket/
    │   ├── socket.ts                   # (Fase 5) Socket.IO: conexões e salas por número CNJ
    │   └── lawsuitSyncEvents.ts         # (Fase 5) ponte BullMQ "completed" → Socket.IO
    └── workers/
        ├── lawsuitSync.worker.ts      # o worker: consome a fila, salva movimentações
        └── tribunalApi.simulator.ts    # simula a API externa do tribunal (delay + falha aleatória)
```

Guarde esta árvore — você vai recriá-la exatamente assim, pasta por pasta, ao longo dos próximos 7 documentos.

---

## ⚠️ Um alerta importante antes de começar (achado durante a leitura do código — e confirmado na prática na Fase 7)

Ao ler o código-fonte do seu projeto para escrever este guia, encontrei um problema real no arquivo de migration da tabela `dead_letter_jobs`
(`src/database/migrations/20260101000004-create-dead-letter-jobs.cjs`): o conteúdo desse arquivo **não era uma migration** — era uma cópia acidental do conteúdo de `src/workers/lawsuitSync.worker.ts` (código TypeScript com `import`, que não pode nem ser interpretado por um arquivo `.cjs`). Provavelmente um "colar no arquivo errado" durante a Fase 4.

Isso ficou só como um alerta teórico até a Fase 7, quando rodar `npm run db:migrate:test` pela primeira vez bateu de frente com o bug de verdade: o comando quebrou com `Cannot use import statement outside a module`, confirmando que o arquivo real do projeto **ainda** estava errado.

**Já está corrigido**: o arquivo `src/database/migrations/20260101000004-create-dead-letter-jobs.cjs` do seu projeto foi sobrescrito com o conteúdo correto (reconstruído a partir do model `deadLetterJob.model.ts`, que sempre esteve certo) — você não precisa fazer nada. O código correto também está reproduzido, para referência, na seção 4.2.c de `04 - Fase 4 - Processamento Assincrono.md`. Se estiver seguindo este guia do zero (em vez de reaproveitando o projeto original), você já cria o arquivo certo desde o início.

---

Pronto para começar? Siga para `01 - Fase 1 - Ambiente e Infraestrutura.md`.
