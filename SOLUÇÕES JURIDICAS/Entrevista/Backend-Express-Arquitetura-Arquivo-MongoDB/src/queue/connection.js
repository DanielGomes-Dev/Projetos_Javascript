let connection;

function getRedisConnection() {
  if (!connection) {
    const IORedis = require('ioredis');
    const url = process.env.REDIS_URL || 'redis://localhost:6380';
    connection = new IORedis(url, {
      maxRetriesPerRequest: null
    });
  }
  return connection;
}

async function closeRedisConnection() {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}

module.exports = { getRedisConnection, closeRedisConnection };
