// Runs the users-store contract against DbHandler on the real Postgres from
// test/e2e/compose.yml (via `just e2e`). Guards pg-promise and Postgres bumps.
const { describeUsersContract } = require('./users-contract');
const DbHandler = require('../../src/api/db-handler');

const handler = new DbHandler({
  username: 'postgres',
  password: 'e2e',
  host: process.env.E2E_DB_HOST || 'localhost',
  port: Number(process.env.E2E_DB_PORT || 15432),
  database: 'dicedb',
});
beforeAll(() => handler.setupDb());
afterAll(() => handler.close());

describeUsersContract('DbHandler on Postgres', () => handler);

describe('DbHandler on an unreachable Postgres', () => {
  it('fails setup, so the server refuses to start instead of serving without a users table', async () => {
    const unreachable = new DbHandler({
      username: 'postgres', password: 'e2e', host: 'localhost', port: 1, database: 'dicedb',
    });

    await expect(unreachable.setupDb()).rejects.toThrow();
    await unreachable.close();
  });
});
