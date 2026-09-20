# 26 — Script de Teste do WebSocket

## 🎯 Objetivo

Um cliente de terminal dedicado para validar manualmente o fluxo completo (passos 24 e 25) de ponta a ponta — bem mais claro do que testar WebSocket "na mão" com ferramentas genéricas de `curl`.

## 📝 Código

Crie `src/scripts/testeSocket.ts`:

```typescript
// src/scripts/testeSocket.ts
//
// Script de teste MANUAL — não faz parte da aplicação (não é
// importado por nada em src/), só um cliente de terminal para validar
// o fluxo Worker → WebSocket → Cliente de ponta a ponta.
//
// Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>
import { io as ioClient } from 'socket.io-client';

const cnjNumber = process.argv[2];

if (!cnjNumber) {
  console.error('Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>');
  process.exit(1);
}

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const socket = ioClient(SERVER_URL);

socket.on('connect', () => {
  console.log(`[teste-socket] Conectado (${socket.id}). Entrando na sala do processo ${cnjNumber}...`);
  socket.emit('join-lawsuit', cnjNumber);
  console.log('[teste-socket] Aguardando evento "lawsuit:updated"... (Ctrl+C para sair)');
});

socket.on('lawsuit:updated', (payload) => {
  console.log('[teste-socket] 🔔 lawsuit:updated recebido:');
  console.log(JSON.stringify(payload, null, 2));
});

socket.on('disconnect', () => {
  console.log('[teste-socket] Desconectado.');
});
```

## ✅ Como confirmar que funcionou

Com a API e o Worker rodando (`npm run dev` e `npm run worker`, ou via Docker):

```bash
# Terminal 1: entre na sala do processo e deixe rodando
npx tsx src/scripts/testeSocket.ts 0007777-33.2024.8.19.0001
```

```bash
# Terminal 2: dispare a importação em lote para esse mesmo CNJ
curl -X POST http://localhost:3000/api/lawsuits/batch-import \
  -H "Content-Type: application/json" \
  -d '{"items":[{"cnjNumber":"0007777-33.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}]}'
```

No Terminal 1, assim que o Worker terminar de processar o job, o evento `lawsuit:updated` deve aparecer sozinho — sem você precisar consultar nada manualmente. Isso confirma o fluxo inteiro: API → fila → Worker → banco → `QueueEvents` → Socket.IO → seu cliente.

## 🔧 Commit sugerido

```bash
git add src/scripts/testeSocket.ts
git commit -m "chore: adicionar script manual de teste do websocket"
```
