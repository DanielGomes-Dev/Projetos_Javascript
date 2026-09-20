// jest.config.cjs
//
// Extensão .cjs pelo mesmo motivo de sempre neste projeto: o
// package.json tem "type": "module", e o Jest carrega este arquivo de
// configuração com require() (CommonJS) por baixo dos panos.

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Onde encontrar os testes — mantemos tudo fora de src/, numa pasta
  // tests/ dedicada, espelhando (mas não misturando) a estrutura do
  // código de produção.
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  // Roda ANTES de qualquer arquivo de teste (e antes de qualquer
  // módulo da aplicação) ser importado. É aqui que garantimos que a
  // aplicação (que faz dotenv.config() internamente, em vários
  // arquivos) vai se conectar ao banco e ao Redis de TESTE, nunca aos
  // de desenvolvimento — ver tests/setup/env.cjs.
  setupFiles: ['<rootDir>/tests/setup/env.cjs'],

  // O código-fonte usa a sintaxe NodeNext (imports terminando em ".js"
  // mesmo apontando para arquivos ".ts" — ver Fase 1.2). O ts-jest,
  // rodando com uma configuração separada em CommonJS
  // (tsconfig.jest.json, abaixo), não entende essa reescrita
  // automaticamente. Este mapa diz ao Jest "quando vir um import
  // terminando em .js, procure o arquivo SEM essa extensão" — deixando
  // o próprio Jest resolver para o .ts real, do jeito que ele já sabe fazer.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },

  // Evita que o Jest tente rodar como teste os artefatos compilados
  // (dist/) ou qualquer coisa dentro de node_modules.
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  clearMocks: true,
};
