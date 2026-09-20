# 12 — Docker e Redis

## 🎯 Objetivo

Adicionar Redis ao ambiente de desenvolvimento — a peça de infraestrutura que o capítulo 13 vai usar para montar uma fila técnica de processamento de matrículas. Ainda sem nenhum código consumindo o Redis: este capítulo é só sobre a infraestrutura existir e responder.

## Por que uma fila, adiantando o motivo

O desafio pede, explicitamente, que `POST /enrollments` e `PATCH /enrollments/:id/cancel` sejam seguros sob concorrência: duas requisições simultâneas para a última vaga de um curso não podem, as duas, terminar `CONFIRMADA`. O capítulo 16 mostra a garantia **definitiva** disso (updates atômicos condicionais no MongoDB, que funcionam mesmo com múltiplas instâncias do processo Node rodando). A fila técnica introduzida a partir daqui é uma camada **adicional**: serializa essas duas operações em nível de aplicação, com um único worker processando uma de cada vez — deliberadamente redundante com a garantia do banco, não uma substituta dela.

## 📝 Código

Adicione o serviço `redis` ao `docker-compose.yml` (editando o arquivo do capítulo 06):

```yaml
services:
  mongodb:
    # ... sem alteração (capítulo 06)

  redis:
    image: redis:7.2-alpine
    restart: unless-stopped
    ports:
      - "6380:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

volumes:
  mongo_data:
    driver: local
  redis_data:
    driver: local
```

> 💡 **De novo, uma porta não-padrão do lado de fora (`6380`, não `6379`)** — mesma lógica do MongoDB no capítulo 06: evita conflito com um Redis local já instalado na porta padrão.

Adicione `REDIS_URL` a `.env`/`.env.example` (editando os arquivos do capítulo 07):

```dotenv
PORT=3333
MONGO_URI=mongodb://localhost:27028/desafio_senior
REDIS_URL=redis://localhost:6380
```

## ✅ Como confirmar que funcionou

```bash
npm run db:up
docker compose ps
```

Os dois serviços (`mongodb` e `redis`) devem aparecer com status `healthy`. Confirme o Redis diretamente:

```bash
docker exec -it $(docker compose ps -q redis) redis-cli ping
```

Deve responder `PONG`.

## 🔧 Commit sugerido

```bash
git add docker-compose.yml .env.example
git commit -m "chore: adicionar redis ao ambiente de desenvolvimento"
```

## 📚 Documentação Oficial

- **Imagem oficial `redis` (Docker Hub)**: https://hub.docker.com/_/redis
- **Redis — documentação geral**: https://redis.io/docs/latest/
- **Compose — múltiplos serviços e `healthcheck`**: https://docs.docker.com/reference/compose-file/services/#healthcheck
