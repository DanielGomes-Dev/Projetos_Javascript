# 08 — Adicionando PostgreSQL ao Docker Compose

## 🎯 Objetivo

Subir um banco PostgreSQL containerizado, ao lado da API — ainda **sem nenhum código** falando com ele (isso vem no passo 09). Este passo é só sobre a infraestrutura existir e estar saudável.

## 📝 Código

Edite `.env` e `.env.example`, acrescentando as variáveis do banco (a primeira vez que este projeto precisa delas):

```dotenv
PORT=3000

DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=juris_db
```

> 💡 **Por que `DB_HOST=db`, e não `localhost`?** Dentro da rede interna que o Docker Compose cria automaticamente, cada serviço enxerga os outros pelo **nome do serviço** (definido no `docker-compose.yml`, próximo bloco) — não por `localhost`. `db` só vai funcionar como hostname quando você estiver rodando a API **dentro** do Docker (que é o caso agora). Se um dia você rodar a API fora do Docker (com `npm run dev` direto na sua máquina, contra um Postgres containerizado com a porta exposta), aí sim usaria `DB_HOST=localhost`.

Edite `docker-compose.yml`, adicionando o serviço `db` e conectando a API a ele:

```yaml
services:
  api:
    build:
      context: .
      target: dev
    container_name: jurisengine_api
    ports:
      - "${PORT:-3000}:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: ${DB_USER:-postgres}
      DB_PASS: ${DB_PASS:-postgres}
      DB_NAME: ${DB_NAME:-juris_db}
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
    depends_on:
      db:
        condition: service_healthy
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
      - juris_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-juris_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  juris_db_data:
```

Explicando as peças novas:
- **`depends_on: db: condition: service_healthy`** — a API só inicia depois que o `healthcheck` do banco reportar sucesso, evitando a API tentar conectar num Postgres que ainda está inicializando (comum nos primeiros segundos de um `docker compose up`).
- **`healthcheck`** — roda `pg_isready` (uma ferramenta que já vem na imagem oficial do Postgres) a cada 5 segundos, até 5 tentativas, para decidir quando o serviço está "de pé" de verdade.
- **`volumes: juris_db_data`** — sem isso, os dados do Postgres viveriam só dentro do container, e um `docker compose down` apagaria tudo. Com o volume nomeado, os dados persistem em disco entre reinícios.
- **`${DB_USER:-postgres}`** — sintaxe do Docker Compose para "use a variável de ambiente `DB_USER` se ela existir (lida do `.env` automaticamente pelo Compose), senão use `postgres` como padrão".

## ✅ Como confirmar que funcionou

```bash
docker compose up --build
```

Em outro terminal, confirme que o banco aceita conexões:

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "SELECT 1;"
```

Deve retornar uma linha com `1`. A API também deve continuar respondendo normalmente (`curl http://localhost:3000/health`) — ela ainda não usa o banco, só está rodando ao lado dele.

## 🔧 Commit sugerido

```bash
git add .env.example docker-compose.yml
git commit -m "chore: adicionar postgresql ao docker-compose"
```
