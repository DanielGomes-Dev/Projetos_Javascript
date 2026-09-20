# Fase 1 — Configuração do Ambiente e Infraestrutura Base

> Objetivo desta fase: sair de uma pasta vazia para um projeto Node.js/TypeScript com padrão de código definido (ESLint) e capaz de rodar em **qualquer máquina** através do Docker, com PostgreSQL já containerizado. Ao final desta fase você ainda não terá nenhuma rota HTTP — isso é intencional, é a fundação.

---

## 1.1. Inicialização do Projeto

### O que vamos construir e por quê

Todo projeto Node.js começa com um `package.json` — é o "RG" do projeto: nome, versão, dependências, e os *scripts* (atalhos de terminal) que vamos usar o tempo todo (`npm run dev`, `npm run build`, etc.). Precisamos também dizer ao Git o que **não** versionar (como o `node_modules`, que tem milhares de arquivos gerados, e o `.env`, que tem senhas).

### Passo a passo

**1.** Crie a pasta do projeto e entre nela:

```bash
mkdir Sistema_Treino
cd Sistema_Treino
```

**2.** Inicialize o `package.json` sem passar pelas perguntas interativas (aceitando os padrões):

```bash
npm init -y
```

> `npm init` cria o `package.json`. A flag `-y` ("yes") responde automaticamente "sim" para todas as perguntas (nome do pacote, versão, etc.), usando os valores padrão. É mais rápido para começar; você edita o arquivo manualmente depois.

**3.** Abra o `package.json` gerado e adicione (ou confirme) a linha `"type": "module"`. Isso diz ao Node.js que este projeto usa a sintaxe moderna de módulos ECMAScript (`import`/`export`) em vez do estilo antigo (`require`/`module.exports`) — é o padrão que usamos em **todo** o código TypeScript deste projeto:

```json
{
  "name": "sistema_treino",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

> 📝 **Nota do professor:** guarde este arquivo mentalmente — ao longo de todo o guia vamos **acrescentar** dependências e scripts a ele. Nunca reescreva o `package.json` do zero; cada fase só adiciona linhas novas às seções `scripts`, `dependencies` e `devDependencies`.

**4.** Crie o arquivo `.gitignore` na raiz do projeto:

```gitignore
node_modules/
.env
dist/
*.log
.DS_Store
```

Explicando cada linha:
- `node_modules/` — a pasta onde o `npm install` baixa todas as dependências. Ela pode ter **centenas de MB**; nunca deve ir para o Git, pois é 100% reconstruível a partir do `package.json` rodando `npm install`.
- `.env` — o arquivo com as variáveis de ambiente **reais** (senhas, hosts, etc. do seu ambiente local). Se ele vazar para um repositório público, qualquer pessoa vê suas credenciais. Por isso versionamos apenas um "molde" (`.env.example`), nunca o `.env` de verdade.
- `dist/` — a pasta de saída do build do TypeScript (JavaScript compilado). É gerada pelo comando `npm run build` (veremos na seção 1.2) e não deve ser versionada, só gerada no momento do deploy.
- `*.log` — qualquer arquivo de log gerado localmente.
- `.DS_Store` — arquivo de metadados que o macOS cria automaticamente em pastas (irrelevante no Windows/Linux, mas é boa prática já deixar ignorado).

**5.** Crie o arquivo `.env.example` — o **molde público** das variáveis de ambiente. Ele documenta quais variáveis o projeto espera, com valores fictícios/óbvios, para que qualquer pessoa que clone o repositório saiba o que preencher no seu próprio `.env` (que não é versionado):

```dotenv
# ── Aplicação ──────────────────────────────
NODE_ENV=development
PORT=3000

# ── Banco de dados (PostgreSQL) ─────────────
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=juris_db

# ── As variáveis abaixo só entram em uso na Fase 4 ──
# (Redis / BullMQ / Bull Board) — deixe comentadas por
# enquanto, ou preenchidas com os valores padrão abaixo.
# REDIS_HOST=redis
# REDIS_PORT=6379
# ADMIN_USER=admin
# ADMIN_PASS=troque_essa_senha
# LAWSUIT_SYNC_CONCURRENCY=5
```

> 💡 Por que `DB_HOST=db` e não `localhost`? Porque, quando a API roda **dentro** do Docker Compose (que vamos configurar na seção 1.3), o nome do serviço do banco (`db`, definido no `docker-compose.yml`) funciona como um "hostname" dentro da rede interna do Docker. Se você rodar a API fora do Docker (direto na sua máquina, com `npm run dev`) enquanto o banco está no Docker, troque para `DB_HOST=localhost`, já que a porta do Postgres está exposta (`5432:5432`) para fora do container.

**6.** Copie o `.env.example` para `.env` e ele será o arquivo que a aplicação realmente lê (nunca commitado):

```bash
cp .env.example .env
```

### Como confirmar que deu certo

Rode `cat package.json` (ou abra o arquivo) e confirme que existe `"type": "module"`. Rode `ls -a` e confirme que `.gitignore`, `.env` e `.env.example` existem na raiz.

---

## 1.2. Qualidade de Código (ESLint + suporte a TypeScript)

### O que vamos construir e por quê

O **ESLint** é um analisador estático: ele lê seu código sem executá-lo e aponta problemas — desde erros reais (uma variável usada antes de existir) até desvios de estilo (aspas simples vs. duplas). Ele existe para que um time inteiro escreva código com a **mesma cara**, e para pegar bugs bobos antes de rodar o programa.

Como este projeto é escrito em **TypeScript** (não em JavaScript puro), o ESLint precisa ser configurado com o parser e as regras específicas do TypeScript — é isso que o assistente interativo abaixo faz por você.

### Passo a passo

**1.** Rode o inicializador oficial do ESLint:

```bash
npx eslint --init
```

> `npx` executa um pacote sem precisar instalá-lo globalmente antes. O `eslint --init` (também poderia ser `npm init @eslint/config`) faz uma série de perguntas:

| Pergunta | Resposta usada neste projeto |
|---|---|
| Como você quer usar o ESLint? | Verificar sintaxe e encontrar problemas |
| Que tipo de módulos seu código usa? | JavaScript modules (import/export) |
| Qual framework? | Nenhum (*None of these* — Express roda em Node puro) |
| Usa TypeScript? | **Sim** |
| Onde o código roda? | Node |
| Formato do arquivo de config? | O instalador, ao detectar TypeScript no projeto, gera um `eslint.config.mts` (config em **TypeScript com módulos ES**) |

Ao final, o assistente instala sozinho as dependências necessárias e cria o arquivo de configuração.

**2.** Você vai perceber que o comando `npm run lint` (que criaremos já já) falha inicialmente com um erro do tipo `Cannot find module 'jiti'` ou similar. Isso acontece porque o arquivo de configuração gerado tem a extensão **`.mts`** — TypeScript com suporte nativo a módulos ES — e o ESLint (que roda sobre Node.js puro) precisa de uma ferramenta para **interpretar TypeScript em tempo real** só para conseguir *ler o próprio arquivo de configuração*. Essa ferramenta é o `jiti`:

```bash
npm install -D jiti
```

> **O que é o `jiti`?** Um carregador de runtime (*runtime loader*) que permite ao Node.js executar arquivos `.ts`/`.mts` diretamente, sem um passo de compilação manual antes. Ferramentas populares (ESLint, Nuxt, Tailwind, Docusaurus) o usam por baixo dos panos exatamente para ler seus próprios arquivos de configuração escritos em TypeScript "on the fly".

**3.** Confirme (ou ajuste manualmente) o conteúdo final de `eslint.config.mts`:

```typescript
// eslint.config.mts
//
// Config "flat" do ESLint (o formato moderno, que substitui o antigo
// .eslintrc). É um array de objetos de configuração — cada objeto pode
// se aplicar a um conjunto de arquivos diferente.

import js from "@eslint/js";                 // regras básicas de JavaScript (ex: "no-unused-vars")
import globals from "globals";                 // define quais variáveis globais existem (window, process, etc.)
import tseslint from "typescript-eslint";       // parser + regras específicas de TypeScript
import { defineConfig } from "eslint/config";    // helper que dá autocomplete/checagem de tipos na config

export default defineConfig([
  {
    // Aplica-se a todo arquivo JS/TS/variantes do projeto.
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],       // conjunto de regras recomendadas para JS puro
    languageOptions: { globals: globals.browser },
  },
  // Acrescenta o conjunto de regras recomendadas do typescript-eslint
  // (detecta erros específicos de tipos, uso indevido de `any`, etc.).
  tseslint.configs.recommended,
]);
```

**4.** Instale o TypeScript e o executor de desenvolvimento `tsx` (usados pelo projeto inteiro a partir daqui, não só pelo ESLint):

```bash
npm install -D typescript tsx @types/node
```

> - **`typescript`** — o compilador oficial (`tsc`), que traduz `.ts` para `.js` puro (usado no `npm run build`, para produção).
> - **`tsx`** — um executor que roda arquivos `.ts` **diretamente**, sem gerar arquivos `.js` intermediários, ideal para desenvolvimento (com `--watch`, reinicia sozinho a cada alteração salva).
> - **`@types/node`** — as definições de tipo das APIs nativas do Node (`process`, `Buffer`, etc.), para o TypeScript "entender" essas globais.

**5.** Crie o `tsconfig.json` na raiz do projeto — ele configura **como** o TypeScript deve compilar/checar o código:

```jsonc
{
  "compilerOptions": {
    "target": "esnext",              // gera JavaScript usando os recursos mais modernos da linguagem
    "module": "NodeNext",             // sistema de módulos: segue exatamente como o Node.js resolve import/export
    "moduleResolution": "NodeNext",   // como o TS encontra os arquivos ao resolver um "import"
    "lib": ["ES2022"],                 // quais APIs de JS o TS reconhece como disponíveis (Promise, Array.at, etc.)
    "outDir": "./dist",                 // pasta de saída do `tsc` (build de produção)
    "rootDir": "./src",                  // pasta raiz do código-fonte
    "strict": false,                      // desativa o modo mais rígido de checagem de tipos (projeto de estudo)
    // "strict": true,                    // <- ligue este quando quiser todo o rigor do TS (recomendado em produção)

    "esModuleInterop": true,               // permite `import express from 'express'` mesmo em libs antigas (CommonJS)
    "skipLibCheck": true,                   // não perde tempo checando tipos dentro de node_modules (mais rápido)

    "forceConsistentCasingInFileNames": true, // erro se o import usar maiúsculas/minúsculas diferente do nome real do arquivo
    "rewriteRelativeImportExtensions": true,   // permite escrever `import './app.js'` mesmo apontando para `app.ts`
    "erasableSyntaxOnly": true                  // só permite sintaxe TS que "some" na compilação (nada que dependa de runtime especial)
  },
  "include": ["src/**/*"]
}
```

> ⚠️ **Por que os imports no código terminam em `.js` e não `.ts`?** Você vai reparar, em todo o projeto, imports como `import app from './app.js';` mesmo dentro de um arquivo `.ts`. Isso **não é engano**. Sob `"module": "NodeNext"`, o Node.js (em tempo de execução, depois de compilado) só entende extensões reais de arquivo — e o arquivo final, depois do `tsc`, se chama `app.js`. A opção `rewriteRelativeImportExtensions` permite que você escreva `.js` no código-fonte `.ts` e o compilador entenda que é uma referência ao arquivo `.ts` correspondente. É a convenção oficial do TypeScript moderno com ESM.

**6.** Adicione ao `package.json` os primeiros scripts de execução e o script de lint:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "rimraf dist && tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/**/*.ts",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

Explicando cada um:
- **`dev`** — usa o `tsx` em modo `watch` (observa arquivos e reinicia sozinho a cada `Ctrl+S`) para rodar `src/server.ts` direto em TypeScript, sem build. É o comando do dia a dia.
- **`build`** — apaga a pasta `dist/` antiga (`rimraf` é um `rm -rf` multiplataforma, funciona igual no Windows) e roda `tsc`, que compila todo `src/**/*.ts` para `dist/**/*.js`.
- **`start`** — roda a versão **já compilada** (`dist/server.js`) com o Node puro. É o comando usado em produção (depois do `build`).
- **`lint`** — roda o ESLint sobre todos os arquivos `.ts` dentro de `src/` (o padrão `src/**/*.ts` é um *glob*: `**` = qualquer subpasta recursivamente, `*.ts` = qualquer arquivo `.ts`).

Instale o `rimraf`, usado no script `build`:

```bash
npm install -D rimraf
```

**7.** Crie um `src/server.ts` mínimo só para o lint e o `dev` terem algo para rodar (vamos reescrevê-lo de verdade na Fase 3):

```typescript
console.log('JurisEngine — em construção');
```

### Como confirmar que deu certo

```bash
npm run lint
```

Deve rodar sem erros de configuração (pode reclamar do `console.log`, sem problema — vamos remover esse arquivo provisório na Fase 3). E:

```bash
npm run dev
```

Deve imprimir `JurisEngine — em construção` no terminal e ficar "vivo" (watch mode) — pressione `Ctrl+C` para encerrar.

---

## 1.3. Containerização Inicial (Docker & Docker Compose)

### O que vamos construir e por quê

Até aqui, o projeto só roda "na sua máquina". Se outra pessoa (ou você, daqui a 6 meses, num computador novo) tentar rodar, vai precisar instalar exatamente a versão certa do Node, do PostgreSQL, configurar tudo manualmente... O **Docker** resolve isso: empacota a aplicação (e suas dependências de sistema) numa "caixa" (*container*) que roda **igual** em qualquer lugar. O **Docker Compose** orquestra **várias** dessas caixas ao mesmo tempo (aqui: a API e o banco de dados) como se fossem um único sistema.

### Passo a passo

**1.** Crie o `Dockerfile` na raiz do projeto. Ele usa a técnica de **multi-stage build** — várias "receitas" dentro do mesmo arquivo, cada uma otimizada para um propósito (desenvolvimento vs. produção):

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
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Explicando cada estágio, como um professor destrinchando o "porquê" de cada linha:

- **`FROM node:22-alpine AS base`** — parte de uma imagem oficial do Node 22 na variante `alpine` (uma distro Linux minúscula, poucos MB), e dá o apelido `base` a esse estágio, para reutilizá-lo depois.
- **`WORKDIR /app`** — define `/app` como a pasta de trabalho **dentro** do container; todo comando seguinte (`COPY`, `RUN`) acontece relativo a ela.
- **`COPY package*.json ./`** — copia só `package.json` **e** `package-lock.json` (o `*` casa com ambos) **antes** de copiar o resto do código. Isso é uma otimização de cache do Docker: se o código-fonte mudar mas as dependências não, o Docker reaproveita a camada do `npm ci` já rodado, em vez de reinstalar tudo do zero a cada build.
- **`FROM base AS dev`** — um segundo estágio que **parte** do estágio `base` (reaproveitando o que já foi copiado).
  - **`RUN npm ci`** — instala as dependências **exatamente** como travadas no `package-lock.json` (diferente do `npm install`, o `ci` nunca atualiza o lockfile — ele falha se o lockfile e o `package.json` estiverem dessincronizados; ideal para builds reprodutíveis).
  - **`COPY . .`** — copia todo o resto do código-fonte para dentro do container.
  - **`EXPOSE 3000`** — documenta que este container escuta na porta 3000 (não abre a porta por si só — quem faz isso é o `docker-compose.yml`, com `ports:`).
  - **`CMD ["npm", "run", "dev"]`** — comando executado quando o container **inicia**. Note que este estágio roda `npm run dev` (com hot-reload), então é usado só em desenvolvimento — nunca em produção.
- **`FROM base AS build`** — outro estágio, também partindo de `base`, mas cujo único propósito é **compilar** o TypeScript (`npm run build`), gerando a pasta `dist/`. Esse estágio nunca vira uma imagem final rodando — ele só existe para produzir arquivos que o próximo estágio vai copiar.
- **`FROM node:22-alpine AS production`** — o estágio final, que começa **do zero** (não herda do `base`, para ficar o menor possível):
  - Copia só o `package.json`, roda `npm ci --omit=dev` (instala **só** as dependências de produção, sem `devDependencies` como `typescript`, `eslint`, `tsx` — a imagem final fica bem mais enxuta).
  - **`COPY --from=build /app/dist ./dist`** — copia **apenas a pasta `dist/` já compilada** do estágio `build` anterior — o código-fonte `.ts`, o `node_modules` de dev, tudo isso fica para trás, não vai para a imagem de produção.
  - `CMD ["node", "dist/server.js"]` — roda o JavaScript já compilado, direto com o Node puro (mais rápido para iniciar que `tsx`, e sem dependências extras).

> 💡 O ganho do multi-stage build: a imagem de **produção** não carrega o `typescript`, o `tsx`, o código-fonte `.ts` nem o ESLint — só o JavaScript final e as dependências de runtime. Isso reduz o tamanho da imagem e a superfície de ataque.

**2.** Crie o `docker-compose.yml` na raiz do projeto. Nesta fase, ele orquestra só a **API** e o **banco de dados** (o Redis e o Worker entram na Fase 4):

```yaml
services:
  api:
    build:
      context: .
      target: dev            # usa o estágio "dev" do Dockerfile (hot-reload)
    container_name: jurisengine_api
    ports:
      - "${PORT:-3000}:3000"   # <porta da sua máquina>:<porta dentro do container>
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3000
      DB_HOST: db               # nome do serviço abaixo — funciona como hostname na rede interna do Compose
      DB_PORT: 5432
      DB_USER: ${DB_USER:-postgres}
      DB_PASS: ${DB_PASS:-postgres}
      DB_NAME: ${DB_NAME:-juris_db}
    volumes:
      - ./src:/app/src                     # espelha seu código-fonte local dentro do container (hot-reload real)
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
    depends_on:
      db:
        condition: service_healthy         # só inicia a API depois que o banco responder "estou pronto"
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: jurisengine_db
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASS:-postgres}
      POSTGRES_DB: ${DB_NAME:-juris_db}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - juris_db_data:/var/lib/postgresql/data   # persiste os dados do banco fora do ciclo de vida do container
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-juris_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  juris_db_data:
```

Explicando os conceitos-chave:

- **`${PORT:-3000}`** — sintaxe de variável de ambiente com valor padrão: usa a variável `PORT` (definida no seu `.env`, que o `docker compose` lê automaticamente se estiver na raiz do projeto), e se ela não existir, usa `3000`.
- **`build.target: dev`** — diz ao Compose "ao construir a imagem deste serviço, pare no estágio chamado `dev` do Dockerfile" (em vez de ir até o final, que seria o estágio `production`).
- **`volumes: - ./src:/app/src`** — um *bind mount*: a pasta `src/` da sua máquina é "colada" dentro do container. Assim, quando você edita um arquivo no seu editor, o container enxerga a mudança instantaneamente (e o `tsx watch`, do `npm run dev`, reinicia sozinho) — sem precisar reconstruir a imagem a cada alteração.
- **`depends_on: db: condition: service_healthy`** — a API só inicia depois que o `healthcheck` do banco passar. Sem isso, a API poderia tentar conectar no Postgres **antes** dele estar pronto para aceitar conexões, e falhar na inicialização.
- **`healthcheck`** — o Compose roda periodicamente (`interval: 5s`) o comando `pg_isready` **dentro** do container do banco; até 5 tentativas (`retries: 5`) antes de considerar o serviço "não saudável".
- **`volumes: juris_db_data:` (no final, fora de `services`)** — declara um **volume nomeado**, gerenciado pelo próprio Docker (fica fora da pasta do projeto, em uma área interna do Docker). Ele guarda os dados reais do PostgreSQL (`/var/lib/postgresql/data`, dentro do container). Sem isso, **todo dado seria perdido** ao remover o container (`docker compose down`) — o container em si é descartável, mas o volume sobrevive.

**3.** Suba tudo pela primeira vez:

```bash
docker compose up --build
```

> `--build` força a reconstrução das imagens (necessário na primeira vez, ou sempre que você mudar o `Dockerfile`/`package.json`). Nas próximas vezes, `docker compose up` (sem `--build`) já é suficiente se nada mudou nas dependências.

### Como testar a persistência de dados com volumes (validação do TODO)

Esse é um teste importante — comprova que os dados **sobrevivem** mesmo destruindo o container:

**1.** Com os containers no ar, entre no psql dentro do container do banco e crie uma tabela de teste:

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "CREATE TABLE teste_persistencia (id serial primary key, nota text);"
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "INSERT INTO teste_persistencia (nota) VALUES ('sobrevivi ao restart');"
```

**2.** Derrube os containers **sem** remover os volumes:

```bash
docker compose down
```

**3.** Suba de novo:

```bash
docker compose up -d
```

**4.** Confirme que a tabela e a linha ainda existem:

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "SELECT * FROM teste_persistencia;"
```

Se a linha `sobrevivi ao restart` aparecer, a persistência via volume nomeado está funcionando. Pode apagar a tabela de teste depois:

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "DROP TABLE teste_persistencia;"
```

> ⚠️ Cuidado: `docker compose down -v` (com `-v`) **remove os volumes também** — só use isso quando quiser mesmo apagar todos os dados do banco (por exemplo, para recomeçar do zero).

---

✅ **Fim da Fase 1.** Você agora tem: um projeto Node/TypeScript com ESLint configurado, e um ambiente Docker que sobe a API (ainda vazia) e um PostgreSQL persistente. Siga para `02 - Fase 2 - Banco de Dados.md`.
