'use strict';
const dbconfig = require('nconf').get('database');
const pg = require('pg-promise');
const PreparedStatement = pg.PreparedStatement;
const db = pg()('postgres://' + dbconfig.username + ':' + dbconfig.password + '@' + dbconfig.host + ':' + dbconfig.port + '/' + dbconfig.database);

const handler = {};

handler.setupDb = function(){
	db.none('CREATE TABLE IF NOT EXISTS users (email varchar(65) NOT NULL PRIMARY KEY);')
		.catch(reportError('Failed to create the users table', true));
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
};

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
	};
}

module.exports = handler;
