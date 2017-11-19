'use strict';
const roller = require('./dice-roller');
const validator = require('./validator');
const base64url = require('base64-url');
const async = require('async');

module.exports = function(router){
	router.get('/verify/:diceArray/:signature/:date', handleVerify);
	router.post('/roll', registrationMiddleware, handleRoll);
	return router;
};

function registrationMiddleware(req, res, next){
	next();
}

function handleRoll(req, res){
	async.waterfall([
		callback => {
			req.params.max = parseInt(req.params.max);
			req.params.times = parseInt(req.params.times);
			callback(validateRollArgs(req, res), req.params.max, req.params.times);
		},
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

function validateRollArgs(req, res){
	const errors = [];
	function validateIntParam(name){
		if(!req.params[name]){
			errors.push(name + ' parameter is not defined');
		} else if(!Number.isInteger(req.params[name])){
			errors.push(name + ' parameter is not a valid number');
		}
	}
	validateIntParam('max');
	validateIntParam('times');
	if(errors.length > 0){
		res.status(422).json({
			status: 'Error',
			errors: errors
		});
		return 'Invalid Parameters';
	}
	return null;
}

function handleVerify(req, res){
	async.waterfall([
		callback => {
			req.params.signature = base64url.unescape(req.params.signature);
			callback(validateVerifyArgs(req, res));
		},
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

function validateVerifyArgs(req, res){
	const errors = [];
	if(typeof req.params.diceArray === 'string'){
		try {
			req.params.diceArray = JSON.parse(req.params.diceArray);
		} catch(e){
			if(!(e instanceof SyntaxError)){
				throw e;
			} else {
				errors.push('The supplied diceArray parameter is invalid JSON');
			}
		}
	}
	if(errors.length === 0){
		if(Array.isArray(req.params.diceArray)){
			req.params.diceArray = req.params.diceArray.map(o => parseInt(o));
			if(req.params.diceArray.some(Number.isNaN)){
				errors.push('The provided diceArray parameter contains values other than integers');
			}
		} else{
			errors.push('The provided diceArray parameter is not an array');
		}
	}
	if(req.params.signature.length !== 684){
		errors.push('The provided signature has a wrong length');
	}
	if(errors.length > 0){
		res.status(422).json({
			status: 'Error',
			errors: errors
		});
		return 'Invalid Parameters';
	}
	return null;
}

function pushToCopy(array, object){
	const copy = array.slice();
	array.push(object);
	return copy;
}
