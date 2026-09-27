const pg = require('pg-promise')({
  // Fires for every driver error, including dropped connections that no
  // query is around to catch. Only the message: params carry emails.
  error(err, e) {
    console.error('[db] %s error: %s', e.cn ? 'connection' : 'query', err.message);
  },
});

// Emails are stored as typed at registration but matched case-insensitively,
// so mixed-case rows registered before addresses were normalized still work.
class DbHandler {
  constructor({
    username, password, host, port, database,
  }) {
    this.db = pg({
      host,
      port,
      database,
      user: username,
      password,
      connectionTimeoutMillis: 5000,
    });
  }

  // Runs at every startup against a table that may already exist with the
  // old varchar(65) column; widening a varchar is metadata-only in Postgres.
  setupDb() {
    return this.db.none(`
      CREATE TABLE IF NOT EXISTS users (email varchar(254) NOT NULL PRIMARY KEY);
      ALTER TABLE users ALTER COLUMN email TYPE varchar(254);
    `);
  }

  ping() {
    return this.db.one('SELECT 1');
  }

  // Idempotent, so two clicks racing on the same confirm link both succeed.
  addUser(email) {
    return this.db.none('INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', email);
  }

  removeUser(email) {
    return this.db.result('DELETE FROM users WHERE lower(email) = lower($1)', email, (r) => r.rowCount);
  }

  checkMail(email) {
    return this.db.oneOrNone('SELECT email FROM users WHERE lower(email) = lower($1) LIMIT 1', email);
  }

  close() {
    return this.db.$pool.end();
  }
}

module.exports = DbHandler;
