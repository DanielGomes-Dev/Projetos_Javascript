# 21 — Docker: Adicionando o Serviço Worker

## 🎯 Objetivo

Fazer o Worker (passo 20) rodar como um serviço do `docker-compose.yml`, ao lado da API — o mesmo código-fonte, com outro *entrypoint*.

## 📝 Código

Edite `docker-compose.yml` (arquivo do passo 08/17), adicionando o serviço `worker`:

```yaml
  worker:
    build:
      context: .
      target: dev
    container_name: jurisengine_worker
    command: npm run worker
    restart: unless-stopped
    depends_on:
      - db
      - redis
    env_file:
      - .env
    environment:
      - REDIS_HOST=redis
    volumes:
      - .:/app
      - /app/node_modules
```

Explicando as diferenças em relação ao serviço `api`:

- **`target: dev`** — usa o **mesmo** estágio de desenvolvimento do Dockerfile (passo 07) que a API usa. Isso importa: o estágio `dev` instala **todas** as dependências (incluindo `devDependencies`, como o `tsx` que o comando abaixo precisa); um estágio de produção (que só existe a partir do passo 28) não teria `tsx` instalado, e este serviço quebraria com `tsx: not found`. Vale guardar esse detalhe — é um erro real e fácil de cometer, que aconteceu no projeto original quando o Dockerfile ganhou um estágio de produção mais tarde.
- **`command: npm run worker`** — sobrescreve o `CMD` do Dockerfile (que roda `npm run dev`, o servidor HTTP) para rodar o worker no lugar, usando a **mesma imagem**.
- **`env_file: - .env`** — carrega todas as variáveis do `.env` de uma vez, em vez de listar uma a uma em `environment:` (as duas formas são válidas; aqui variamos de propósito para você ver os dois estilos).
- **`volumes: - .:/app` e `- /app/node_modules`** — monta o projeto inteiro (não só `src/`, como a API faz) dentro do container. O segundo volume (um "volume anônimo" apontando só para `node_modules`) evita que o `node_modules` da sua máquina (que pode ter binários compilados para outro sistema operacional, se você estiver em Windows/Mac) sobrescreva o `node_modules` instalado **dentro** do container Linux.

## ✅ Como confirmar que funcionou

```bash
docker compose up --build
docker compose logs -f worker
```

Dispare uma importação (passo 19) em outro terminal e confirme que os logs do worker aparecem, exatamente como no teste manual do passo 20 — só que agora rodando inteiramente dentro do Docker.

## 🔧 Commit sugerido

```bash
git add docker-compose.yml
git commit -m "chore: adicionar worker ao docker-compose"
```
