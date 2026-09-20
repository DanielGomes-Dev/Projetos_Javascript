// tests/setup/env.cjs
//
// Jest "setupFiles": roda ANTES de qualquer arquivo de teste (e antes
// de qualquer módulo da aplicação) ser importado. É o único lugar
// seguro para preparar variáveis de ambiente que o restante do app
// (config/database.ts, config/redis.ts, etc.) vai ler durante o import
// — se esperássemos até dentro de um arquivo de teste normal, algum
// módulo já teria sido importado (e já teria lido process.env) antes
// de nós conseguirmos mudar qualquer coisa.

process.env.NODE_ENV = 'test';

// Os testes SEMPRE rodam no HOST (fora do Docker), mesmo que o
// Postgres e o Redis estejam containerizados. "db" e "redis" só
// resolvem como hostname DENTRO da rede do docker-compose (Fase 1) —
// do lado de fora, alcançamos os mesmos serviços via localhost, nas
// portas que o docker-compose já expõe (5432 e 6379).
process.env.DB_HOST = 'localhost';
process.env.REDIS_HOST = 'localhost';

// Redireciona a conexão do Sequelize para o banco de TESTE
// (juris_db_test) — o mesmo nome que `src/config/config.cjs` já usa
// para o ambiente "test" desde a Fase 2; reaproveitamos essa convenção
// em vez de inventar uma nova.
//
// Importante: `dotenv.config()` (chamado dentro de database.ts,
// redis.ts, etc.) NUNCA sobrescreve uma variável que já existe em
// process.env. Como este arquivo roda ANTES de qualquer import da
// aplicação, definir DB_NAME aqui garante que o valor lido do .env,
// mais tarde, não vai "vencer" por engano.
process.env.DB_NAME = `${process.env.DB_NAME || 'juris_db'}_test`;
