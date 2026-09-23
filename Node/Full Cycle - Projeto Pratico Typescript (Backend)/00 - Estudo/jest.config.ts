import type {Config} from 'jest';

const config: Config = {  
  coverageProvider: "v8",
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
  coverageDirectory: '../coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/*.spec.ts',
  ],
  rootDir: "src",
  testRegex: ".*\\..*spec\\.ts$",
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  clearMocks: true
};

export default config;