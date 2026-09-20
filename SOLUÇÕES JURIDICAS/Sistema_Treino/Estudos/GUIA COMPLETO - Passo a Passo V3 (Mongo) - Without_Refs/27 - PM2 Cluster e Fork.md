# 27 — PM2: Cluster e Fork

## 🎯 Objetivo

Definir COMO cada processo (API e Worker) deveria rodar em produção — quantas cópias, e de que tipo — sem ainda mexer no Dockerfile (isso é o próximo passo). Esta fase não cria nenhuma lógica de negócio nova: ela decide como o código que já existe roda em escala.

## 📦 Instalar

```bash
npm install pm2
```

> Repare que `pm2` vai em **dependencies**, não `devDependencies` — ele precisa estar disponível na imagem de produção (passo 28), que só instala `dependencies`.

## 📝 Código

Crie `ecosystem.config.cjs` na raiz:

```javascript
// ecosystem.config.cjs
//
// Config do PM2 — descreve QUAIS processos rodar em produção e COMO.
// Só entra em cena no estágio de produção do Dockerfile (próximo
// passo); em desenvolvimento continuamos usando `tsx watch` normalmente.

module.exports = {
  apps: [
    {
      // ── API REST (+ Socket.IO) — modo CLUSTER ──────────────────
      name: 'jurisengine-api',
      script: 'dist/server.js', // JavaScript já compilado (npm run build)

      // "cluster": o PM2 usa o módulo cluster nativo do Node para
      // rodar VÁRIAS cópias do mesmo processo, todas escutando a
      // MESMA porta — o Node faz o balanceamento entre elas
      // internamente. Faz sentido para a API porque ela é
      // CPU/IO-bound por requisição, sem estado compartilhado em
      // memória entre requisições diferentes.
      exec_mode: 'cluster',

      // 'max': uma instância por núcleo de CPU disponível.
      instances: 'max',

      env: { NODE_ENV: 'production' },
    },
    {
      // ── Worker de sincronização — modo FORK ────────────────────
      name: 'jurisengine-worker',
      script: 'dist/workers/lawsuitSync.worker.js',

      // "fork": cada instância é um processo independente, sem
      // relação de balanceamento de porta (o worker não abre porta
      // HTTP nenhuma). Rodar várias cópias em fork é simplesmente
      // rodar o mesmo script várias vezes, competindo pelos mesmos
      // jobs na fila — o BullMQ garante que cada job só vai para UM
      // worker por vez (lock interno no Redis).
      exec_mode: 'fork',
      instances: 2,

      env: { NODE_ENV: 'production' },
    },
  ],
};
```

> 💡 **Cluster vs. fork, em uma frase.** *Cluster* é para "várias cópias dividindo o trabalho de UMA porta HTTP"; *fork* é para "várias cópias competindo por itens de UMA fila", sem porta nenhuma envolvida. A API precisa da primeira coisa; o Worker, da segunda.

Adicione o script `prod` ao `package.json`:

```json
{
  "scripts": {
    "prod": "pm2-runtime start ecosystem.config.cjs"
  }
}
```

> 💡 **`pm2-runtime`, não `pm2`.** O comando `pm2` normal se comporta como um daemon: ele inicia os processos e devolve o controle do terminal na hora, rodando tudo em segundo plano — dentro de um container Docker isso é fatal, porque o container encerra assim que seu processo principal (PID 1) termina, e um daemon que "se solta" do terminal conta como terminado do ponto de vista do Docker. `pm2-runtime` é a variante feita exatamente para containers: roda em primeiro plano, então o Docker o mantém vivo.

## ✅ Como confirmar que funcionou

Ainda sem Dockerfile de produção (próximo passo), teste localmente:

```bash
npm run build
npm run prod
```

Deve mostrar a tabela do PM2 com várias linhas `jurisengine-api` (uma por núcleo de CPU) e duas `jurisengine-worker`, todas `online`. `Ctrl+C` para encerrar.

## 🔧 Commit sugerido

```bash
git add ecosystem.config.cjs package.json package-lock.json
git commit -m "feat: configurar pm2 para producao (api em cluster, worker em fork)"
```
