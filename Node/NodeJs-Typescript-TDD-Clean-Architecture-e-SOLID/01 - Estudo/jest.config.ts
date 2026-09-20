import type { Config } from 'jest'

const config: Config = {

  roots: ['<rootDir>/src'],
  // clearMocks: true,
  // collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/main/**'
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'babel',
  testEnvironment: 'node',
  // preset: '@shelf/jest-mongodb',

  transform: {
    '.+\\.ts$': 'ts-jest'
  }

  // moduleNameMapper: {
  //   '@/tests/(.*)': '<rootDir>/tests/$1',
  //   '@/(.*)': '<rootDir>/src/$1'
  // }

}

export default config
