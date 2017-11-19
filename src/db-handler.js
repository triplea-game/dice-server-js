'use strict';
const dbconfig = require('nconf').get('database');
const pg = require('pg-promise');
const PreparedStatement = pg.PreparedStatement;
const db = pg()('postgres://' + dbconfig.username + ':' + dbconfig.password + '@' + dbconfig.host + ':' + dbconfig.port + '/' + dbconfig.database);

const handler = {};

handler.setupDb = function(){
	db.none('CREATE TABLE IF NOT EXISTS users (email varchar(65) NOT NULL PRIMARY KEY);')
		.catch(reportError('Failed to create table "users"'));
};

handler.addUser = function(email, callback){
	db.none(new PreparedStatement('add-user', 'INSERT INTO users (email) VALUES ($1)', [email]))
		.then(callback)
		.catch(reportError('Failed to add email "' + email + '" to the database.'));
};

handler.removeUser = function(email, callback){
	db.result(new PreparedStatement('remove-user', 'DELETE FROM users WHERE email=$1', [email]))
		.then(callback)
		.catch(reportError('Failed to remove email "' + email + '" from the database.'));
};

handler.checkMail = function(email, callback){
	db.oneOrNone(new PreparedStatement('check-user', 'SELECT email FROM users WHERE email=$1', [email]))
		.then(callback)
		.catch(reportError('Failed to query email: ""' + email + '" from the database.'));
};

function reportError(message){
	return function(e){
		console.error(message);
		console.error(e);
	};
}

module.exports = handler;
