# 08 — Adicionando MongoDB ao Docker Compose

## 🎯 Objetivo

Subir um banco MongoDB containerizado, ao lado da API — ainda **sem nenhum código** falando com ele (isso vem no passo 09). Este passo é só sobre a infraestrutura existir e estar saudável.

## 📝 Código

Edite `.env` e `.env.example`, acrescentando a variável do banco (a primeira vez que este projeto precisa dela):

```dotenv
PORT=3000

MONGODB_URI=mongodb://mongo:27017/juris_db
```

> 💡 **Uma única variável, em vez das cinco que o PostgreSQL exigiria (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`).** Drivers de MongoDB (e o Mongoose, que você vai instalar no passo 09) aceitam host, porta e nome do banco todos embutidos numa única *connection string*. É uma simplificação real do ecossistema Mongo, não uma escolha estética deste guia.
>
> 💡 **Por que `mongo` no meio da URI, e não `localhost`?** Mesma lógica de qualquer hostname de serviço dentro do Docker Compose: na rede interna que o Compose cria automaticamente, cada serviço enxerga os outros pelo **nome do serviço** (definido no `docker-compose.yml`, próximo bloco) — não por `localhost`. `mongo` só resolve como hostname quando a API está rodando **dentro** do Docker (o caso agora). Rodando a API fora do Docker (`npm run dev` direto na sua máquina, contra um Mongo containerizado com a porta exposta), a URI usaria `localhost` no lugar: `mongodb://localhost:27017/juris_db`.

Edite `docker-compose.yml`, adicionando o serviço `mongo` e conectando a API a ele:

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
      MONGODB_URI: mongodb://mongo:27017/juris_db
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
    depends_on:
      mongo:
        condition: service_healthy
    restart: unless-stopped

  mongo:
    image: mongo:7
    container_name: jurisengine_mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mongo_data:
```

Explicando as peças novas:
- **`depends_on: mongo: condition: service_healthy`** — a API só inicia depois que o `healthcheck` do banco reportar sucesso, evitando a API tentar conectar num Mongo que ainda está inicializando (comum nos primeiros segundos de um `docker compose up`).
- **`healthcheck`** — roda `mongosh` (o shell do MongoDB, já incluído na imagem oficial a partir da versão 6) a cada 5 segundos, até 5 tentativas, para decidir quando o serviço está "de pé" de verdade.
- **`volumes: mongo_data`** — sem isso, os dados do MongoDB viveriam só dentro do container, e um `docker compose down` apagaria tudo. Com o volume nomeado, os dados persistem em disco entre reinícios.
- Sem `POSTGRES_USER`/`POSTGRES_PASSWORD` (ou equivalente): esta configuração roda **sem autenticação**, adequada para desenvolvimento local. Um MongoDB de produção normalmente habilitaria autenticação (`MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD`) e incluiria usuário/senha na `MONGODB_URI` — fora do escopo didático deste guia.

## ✅ Como confirmar que funcionou

```bash
docker compose up --build
```

Em outro terminal, confirme que o banco aceita conexões:

```bash
docker exec -it jurisengine_mongo mongosh --eval "db.runCommand({ ping: 1 })"
```

Deve retornar `{ ok: 1 }`. A API também deve continuar respondendo normalmente (`curl http://localhost:3000/health`) — ela ainda não usa o banco, só está rodando ao lado dele.

Em resumo, este comando **testa se o seu banco de dados MongoDB está vivo, respondendo e pronto para uso** (é exatamente a mesma lógica que o `healthcheck` do seu `docker-compose.yml` faz nos bastidores).

Aqui está a explicação detalhada de cada pedacinho do comando:

* `docker exec`: É o comando do Docker usado para **executar algo dentro de um container que já está rodando**. É como se você abrisse um terminal lá dentro.
* `-it`: É a junção de duas flags (`-i` de *interactive* e `-t` de *tty*). Elas garantem que a resposta do comando seja impressa de forma bonita e legível no seu terminal.
* `jurisengine_mongo`: É o **nome exato do container** onde o comando vai ser executado (o mesmo nome que você definiu lá no `docker-compose.yml`).
* `mongosh`: É o **MongoDB Shell** moderno. É o programa nativo do Mongo usado para interagir com o banco de dados via linha de comando.
* `--eval`: É uma flag do `mongosh` que significa "avalie/execute o código a seguir e feche em seguida". Ou seja, em vez de abrir a tela do banco e ficar esperando você digitar algo, ele roda o comando de uma vez só e sai.
* `"db.runCommand({ ping: 1 })"`: É o comando interno do MongoDB propriamente dito. Ele pede para o banco de dados executar um **"ping"**.

### 💡 O que acontece quando você roda isso?

Se o banco de dados estiver rodando perfeitamente, o terminal vai te devolver algo parecido com isso:

```javascript
{ ok: 1 }

```

O `1` significa "Sucesso/Verdadeiro".

Se o container estiver desligado ou o banco de dados travado, o comando vai falhar e retornar um erro, indicando que a sua API provavelmente não conseguirá se conectar a ele.

## 🔧 Commit sugerido

```bash
git add .env.example docker-compose.yml
git commit -m "chore: adicionar mongodb ao docker-compose"
```
