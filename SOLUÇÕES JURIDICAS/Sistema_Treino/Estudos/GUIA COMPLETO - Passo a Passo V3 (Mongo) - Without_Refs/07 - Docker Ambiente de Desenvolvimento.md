# 07 — Docker: Ambiente de Desenvolvimento

## 🎯 Objetivo

Conseguir rodar a API dentro de um container Docker — o primeiro passo para "funciona na minha máquina" deixar de ser um problema. Ainda **sem banco de dados** neste passo: só a API sozinha, confirmando que a imagem builda e roda.

## Pré-requisito

Docker Desktop instalado (`docker -v` e `docker compose version` devem funcionar no terminal).

## 📝 Código

Crie `Dockerfile` na raiz:

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
```

> 💡 **Por que já usar `AS base` e `AS dev`, se por enquanto só existe um estágio de verdade?** Este `Dockerfile` vai crescer — o passo 28 acrescenta estágios `build` e `production`. Nomear os estágios desde já (em vez de reescrever tudo depois) deixa cada adição futura sendo só "acrescentar mais um bloco `FROM ... AS ...`" no fim do arquivo, sem tocar no que já funciona.

Crie `docker-compose.yml` na raiz, só com o serviço `api` por enquanto:

```yaml
services:
  api:
    build:
      context: .
      target: dev
    container_name: jurisengine_api
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
    restart: unless-stopped
```

> 💡 **Por que montar `./src`, `package.json` e `tsconfig.json` como volumes, em vez de deixar só o que foi copiado no build (`COPY . .` do Dockerfile)?** Um volume "espelha" um caminho da sua máquina para dentro do container **em tempo real** — quando você salva um arquivo `.ts` no seu editor, o `tsx watch` (rodando dentro do container, via `npm run dev`) enxerga a mudança na hora e reinicia sozinho. Sem os volumes, você precisaria reconstruir a imagem (`docker compose up --build`) a cada alteração de código — inviável para o dia a dia de desenvolvimento.

Adicione um `.dockerignore` (evita copiar `node_modules` da sua máquina para dentro da imagem, o que além de lento poderia trazer binários da plataforma errada — Windows/Mac em vez de Linux):

```
node_modules
dist
.git
.env
```

## ✅ Como confirmar que funcionou

```bash
docker compose up --build
```

Em outro terminal:

```bash
curl http://localhost:3000/health
```

Deve responder `{"status":"ONLINE"}`, com a resposta vindo de **dentro do container** (confira nos logs do primeiro terminal — deve aparecer `[Server] Rodando na porta 3000`).

## 🔧 Commit sugerido

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "chore: adicionar docker para ambiente de desenvolvimento"
```
