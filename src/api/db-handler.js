const pg = require('pg-promise')();

class Handler {
  constructor({ username, password, host, port, database}) {
    this.db = pg(`postgres://${username}:${password}@${host}:${port}/${database}`);
    this.setupDb();
  }

  setupDb() {
    this.db.none('CREATE TABLE IF NOT EXISTS users (email varchar(65) NOT NULL PRIMARY KEY);')
    .catch((e) => {
      console.error('Failed to create table "users"');
      console.error(e);
    })
  }

  addUser(email) {
    return this.db.none('INSERT INTO users (email) VALUES ($1)', email);
  }

  removeUser(email) {
    return this.db.result('DELETE FROM users WHERE email=$1', email, r => r.rowCount);
  }

  checkMail(email) {
    return this.db.oneOrNone('SELECT email FROM users WHERE email=$1', email);
  }
}

module.exports = Handler;
