const { getRedisConnection } = require('./connection');

const QUEUE_NAME = 'enrollments';


function resolveDriver() {
  if (process.env.QUEUE_DRIVER) return process.env.QUEUE_DRIVER;
  return process.env.NODE_ENV === 'test' ? 'memory' : 'redis';
}


function createMemoryDriver(handlers) {
  let tail = Promise.resolve();

  async function enqueue(name, data) {
    const run = tail.then(() => handlers[name](data));
    tail = run.catch(() => {}); // uma falha não deve travar a fila
    return run;
  }

  return { enqueue, close: async () => {} };
}


function createRedisDriver(handlers) {
  const { Queue, Worker, QueueEvents } = require('bullmq');
  const connection = getRedisConnection();
  const queue = new Queue(QUEUE_NAME, { connection });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  const worker = new Worker(
    QUEUE_NAME,
    (job) => handlers[job.name](job.data),
    { connection, concurrency: 1 }
  );

  const ready = Promise.all([queueEvents.waitUntilReady(), worker.waitUntilReady()]);

  async function enqueue(name, data) {
    await ready;
    const job = await queue.add(name, data);
    return job.waitUntilFinished(queueEvents);
  }

  async function close() {
    await Promise.all([worker.close(), queueEvents.close(), queue.close()]);
  }

  return { enqueue, close };
}

function buildDriver(handlers) {
  return resolveDriver() === 'redis' ? createRedisDriver(handlers) : createMemoryDriver(handlers);
}

module.exports = { buildDriver };
