# 06 — Docker: Ambiente de Desenvolvimento (MongoDB)

## 🎯 Objetivo

Subir um MongoDB local, containerizado, sem precisar instalar nada além do Docker na máquina — a peça de infraestrutura que os próximos capítulos (Mongoose, models) vão precisar.

## 📝 Código

Crie `docker-compose.yml` na raiz:

```yaml
services:
  mongodb:
    image: mongo:7.0.14
    restart: unless-stopped
    ports:
      - "27028:27017"
    environment:
      - MONGO_INITDB_DATABASE=desafio_senior
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

volumes:
  mongo_data:
    driver: local
```

> 💡 **Por que a porta é `27028:27017`, e não a porta padrão `27017:27017`?** O lado esquerdo (`27028`) é a porta exposta na **sua máquina**; o lado direito (`27017`) é a porta padrão do MongoDB **dentro** do container, e não muda. Usar uma porta não-padrão do lado de fora evita conflito caso você já tenha um MongoDB "de verdade" instalado localmente na porta 27017 — os dois podem coexistir sem briga.
>
> 💡 **Para que serve o `healthcheck`?** Sem ele, o Docker considera o container "no ar" assim que o processo do Mongo inicia — mesmo que o banco ainda esteja fazendo sua inicialização interna e não aceite conexões de verdade por mais alguns segundos. O `healthcheck` roda `db.adminCommand('ping')` repetidamente até o Mongo responder de verdade, e é o que permite usar `docker compose up --wait` (mais abaixo) para só devolver o terminal quando o banco estiver **realmente** pronto para uso, não só "container criado".
>
> 💡 **`mongo_data` como volume nomeado, em vez de deixar o Mongo gravar dentro do container.** Um container Docker é, por padrão, descartável — se você o remover (`docker compose down` sem `-v`), os dados dentro dele iriam junto. Um volume nomeado guarda os dados **fora** do ciclo de vida do container, num local gerenciado pelo próprio Docker: você pode parar, recriar ou atualizar a imagem do Mongo sem perder o banco.

Adicione dois scripts utilitários ao `package.json`:

```json
{
  "scripts": {
    "db:up": "docker compose up -d --wait",
    "db:down": "docker compose down"
  }
}
```

Atualize o `.gitignore` (nada novo neste capítulo, mas é um bom momento para conferir que ele já cobre tudo até aqui):

```gitignore
node_modules/
*.log
.DS_Store
.env
```

## ✅ Como confirmar que funcionou

```bash
npm run db:up
docker compose ps
```

O serviço `mongodb` deve aparecer com status `healthy`. Confirme a conexão diretamente:

```bash
docker exec -it $(docker compose ps -q mongodb) mongosh --eval "db.adminCommand('ping')"
```

Deve responder `{ ok: 1 }`.

## 🔧 Commit sugerido

```bash
git add docker-compose.yml package.json
git commit -m "chore: adicionar mongodb via docker compose"
```

## 📚 Documentação Oficial

- **Docker** — documentação geral: https://docs.docker.com/
- **Docker Compose**: https://docs.docker.com/compose/
- **Compose — `healthcheck`**: https://docs.docker.com/reference/compose-file/services/#healthcheck
- **Imagem oficial `mongo` (Docker Hub)**: https://hub.docker.com/_/mongo
- **Docker — volumes**: https://docs.docker.com/engine/storage/volumes/
