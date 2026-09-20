# 📗 Guia Completo V2 — Construção Incremental do Zero

> Este é o **complemento** do guia principal (pasta `GUIA COMPLETO - Passo a Passo/`), não uma substituição. O guia principal está organizado pelas **fases do seu TODO original** — cada fase entrega um pedaço grande e coerente do sistema (ex.: "Fase 4: todo o processamento assíncrono", de uma vez). Este V2 existe para responder a uma pergunta diferente: **"se eu abrisse uma pasta vazia agora, digitando um comando de cada vez, na ordem exata em que cada peça passa a fazer sentido, como seria?"**

## O que muda em relação ao V1

1. **Passos muito menores.** Em vez de "Fase 4: Processamento Assíncrono" (que sozinha cria 5 arquivos novos), o V2 quebra isso em "17 - Redis e a Fila", "18 - Simulador do Tribunal", "19 - Endpoint de Importação em Lote", "20 - O Worker", "22 - Dead Letter Queue"... cada um testável e commitável isoladamente.
2. **Variáveis de ambiente aparecem aos poucos.** No V1, o `.env` "nasce pronto" já na Fase 1, com todas as variáveis que o projeto inteiro vai usar. Isso é prático para consulta, mas não é como um projeto de verdade nasce — ninguém sabe que vai precisar de `ADMIN_USER`/`ADMIN_PASS` antes de decidir criar o Bull Board. Aqui, cada variável só aparece no arquivo em que ela passa a ser necessária pela primeira vez.
3. **A ordem segue dependência técnica, não a numeração do TODO.** Por exemplo: o V1 trata WebSockets (Fase 5) só depois de PM2 (Fase 6) na sua numeração original — mas tecnicamente o Socket.IO com Redis Adapter *depende* do Socket.IO básico já existir. Aqui a ordem é: Socket.IO básico → PM2 cluster → Redis Adapter (só necessário *por causa* do cluster). Isso significa que a numeração dos arquivos aqui **não bate 1:1** com as fases do V1 — é proposital.
4. **Cada arquivo termina com um commit sugerido**, no padrão Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), desde o primeiro arquivo. Se você seguir o guia commitando a cada passo, ao final você terá um histórico de commits genuinamente limpo e descritivo — não algo para "arrumar depois" (foi exatamente o problema que apareceu no projeto real na Fase 8 do V1).

## Como usar

Siga os arquivos **em ordem numérica**. Cada um pressupõe que todos os anteriores já foram feitos e testados. Não pule — mesmo os passos que parecem triviais (como "01 - Iniciando o Projeto") estabelecem uma base que os passos seguintes vão citar.

Cada arquivo segue sempre a mesma estrutura:

- **🎯 Objetivo** — o que este passo entrega, em uma frase.
- **📦 Instalar** (quando aplicável) — o(s) comando(s) `npm install` exato(s).
- **📝 Código** — o conteúdo completo de cada arquivo criado/alterado neste passo, comentado.
- **✅ Como confirmar que funcionou** — um comando (ou `curl`) e o resultado esperado.
- **🔧 Commit sugerido** — o comando `git add`/`git commit` exato para fechar o passo.

## Índice completo

| # | Arquivo | Entrega |
|---|---|---|
| 01 | Iniciando o Projeto | `npm init`, `package.json`, ESM (`"type": "module"`) |
| 02 | Git e Padrão de Commits | `git init`, primeiro `.gitignore`, Conventional Commits desde o commit zero |
| 03 | Configurando TypeScript | `tsconfig.json`, primeiro script `.ts` rodando |
| 04 | Configurando ESLint | `eslint.config.mts`, typescript-eslint |
| 05 | Express — Primeiro "Hello World" | `express`, `app.ts`/`server.ts` mínimos, `/health` |
| 06 | Variáveis de Ambiente com Dotenv | `dotenv`, `.env`/`.env.example` (só `PORT`, por enquanto) |
| 07 | Docker — Ambiente de Desenvolvimento | `Dockerfile` (estágio dev), `docker-compose.yml` (só `api`) |
| 08 | Adicionando PostgreSQL ao Compose | serviço `db`, variáveis `DB_*` |
| 09 | Sequelize — Conectando ao Banco | `sequelize`, `.sequelizerc`, `config.cjs`, `database.ts` |
| 10 | Primeira Migration e Model: Client | `clients` (migration + model) |
| 11 | Middlewares de Tratamento de Erros | `AppError`, `asyncHandler`, `errorHandler` |
| 12 | Endpoints de Clientes | criar, listar (paginado), buscar por id |
| 13 | Migration e Model: Lawsuit | `lawsuits` vinculado a `clients` |
| 14 | Endpoints de Processos | criar, buscar por id |
| 15 | Migration e Model: Movement | `movements` vinculado a `lawsuits` |
| 16 | Seeder de Dados de Exemplo | popular o banco local com um comando |
| 17 | Redis e a Fila BullMQ | `ioredis`, `bullmq`, `REDIS_HOST`/`REDIS_PORT` |
| 18 | Simulador da API do Tribunal | latência + falha aleatória, sem depender de nada externo |
| 19 | Endpoint de Importação em Lote | `POST /api/lawsuits/batch-import` (`202`) |
| 20 | O Worker de Sincronização | consome a fila, salva movimentações |
| 21 | Docker — Adicionando o Worker | serviço `worker` no compose |
| 22 | Dead Letter Queue | jobs definitivamente falhos, para investigação |
| 23 | Bull Board — Dashboard das Filas | `ADMIN_USER`/`ADMIN_PASS`, `/admin/queues` |
| 24 | WebSockets — Configuração Inicial | Socket.IO, salas por número CNJ |
| 25 | Ponte Worker → WebSocket | BullMQ `QueueEvents`, notificação em tempo real |
| 26 | Script de Teste do WebSocket | cliente de terminal para validar manualmente |
| 27 | PM2 — Cluster e Fork | `ecosystem.config.cjs`, API em cluster, Worker em fork |
| 28 | Dockerfile de Produção | multi-stage, `pm2-runtime` |
| 29 | Socket.IO em Cluster — Redis Adapter | por que o WebSocket quebra com mais de uma instância, e como resolver |
| 30 | Jest — Configuração | `jest.config.cjs`, `tsconfig.jest.json`, banco de teste isolado |
| 31 | Testes Unitários — Número CNJ | validador + dígito verificador oficial |
| 32 | Testes de Integração — API | clientes e processos, ponta a ponta |
| 33 | README e Publicação no GitHub | documentação final, `.gitattributes`, primeiro push |

## Pré-requisitos

Os mesmos do guia principal: Node.js 22+, Docker Desktop, um editor de código, e um cliente HTTP (`curl` ou Postman). Ver `../GUIA COMPLETO - Passo a Passo/00 - Leia-me Primeiro.md` para detalhes de instalação.

Pronto? Comece por `01 - Iniciando o Projeto.md`.
