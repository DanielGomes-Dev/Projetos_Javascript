// tests/setup/testDatabase.ts
//
// Helper de apoio para os testes de integração (Fase 7.3): garante que
// cada teste começa com as tabelas VAZIAS, sem depender da ordem de
// execução dos outros testes, e fecha TODAS as conexões abertas ao
// importar a aplicação (Postgres, Redis, fila BullMQ) ao final da
// suíte — sem isso, o Jest fica "pendurado" esperando o processo
// terminar, porque essas conexões mantêm o event loop vivo.

import { sequelize } from '../../src/models/index.js';
import { redisConnection } from '../../src/config/redis.js';
import { lawsuitSyncQueue } from '../../src/queues/lawsuitSync.queue.js';

/**
 * Apaga todas as linhas de todas as tabelas gerenciadas pelo Sequelize
 * (`cascade: true` faz o Postgres limpar junto quem depende via FK).
 *
 * Preferimos isto a recriar o schema do zero a cada teste
 * (`sequelize.sync({ force: true })`): é bem mais rápido, e o schema
 * já é gerenciado pelas migrations — rodadas uma única vez,
 * manualmente, contra o banco de teste, ANTES de `npm test` (ver Fase
 * 7.1: `npm run db:migrate:test`).
 */
export async function truncateAllTables(): Promise<void> {
  const models = Object.values(sequelize.models);
  for (const model of models) {
    await model.destroy({ where: {}, truncate: true, cascade: true, force: true });
  }
}

/**
 * Fecha a conexão do Sequelize, a fila BullMQ e a conexão Redis
 * compartilhada. Chame isto UMA VEZ, num `afterAll`, ao final de cada
 * arquivo de teste que importa `src/app.ts` (que, transitivamente, via
 * o Bull Board, já abre uma conexão Redis e cria a fila — mesmo que o
 * teste em si nunca dispare um job).
 *
 * Nota: `lawsuitSyncQueue.close()` NÃO fecha a conexão Redis
 * subjacente quando ela foi criada FORA do BullMQ (é o nosso caso —
 * `redisConnection`, de config/redis.ts, é compartilhada e "dona" de
 * si mesma). Por isso fechamos as duas coisas separadamente.
 */
export async function closeTestDatabase(): Promise<void> {
  await lawsuitSyncQueue.close();
  await sequelize.close();
  await redisConnection.quit();
}
