export default {
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 5_000,
  },
}
