'use strict';
const roller = require('./dice-roller');
const validator = require('./validator');
const base64url = require('base64-url');

module.exports = function(router){
	router.get('/verify/:diceArray/:signature/:date', handleVerify);
	router.post('/roll', registrationMiddleware, handleRoll);
	return router;
};

function registrationMiddleware(req, res, next){
	next();
}

function handleRoll(req, res){
	req.params.max = parseInt(req.params.max);
	req.params.times = parseInt(req.params.times);
	if(validateRollArgs(req, res)){
		roller.roll(req.params.max, req.params.times, dice => {
			const now = new Date();
			validator.sign(pushToCopy(dice, now.getTime()), signature => res.json({
				status: 'OK',
				result: {
					dice: dice,
					signature: {
						plain: signature,
						urlescaped: base64url.escape(signature)
					},
					date: now.toISOString()
				}
			}));
		});
	}
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
		return false;
	}
	return true;
}

function handleVerify(req, res){
	req.params.signature = base64url.unescape(req.params.signature);
	if(validateVerifyArgs(req, res)){
		const queryDate = new Date(req.params.date);
		req.params.diceArray.push(queryDate.getTime());
		validator.verify(pushToCopy(req.params.diceArray, queryDate), req.params.signature, valid => res.json({
			status: 'OK',
			valid: valid
		}));
	}
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
		return false;
	}
	return true;
}

function pushToCopy(array, object){
	const copy = array.slice();
	array.push(object);
	return copy;
}
