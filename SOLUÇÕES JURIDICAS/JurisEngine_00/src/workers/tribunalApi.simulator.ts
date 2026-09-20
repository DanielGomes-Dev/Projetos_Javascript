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