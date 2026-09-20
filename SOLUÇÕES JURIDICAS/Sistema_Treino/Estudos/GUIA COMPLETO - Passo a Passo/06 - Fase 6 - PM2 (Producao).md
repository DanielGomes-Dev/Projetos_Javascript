# Fase 6 — Gerenciamento de Processos Concorrentes (PM2)

> Objetivo desta fase: dar ao JurisEngine uma forma de rodar em **produção** aproveitando **todos os núcleos de CPU** disponíveis, sem depender do hot-reload de desenvolvimento (`tsx watch`) nem de você reiniciar manualmente o processo se ele cair. Vamos usar o **PM2** — um gerenciador de processos para Node.js — para orquestrar múltiplas cópias da API (modo *cluster*) e do Worker (modo *fork*) dentro do mesmo container.
>
> Assim como a Fase 5, esta fase já foi **implementada no seu projeto real**. Este documento explica o que foi feito e por quê, no mesmo formato didático das fases anteriores.

---

## 🧠 Por que isso importa: o problema que o PM2 resolve

Até a Fase 5, a API rodava como **um único processo Node**. Isso significa que, não importa quantos núcleos de CPU o servidor tenha (4, 8, 16...), a API só usa **um** deles — o Node.js é, por padrão, single-threaded para código JavaScript. Numa aplicação com bastante tráfego, isso deixa a maior parte da máquina ociosa.

O **modo cluster** do PM2 resolve isso rodando **várias cópias idênticas** do mesmo processo (uma por núcleo, tipicamente), com o próprio sistema operacional/Node dividindo as conexões de entrada entre elas. É a mesma ideia por trás do `pm2 start app.js -i max` que você talvez já tenha visto em tutoriais — só que, aqui, configurada declarativamente num arquivo (`ecosystem.config.cjs`) em vez de flags de linha de comando, e rodando **dentro** do container Docker via `pm2-runtime` (a variante do PM2 feita para containers).

O PM2 também cuida de outras coisas que, de outra forma, você teria que implementar na mão: reiniciar um processo automaticamente se ele cair (`crash`), logs organizados por processo, e um encerramento coordenado quando o container recebe um sinal de parada.

> ⚠️ **Importante**: o PM2/cluster mode é uma decisão de **produção**. O `docker compose up` do seu dia a dia continua funcionando **exatamente igual** às Fases 1-5 — um único processo por serviço, com `tsx watch` e hot-reload. Misturar cluster mode com hot-reload não faz sentido (você não quer 4 cópias do processo reiniciando ao mesmo tempo a cada `Ctrl+S`) — por isso o PM2 só entra em cena no estágio `production` do `Dockerfile`, usado para um deploy de verdade.

---

## 6.1. Configuração do Ecosystem File

### O que vamos construir e por quê

O **"ecosystem file"** é como o PM2 chama seu arquivo de configuração: em vez de digitar `pm2 start app.js -i max --name api` na linha de comando toda vez, você descreve **todos** os processos que quer gerenciar (a API, o Worker, e quaisquer outros que existirem no futuro) num único arquivo declarativo, versionado junto com o código.

### Passo a passo

**1.** Instale o PM2 como dependência de **produção** (não de desenvolvimento — ele precisa estar disponível na imagem Docker final, que só instala `dependencies`, nunca `devDependencies`):

```bash
npm install pm2
```

**2.** Crie `ecosystem.config.cjs` na **raiz** do projeto:

```javascript
// ecosystem.config.cjs
//
// Arquivo de configuração do PM2 — descreve QUAIS processos rodar em
// produção e COMO (cluster vs fork, quantas instâncias, variáveis de
// ambiente). Só entra em cena dentro do estágio "production" do
// Dockerfile — a Fase 6 NÃO muda como você roda o projeto em
// desenvolvimento: `docker compose up` continua usando `tsx watch`,
// com hot-reload, exatamente como nas Fases 1-5.
//
// Extensão .cjs (não .js, como o TODO original sugere): o projeto
// inteiro é "type": "module" no package.json, e o PM2 carrega este
// arquivo com `require()` (CommonJS) por baixo dos panos — a mesma
// razão pela qual `.sequelizerc` e os arquivos de migration também
// usam CommonJS em vez de ESM.

module.exports = {
  apps: [
    {
      // ── API REST (+ Socket.IO) — modo CLUSTER ──────────────────
      name: 'jurisengine-api',

      // JavaScript JÁ COMPILADO — em produção rodamos o resultado de
      // `npm run build` (dist/), nunca o tsx (uma devDependency, que
      // sequer é instalada na imagem de produção — veja o Dockerfile).
      script: 'dist/server.js',

      // "cluster": o PM2 usa o módulo `cluster` nativo do Node para
      // rodar VÁRIAS cópias do mesmo processo, todas escutando a MESMA
      // porta (3000) — o próprio Node faz o balanceamento entre elas
      // internamente. Faz sentido para a API porque ela é
      // CPU/IO-bound por requisição e sem estado compartilhado em
      // memória entre requisições diferentes.
      exec_mode: 'cluster',

      // 'max': o PM2 detecta sozinho quantos núcleos de CPU o
      // container enxerga e sobe uma instância por núcleo (equivale a
      // `instances: 0`). Em máquinas pequenas (1-2 vCPUs), isso já
      // acontece automaticamente sem desperdiçar recursos.
      instances: 'max',

      env: {
        NODE_ENV: 'production',
      },
    },
    {
      // ── Worker de sincronização — modo FORK ────────────────────
      name: 'jurisengine-worker',

      script: 'dist/workers/lawsuitSync.worker.js',

      // "fork": cada instância é um processo Node INDEPENDENTE, sem
      // relação de balanceamento de porta entre elas (o worker não
      // abre nenhuma porta HTTP — não há nada para "dividir" no
      // sentido do modo cluster). Rodar várias cópias em fork mode é
      // simplesmente rodar o mesmo script várias vezes, cada cópia
      // competindo pelos mesmos jobs na fila do BullMQ.
      exec_mode: 'fork',

      // 2 processos consumindo a MESMA fila `lawsuit-sync`. Isso é
      // seguro por causa de como o BullMQ funciona: cada job só é
      // entregue a UM worker por vez (há um lock interno no Redis);
      // as duas cópias nunca processam o mesmo job simultaneamente —
      // elas só aumentam o throughput total (mais jobs em paralelo).
      // Note que isso é uma dimensão de escala DIFERENTE da variável
      // LAWSUIT_SYNC_CONCURRENCY (Fase 4): aquela controla quantos
      // jobs UM processo processa ao mesmo tempo; isto controla
      // quantos PROCESSOS existem, cada um com sua própria concorrência interna.
      instances: 2,

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

> 💡 **`cluster` vs `fork`, a regra prática**: use `cluster` quando o processo abre uma porta HTTP que faz sentido dividir entre várias cópias (a API). Use `fork` para qualquer processo que **não** escuta uma porta — um worker de fila, uma tarefa agendada (cron job), um script de processamento em lote. Tentar rodar um worker em modo `cluster` não traria nenhum benefício (não existe porta para balancear) e só adicionaria complexidade desnecessária.

**3.** Adicione o script `"prod"` ao `package.json`, exatamente como o TODO especifica (só ajustando a extensão do arquivo, pelo mesmo motivo do `.cjs` acima):

```json
{
  "scripts": {
    "prod": "pm2-runtime start ecosystem.config.cjs"
  }
}
```

### Como confirmar que deu certo

Você pode testar o PM2 **fora** do Docker, direto na sua máquina, desde que já tenha rodado `npm run build` antes (o PM2 aponta para `dist/`, não para `src/`):

```bash
npm run build
npm run prod
```

Deve aparecer uma tabela no terminal, gerada pelo próprio PM2, listando `jurisengine-api` (várias linhas, uma por instância de cluster) e `jurisengine-worker` (2 linhas), todas com status `online`. Pressione `Ctrl+C` para encerrar.

---

## 6.2. Multi-processos e Cluster Mode

Esta seção já foi coberta em detalhe dentro do `ecosystem.config.cjs` acima (a configuração É a implementação). Vale aprofundar dois pontos que o TODO não menciona explicitamente, mas que são consequência direta de colocar a API em modo cluster — e que **já foram corrigidos no seu projeto**, não apenas descritos.

### 6.2.a — O problema: Socket.IO não funciona "de graça" em modo cluster

Lembra da Fase 5? A API hospeda um servidor Socket.IO, e o `getIO().to(sala).emit(...)` (usado pela ponte `lawsuitSyncEvents.ts`) só alcança clientes conectados **àquele processo específico**. Em modo cluster, existem várias cópias do processo da API rodando ao mesmo tempo — e não há garantia de que o cliente que precisa receber uma notificação esteja conectado à MESMA cópia que recebeu o evento `completed` do BullMQ.

**A solução, já aplicada em `src/websocket/socket.ts`**: o **Redis Adapter** do Socket.IO (`@socket.io/redis-adapter`). Toda vez que qualquer cópia da API emite para uma sala, o adapter publica a mensagem num canal Redis compartilhado; todas as cópias assinam esse canal e retransmitem para os clientes que têm conectados localmente. O efeito prático é que `.to(sala).emit(...)` funciona **como se** existisse só uma API, não importa quantas cópias estejam rodando.

```bash
npm install @socket.io/redis-adapter
```

```typescript
// src/websocket/socket.ts (trecho acrescentado nesta fase)
import { createAdapter } from '@socket.io/redis-adapter';
import { redisConnection } from '../config/redis.js';

// ...dentro de initSocket(), logo após criar `io`:

// Usamos `.duplicate()` (do ioredis) para abrir DUAS conexões novas a
// partir da mesma configuração de `redisConnection` — Pub/Sub, tal
// como os comandos bloqueantes do BullMQ (Fase 4), exige conexões
// DEDICADAS: uma conexão em modo "subscriber" fica presa ouvindo o
// canal e não pode mais executar outros comandos Redis normalmente.
const pubClient = redisConnection.duplicate();
const subClient = redisConnection.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

> 💡 Repare no padrão se repetindo: na Fase 4 vimos que o BullMQ precisa de uma conexão Redis dedicada para comandos bloqueantes (`maxRetriesPerRequest: null`). Aqui, Pub/Sub tem exatamente a mesma exigência, pelo mesmo motivo de fundo — uma conexão em modo "assinatura" não pode ser reaproveitada para comandos normais. É um padrão geral do Redis, não uma peculiaridade do BullMQ ou do Socket.IO.

### 6.2.b — O problema: o handshake do Socket.IO precisa de "sticky sessions"

Mesmo com o Redis Adapter resolvendo o **emit**, ainda existe um segundo problema: a **conexão inicial** de um cliente. Por padrão, o Socket.IO tenta primeiro várias requisições HTTP de long-polling antes de fazer o "upgrade" para WebSocket — e, sem *sticky sessions* configuradas no balanceador (algo que o PM2 **não** provê automaticamente em modo cluster), cada uma dessas requisições pode ser roteada para uma cópia diferente do processo, quebrando o handshake.

**A solução, também já aplicada**: forçar o transporte para `websocket` puro, tanto no servidor quanto no cliente — pulando o long-polling inteiramente. Uma vez estabelecida, a conexão WebSocket é uma única conexão TCP persistente, que naturalmente permanece atrelada a UMA cópia do processo do início ao fim, sem exigir nenhuma configuração extra de sticky session:

```typescript
// src/websocket/socket.ts
io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'],   // pula o long-polling — ver explicação completa no arquivo
});
```

```typescript
// src/scripts/testeSocket.ts (e qualquer outro cliente, inclusive o front-end de verdade)
const socket = ioClient(SERVER_URL, { transports: ['websocket'] });
```

> ⚠️ Se você esquecer de configurar isso no **cliente** também, ele vai tentar long-polling por padrão, o servidor vai rejeitar essa tentativa, e a conexão vai demorar mais (ou falhar) até cair no fallback certo — sempre configure os dois lados juntos.

### 6.2.c — Um bug real encontrado no `docker-compose.yml` (e corrigido nesta fase)

Ao revisar o projeto para implementar esta fase, encontrei uma inconsistência no serviço `worker` do `docker-compose.yml` — parecida em espírito com o problema da migration da DLQ que apareceu na Fase 4.

O bloco original era:

```yaml
  worker:
    build: .              # <- sem "target" definido
    container_name: jurisengine_worker
    command: npm run worker   # roda "tsx watch src/workers/lawsuitSync.worker.ts"
    ...
```

O `Dockerfile` tem 3 estágios: `dev`, `build` e `production` (Fase 1). Quando o `docker-compose.yml` faz `build: .` **sem** especificar `target:`, o Docker constrói, por padrão, o **último** estágio do `Dockerfile` — que é `production`. E o estágio `production` roda `npm ci --omit=dev`, ou seja, **sem** o pacote `tsx` (uma devDependency). Só que o `command: npm run worker` desse serviço tenta rodar exatamente `tsx watch ...` — um comando que depende de um pacote que não foi instalado nessa imagem. Na prática, isso faria o container do worker falhar ao iniciar, com um erro do tipo "tsx: not found".

O serviço `api`, ao lado, já fazia a coisa certa (`build: { context: ., target: dev }`) — o `worker` só não tinha recebido o mesmo cuidado. A correção, já aplicada no seu projeto:

```yaml
  worker:
    build:
      context: .
      target: dev   # agora builda o MESMO estágio "dev" usado pela api — tsx disponível
    container_name: jurisengine_worker
    command: npm run worker
    ...
```

> 📝 Esse bug provavelmente nunca foi percebido durante o desenvolvimento das Fases 1-5 porque o `docker-compose.yml` é reconstruído (`docker compose up --build`) com bastante frequência, e o cache de camadas do Docker pode ter mascarado o problema em algum momento (reaproveitando uma imagem `dev` de um build anterior, por exemplo). Vale sempre rodar `docker compose build --no-cache` de vez em quando, justamente para pegar esse tipo de inconsistência.

### Como confirmar que deu certo

```bash
docker compose up --build
```

Ambos os serviços (`api` e `worker`) devem subir normalmente, com `tsx watch` funcionando em ambos (você pode confirmar editando um arquivo em `src/` e vendo o hot-reload disparar nos logs de qualquer um dos dois serviços).

---

## 6.3. Scripts de Produção

### O que vamos construir e por quê

Precisamos que a imagem Docker de **produção** (o estágio `production` do `Dockerfile`, usado quando você faz um deploy de verdade — não pelo `docker-compose.yml`, que é só para desenvolvimento) rode através do PM2 Runtime, em vez de `node dist/server.js` direto.

### Passo a passo

**1.** Atualize o estágio `production` do `Dockerfile`:

```dockerfile
# ---------- Production: imagem final, enxuta ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# `pm2` precisa estar em "dependencies" (não "devDependencies") no
# package.json — `npm ci --omit=dev` NUNCA instala devDependencies, e
# sem o pm2 instalado aqui, o binário pm2-runtime abaixo não existiria.
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY ecosystem.config.cjs ./
EXPOSE 3000
# Fase 6: em vez de rodar `node dist/server.js` diretamente (Fases 1-5),
# a imagem de produção agora sobe os processos através do PM2 Runtime —
# a variante do PM2 feita para containers: roda em PRIMEIRO PLANO (não
# vira um daemon em background, como o `pm2 start` normal faria), o que
# é obrigatório em Docker — um container encerra assim que seu processo
# principal (PID 1) termina, e um daemon que se desprende do terminal
# "termina" imediatamente do ponto de vista do Docker.
#
# Chamamos o binário DIRETO (node_modules/.bin/pm2-runtime), em vez de
# `npm run prod`, de propósito: `npm run <script>` insere um processo
# `sh -c` no meio do caminho, o que atrapalha o repasse de sinais do
# Docker (SIGTERM ao rodar `docker stop`) para o pm2-runtime — e sem
# receber o SIGTERM corretamente, o desligamento gracioso que
# implementamos em server.ts e no worker (Fases 4 e 5) nunca dispara.
CMD ["node_modules/.bin/pm2-runtime", "start", "ecosystem.config.cjs"]
```

> 💡 **`pm2` (normal) vs `pm2-runtime`**: o comando `pm2` de sempre foi feito para rodar numa máquina/VM tradicional — ele inicia um daemon em background e devolve o controle do terminal na hora (`pm2 start app.js` retorna imediatamente, com o processo real continuando "escondido"). Dentro de um container, isso é um problema: o Docker considera que o container "terminou" assim que o comando do `CMD` retorna — e um daemon que já se desprendeu do processo principal não conta. O `pm2-runtime` existe justamente para isso: ele roda em primeiro plano, tornando-se o próprio PID 1 do container, exatamente como esperado por qualquer processo "principal" de uma imagem Docker.

**2.** (Passo já coberto na seção 6.1, repetido aqui por completude) confirme que o `package.json` tem o script `"prod": "pm2-runtime start ecosystem.config.cjs"`.

### Como confirmar que deu certo (o teste final da Fase 6)

**1.** Construa **só** a imagem de produção (sem passar pelo `docker-compose.yml`, que continua usando o estágio `dev`):

```bash
docker build --target production -t jurisengine:prod .
```

**2.** Garanta que o banco e o Redis do seu ambiente de desenvolvimento já estão no ar (para reaproveitar — não precisa subir outra cópia deles):

```bash
docker compose up -d db redis
```

**3.** Rode a imagem de produção, conectando-a à mesma rede do Docker Compose (assim ela enxerga os serviços `db` e `redis` pelo nome):

```bash
docker network ls | grep sistema_treino   # confirme o nome exato da rede criada pelo compose
docker run --rm -it \
  --network sistema_treino_default \
  -p 3000:3000 \
  --env-file .env \
  -e DB_HOST=jurisengine_db \
  -e REDIS_HOST=jurisengine_redis \
  --name jurisengine_prod_test \
  jurisengine:prod
```

> Os nomes de container (`jurisengine_db`, `jurisengine_redis`) funcionam como hostname dentro da rede do Compose, da mesma forma que `db`/`redis` funcionam quando os serviços fazem parte do MESMO arquivo `docker-compose.yml` — aqui estamos conectando um container "avulso" (fora do compose) a essa mesma rede.

**4.** No terminal, você deve ver a saída característica do PM2 (uma tabela com `jurisengine-api` × N instâncias e `jurisengine-worker` × 2 instâncias, todas `online`). Teste a API normalmente:

```bash
curl http://localhost:3000/health
```

**5.** Confirme o paralelismo de verdade — dispare várias requisições simultâneas e observe, nos logs (`docker logs -f jurisengine_prod_test`), que elas são atendidas por **PIDs diferentes** (o PM2 identifica cada instância de cluster):

```bash
for i in 1 2 3 4 5 6; do curl -s http://localhost:3000/health & done; wait
```

**6.** Encerre com `Ctrl+C` (ou `docker stop jurisengine_prod_test` em outro terminal) e confirme, nos logs, que aparecem as mensagens de encerramento gracioso que já existiam desde a Fase 4/5 (`[Server] Recebido SIGTERM, encerrando...` / `[worker:lawsuit-sync] Recebido SIGTERM, encerrando...`) — sinal de que o `pm2-runtime` está repassando o sinal corretamente para cada processo gerenciado.

---

## 📁 Estrutura de pastas e arquivos — o que foi adicionado/alterado nesta fase

```
Sistema_Treino/
├── ecosystem.config.cjs         ← NOVO
├── Dockerfile                    ← ALTERADO (estágio "production" usa pm2-runtime)
├── docker-compose.yml            ← ALTERADO (correção de bug: worker agora builda target "dev")
├── package.json                   ← ALTERADO (+script "prod", +dependência "pm2")
└── src/
    ├── websocket/
    │   └── socket.ts               ← ALTERADO (Redis Adapter + transports: ['websocket'])
    └── scripts/
        └── testeSocket.ts          ← ALTERADO (cliente também restrito a transports: ['websocket'])
```

---

✅ **Fim da Fase 6.** O projeto agora tem dois modos de execução bem definidos: **desenvolvimento** (`docker compose up`, hot-reload, um processo por serviço) e **produção** (`docker build --target production` + PM2, múltiplas instâncias por núcleo de CPU, reinício automático em caso de falha, encerramento gracioso coordenado). Nenhuma lógica de negócio mudou — a Fase 6 é inteiramente sobre **como** o mesmo código roda em escala, não sobre o que ele faz.
