// Runs the users-store contract against DbHandler on the real Postgres from
// test/e2e/compose.yml (via `just e2e`). Guards pg-promise and Postgres bumps.
const { describeUsersContract } = require('./users-contract');
const DbHandler = require('../../src/api/db-handler');
const { stackEnv } = require('../e2e/stack');

const config = {
  username: 'postgres',
  password: 'e2e',
  host: process.env.E2E_DB_HOST || 'localhost',
  port: Number(stackEnv('E2E_DB_PORT')),
  database: 'dicedb',
};
const handler = new DbHandler(config);
beforeAll(() => handler.setupDb());
afterAll(() => handler.close());

describeUsersContract('DbHandler on Postgres', () => handler, () => new DbHandler(config));

describe('DbHandler setup on an existing table', () => {
  it('widens the old varchar(65) column in place, keeping its rows and without rewriting the table', async () => {
    const email = `widen-${Date.now()}@example.com`;
    await handler.db.none('ALTER TABLE users ALTER COLUMN email TYPE varchar(65)');
    await handler.addUser(email);
    const before = await handler.db.one('SELECT pg_relation_filenode($1) AS node', 'users');

    await handler.setupDb();

    const after = await handler.db.one('SELECT pg_relation_filenode($1) AS node', 'users');
    const column = await handler.db.one(
      "SELECT character_maximum_length AS width FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email'",
    );
    expect(column.width).toBe(254);
    expect(after.node).toBe(before.node);
    expect(await handler.checkMail(email)).toEqual({ email });
    await handler.removeUser(email);
  });
});

describe('DbHandler on an unreachable Postgres', () => {
  it('fails setup, so the server refuses to start instead of serving without a users table', async () => {
    const unreachable = new DbHandler({
      username: 'postgres', password: 'e2e', host: 'localhost', port: 1, database: 'dicedb',
    });

    await expect(unreachable.setupDb()).rejects.toThrow();
    await unreachable.close();
  });
});
