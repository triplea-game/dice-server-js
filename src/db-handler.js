'use strict';
const dbconfig = require('nconf').get('database');
const pg = require('pg-promise');
const PreparedStatement = pg.PreparedStatement;
const db = pg()('postgres://' + dbconfig.username + ':' + dbconfig.password + '@' + dbconfig.host + ':' + dbconfig.port + '/' + dbconfig.database);

const handler = {};

handler.setupDb = function(){
  db.none('CREATE TABLE IF NOT EXISTS keys (private_key char(3292) NOT NULL, public_key char(812) NOT NULL, creation_date timestamptz NOT NULL PRIMARY KEY DEFAULT CURRENT_TIMESTAMP);')
  .catch(reportError('Failed to create the key table', true));
  db.none('CREATE TABLE IF NOT EXISTS users (email varchar(65) NOT NULL PRIMARY KEY);')
  .catch(reportError('Failed to create the users table', true));
};

handler.insertKeyPair = function(privateKey, publicKey, callback){
  db.none(new PreparedStatement('insert-key-pair', 'INSERT INTO keys (private_key, public_key) VALUES ($1, $2);', [privateKey, publicKey]))
  .then(callback)
  .catch(reportError('Failed to insert a new keypair', true));
};

handler.getPrivateKey = function(callback){
  db.oneOrNone(new PreparedStatement('get-private-key', 'SELECT private_key FROM keys ORDER BY NOW() - creation_date LIMIT 1;'))
  .then(result => callback(result ? result['private_key'] : null, result ? new Date(result['creation_date']) : null))
  .catch(reportError('Failed to retrieve latest private Key', true));
};

handler.getPublicKey = function(date, callback, errcallback){
  db.oneOrNone(new PreparedStatement('get-public-key', 'SELECT public_key FROM keys WHERE to_timestamp($1) > creation_date ORDER BY NOW() - creation_date LIMIT 1;', [date.getTime() / 1000]))
  .then(result => {
    if(result){
      callback(result['public_key'])
    } else {
      errcallback('Date too old, unable to confirm');
    }
  })
  .catch(reportError('Failed to retrieve latest public key for date ' + date, false, errcallback));
};

handler.addUser = function(email, callback){
  db.none(new PreparedStatement('add-user', 'INSERT INTO users (email) VALUES ($1)', [email]))
  .catch(reportError('Failed to add User with email ' + email, false, callback));
};

handler.removeUser = function(email, callback){
  db.none(new PreparedStatement('remove-user', 'DELETE FROM users WHERE email=$1', [email]))
  .catch(reportError('Failed to remove user with email ' + email, false, callback));
};

handler.ifMailRegistered = function(email, callback, error){
  db.one(new PreparedStatement('check-user', 'SELECT email FROM users WHERE email=$1', [email]))
  .then(callback)
  .catch(reportError('Something went wrong while checking for user with email: ' + email, true, error));
}

function reportError(string, severe, callback){
  return function(e){
    if(e){
      console.error(e);
      if(severe){
        console.error(string);
        throw e;
      } else if(callback){
        callback(string);
      }
    }
  }
}

module.exports = handler;
