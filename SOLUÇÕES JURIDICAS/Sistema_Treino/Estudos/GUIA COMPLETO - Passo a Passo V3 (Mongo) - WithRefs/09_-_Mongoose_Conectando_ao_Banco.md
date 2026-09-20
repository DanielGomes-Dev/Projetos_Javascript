# 09 — Mongoose: Conectando ao Banco

## 🎯 Objetivo

Instalar o ODM (*Object-Document Mapper* — o equivalente a um ORM, mas para bancos orientados a documento) e configurar a conexão com o MongoDB — ainda **sem nenhuma coleção**. Este passo é só sobre a "cola" entre a aplicação e o banco existir e funcionar.

## 📦 Instalar

```bash
npm install mongoose
```

> **`mongoose`** — o ODM: mapeia coleções do MongoDB para *schemas*/classes TypeScript, com validação, valores padrão e um sistema de "modelos" bem parecido, na superfície, com o que o Sequelize oferecia na V2 — mas por baixo, os dois resolvem problemas diferentes (tabelas relacionais vs. documentos), como você vai ver a partir do passo 10.
>
> 💡 **Sem uma CLI equivalente ao `sequelize-cli`.** Diferente da V2, não existe aqui uma ferramenta de linha de comando separada, nem um arquivo `.cjs` de configuração exigido por ela — toda a conexão vive dentro do próprio TypeScript da aplicação. Uma consequência direta disso aparece já no próximo passo: não existem *migrations*.

## 📝 Código

Crie `src/config/database.ts`:

```typescript
// src/config/database.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/juris_db';

mongoose.connect(MONGODB_URI).catch((err: Error) => {
  console.error('[mongoose] Falha ao conectar:', err.message);
});

mongoose.connection.on('connected', () => {
  console.log('[mongoose] Conectado ao MongoDB.');
});

mongoose.connection.on('error', (err: Error) => {
  console.error('[mongoose] Erro de conexão:', err.message);
});

export default mongoose;
```

> 💡 **Por que não existe um `await` esperando a conexão terminar antes do resto do código continuar (diferente do `sequelize.authenticate()` explícito que a V2 usava para testar a conexão)?** O Mongoose usa, por padrão, um **buffer de comandos** (`bufferCommands: true`): qualquer operação (`Model.find()`, `.create()`, etc.) chamada antes de a conexão terminar de abrir fica enfileirada em memória e é disparada automaticamente assim que a conexão fica pronta. Na prática, o pior cenário é a primeiríssima requisição da aplicação demorar alguns milissegundos a mais — nunca um erro. É por isso que este arquivo simplesmente dispara `mongoose.connect(...)` e segue em frente, sem bloquear o carregamento do resto da aplicação.

## ✅ Como confirmar que funcionou

Crie um script temporário para testar a conexão:

```typescript
// src/teste-conexao.ts
import mongoose from './config/database.js';

mongoose.connection.once('connected', async () => {
  console.log('Conexão com o banco estabelecida com sucesso!');
  await mongoose.disconnect();
});

mongoose.connection.once('error', () => {
  process.exit(1);
});
```

```bash
npx tsx src/teste-conexao.ts
```

Com o MongoDB do passo 08 rodando (`docker compose up -d mongo`) e a variável `MONGODB_URI` apontando para onde ele está acessível (`mongodb://localhost:27017/juris_db`, se você estiver rodando este script **fora** do Docker), deve imprimir a mensagem de sucesso. Apague `src/teste-conexao.ts` depois.

## 🔧 Commit sugerido

```bash
git add src/config/database.ts package.json package-lock.json
git commit -m "feat: configurar mongoose e conexao com o banco"
```

## 📚 Documentação Oficial

- **Mongoose — conexões**: https://mongoosejs.com/docs/connections.html
- **Mongoose — buffering de comandos (`bufferCommands`)**: https://mongoosejs.com/docs/faq.html#callback_never_executes
