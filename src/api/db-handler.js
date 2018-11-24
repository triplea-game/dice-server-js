const dbconfig = require('nconf').get('database');
// TODO connect elsewhere
const db = require('pg-promise')()(`postgres://${dbconfig.username}:${dbconfig.password}@${dbconfig.host}:${dbconfig.port}/${dbconfig.database}`);

const handler = {};

handler.setupDb = () => (
  db.none('CREATE TABLE IF NOT EXISTS users (email varchar(65) NOT NULL PRIMARY KEY);')
    .catch((e) => {
      console.error('Failed to create table "users"');
      console.error(e);
    })
);

handler.addUser = email => db.none('INSERT INTO users (email) VALUES ($1)', email);

handler.removeUser = email => db.result('DELETE FROM users WHERE email=$1', email, r => r.rowCount);

handler.checkMail = email => db.oneOrNone('SELECT email FROM users WHERE email=$1', email);

module.exports = handler;
