# 28 — Dockerfile de Produção

## 🎯 Objetivo

Acrescentar os estágios `build` e `production` ao `Dockerfile` (criado no passo 07, só com o estágio `dev`) — uma imagem final enxuta, que roda via PM2 (passo 27).

## 📝 Código

Edite `Dockerfile`, acrescentando os novos estágios **depois** do estágio `dev` já existente:

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Base: dependências compartilhadas ----------
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---------- Dev: usada pelo docker-compose no dia a dia ----------
FROM base AS dev
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- Build: compila o TypeScript ----------
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# ---------- Production: imagem final, enxuta ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# `npm ci --omit=dev` NUNCA instala devDependencies — é por isso que o
# passo 27 insistiu para "pm2" ir em "dependencies", não "devDependencies".
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY ecosystem.config.cjs ./
EXPOSE 3000
# Chamamos o binário DIRETO (node_modules/.bin/pm2-runtime), em vez de
# `npm run prod`: `npm run <script>` insere um processo `sh -c` no meio
# do caminho, que atrapalha o repasse de sinais do Docker (SIGTERM ao
# rodar `docker stop`) para o pm2-runtime — e sem o SIGTERM chegando
# corretamente, o desligamento gracioso do server.ts e do worker
# (implementado desde os passos 06/20) nunca dispara.
CMD ["node_modules/.bin/pm2-runtime", "start", "ecosystem.config.cjs"]
```

> 💡 **Por que 4 estágios, e não construir a imagem de produção diretamente?** Cada estágio existe por um motivo específico: `base` evita repetir `COPY package*.json` três vezes; `dev` prioriza velocidade de iteração (hot-reload, todas as ferramentas disponíveis) às custas de uma imagem maior; `build` roda `npm run build` num ambiente isolado, sem misturar suas dependências com a imagem final; `production` copia **só** o resultado compilado (`dist/`) e as dependências de produção — nada de código-fonte `.ts`, nada de devDependencies, nada de ferramentas de build. O resultado é uma imagem bem menor e com uma superfície de ataque bem menor (menos coisa instalada = menos coisa que pode ter uma vulnerabilidade).

## ✅ Como confirmar que funcionou

```bash
docker build --target production -t jurisengine:prod .
docker network ls | grep sistema_treino   # descubra o nome da rede do docker-compose

docker run --rm -it \
  --network sistema_treino_default \
  -p 3000:3000 \
  --env-file .env \
  -e MONGODB_URI=mongodb://jurisengine_mongo:27017/juris_db \
  -e REDIS_HOST=jurisengine_redis \
  jurisengine:prod
```

(Garanta que `mongo`/`redis` do passo 08/17 já estejam de pé: `docker compose up -d mongo redis`.)

Deve mostrar a tabela do PM2, todos os processos `online`. `curl http://localhost:3000/health` deve responder normalmente.

## 🔧 Commit sugerido

```bash
git add Dockerfile
git commit -m "feat: adicionar estagio de producao ao dockerfile com pm2-runtime"
```

## 📚 Documentação Oficial

- **Docker — Multi-stage builds**: https://docs.docker.com/build/building/multi-stage/
- **Docker — referência do `Dockerfile`**: https://docs.docker.com/reference/dockerfile/
- **npm — `npm ci` (incluindo `--omit=dev`)**: https://docs.npmjs.com/cli/v11/commands/npm-ci
- **PM2 — `pm2-runtime` e repasse de sinais em containers**: https://pm2.keymetrics.io/docs/usage/docker-pm2-nodejs/
- **Docker — `docker stop` e `SIGTERM`**: https://docs.docker.com/reference/cli/docker/container/stop/
