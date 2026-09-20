// src/config/redis.ts
//
// Import nomeado em vez de default: sob moduleResolution "NodeNext" o
// interop do export default do ioredis é inconsistente entre versões,
// e o import nomeado evita o erro "This expression is not constructable".


import {Redis as IORedis} from 'ioredis'


import dotenv from 'dotenv';

dotenv.config();


/**
 * Conexão Redis compartilhada entre Queue (producer) e Worker (consumer).
 *
 * `maxRetriesPerRequest: null` é exigido pelo BullMQ: sem isso, o cliente
 * ioredis desiste de comandos bloqueantes internos (usados pelo BullMQ para
 * esperar por novos jobs) depois de poucas tentativas, e a lib lança erro.
 */

export const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
})


redisConnection.on('error', (err: Error) => {
    console.error('[redis] Erro de conexão: ', err.message);
})

