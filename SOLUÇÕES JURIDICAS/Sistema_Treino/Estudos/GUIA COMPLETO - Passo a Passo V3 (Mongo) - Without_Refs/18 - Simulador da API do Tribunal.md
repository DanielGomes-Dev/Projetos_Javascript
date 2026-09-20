# 18 — Simulador da API do Tribunal

## 🎯 Objetivo

Criar uma função que se comporta como uma integração externa de verdade (com latência e falhas aleatórias), sem depender de nenhum serviço real — para que o retry e a Dead Letter Queue (passo 22) sejam **testáveis**.

## 📝 Código

Crie `src/workers/tribunalApi.simulator.ts`:

```typescript
// src/workers/tribunalApi.simulator.ts

/**
 * Simula uma chamada a uma API externa de Tribunais/Diário Oficial.
 *
 * Enquanto a integração real não existe, este módulo introduz um delay
 * artificial e falha aleatoriamente uma fração das vezes, para
 * exercitar o retry/backoff do BullMQ e, eventualmente, a DLQ.
 *
 * Basta trocar o corpo desta função por uma chamada HTTP real quando a
 * integração verdadeira for implementada — quem a consome (o Worker,
 * próximo passo) não precisa mudar.
 */

export interface TribunalMovementResult {
  description: string;
  date: Date;
}

const ARTIFICIAL_DELAY_MS_MIN = 500;
const ARTIFICIAL_DELAY_MS_MAX = 2500;
const SIMULATED_FAILURE_RATE = 0.25; // 25% das chamadas "falham" de propósito

function randomDelay(): Promise<void> {
  const ms = ARTIFICIAL_DELAY_MS_MIN + Math.random() * (ARTIFICIAL_DELAY_MS_MAX - ARTIFICIAL_DELAY_MS_MIN);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SAMPLE_MOVEMENT_DESCRIPTIONS = [
  'Publicação de despacho no Diário Oficial.',
  'Juntada de petição da parte autora.',
  'Audiência de conciliação designada.',
  'Decisão interlocutória proferida.',
  'Expedição de ofício.',
];

export async function fetchTribunalMovements(cnjNumber: string): Promise<TribunalMovementResult[]> {
  await randomDelay();

  if (Math.random() < SIMULATED_FAILURE_RATE) {
    throw new Error(`Falha simulada ao consultar o tribunal para o processo ${cnjNumber} (timeout/instabilidade).`);
  }

  const count = 1 + Math.floor(Math.random() * 3);
  const movements: TribunalMovementResult[] = [];

  for (let i = 0; i < count; i += 1) {
    const description =
      SAMPLE_MOVEMENT_DESCRIPTIONS[Math.floor(Math.random() * SAMPLE_MOVEMENT_DESCRIPTIONS.length)];
    movements.push({ description, date: new Date() });
  }

  return movements;
}
```

> 💡 **Isso é um exemplo de inversão de dependência na prática.** O Worker (próximo passo) vai depender apenas da **assinatura** desta função (`cnjNumber` entra, uma lista de movimentações sai), não de **como** ela é implementada por dentro. Trocar a simulação por uma chamada `fetch()` real, no futuro, é uma mudança isolada neste único arquivo — nada mais no projeto precisa saber que isso mudou.

## ✅ Como confirmar que funcionou

Ainda não existe nada chamando esta função de dentro da aplicação — teste isolado, direto:

```typescript
// teste-simulador.ts (temporário, na raiz)
import { fetchTribunalMovements } from './src/workers/tribunalApi.simulator.js';

fetchTribunalMovements('0001234-56.2024.8.19.0001')
  .then((m) => console.log('Sucesso:', m))
  .catch((e) => console.error('Falha simulada:', e.message));
```

```bash
npx tsx teste-simulador.ts
```

Rode algumas vezes — você deve ver tanto o caminho de sucesso quanto, ocasionalmente (~25% das vezes), a falha simulada. Apague o arquivo depois.

## 🔧 Commit sugerido

```bash
git add src/workers/tribunalApi.simulator.ts
git commit -m "feat: adicionar simulador da api do tribunal"
```
