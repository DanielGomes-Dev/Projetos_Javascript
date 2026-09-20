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
