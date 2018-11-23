'use strict';
const dbconfig = require('nconf').get('database');
const db = require('pg-promise')()('postgres://' + dbconfig.username + ':' + dbconfig.password + '@' + dbconfig.host + ':' + dbconfig.port + '/' + dbconfig.database);

const reportError = (message) => (e) => {
		console.error(message);
		console.error(e);
};

const handler = {};

handler.setupDb = () => {
	db.none('CREATE TABLE IF NOT EXISTS users (email varchar(65) NOT NULL PRIMARY KEY);')
		.catch(reportError('Failed to create table "users"'));
};

handler.addUser = (email, callback) => {
	db.none('INSERT INTO users (email) VALUES ($1)', email)
		.then(callback)
		.catch(reportError('Failed to add email "' + email + '" to the database.'));
};

handler.removeUser = (email, callback) => {
	db.result('DELETE FROM users WHERE email=$1', email, r => r.rowCount)
		.then(callback)
		.catch(reportError('Failed to remove email "' + email + '" from the database.'));
};

handler.checkMail = (email, callback) => {
	db.oneOrNone('SELECT email FROM users WHERE email=$1', email)
		.then(callback)
		.catch(reportError('Failed to query email: ""' + email + '" from the database.'));
};

module.exports = handler;
