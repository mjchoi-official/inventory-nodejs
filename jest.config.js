/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // 테스트 파일 탐색 패턴
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],

  // 커버리지 대상
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',        // DB 연결 설정 제외
  ],

  // 전역 설정 파일
  globalSetup:    './__tests__/setup/globalSetup.js',
  globalTeardown: './__tests__/setup/globalTeardown.js',

  // 타임아웃
  testTimeout: 15000,

  // 출력 형식
  verbose: true,

  // 커버리지 리포트 형식
  coverageReporters: ['text', 'lcov', 'text-summary'],

  // 통합 테스트는 순차 실행
  projects: [
    {
      displayName: 'unit',
      testMatch:   ['**/__tests__/unit/**/*.test.js'],
      testEnvironment: 'node',
    },
    {
      displayName: 'integration',
      testMatch:   ['**/__tests__/integration/**/*.test.js'],
      testEnvironment: 'node',
      // 통합 테스트는 순차 실행 (DB 충돌 방지)
      runner: 'jest-runner',
    },
  ],
};
