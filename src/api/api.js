'use strict';
const roller = require('./dice-roller');
const validator = require('./validator');
const base64url = require('base64-url');
const async = require('async');
const emailManager = require('./email-manager.js');
const dbhandler = require('./db-handler');

const registrationMiddleware = (req, res, next) => {
	const errors = [];
	async.each([req.body.email1, req.body.email2], (email, callback) => {
		dbhandler.checkMail(email, result => {
			if(!result){
				errors.push('Email "' + email +'" not registered.');
			}
			callback();
		});
	}, () => {
		if(errors.length > 0){
			res.status(403).json({
				status: 'Error',
				errors: errors
			});
		} else {
			next();
		}
	});
}

const handleRoll = (req, res) => {
	async.waterfall([
		callback => {
			req.params.max = parseInt(req.params.max);
			req.params.times = parseInt(req.params.times);
			callback(null, req, res);
		},
		validateRollArgs,
		callback => callback(null, req.params.max, req.params.times),
		roller.roll,
		(dice, callback) => {
			const now = new Date();
			async.waterfall([
				callback => callback(pushToCopy(dice, now.getTime())),
				validator.sign
			], (error, signature) => {
				res.json({
					status: 'OK',
					result: {
						dice: dice,
						signature: {
							plain: signature,
							urlescaped: base64url.escape(signature)
						},
						date: now.toISOString()
					}
				});
			});
			callback(null);
		}]);
}

const validateRollArgs = (req, res, callback) => {
	const errors = [];
	async.each(['max', 'times'], (name, callback) => {
		if(!req.params[name]){
			errors.push(name + ' parameter is not defined');
		} else if(!Number.isInteger(req.params[name])){
			errors.push(name + ' parameter is not a valid number');
		}
		callback();
	},
	() => {
		if(errors.length > 0){
			res.status(422).json({
				status: 'Error',
				errors: errors
			});
			callback(errors);
		} else {
			callback(null);
		}
	});
}

const handleVerify = (req, res) => {
	async.waterfall([
		callback => {
			req.params.signature = base64url.unescape(req.params.signature);
			callback(null, req, res);
		},
		validateVerifyArgs,
		callback => {
			req.params.diceArray.push(new Date(req.params.date).getTime());
			callback(null, req.params.diceArray, req.params.signature);
		},
		validator.verify,
		(valid, callback) => {
			res.json({
				status: 'OK',
				valid: valid
			});
			callback(null);
		}
	]);
}

const validateVerifyArgs = (req, res, callback) => {
	const errors = [];
	async.waterfall([
		callback => {
			try {
				req.params.diceArray = JSON.parse(req.params.diceArray);
			} catch(e){
				if(!(e instanceof SyntaxError)){
					return callback(e);
				} else {
					errors.push('The supplied diceArray parameter is invalid JSON.');
				}
			}
			callback();
		},
		callback => {
			if(errors.length === 0){
				if(Array.isArray(req.params.diceArray)){
					req.params.diceArray = req.params.diceArray.map(o => parseInt(o));
					if(req.params.diceArray.some(Number.isNaN)){
						errors.push('The provided diceArray parameter contains values other than integers.');
					}
				} else{
					errors.push('The provided diceArray parameter is not an array.');
				}
			}
			callback();
		}
	]);
	if(req.params.signature.length !== 684){
		errors.push('The provided signature has a wrong length.');
	}
	if(errors.length > 0){
		res.status(422).json({
			status: 'Error',
			errors: errors
		});
		callback(errors);
	} else {
		callback(null);
	}
}

const handleEmailRegister = (req, res) => {
	if(req.body.token){
		if(!emailManager.verifyEmail(req.params.email, base64url.unescape(req.params.token),
			() => res.status(200).json({status: 'OK'}))){
			res.status(403).json({
				status: 'Error',
				errors: 'invalid Token or mail.'
			});
		}
	} else {
		emailManager.registerEmail(req.body.email);
		res.status(200).json({status: 'OK'});
	}
}

const handleEmailUnregister = (req, res) => {
	emailManager.unregisterEmail(req.body.email, rowCount => {
		if(rowCount == 1){
			res.status(200).json({status: 'OK'});
		} else if(rowCount == 0){
			res.status(412).json({
				status: 'Error',
				errors: ['Email "' + req.body.email + '" does not exist in the database.']
			});
		}
	});
}

const pushToCopy = (array, object) => {
	const copy = array.slice();
	array.push(object);
	return copy;
}

module.exports = (router) => {
	router.get('/verify/:diceArray/:signature/:date', handleVerify);
	router.post('/roll', registrationMiddleware, handleRoll);
	router.post('/register', handleEmailRegister);
	router.post('/unregister', handleEmailUnregister);
	return router;
};
