# 19 — Encerramento Gracioso e Amarrando Tudo

## 🎯 Objetivo

Fechar as pontas soltas de infraestrutura: garantir que os índices de todos os models estão prontos **antes** da API aceitar tráfego (não só nos testes), e que a aplicação encerra de forma limpa — sem deixar conexões penduradas nem cortar uma matrícula em processamento no meio.

## Por que isso importa, concretamente

Até aqui, `Model.init()` (que espera os índices únicos terminarem de ser construídos) só era chamado no banco de teste (`tests/helpers/mongo.js`). Em desenvolvimento/produção, os índices ainda são criados automaticamente na primeira vez que cada model é usado (`autoIndex`, ligado por padrão fora de produção) — mas **de forma assíncrona, em segundo plano**, sem a aplicação esperar por isso. Isso significa que, por uma janela pequena logo depois do servidor subir, é tecnicamente possível duas requisições concorrentes escaparem de uma garantia de unicidade que ainda está sendo construída. Fechar essa janela é simples: esperar os índices antes de abrir a porta HTTP.

Do outro lado, um `Ctrl+C` ou um `docker stop` envia `SIGINT`/`SIGTERM` ao processo. Sem tratamento, o Node mata o processo imediatamente — inclusive no meio de uma matrícula sendo processada pela fila técnica (capítulo 13), ou com uma conexão de banco pendurada. Um encerramento gracioso resolve isso na ordem certa.

## 🟢 Código

Exporte `closeQueue` de `src/services/enrollments.service.js` (editando o arquivo do capítulo 18):

```javascript
// src/services/enrollments.service.js
// ... resto do arquivo sem alteração

async function closeQueue() {
  await queue.close();
}

module.exports = { createEnrollment, cancelEnrollment, listEnrollments, closeQueue };
```

Reescreva `src/server.js` por completo:

```javascript
// src/server.js
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const Student = require('./models/Student');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const { closeQueue } = require('./services/enrollments.service');

const PORT = process.env.PORT || 3333;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27028/desafio_senior';

let server;

async function bootstrap() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado com sucesso');

    await Promise.all([Student.init(), Course.init(), Enrollment.init()]);

    server = app.listen(PORT, () => {
      console.log(`Servidor rodando com sucesso na porta ${PORT}`);
      console.log(`Healthcheck: http://localhost:${PORT}/health`);
      console.log(`Cursos: http://localhost:${PORT}/courses`);
    });
  } catch (error) {
    console.error('❌ Falha ao inicializar o servidor:', error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n${signal} recebido, encerrando...`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await closeQueue();
    await mongoose.disconnect();
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();
```

> 💡 **Por que `Promise.all([Student.init(), Course.init(), Enrollment.init()])` acontece aqui, em produção/desenvolvimento, e não só nos testes?** É exatamente a mesma preocupação do `tests/helpers/mongo.js` (capítulos 09, 11 e 14), agora aplicada ao caminho real: sem esperar, o servidor anunciaria "no ar" antes dos índices únicos (`cpf`/`email` em `Student`, `codigo` em `Course`, `activeKey` em `Enrollment`) estarem garantidamente prontos. É um custo pequeno, pago uma única vez na inicialização, em troca de uma garantia real desde o primeiro request aceito.
>
> 💡 **Por que a ordem do `shutdown` é servidor HTTP → fila → banco, e não a ordem inversa?** Cada passo depende do anterior ainda estar de pé: `server.close()` primeiro **para de aceitar novas conexões**, mas deixa as requisições já em andamento terminarem naturalmente — se o banco fosse desconectado antes, essas requisições em andamento quebrariam no meio. `closeQueue()` em seguida espera o worker da fila técnica (se o driver Redis estiver ativo) terminar o job que estiver processando, em vez de abandoná-lo pela metade. Só depois de tudo isso é seguro fechar a conexão com o MongoDB.
>
> 💡 **Por que `server.close(resolve)` é envolvido numa `Promise`, se `.close()` já aceita um callback?** `server.close()` é uma API baseada em callback (um padrão mais antigo do Node); envolvê-la numa `Promise` permite usar `await` e mantém o `shutdown` inteiro no mesmo estilo `async`/`await` do resto do arquivo, sem misturar os dois estilos.
>
> ⚠️ **`process.exit(0)` está dentro de um `finally`, não depois do `try`.** Isso garante que o processo termina mesmo que `closeQueue()` ou `mongoose.disconnect()` rejeitem por algum motivo — um encerramento gracioso que trava para sempre por causa de um erro na própria rotina de encerramento seria pior do que simplesmente sair.

## ✅ Como confirmar que funcionou

```bash
npm test
```

A suíte inteira deve continuar passando (nenhum comportamento de teste muda — este capítulo afeta só o caminho de produção/desenvolvimento, `src/server.js`, que os testes de integração não exercitam diretamente, porque eles importam `src/app.js` sem passar por `bootstrap()`).

Manualmente:

```bash
npm run db:up
npm run dev
```

Pressione `Ctrl+C` no terminal do servidor. Deve aparecer, na ordem: `SIGINT recebido, encerrando...`, seguido do processo terminando limpo (sem travar, sem stack trace de erro).

## 🔧 Commit sugerido

```bash
git add src/services/enrollments.service.js src/server.js
git commit -m "feat: aguardar indices na inicializacao e encerrar graciosamente"
```

## 📚 Documentação Oficial

- **Node.js — sinais de processo (`SIGINT`/`SIGTERM`)**: https://nodejs.org/api/process.html#signal-events
- **Node.js — `server.close()`**: https://nodejs.org/api/http.html#serverclosecallback
- **Mongoose — `Model.init()`**: https://mongoosejs.com/docs/api/model.html#Model.init()
- **Mongoose — `disconnect()`**: https://mongoosejs.com/docs/api/mongoose.html#Mongoose.prototype.disconnect()
