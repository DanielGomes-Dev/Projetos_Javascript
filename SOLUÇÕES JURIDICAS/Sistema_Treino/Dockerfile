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